-- ──────────────────────────────────────────────────────────────────────────────
-- profiles.client_data — payload JSON com dados físicos do paciente
-- (peso, altura, % gordura, gênero, objetivo e alergias) usados pela aba
-- "Meu Perfil" do ClientDashboard. JSONB permite evoluir o schema sem
-- quebrar builds / refetchs quando novos campos forem adicionados.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_data JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.client_data IS
  'Dados físicos do paciente (weight, height, bodyFat, gender, goal, allergies[]). Usados como default para a geração de dieta via n8n.';

-- Sem alteração de RLS: a policy existente "Users can update own profile"
-- (auth.uid() = user_id) cobre UPDATEs nesta coluna automaticamente.
