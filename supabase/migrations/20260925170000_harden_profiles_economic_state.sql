-- =============================================================================
-- Etapa 1E.1B — Hardening de ESTADO ECONÔMICO privilegiado em public.profiles
-- =============================================================================
-- Escopo: credits + plan_tier via RPCs SECURITY DEFINER
-- Fora de escopo: diet_requests claim/pool (1E.2), gateway, SEC-008 global
-- Reutiliza public.is_admin() da migration 1D.
-- =============================================================================
-- DIVERGÊNCIA CLINIC (documentada, não normalizada silenciosamente):
--   PlanCheckoutModal grant histórico: clinic → 9999 moedas
--   TIER_CONFIG/usePlanTier: clinic → unlimitedValidations, initialCoins=0
--   Esta migration preserva o grant 9999 no upgrade (comportamento do checkout).
--   O custo de job clinic permanece 0 (unlimitedValidations).
-- =============================================================================

-- ── 1) Bloquear UPDATE direto de credits / plan_tier ───────────────────────
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
REVOKE UPDATE ON TABLE public.profiles FROM anon;

GRANT UPDATE (
  full_name,
  crn_number,
  clinic_logo_url,
  birth_date,
  affiliate_code,
  phone,
  client_data,
  avatar_url,
  referred_by,
  deleted_at,
  updated_at
) ON TABLE public.profiles TO authenticated;

-- ── 2) Trial credits (safety net) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_trial_credits()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.profiles;
  v_tx_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.profiles
  WHERE user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.role IS DISTINCT FROM 'nutritionist' THEN
    RAISE EXCEPTION 'trial credits only for nutritionist' USING ERRCODE = '42501';
  END IF;

  -- Idempotente: já tem créditos → no-op
  IF v_row.credits > 0 THEN
    RETURN v_row;
  END IF;

  SELECT count(*)::int INTO v_tx_count
  FROM public.transactions
  WHERE user_id = v_uid;

  -- Regra histórica: só concede se ainda não houve nenhuma transaction
  IF v_tx_count > 0 THEN
    RETURN v_row;
  END IF;

  UPDATE public.profiles
     SET credits = 3,
         updated_at = now()
   WHERE user_id = v_uid
   RETURNING * INTO v_row;

  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (
    v_uid,
    3,
    'trial_grant',
    'Bônus de boas-vindas: 3 moedas gratuitas'
  );

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_trial_credits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_trial_credits() TO authenticated;

