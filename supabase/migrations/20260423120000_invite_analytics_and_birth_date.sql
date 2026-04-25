-- =============================================================================
-- 1) profiles.birth_date — data de nascimento do cliente (Configurações)
-- 2) invite_analytics   — rastreia cliques / cópias / vendas por código de
--                        afiliado (Performance de Convites / painel admin)
-- =============================================================================

-- ── 1. Data de nascimento do cliente ────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date DATE;

-- ── 2. Tabela de analytics de convite ───────────────────────────────────────
-- Um único evento por linha. Eventos possíveis:
--   click → visitante abriu /auth?ref=<code>
--   copy  → profissional copiou o link/código do seu painel
--   sale  → houve conversão monetária vinda de um link
--
-- A coluna `owner_id` aponta para o dono do código (nutri ou personal).
-- A coluna `session_key` permite deduplicar cliques por navegador/dia.
CREATE TABLE IF NOT EXISTS public.invite_analytics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL,
  owner_id     UUID,
  event_type   TEXT NOT NULL CHECK (event_type IN ('click', 'copy', 'sale')),
  session_key  TEXT,
  client_id    UUID,
  amount       NUMERIC(10, 2) DEFAULT 0,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invite_analytics_code_idx
  ON public.invite_analytics (code);
CREATE INDEX IF NOT EXISTS invite_analytics_owner_idx
  ON public.invite_analytics (owner_id);
CREATE INDEX IF NOT EXISTS invite_analytics_event_idx
  ON public.invite_analytics (event_type);

-- Deduplica cliques únicos por código + sessão (evita inflar contagem).
CREATE UNIQUE INDEX IF NOT EXISTS invite_analytics_unique_click
  ON public.invite_analytics (code, session_key)
  WHERE event_type = 'click' AND session_key IS NOT NULL;

-- ── RLS: leitura para admin/supreme/dono, escrita aberta (analytics) ───────
ALTER TABLE public.invite_analytics ENABLE ROW LEVEL SECURITY;

-- Qualquer visitante (anon ou autenticado) pode INSERIR eventos — é o único
-- caminho para registrar cliques antes do login.
DROP POLICY IF EXISTS "invite_analytics_insert_any" ON public.invite_analytics;
CREATE POLICY "invite_analytics_insert_any"
  ON public.invite_analytics
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Leitura: dono do código (owner_id = auth.uid()) ou admin.
DROP POLICY IF EXISTS "invite_analytics_select_owner_or_admin" ON public.invite_analytics;
CREATE POLICY "invite_analytics_select_owner_or_admin"
  ON public.invite_analytics
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND p.role = 'admin'
    )
  );

-- ── affiliate_code em profiles: garante existência para uso pelo painel ─────
-- (A coluna já é usada em PersonalDashboard/AffiliateTab via `as any`; criamos
--  se faltar para consolidar o schema em ambientes frescos.)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS affiliate_code TEXT UNIQUE;
