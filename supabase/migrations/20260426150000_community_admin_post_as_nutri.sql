-- Staff com perfil `admin` pode publicar com papel de nutricionista (ex.: acesso master / supremo)
DROP POLICY IF EXISTS "Community publish by role" ON public.community_posts;

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
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
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
