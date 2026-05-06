-- FKs em public → auth.users(id) com política explícita de DELETE.
--
-- Regra:
--   • ON DELETE CASCADE — o UUID em auth.users é o "dono" do registro
--     (ex.: profiles.user_id, diet_requests.client_id).
--   • ON DELETE SET NULL — vínculo/atribuição profissional
--     (ex.: diet_requests.nutritionist_id), para não apagar pedidos nem perfis
--     de clientes quando o nutricionista exclui a conta.
--
-- Nomes das constraints: padrão PostgreSQL {tabela}_{coluna}_fkey.

-- ── profiles ──────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── diet_requests ─────────────────────────────────────────────────────
ALTER TABLE public.diet_requests
  DROP CONSTRAINT IF EXISTS diet_requests_client_id_fkey;

ALTER TABLE public.diet_requests
  ADD CONSTRAINT diet_requests_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.diet_requests
  DROP CONSTRAINT IF EXISTS diet_requests_nutritionist_id_fkey;

ALTER TABLE public.diet_requests
  ADD CONSTRAINT diet_requests_nutritionist_id_fkey
  FOREIGN KEY (nutritionist_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── transactions ──────────────────────────────────────────────────────
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── client_feedback ───────────────────────────────────────────────────
ALTER TABLE public.client_feedback
  DROP CONSTRAINT IF EXISTS client_feedback_client_id_fkey;

ALTER TABLE public.client_feedback
  ADD CONSTRAINT client_feedback_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── referrals ─────────────────────────────────────────────────────────
ALTER TABLE public.referrals
  DROP CONSTRAINT IF EXISTS referrals_referrer_id_fkey;

ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_referrer_id_fkey
  FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── community_posts ───────────────────────────────────────────────────
ALTER TABLE public.community_posts
  DROP CONSTRAINT IF EXISTS community_posts_author_id_fkey;

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── post_likes ────────────────────────────────────────────────────────
ALTER TABLE public.post_likes
  DROP CONSTRAINT IF EXISTS post_likes_user_id_fkey;

ALTER TABLE public.post_likes
  ADD CONSTRAINT post_likes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
