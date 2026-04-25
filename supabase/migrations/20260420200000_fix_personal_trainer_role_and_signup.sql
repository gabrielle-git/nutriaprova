-- =============================================================================
-- Fix: permite role 'personal_trainer' na tabela profiles + robustece o trigger
-- =============================================================================
-- O CHECK original (migração 20260416035448) só aceitava
-- ('client', 'nutritionist', 'admin'). Quando um Personal Trainer se cadastrava
-- via e-mail/senha, a função `handle_new_user` tentava inserir role
-- 'personal_trainer' e o Postgres retornava "Database error saving new user".
-- Esta migração:
--   1. Atualiza o CHECK para incluir 'personal_trainer'.
--   2. Reescreve a função `handle_new_user` para:
--      - inserir `plan_tier` já no cadastro (coluna NOT NULL DEFAULT 'basic');
--      - tolerar role inválida caindo para 'client' em vez de falhar;
--      - preencher full_name com o e-mail caso o metadata venha vazio.
-- =============================================================================

-- 1. Remove o CHECK antigo (nome padrão gerado pelo Postgres) e cria um novo.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('client', 'nutritionist', 'admin', 'personal_trainer'));

-- 2. Trigger robusto — nunca derruba o signUp por metadata faltando.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_full_name text;
  v_crn text;
  v_referred_by uuid;
  v_credits int;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');

  -- Fallback defensivo: se o role vier fora do enum aceito, cai para 'client'.
  IF v_role NOT IN ('client', 'nutritionist', 'admin', 'personal_trainer') THEN
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

  v_credits := CASE WHEN v_role = 'nutritionist' THEN 3 ELSE 0 END;

  INSERT INTO public.profiles (
    user_id, full_name, role, crn_number, credits, referred_by, plan_tier
  )
  VALUES (
    NEW.id,
    v_full_name,
    v_role,
    v_crn,
    v_credits,
    v_referred_by,
    'basic'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
