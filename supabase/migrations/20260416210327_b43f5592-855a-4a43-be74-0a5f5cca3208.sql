-- Add status column to blog_posts for triage workflow
ALTER TABLE public.blog_posts 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

-- Update RLS: public only sees published posts with status='published'
DROP POLICY IF EXISTS "Anyone can view published posts" ON public.blog_posts;
CREATE POLICY "Anyone can view published posts"
ON public.blog_posts
FOR SELECT
USING (published = true AND status = 'published');

-- Admin can view all posts (any status) for triage
DROP POLICY IF EXISTS "Admin can view all posts" ON public.blog_posts;
CREATE POLICY "Admin can view all posts"
ON public.blog_posts
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- Allow personal_trainer role to insert posts too
DROP POLICY IF EXISTS "Admin or nutritionist can insert posts" ON public.blog_posts;
CREATE POLICY "Authorized roles can insert posts"
ON public.blog_posts
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('admin', 'nutritionist', 'personal_trainer')
  )
);