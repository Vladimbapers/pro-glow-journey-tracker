-- =========================================
-- 1. ROLES ENUM + user_roles table
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- user_roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- 2. PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  height NUMERIC,
  weight NUMERIC,
  gender TEXT,
  age INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =========================================
-- 3. updated_at trigger function
-- =========================================
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

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 4. Auto-create profile + default role on signup
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- 5. HEALTH TRACKING TABLES
-- =========================================

-- BMI entries
CREATE TABLE public.bmi_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  height NUMERIC NOT NULL,
  weight NUMERIC NOT NULL,
  bmi NUMERIC NOT NULL,
  category TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bmi_entries ENABLE ROW LEVEL SECURITY;

-- Activities
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  calories_burned NUMERIC,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Nutrition entries
CREATE TABLE public.nutrition_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal TEXT NOT NULL,
  food_name TEXT NOT NULL,
  calories NUMERIC,
  protein NUMERIC,
  carbs NUMERIC,
  fat NUMERIC,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrition_entries ENABLE ROW LEVEL SECURITY;

-- Sleep entries
CREATE TABLE public.sleep_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hours NUMERIC NOT NULL,
  quality TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sleep_entries ENABLE ROW LEVEL SECURITY;

-- Hydration entries
CREATE TABLE public.hydration_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_ml INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hydration_entries ENABLE ROW LEVEL SECURITY;

-- Goals
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  target NUMERIC,
  unit TEXT,
  deadline DATE,
  progress NUMERIC NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 6. RLS policies for all tracking tables (DRY via repeated CREATE POLICY)
-- =========================================

-- Helper macro-style: for each table, users manage own rows, admins see all
-- bmi_entries
CREATE POLICY "Users view own bmi" ON public.bmi_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all bmi" ON public.bmi_entries FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own bmi" ON public.bmi_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bmi" ON public.bmi_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own bmi" ON public.bmi_entries FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins delete bmi" ON public.bmi_entries FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- activities
CREATE POLICY "Users view own activities" ON public.activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all activities" ON public.activities FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own activities" ON public.activities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own activities" ON public.activities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own activities" ON public.activities FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins delete activities" ON public.activities FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- nutrition_entries
CREATE POLICY "Users view own nutrition" ON public.nutrition_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all nutrition" ON public.nutrition_entries FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own nutrition" ON public.nutrition_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own nutrition" ON public.nutrition_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own nutrition" ON public.nutrition_entries FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins delete nutrition" ON public.nutrition_entries FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- sleep_entries
CREATE POLICY "Users view own sleep" ON public.sleep_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all sleep" ON public.sleep_entries FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own sleep" ON public.sleep_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sleep" ON public.sleep_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sleep" ON public.sleep_entries FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins delete sleep" ON public.sleep_entries FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- hydration_entries
CREATE POLICY "Users view own hydration" ON public.hydration_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all hydration" ON public.hydration_entries FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own hydration" ON public.hydration_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own hydration" ON public.hydration_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own hydration" ON public.hydration_entries FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins delete hydration" ON public.hydration_entries FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- goals
CREATE POLICY "Users view own goals" ON public.goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all goals" ON public.goals FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own goals" ON public.goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own goals" ON public.goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own goals" ON public.goals FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins delete goals" ON public.goals FOR DELETE USING (public.has_role(auth.uid(), 'admin'));