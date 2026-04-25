-- =============================================================================
-- profiles.clinic_logo_url + plan_tier + bucket clinic-logos
-- Migration idempotente.
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clinic_logo_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'basic';

INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-logos', 'clinic-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read clinic logos" ON storage.objects;
CREATE POLICY "Public read clinic logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'clinic-logos');

DROP POLICY IF EXISTS "Users upload own clinic logo" ON storage.objects;
CREATE POLICY "Users upload own clinic logo"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clinic-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users update own clinic logo" ON storage.objects;
CREATE POLICY "Users update own clinic logo"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'clinic-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own clinic logo" ON storage.objects;
CREATE POLICY "Users delete own clinic logo"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'clinic-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
