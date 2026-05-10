-- Pool estilo "Uber": pedidos em in_review com nutritionist_id nulo ficam visíveis
-- no pool e podem ser assumidos (UPDATE nutritionist_id) por nutricionistas elegíveís.
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
);

DROP POLICY IF EXISTS "Nutritionists can update assigned" ON public.diet_requests;
CREATE POLICY "Nutritionists can update assigned"
ON public.diet_requests
FOR UPDATE
TO authenticated
USING (
  nutritionist_id = auth.uid()
  OR (status = 'pending' AND (assigned_nutritionist_id = auth.uid() OR assigned_nutritionist_id IS NULL))
  OR (
    status = 'in_review'
    AND nutritionist_id IS NULL
    AND (assigned_nutritionist_id = auth.uid() OR assigned_nutritionist_id IS NULL)
  )
);
