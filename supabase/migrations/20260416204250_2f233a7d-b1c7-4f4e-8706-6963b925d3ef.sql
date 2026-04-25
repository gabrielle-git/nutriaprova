-- =============================================================================
-- blog_posts + storage (blog-images)
-- Migration idempotente: pode ser re-aplicada sobre schema já existente.
-- =============================================================================

-- Helper function (create first so trigger can reference it)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Nutrição',
  cover_image_url TEXT,
  read_time TEXT DEFAULT '5 min',
  featured BOOLEAN NOT NULL DEFAULT false,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- ── Policies: blog_posts ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view published posts" ON public.blog_posts;
CREATE POLICY "Anyone can view published posts"
  ON public.blog_posts FOR SELECT
  USING (published = true);

DROP POLICY IF EXISTS "Authors can view own posts" ON public.blog_posts;
CREATE POLICY "Authors can view own posts"
  ON public.blog_posts FOR SELECT TO authenticated
  USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Admin or nutritionist can insert posts" ON public.blog_posts;
CREATE POLICY "Admin or nutritionist can insert posts"
  ON public.blog_posts FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'nutritionist')
    )
  );

DROP POLICY IF EXISTS "Authors can update own posts" ON public.blog_posts;
CREATE POLICY "Authors can update own posts"
  ON public.blog_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Admin can update any post" ON public.blog_posts;
CREATE POLICY "Admin can update any post"
  ON public.blog_posts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Authors can delete own posts" ON public.blog_posts;
CREATE POLICY "Authors can delete own posts"
  ON public.blog_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Admin can delete any post" ON public.blog_posts;
CREATE POLICY "Admin can delete any post"
  ON public.blog_posts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- ── Trigger: updated_at ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ── Storage bucket + policies (blog-images) ───────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view blog images" ON storage.objects;
CREATE POLICY "Public can view blog images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-images');

DROP POLICY IF EXISTS "Authenticated nutritionists/admins can upload blog images" ON storage.objects;
CREATE POLICY "Authenticated nutritionists/admins can upload blog images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'blog-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role IN ('admin', 'nutritionist')
    )
  );

DROP POLICY IF EXISTS "Users can update their own blog images" ON storage.objects;
CREATE POLICY "Users can update their own blog images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'blog-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own blog images" ON storage.objects;
CREATE POLICY "Users can delete their own blog images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'blog-images' AND auth.uid()::text = (storage.foldername(name))[1]);
