-- diet_requests: REPLICA IDENTITY FULL.
--
-- Sem isso, eventos de UPDATE no Supabase Realtime entregam apenas a PK no
-- "old record". Com FULL, o old record vem completo, o que é necessário para
-- o motor de Realtime avaliar corretamente RLS em transições de visibilidade
-- (ex.: status 'processing' -> 'pending', que faz a linha aparecer pro nutri
-- de repente). Esse é o jeito recomendado pela Supabase para tabelas com RLS
-- e Realtime ativos simultaneamente.
ALTER TABLE public.diet_requests REPLICA IDENTITY FULL;