-- ── 3) Consumo de crédito de job (efeito econômico apenas) ──────────────────
CREATE OR REPLACE FUNCTION public.consume_job_credit(request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prof public.profiles;
  v_req public.diet_requests;
  v_cost int;
  v_new_credits int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF request_id IS NULL THEN
    RAISE EXCEPTION 'request_id required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_prof
  FROM public.profiles
  WHERE user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_req
  FROM public.diet_requests
  WHERE id = request_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002';
  END IF;

  -- Job já deve estar assumido pelo caller (claim continua no cliente até 1E.2)
  IF v_req.nutritionist_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'request not owned by caller' USING ERRCODE = '42501';
  END IF;

  IF v_req.status IS DISTINCT FROM 'in_review' THEN
    RAISE EXCEPTION 'request status incompatible for debit: %', v_req.status
      USING ERRCODE = '22023';
  END IF;

  -- Custo server-side: clinic = 0; demais = 1
  IF lower(COALESCE(v_prof.plan_tier, 'basic')) = 'clinic' THEN
    v_cost := 0;
  ELSE
    v_cost := 1;
  END IF;

  IF v_cost = 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (
      v_uid,
      0,
      'job_acceptance',
      'Aceitou job #' || left(request_id::text, 8) || ' (Clínica — validação ilimitada)'
    );
    RETURN jsonb_build_object(
      'ok', true,
      'cost', 0,
      'credits', v_prof.credits,
      'plan_tier', v_prof.plan_tier
    );
  END IF;

  IF v_prof.credits < v_cost THEN
    RAISE EXCEPTION 'insufficient credits' USING ERRCODE = 'P0001';
  END IF;

  v_new_credits := v_prof.credits - v_cost;

  UPDATE public.profiles
     SET credits = v_new_credits,
         updated_at = now()
   WHERE user_id = v_uid;

  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (
    v_uid,
    -v_cost,
    'job_acceptance',
    'Aceitou job #' || left(request_id::text, 8)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'cost', v_cost,
    'credits', v_new_credits,
    'plan_tier', v_prof.plan_tier
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_job_credit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_job_credit(uuid) TO authenticated;

-- ── 4) Admin adjust credits ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_adjust_credits(
  target_user_id uuid,
  delta integer,
  reason text
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_row public.profiles;
  v_reason text := left(trim(COALESCE(reason, '')), 200);
  v_new int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE = '42501';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id required' USING ERRCODE = '22023';
  END IF;

  IF delta IS NULL OR delta = 0 THEN
    RAISE EXCEPTION 'delta must be non-zero' USING ERRCODE = '22023';
  END IF;

  IF v_reason = '' THEN
    v_reason := 'Admin credit adjustment';
  END IF;

  SELECT * INTO v_row
  FROM public.profiles
  WHERE user_id = target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  v_new := v_row.credits + delta;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'credits cannot go negative' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
     SET credits = v_new,
         updated_at = now()
   WHERE user_id = target_user_id
   RETURNING * INTO v_row;

  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (target_user_id, delta, 'credit_purchase', v_reason);

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_adjust_credits(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, text) TO authenticated;

-- ── 5) Downgrade próprio → freemium ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.downgrade_own_plan_to_freemium()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.profiles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.profiles
  WHERE user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF lower(COALESCE(v_row.plan_tier, 'freemium')) = 'freemium' THEN
    RETURN v_row;
  END IF;

  UPDATE public.profiles
     SET plan_tier = 'freemium',
         updated_at = now()
   WHERE user_id = v_uid
   RETURNING * INTO v_row;

  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (
    v_uid,
    0,
    'plan_downgrade',
    'Cancelamento de assinatura e retorno para Freemium'
  );

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.downgrade_own_plan_to_freemium() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.downgrade_own_plan_to_freemium() TO authenticated;

-- ── 6) Upgrade com saldo interno verificável (sem gateway) ──────────────────
CREATE OR REPLACE FUNCTION public.activate_plan_with_internal_balance(
  target_tier text,
  billing_period text DEFAULT 'monthly'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.profiles;
  v_tier text := lower(trim(COALESCE(target_tier, '')));
  v_period text := lower(trim(COALESCE(billing_period, 'monthly')));
  v_price_reais numeric;
  v_price int;
  v_completed int;
  v_used int;
  v_balance int;
  v_grant int;
  v_next_credits int;
  v_credit_delta int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_tier NOT IN ('basic', 'premium', 'clinic') THEN
    RAISE EXCEPTION 'invalid target_tier' USING ERRCODE = '22023';
  END IF;

  IF v_period NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'invalid billing_period' USING ERRCODE = '22023';
  END IF;

  -- Preços canônicos (espelham Planos.tsx / TIER_CONFIG)
  v_price_reais := CASE v_tier
    WHEN 'basic' THEN 39.9
    WHEN 'premium' THEN 99.9
    WHEN 'clinic' THEN 199.9
  END;

  IF v_period = 'annual' THEN
    v_price_reais := v_price_reais * 0.8;
  END IF;

  v_price := round(v_price_reais)::int;

  SELECT * INTO v_row
  FROM public.profiles
  WHERE user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  -- Saldo interno: R$15 por job completed − débitos de upgrade anteriores
  SELECT count(*)::int INTO v_completed
  FROM public.diet_requests
  WHERE nutritionist_id = v_uid
    AND status = 'completed';

  SELECT COALESCE(sum(abs(amount)), 0)::int INTO v_used
  FROM public.transactions
  WHERE user_id = v_uid
    AND type = 'plan_upgrade_balance_debit';

  v_balance := greatest(0, (v_completed * 15) - v_used);

  IF v_balance < v_price THEN
    RETURN jsonb_build_object(
      'status', 'payment_required',
      'reason', 'insufficient_internal_balance',
      'required', v_price,
      'available', v_balance,
      'plan_tier', v_row.plan_tier,
      'credits', v_row.credits
    );
  END IF;

  -- Grant histórico do checkout (clinic=9999 preservado; ver comentário no topo)
  v_grant := CASE v_tier
    WHEN 'basic' THEN 20
    WHEN 'premium' THEN 120
    WHEN 'clinic' THEN 9999
  END;

  v_next_credits := greatest(v_row.credits, v_grant);
  v_credit_delta := v_next_credits - v_row.credits;

  UPDATE public.profiles
     SET plan_tier = v_tier,
         credits = v_next_credits,
         updated_at = now()
   WHERE user_id = v_uid
   RETURNING * INTO v_row;

  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (
    v_uid,
    -v_price,
    'plan_upgrade_balance_debit',
    'Upgrade para ' || v_tier || ' usando saldo interno'
  );

  IF v_credit_delta > 0 THEN
    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (
      v_uid,
      v_credit_delta,
      'plan_coin_grant',
      'Ajuste de moedas no upgrade para ' || v_tier
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'activated',
    'plan_tier', v_row.plan_tier,
    'credits', v_row.credits,
    'debited', v_price,
    'grant', v_grant,
    'clinic_grant_note',
      'clinic grant=9999 mirrors PlanCheckoutModal; TIER_CONFIG uses unlimitedValidations/initialCoins=0'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_plan_with_internal_balance(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_plan_with_internal_balance(text, text) TO authenticated;

COMMENT ON FUNCTION public.ensure_trial_credits() IS
  '1E.1B: concede 3 créditos trial uma vez (nutritionist, saldo 0, sem txs).';

COMMENT ON FUNCTION public.consume_job_credit(uuid) IS
  '1E.1B: debita crédito de job assumido. Não corrige claim/pool (1E.2).';

COMMENT ON FUNCTION public.admin_adjust_credits(uuid, integer, text) IS
  '1E.1B: admin ajusta credits com lock + transaction atômica.';

COMMENT ON FUNCTION public.downgrade_own_plan_to_freemium() IS
  '1E.1B: downgrade próprio para freemium.';

COMMENT ON FUNCTION public.activate_plan_with_internal_balance(text, text) IS
  '1E.1B: upgrade SOMENTE com saldo interno integral. Sem gateway / sem externalPaid.';
