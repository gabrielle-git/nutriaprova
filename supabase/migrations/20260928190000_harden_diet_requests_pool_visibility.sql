-- =============================================================================
-- Etapa 1E.2A — Visibilidade do pool de diet_requests (SEC-001 / SEC-002)
-- =============================================================================
-- Escopo: somente autorização SELECT de public.diet_requests.
-- Fora de escopo: UPDATE/claim (1E.2B), INSERT, transactions, invite_analytics,
-- client_feedback.
--
-- Acesso profissional ao pool exige profiles.role = 'nutritionist'
-- AND profiles.approved = true (ambos protegidos desde a 1E.1A).
-- Estados de pool preservados de 20260509120000 / 20260510123000:
--   pending, in_review, processing, awaiting_validation (completed fora).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_approved_nutritionist()
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
      AND p.role = 'nutritionist'
      AND p.approved = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_approved_nutritionist() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_approved_nutritionist() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_approved_nutritionist() TO authenticated;

COMMENT ON FUNCTION public.is_approved_nutritionist() IS
  '1E.2A: true se auth.uid() é nutritionist com approved=true. Não aceita user_id.';

-- ── Pool profissional ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Nutritionists see pending and own" ON public.diet_requests;
CREATE POLICY "Approved nutritionists see pool and own"
  ON public.diet_requests
  FOR SELECT
  TO authenticated
  USING (
    public.is_approved_nutritionist()
    AND (
      nutritionist_id = auth.uid()
      OR (
        nutritionist_id IS NULL
        AND status IN ('pending', 'in_review', 'processing', 'awaiting_validation')
        AND (assigned_nutritionist_id IS NULL OR assigned_nutritionist_id = auth.uid())
      )
    )
  );

-- ── Admin: mesmo comportamento, verificação via helper seguro da 1D ─────────
DROP POLICY IF EXISTS "Admin sees all diet requests" ON public.diet_requests;
CREATE POLICY "Admin sees all diet requests"
  ON public.diet_requests
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- "Clients see own diet requests" (client_id = auth.uid()) permanece inalterada.
