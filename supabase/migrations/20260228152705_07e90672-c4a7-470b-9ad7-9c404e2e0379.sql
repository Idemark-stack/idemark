
-- Fix handle_new_user to handle duplicates gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role, company_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'innovator'),
    NEW.raw_user_meta_data->>'company_name'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Re-attach idea/filter triggers
DROP TRIGGER IF EXISTS on_idea_created ON public.ideas;
CREATE TRIGGER on_idea_created
  AFTER INSERT ON public.ideas
  FOR EACH ROW EXECUTE FUNCTION public.notify_matching_filters();

DROP TRIGGER IF EXISTS on_filter_created ON public.company_filters;
CREATE TRIGGER on_filter_created
  AFTER INSERT ON public.company_filters
  FOR EACH ROW EXECUTE FUNCTION public.notify_matching_ideas();

-- Clean orphaned profiles (no matching auth user)
DELETE FROM public.profiles WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Convert ALL restrictive policies to permissive

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view matched profiles" ON public.profiles;
CREATE POLICY "Users can view matched profiles" ON public.profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.type = 'match' AND n.user_id = auth.uid()
    AND profiles.user_id IN (
      SELECT cf.company_id FROM company_filters cf WHERE cf.id = n.filter_id
      UNION
      SELECT i.user_id FROM ideas i WHERE i.id = n.idea_id
    )
  )
);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- IDEAS
DROP POLICY IF EXISTS "Innovators can view own ideas" ON public.ideas;
CREATE POLICY "Innovators can view own ideas" ON public.ideas FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Companies can view matched ideas" ON public.ideas;
CREATE POLICY "Companies can view matched ideas" ON public.ideas FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM company_filters cf
    WHERE cf.company_id = auth.uid()
    AND (cf.industries IS NULL OR array_length(cf.industries, 1) IS NULL OR ideas.industry = ANY(cf.industries))
  )
);

DROP POLICY IF EXISTS "Innovators can insert own ideas" ON public.ideas;
CREATE POLICY "Innovators can insert own ideas" ON public.ideas FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Innovators can update own ideas" ON public.ideas;
CREATE POLICY "Innovators can update own ideas" ON public.ideas FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Innovators can delete own ideas" ON public.ideas;
CREATE POLICY "Innovators can delete own ideas" ON public.ideas FOR DELETE USING (auth.uid() = user_id);

-- COMPANY_FILTERS
DROP POLICY IF EXISTS "Companies can view own filters" ON public.company_filters;
CREATE POLICY "Companies can view own filters" ON public.company_filters FOR SELECT USING (auth.uid() = company_id);

DROP POLICY IF EXISTS "Companies can insert own filters" ON public.company_filters;
CREATE POLICY "Companies can insert own filters" ON public.company_filters FOR INSERT WITH CHECK (auth.uid() = company_id);

DROP POLICY IF EXISTS "Companies can update own filters" ON public.company_filters;
CREATE POLICY "Companies can update own filters" ON public.company_filters FOR UPDATE USING (auth.uid() = company_id);

DROP POLICY IF EXISTS "Companies can delete own filters" ON public.company_filters;
CREATE POLICY "Companies can delete own filters" ON public.company_filters FOR DELETE USING (auth.uid() = company_id);

-- MESSAGES
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can mark messages read" ON public.messages;
CREATE POLICY "Users can mark messages read" ON public.messages FOR UPDATE USING (auth.uid() = receiver_id);

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- CHALLENGES
DROP POLICY IF EXISTS "Anyone authed can view challenges" ON public.challenges;
CREATE POLICY "Anyone authed can view challenges" ON public.challenges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Companies can insert own challenges" ON public.challenges;
CREATE POLICY "Companies can insert own challenges" ON public.challenges FOR INSERT WITH CHECK (auth.uid() = company_id);

DROP POLICY IF EXISTS "Companies can update own challenges" ON public.challenges;
CREATE POLICY "Companies can update own challenges" ON public.challenges FOR UPDATE USING (auth.uid() = company_id);

DROP POLICY IF EXISTS "Companies can delete own challenges" ON public.challenges;
CREATE POLICY "Companies can delete own challenges" ON public.challenges FOR DELETE USING (auth.uid() = company_id);
