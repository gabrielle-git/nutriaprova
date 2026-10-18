-- =============================================================================
-- Etapa 1E.3A — Integridade de public.transactions (SEC-008)
-- =============================================================================
-- Depende da 1E.1B (writers econômicos SECURITY DEFINER) e da 1E.2B.
--
-- Modelo:
--   * anon/authenticated não escrevem diretamente em public.transactions.
--   * Todo INSERT legítimo passa por função SECURITY DEFINER (dona da tabela,
--     ignora RLS): ensure_trial_credits, consume_job_credit,
--     admin_adjust_credits, downgrade_own_plan_to_freemium,
--     activate_plan_with_internal_balance, trigger
--     community_like_milestone_nutri e, a partir daqui,
--     record_ai_correction_usage.
--   * SELECT permanece inalterado ("Users see own transactions" /
--     "Admin sees all transactions").
--
-- Policy admin de INSERT ("Admin can insert transactions"): REMOVIDA.
--   Nenhum fluxo do frontend usa INSERT direto de admin; ajustes de admin
--   passam por admin_adjust_credits. Sem o GRANT de INSERT ela ficaria inerte,
--   e mantê-la reabriria fabricação de linhas (ex.: credit_purchase, que
--   alimenta a receita no painel admin) se o GRANT voltar algum dia.
--
-- Fora de escopo: enforcement server-side do limite diário de correções IA,
-- regras de planos/cobrança, SEC-009/010/011.
-- =============================================================================

-- ── 1) Remover INSERT direto ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admin can insert transactions" ON public.transactions;

-- UPDATE/DELETE já eram negados por ausência de policy; TRUNCATE não passa
-- por RLS. Revogados juntos para que o ledger dependa só de GRANT.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.transactions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.transactions FROM authenticated;

-- ── 2) Registro confiável de uso de correção IA ─────────────────────────────
CREATE OR REPLACE FUNCTION public.record_ai_correction_usage(
  p_request_id uuid,
  p_correction_kind text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prof public.profiles;
  v_req public.diet_requests;
  v_label text;
  v_tx_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id required' USING ERRCODE = '22023';
  END IF;

  v_label := CASE p_correction_kind
    WHEN 'draft' THEN 'rascunho'
    WHEN 'markdown' THEN 'markdown'
    ELSE NULL
  END;

  IF v_label IS NULL THEN
    RAISE EXCEPTION 'invalid correction_kind' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_prof
  FROM public.profiles
  WHERE user_id = v_uid;

  IF NOT FOUND OR v_prof.role IS DISTINCT FROM 'nutritionist' THEN
    RAISE EXCEPTION 'not eligible' USING ERRCODE = '42501';
  END IF;

  IF v_prof.approved IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'not approved' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.diet_requests
  WHERE id = p_request_id;

  -- not_found e not_owner indistinguíveis para não vazar existência de request.
  IF NOT FOUND OR v_req.nutritionist_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'request not owned' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (
    v_uid,
    0,
    'ai_correction',
    'Correção IA (' || v_label || ') — pedido ' || left(v_req.id::text, 8)
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'status', 'recorded',
    'transaction_id', v_tx_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_ai_correction_usage(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_ai_correction_usage(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_ai_correction_usage(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.record_ai_correction_usage(uuid, text) IS
  '1E.3A: registra uso de correção IA (amount=0, type=ai_correction) para '
  'nutricionista aprovado dono da diet_request. user_id/amount/type/description '
  'derivados no servidor; correction_kind ∈ {draft, markdown}.';
