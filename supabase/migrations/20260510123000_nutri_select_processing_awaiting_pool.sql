-- Pool visível: pedidos `processing` / `awaiting_validation` sem nutricionista assumido
-- seguem a mesma lógica de fila pública vs lead exclusivo que `pending` / `in_review`.
DROP POLICY IF EXISTS "Nutritionists see pending and own" ON public.diet_requests;
CREATE POLICY "Nutritionists see pending and own"
ON public.diet_requests
FOR SELECT
TO authenticated
USING (
  nutritionist_id = auth.uid()
  OR (status = 'pending' AND (assigned_nutritionist_id = auth.uid() OR assigned_nutritionist_id IS NULL))
  OR (
    status = 'in_review'
    AND nutritionist_id IS NULL
    AND (assigned_nutritionist_id = auth.uid() OR assigned_nutritionist_id IS NULL)
  )
  OR (
    status IN ('processing', 'awaiting_validation')
    AND nutritionist_id IS NULL
    AND (assigned_nutritionist_id = auth.uid() OR assigned_nutritionist_id IS NULL)
  )
);
