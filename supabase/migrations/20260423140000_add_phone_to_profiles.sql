-- =============================================================================
-- Onboarding Nutri: persistir telefone no profiles + blindar RLS do UPSERT
-- =============================================================================
-- Contexto: a tela `/onboarding` coleta nome, telefone e CRN, mas o telefone
-- era salvo apenas em `auth.users.raw_user_meta_data`. Passa a viver em
-- `profiles.phone` — fonte de verdade usada pelos painéis.
--
-- Também é feito um hardening do RLS de UPDATE em profiles: a policy original
-- tinha USING mas não WITH CHECK explícito, o que pode falhar em alguns
-- caminhos de `INSERT ... ON CONFLICT DO UPDATE` (o que o PostgREST emite
-- quando chamamos `.upsert()`). Aqui adicionamos WITH CHECK idêntico ao USING.
-- =============================================================================

-- ── 1. Coluna phone ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.profiles.phone IS
  'Telefone normalizado (apenas dígitos). Preenchido no onboarding do Nutri e/ou Cliente.';

-- ── 2. RLS: UPDATE com WITH CHECK explícito ────────────────────────────────────
-- Necessário para que UPSERT (INSERT ... ON CONFLICT DO UPDATE) não seja
-- bloqueado: o PostgREST aplica WITH CHECK na linha NEW tanto para INSERT
-- quanto para o ramo UPDATE do conflito.

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- A policy de admin também ganha WITH CHECK consistente — evita falhas silenciosas
-- quando um admin faz upsert.
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
CREATE POLICY "Admin can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );
