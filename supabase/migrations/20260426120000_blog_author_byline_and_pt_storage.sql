-- Byline on published posts (avoids exposing profiles via RLS) + personals can upload to blog-images
-- Authors may only update/delete their own posts while em revisão (pending_review)

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS author_display_name text,
  ADD COLUMN IF NOT EXISTS author_role_label text;

-- Storage: allow Personal Trainers to upload to blog-images
DROP POLICY IF EXISTS "Authenticated nutritionists/admins can upload blog images" ON storage.objects;
CREATE POLICY "Blog images upload by content authors"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'blog-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'nutritionist', 'personal_trainer')
    )
  );

DROP POLICY IF EXISTS "Authors can update own posts" ON public.blog_posts;
CREATE POLICY "Authors can update own posts"
  ON public.blog_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND status = 'pending_review')
  WITH CHECK (author_id = auth.uid() AND status = 'pending_review');

DROP POLICY IF EXISTS "Authors can delete own posts" ON public.blog_posts;
CREATE POLICY "Authors can delete own posts"
  ON public.blog_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() AND status = 'pending_review');
