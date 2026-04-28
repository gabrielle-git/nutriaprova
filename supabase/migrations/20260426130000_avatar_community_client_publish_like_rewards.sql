-- Foto de perfil + comunidade: clientes com plano concluído + 1 moeda a cada 10 curtidas (posts de nutri)

-- ── 1) Avatar na tabela profiles ─────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- ── 2) Storage avatars (público leitura) ───────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar images public read" ON storage.objects;
CREATE POLICY "Avatar images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── 3) Tabelas comunidade (idempotente) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_role text NOT NULL,
  author_initials text NOT NULL,
  text text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Ajusta constraint de papel para incluir client
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_posts_author_role_check'
      AND conrelid = 'public.community_posts'::regclass
  ) THEN
    ALTER TABLE public.community_posts DROP CONSTRAINT community_posts_author_role_check;
  END IF;
END $$;

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_author_role_check
  CHECK (author_role IN ('nutritionist', 'personal_trainer', 'admin', 'client'));

-- Políticas community_posts
DROP POLICY IF EXISTS "Authenticated users can view community posts" ON public.community_posts;
CREATE POLICY "Authenticated users can view community posts"
  ON public.community_posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Professionals can publish community posts" ON public.community_posts;
DROP POLICY IF EXISTS "Client or professionals can publish per rules" ON public.community_posts;
CREATE POLICY "Community publish by role"
  ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'nutritionist')
        AND author_role = 'nutritionist'
      )
      OR (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'personal_trainer')
        AND author_role = 'personal_trainer'
      )
      OR (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
        AND author_role = 'admin'
      )
      OR (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'client')
        AND author_role = 'client'
        AND EXISTS (
          SELECT 1 FROM public.diet_requests dr
          WHERE dr.client_id = auth.uid() AND dr.status = 'completed'
        )
      )
    )
  );

DROP POLICY IF EXISTS "Authors can delete own community posts" ON public.community_posts;
CREATE POLICY "Authors can delete own community posts"
  ON public.community_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- post_likes
DROP POLICY IF EXISTS "Authenticated users can view post likes" ON public.post_likes;
CREATE POLICY "Authenticated users can view post likes"
  ON public.post_likes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
CREATE POLICY "Users can like posts"
  ON public.post_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove own likes" ON public.post_likes;
CREATE POLICY "Users can remove own likes"
  ON public.post_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── 4) 10 curtidas → +1 moeda para o autor nutri do post ───────
CREATE OR REPLACE FUNCTION public.community_like_milestone_nutri()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_role text;
  v_cnt int;
BEGIN
  SELECT author_id, author_role INTO v_author, v_role
  FROM public.community_posts
  WHERE id = NEW.post_id;

  IF v_role IS DISTINCT FROM 'nutritionist' OR v_author IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::int INTO v_cnt FROM public.post_likes WHERE post_id = NEW.post_id;

  IF v_cnt > 0 AND v_cnt % 10 = 0 THEN
    UPDATE public.profiles
    SET credits = credits + 1, updated_at = now()
    WHERE user_id = v_author;

    INSERT INTO public.transactions (user_id, amount, type, description)
    VALUES (
      v_author,
      1,
      'community_likes_milestone',
      'Bônus comunidade: ' || v_cnt::text || ' curtidas no post ' || left(NEW.post_id::text, 8)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_likes_milestone_nutri ON public.post_likes;
CREATE TRIGGER trg_post_likes_milestone_nutri
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.community_like_milestone_nutri();
