-- =============================================================================
-- Etapa 1E.2B — Claim seguro de diet_requests (SEC-003 / SEC-004)
-- =============================================================================
-- Depende de 20260928190000_harden_diet_requests_pool_visibility.sql
-- (public.is_approved_nutritionist) e da 1E.1B (public.consume_job_credit).
--
-- Modelo:
--   * UPDATE direto por profissional: somente em request já própria
--     (nutritionist_id = auth.uid()) e sem poder transferir/soltar a posse.
--   * Claim (nutritionist_id NULL → auth.uid()): somente via
--     public.claim_diet_request, que deriva identidade de auth.uid() e trava a
--     linha com FOR UPDATE (um único vencedor).
--   * Cobrança: pending → in_review cobra via public.consume_job_credit
--     (fonte única de custo; inalterada). Demais estados elegíveis mantêm o
--     status e não cobram, como no fluxo histórico.
-- Fora de escopo: INSERT, transactions (SEC-008), SEC-009/010/011.
-- =============================================================================

-- ── UPDATE profissional: own-only ──────────────────────────────────────────
DROP POLICY IF EXISTS "Nutritionists can update assigned" ON public.diet_requests;
CREATE POLICY "Approved nutritionists update own requests"
  ON public.diet_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.is_approved_nutritionist()
    AND nutritionist_id = auth.uid()
  )
  WITH CHECK (
    public.is_approved_nutritionist()
    AND nutritionist_id = auth.uid()
  );

-- ── UPDATE admin: mesmo alcance, verificação via helper seguro da 1D ───────
DROP POLICY IF EXISTS "Admin can update all diet requests" ON public.diet_requests;
CREATE POLICY "Admin can update all diet requests"
  ON public.diet_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Claim confiável ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_diet_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prof public.profiles;
  v_req public.diet_requests;
  v_debit jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id required' USING ERRCODE = '22023';
  END IF;

  -- Mesma ordem de locks de consume_job_credit (profile → request).
  SELECT * INTO v_prof
  FROM public.profiles
  WHERE user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND OR v_prof.role IS DISTINCT FROM 'nutritionist' THEN
    RETURN jsonb_build_object('status', 'not_eligible', 'reason', 'role');
  END IF;

  IF v_prof.approved IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('status', 'not_approved');
  END IF;

  SELECT * INTO v_req
  FROM public.diet_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_req.nutritionist_id = v_uid THEN
    RETURN jsonb_build_object(
      'status', 'already_owned',
      'request_id', v_req.id,
      'request_status', v_req.status
    );
  END IF;

  IF v_req.nutritionist_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_claimed');
  END IF;

  IF v_req.assigned_nutritionist_id IS NOT NULL
     AND v_req.assigned_nutritionist_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('status', 'not_eligible', 'reason', 'assigned_to_other');
  END IF;

  IF v_req.status IS NULL
     OR v_req.status NOT IN ('pending', 'in_review', 'processing', 'awaiting_validation') THEN
    RETURN jsonb_build_object('status', 'not_eligible', 'reason', 'status');
  END IF;

  IF v_req.status = 'pending' THEN
    BEGIN
      UPDATE public.diet_requests
         SET nutritionist_id = v_uid,
             status = 'in_review',
             updated_at = now()
       WHERE id = v_req.id;

      v_debit := public.consume_job_credit(v_req.id);
    EXCEPTION
      WHEN raise_exception THEN
        IF SQLERRM = 'insufficient credits' THEN
          RETURN jsonb_build_object('status', 'insufficient_credits');
        END IF;
        RAISE;
    END;

    RETURN jsonb_build_object(
      'status', 'claimed',
      'request_id', v_req.id,
      'request_status', 'in_review',
      'cost', v_debit -> 'cost',
      'credits', v_debit -> 'credits'
    );
  END IF;

  UPDATE public.diet_requests
     SET nutritionist_id = v_uid,
         updated_at = now()
   WHERE id = v_req.id;

  RETURN jsonb_build_object(
    'status', 'claimed',
    'request_id', v_req.id,
    'request_status', v_req.status,
    'cost', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_diet_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_diet_request(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_diet_request(uuid) TO authenticated;

COMMENT ON FUNCTION public.claim_diet_request(uuid) IS
  '1E.2B: claim atômico de diet_request por nutricionista aprovado (auth.uid()). '
  'pending→in_review cobra via consume_job_credit; demais estados elegíveis não cobram.';
