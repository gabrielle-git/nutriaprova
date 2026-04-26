-- =============================================================================
-- Migration inicial — bootstrap do schema (profiles, diet_requests, transactions,
-- client_feedback, referrals) + RLS + trigger de signup.
--
-- Idempotente: todas as criações usam IF NOT EXISTS / DROP + CREATE / CREATE OR
-- REPLACE / DO blocks para que `supabase db push` possa ser re-executado em um
-- banco que já tenha o schema aplicado manualmente/Studio sem falhar.
-- =============================================================================

-- ── Tabelas ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'nutritionist', 'admin')),
  credits INTEGER NOT NULL DEFAULT 0,
  crn_number TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.diet_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nutritionist_id UUID REFERENCES auth.users(id),
  client_data JSONB,
  ai_draft JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'completed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'credit_purchase',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diet_request_id UUID REFERENCES public.diet_requests(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referred_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'converted')),
  commission NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals       ENABLE ROW LEVEL SECURITY;

-- ── Policies: profiles ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
CREATE POLICY "Admin can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- ── Policies: diet_requests ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Clients see own diet requests" ON public.diet_requests;
CREATE POLICY "Clients see own diet requests"
  ON public.diet_requests FOR SELECT TO authenticated
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Nutritionists see pending and own" ON public.diet_requests;
CREATE POLICY "Nutritionists see pending and own"
  ON public.diet_requests FOR SELECT TO authenticated
  USING (status = 'pending' OR nutritionist_id = auth.uid());

DROP POLICY IF EXISTS "Admin sees all diet requests" ON public.diet_requests;
CREATE POLICY "Admin sees all diet requests"
  ON public.diet_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Clients can insert diet requests" ON public.diet_requests;
CREATE POLICY "Clients can insert diet requests"
  ON public.diet_requests FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "Nutritionists can update assigned" ON public.diet_requests;
CREATE POLICY "Nutritionists can update assigned"
  ON public.diet_requests FOR UPDATE TO authenticated
  USING (nutritionist_id = auth.uid() OR status = 'pending');

DROP POLICY IF EXISTS "Admin can update all diet requests" ON public.diet_requests;
CREATE POLICY "Admin can update all diet requests"
  ON public.diet_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- ── Policies: transactions ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own transactions" ON public.transactions;
CREATE POLICY "Users see own transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin sees all transactions" ON public.transactions;
CREATE POLICY "Admin sees all transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin can insert transactions" ON public.transactions;
CREATE POLICY "Admin can insert transactions"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- ── Policies: client_feedback ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Clients can insert feedback" ON public.client_feedback;
CREATE POLICY "Clients can insert feedback"
  ON public.client_feedback FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "Clients can view own feedback" ON public.client_feedback;
CREATE POLICY "Clients can view own feedback"
  ON public.client_feedback FOR SELECT TO authenticated
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Admin sees all feedback" ON public.client_feedback;
CREATE POLICY "Admin sees all feedback"
  ON public.client_feedback FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- ── Policies: referrals ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users see own referrals" ON public.referrals;
CREATE POLICY "Users see own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert referrals" ON public.referrals;
CREATE POLICY "Users can insert referrals"
  ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (referrer_id = auth.uid());

DROP POLICY IF EXISTS "Admin sees all referrals" ON public.referrals;
CREATE POLICY "Admin sees all referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- ── Trigger de signup: handle_new_user ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role, crn_number, credits)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    NEW.raw_user_meta_data->>'crn_number',
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'nutritionist' THEN 2 ELSE 0 END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Realtime: publica diet_requests (tolerante a já estar publicada) ──────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.diet_requests;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL; -- publication pode não existir em ambientes locais
END;
$$;
