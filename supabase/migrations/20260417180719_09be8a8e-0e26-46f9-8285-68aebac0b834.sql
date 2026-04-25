
-- 1. Update welcome trigger: 3 coins for new nutritionists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role, crn_number, credits, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    NEW.raw_user_meta_data->>'crn_number',
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'nutritionist' THEN 3 ELSE 0 END,
    NULLIF(NEW.raw_user_meta_data->>'referred_by', '')::uuid
  );
  RETURN NEW;
END;
$function$;

-- 2. Add referred_by to profiles (who referred this user)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by uuid;
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

-- 3. Add assigned_nutritionist_id to diet_requests (preassigned by referrer)
ALTER TABLE public.diet_requests ADD COLUMN IF NOT EXISTS assigned_nutritionist_id uuid;
CREATE INDEX IF NOT EXISTS idx_diet_requests_assigned ON public.diet_requests(assigned_nutritionist_id);

-- 4. Update RLS so a preassigned diet only appears to its assigned professional
DROP POLICY IF EXISTS "Nutritionists see pending and own" ON public.diet_requests;
CREATE POLICY "Nutritionists see pending and own"
ON public.diet_requests
FOR SELECT
TO authenticated
USING (
  -- Own assigned (in_review/completed)
  nutritionist_id = auth.uid()
  -- OR pending and either explicitly assigned to me, or unassigned (public queue)
  OR (status = 'pending' AND (assigned_nutritionist_id = auth.uid() OR assigned_nutritionist_id IS NULL))
);

DROP POLICY IF EXISTS "Nutritionists can update assigned" ON public.diet_requests;
CREATE POLICY "Nutritionists can update assigned"
ON public.diet_requests
FOR UPDATE
TO authenticated
USING (
  nutritionist_id = auth.uid()
  OR (status = 'pending' AND (assigned_nutritionist_id = auth.uid() OR assigned_nutritionist_id IS NULL))
);
