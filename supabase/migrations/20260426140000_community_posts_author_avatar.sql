-- Foto exibida no feed (snapshot do avatar no momento da publicação)
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS author_avatar_url text;
