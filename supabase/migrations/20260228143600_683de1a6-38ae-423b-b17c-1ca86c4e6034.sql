
-- Create the missing triggers for notification matching
CREATE TRIGGER on_filter_created
  AFTER INSERT ON public.company_filters
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_matching_ideas();

CREATE TRIGGER on_idea_created
  AFTER INSERT ON public.ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_matching_filters();

-- Fix ALL RLS policies from RESTRICTIVE to PERMISSIVE

-- IDEAS table
DROP POLICY IF EXISTS "Innovators can view own ideas" ON public.ideas;
DROP POLICY IF EXISTS "Companies can view matched ideas" ON public.ideas;
DROP POLICY IF EXISTS "Innovators can insert own ideas" ON public.ideas;
DROP POLICY IF EXISTS "Innovators can update own ideas" ON public.ideas;
DROP POLICY IF EXISTS "Innovators can delete own ideas" ON public.ideas;

CREATE POLICY "Innovators can view own ideas" ON public.ideas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Companies can view matched ideas" ON public.ideas FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM company_filters cf
    WHERE cf.company_id = auth.uid()
    AND (cf.industries IS NULL OR array_length(cf.industries, 1) IS NULL OR ideas.industry = ANY(cf.industries))
  )
);
CREATE POLICY "Innovators can insert own ideas" ON public.ideas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Innovators can update own ideas" ON public.ideas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Innovators can delete own ideas" ON public.ideas FOR DELETE USING (auth.uid() = user_id);

-- PROFILES table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view matched profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
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
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- COMPANY_FILTERS table
DROP POLICY IF EXISTS "Companies can view own filters" ON public.company_filters;
DROP POLICY IF EXISTS "Companies can insert own filters" ON public.company_filters;
DROP POLICY IF EXISTS "Companies can update own filters" ON public.company_filters;
DROP POLICY IF EXISTS "Companies can delete own filters" ON public.company_filters;

CREATE POLICY "Companies can view own filters" ON public.company_filters FOR SELECT USING (auth.uid() = company_id);
CREATE POLICY "Companies can insert own filters" ON public.company_filters FOR INSERT WITH CHECK (auth.uid() = company_id);
CREATE POLICY "Companies can update own filters" ON public.company_filters FOR UPDATE USING (auth.uid() = company_id);
CREATE POLICY "Companies can delete own filters" ON public.company_filters FOR DELETE USING (auth.uid() = company_id);

-- CHALLENGES table
DROP POLICY IF EXISTS "Anyone authed can view challenges" ON public.challenges;
DROP POLICY IF EXISTS "Companies can insert own challenges" ON public.challenges;
DROP POLICY IF EXISTS "Companies can update own challenges" ON public.challenges;
DROP POLICY IF EXISTS "Companies can delete own challenges" ON public.challenges;

CREATE POLICY "Anyone authed can view challenges" ON public.challenges FOR SELECT USING (true);
CREATE POLICY "Companies can insert own challenges" ON public.challenges FOR INSERT WITH CHECK (auth.uid() = company_id);
CREATE POLICY "Companies can update own challenges" ON public.challenges FOR UPDATE USING (auth.uid() = company_id);
CREATE POLICY "Companies can delete own challenges" ON public.challenges FOR DELETE USING (auth.uid() = company_id);

-- MESSAGES table
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can mark messages read" ON public.messages;

CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can mark messages read" ON public.messages FOR UPDATE USING (auth.uid() = receiver_id);

-- NOTIFICATIONS table
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Storage policies for idea-media bucket (drop existing first)
DROP POLICY IF EXISTS "Anyone can view idea media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload idea media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own idea media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own idea media" ON storage.objects;

CREATE POLICY "Anyone can view idea media" ON storage.objects FOR SELECT USING (bucket_id = 'idea-media');
CREATE POLICY "Authenticated users can upload idea media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'idea-media' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own idea media" ON storage.objects FOR UPDATE USING (bucket_id = 'idea-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own idea media" ON storage.objects FOR DELETE USING (bucket_id = 'idea-media' AND auth.uid()::text = (storage.foldername(name))[1]);
