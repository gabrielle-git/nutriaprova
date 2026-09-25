-- =============================================================================
-- Etapa 1E.1A — Hardening de IDENTIDADE privilegiada em public.profiles
-- =============================================================================
-- Escopo: role + approved (+ signup/INSERT)
-- Fora de escopo: credits, plan_tier (1E.1B), diet_requests (1E.2)
-- Reutiliza public.is_admin() da migration 1D.
-- =============================================================================

-- ── 1) Signup: jamais criar admin via metadata ───────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_role text;
  v_full_name text;
  v_crn text;
  v_referred_by uuid;
  v_credits int;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');

  -- Whitelist pública apenas. admin (e qualquer outro) → client.
  IF v_role NOT IN ('client', 'nutritionist', 'personal_trainer') THEN
    v_role := 'client';
  END IF;

  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    split_part(COALESCE(NEW.email, ''), '@', 1),
    ''
  );

  v_crn := NULLIF(TRIM(NEW.raw_user_meta_data->>'crn_number'), '');

  BEGIN
    v_referred_by := NULLIF(NEW.raw_user_meta_data->>'referred_by', '')::uuid;
  EXCEPTION WHEN others THEN
    v_referred_by := NULL;
  END;

  -- Créditos iniciais do nutri preservados até 1E.1B substituir o mecanismo.
  v_credits := CASE WHEN v_role = 'nutritionist' THEN 3 ELSE 0 END;

  INSERT INTO public.profiles (
    user_id, full_name, role, crn_number, credits, referred_by, plan_tier, approved
  )
  VALUES (
    NEW.id,
    v_full_name,
    v_role,
    v_crn,
    v_credits,
    v_referred_by,
    'basic',
    false
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ── 2) Remover INSERT client-side em profiles ───────────────────────────────
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

REVOKE INSERT ON TABLE public.profiles FROM authenticated;
REVOKE INSERT ON TABLE public.profiles FROM anon;

-- ── 3) UPDATE por coluna: bloquear role/approved no Data API ───────────────
-- Table-level UPDATE genérico → column grants (credits/plan_tier ainda na A).
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
  updated_at,
  credits,
  plan_tier
) ON TABLE public.profiles TO authenticated;

-- Policies de UPDATE (own / admin) permanecem; privilégio de coluna impede
-- role/approved mesmo quando RLS permite a linha.
-- Admin deve usar RPCs para approved (e role nunca via PostgREST).

-- ── 4) RPC: transição legítima de papel do próprio usuário ────────────────
CREATE OR REPLACE FUNCTION public.request_own_role_transition(
  target_role text,
  p_crn_number text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.profiles;
  v_target text := lower(trim(COALESCE(target_role, '')));
  v_crn text := NULLIF(trim(COALESCE(p_crn_number, '')), '');
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

  -- Idempotente
  IF v_row.role = v_target THEN
    IF v_target = 'nutritionist' AND v_crn IS NOT NULL THEN
      UPDATE public.profiles
         SET crn_number = v_crn,
             updated_at = now()
       WHERE user_id = v_uid
       RETURNING * INTO v_row;
    END IF;
    RETURN v_row;
  END IF;

  -- Transições permitidas
  IF v_row.role = 'client' AND v_target = 'nutritionist' THEN
    IF v_crn IS NULL THEN
      RAISE EXCEPTION 'crn_number required for nutritionist transition'
        USING ERRCODE = '22023';
    END IF;
    UPDATE public.profiles
       SET role = 'nutritionist',
           approved = false,
           crn_number = v_crn,
           updated_at = now()
     WHERE user_id = v_uid
     RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  IF v_row.role = 'client' AND v_target = 'personal_trainer' THEN
    UPDATE public.profiles
       SET role = 'personal_trainer',
           approved = false,
           crn_number = NULL,
           updated_at = now()
     WHERE user_id = v_uid
     RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  IF v_row.role IN ('nutritionist', 'personal_trainer') AND v_target = 'client' THEN
    UPDATE public.profiles
       SET role = 'client',
           approved = false,
           crn_number = NULL,
           updated_at = now()
     WHERE user_id = v_uid
     RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  -- Qualquer caminho para admin ou cross-professional: negado
  RAISE EXCEPTION 'role transition not allowed: % -> %', v_row.role, v_target
    USING ERRCODE = '42501';
END;
$function$;

REVOKE ALL ON FUNCTION public.request_own_role_transition(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_own_role_transition(text, text) TO authenticated;

-- ── 5) RPC: aprovação profissional (somente admin) ────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_professional_approval(
  target_user_id uuid,
  p_approved boolean
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_row public.profiles;
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

  -- Não permitir auto-aprovação mesmo se algum dia is_admin falhar
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot approve own profile via this RPC' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.profiles
  WHERE user_id = target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_row.role NOT IN ('nutritionist', 'personal_trainer') THEN
    RAISE EXCEPTION 'approval only applies to professional roles'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
     SET approved = COALESCE(p_approved, false),
         updated_at = now()
   WHERE user_id = target_user_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_professional_approval(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_professional_approval(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.request_own_role_transition(text, text) IS
  '1E.1A: transição legítima de role do próprio usuário. Nunca promove admin.';

COMMENT ON FUNCTION public.admin_set_professional_approval(uuid, boolean) IS
  '1E.1A: admin define approved de profissional. Bootstrap de admin fica fora desta RPC.';
