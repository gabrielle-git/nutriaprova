-- Soft delete de conta: marca o perfil sem remover auth.users nem linhas relacionadas.
-- Carência de 30 dias: após esse prazo, um job externo (Edge/cron) pode remover o
-- usuário do Auth e dados conforme política — o app só marca deleted_at e recupera
-- no login enquanto o usuário ainda existir no Auth.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.deleted_at IS
  'Preenchido em solicitação de exclusão (soft delete). NULL = conta ativa. '
  'Login limpa o campo (recuperação). Planejar purge em auth após ~30 dias via job.';

-- Marca o perfil da sessão atual como excluído (soft delete).
CREATE OR REPLACE FUNCTION public.soft_delete_own_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.profiles
  SET deleted_at = now(),
      updated_at = now()
  WHERE user_id = auth.uid();

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_own_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_own_profile() TO authenticated;
