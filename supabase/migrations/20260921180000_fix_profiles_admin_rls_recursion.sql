-- =============================================================================
-- Etapa 1D — correção MÍNIMA da recursão RLS em public.profiles (VULN-1C-001)
-- =============================================================================
-- Contexto (auditoria local isolada — NÃO production-ready):
-- As policies admin em `profiles` faziam EXISTS (SELECT … FROM profiles …),
-- reentrando RLS da própria tabela → 42P17.
--
-- Escopo deliberadamente estreito:
--   - helper SECURITY DEFINER is_admin()
--   - recria SOMENTE:
--       "Admin can view all profiles"
--       "Admin can update all profiles"
--
-- Fora de escopo nesta migration:
--   pool/claim diet_requests, proteção role/credits/plan_tier, transactions,
--   invite_analytics, client_feedback, billing, IA.
--
-- Nota: profiles.role permanece self-writable nesta etapa (necessário p/ SEC-005).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
CREATE POLICY "Admin can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
