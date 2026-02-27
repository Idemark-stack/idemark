
-- ============================================================
-- 1. FIX ALL RLS POLICIES: Change RESTRICTIVE to PERMISSIVE
-- ============================================================

-- == IDEAS ==
DROP POLICY IF EXISTS "Companies can view all ideas" ON public.ideas;
DROP POLICY IF EXISTS "Innovators can delete own ideas" ON public.ideas;
DROP POLICY IF EXISTS "Innovators can insert own ideas" ON public.ideas;
DROP POLICY IF EXISTS "Innovators can update own ideas" ON public.ideas;
DROP POLICY IF EXISTS "Innovators can view own ideas" ON public.ideas;

CREATE POLICY "Innovators can view own ideas" ON public.ideas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Companies can view matched ideas" ON public.ideas
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.company_filters cf
      WHERE cf.company_id = auth.uid()
        AND (cf.industries IS NULL OR array_length(cf.industries, 1) IS NULL OR ideas.industry = ANY(cf.industries))
    )
  );

CREATE POLICY "Innovators can insert own ideas" ON public.ideas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Innovators can update own ideas" ON public.ideas
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Innovators can delete own ideas" ON public.ideas
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- == PROFILES ==
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Allow viewing profiles of matched users (for messaging context)
CREATE POLICY "Users can view matched profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.type = 'match'
        AND (
          (n.user_id = auth.uid() AND profiles.user_id IN (
            SELECT cf.company_id FROM public.company_filters cf WHERE cf.id = n.filter_id
            UNION
            SELECT i.user_id FROM public.ideas i WHERE i.id = n.idea_id
          ))
        )
    )
  );

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- == COMPANY_FILTERS ==
DROP POLICY IF EXISTS "Companies can insert own filters" ON public.company_filters;
DROP POLICY IF EXISTS "Companies can update own filters" ON public.company_filters;
DROP POLICY IF EXISTS "Companies can view own filters" ON public.company_filters;

CREATE POLICY "Companies can view own filters" ON public.company_filters
  FOR SELECT TO authenticated USING (auth.uid() = company_id);

CREATE POLICY "Companies can insert own filters" ON public.company_filters
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Companies can update own filters" ON public.company_filters
  FOR UPDATE TO authenticated USING (auth.uid() = company_id);

CREATE POLICY "Companies can delete own filters" ON public.company_filters
  FOR DELETE TO authenticated USING (auth.uid() = company_id);

-- == CHALLENGES ==
DROP POLICY IF EXISTS "Anyone authed can view challenges" ON public.challenges;
DROP POLICY IF EXISTS "Companies can delete own challenges" ON public.challenges;
DROP POLICY IF EXISTS "Companies can insert own challenges" ON public.challenges;
DROP POLICY IF EXISTS "Companies can update own challenges" ON public.challenges;

CREATE POLICY "Anyone authed can view challenges" ON public.challenges
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Companies can insert own challenges" ON public.challenges
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Companies can update own challenges" ON public.challenges
  FOR UPDATE TO authenticated USING (auth.uid() = company_id);

CREATE POLICY "Companies can delete own challenges" ON public.challenges
  FOR DELETE TO authenticated USING (auth.uid() = company_id);

-- == NOTIFICATIONS ==
DROP POLICY IF EXISTS "No direct user inserts on notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Notifications are inserted by triggers (SECURITY DEFINER), no direct insert policy needed

-- ============================================================
-- 2. CREATE MISSING TRIGGERS
-- ============================================================

CREATE TRIGGER on_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_new_filter_notify
  AFTER INSERT ON public.company_filters
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_matching_ideas();

CREATE TRIGGER on_new_idea_notify
  AFTER INSERT ON public.ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_matching_filters();

-- ============================================================
-- 3. CREATE MESSAGES TABLE for innovator-company communication
-- ============================================================

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  idea_id UUID REFERENCES public.ideas(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.messages
  FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can mark messages read" ON public.messages
  FOR UPDATE TO authenticated USING (auth.uid() = receiver_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
