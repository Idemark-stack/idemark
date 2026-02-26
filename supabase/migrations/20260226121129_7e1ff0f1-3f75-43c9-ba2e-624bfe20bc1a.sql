
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'match',
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  idea_id UUID REFERENCES public.ideas(id) ON DELETE CASCADE,
  filter_id UUID REFERENCES public.company_filters(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Create storage bucket for idea media
INSERT INTO storage.buckets (id, name, public) VALUES ('idea-media', 'idea-media', true);

-- Storage policies
CREATE POLICY "Anyone can view idea media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'idea-media');

CREATE POLICY "Authenticated users can upload idea media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'idea-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own idea media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'idea-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own idea media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'idea-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to create notifications when company filter matches existing ideas
CREATE OR REPLACE FUNCTION public.notify_matching_ideas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  idea_record RECORD;
BEGIN
  -- Find ideas matching the company filter
  FOR idea_record IN
    SELECT i.id, i.title, i.industry, i.user_id
    FROM public.ideas i
    WHERE 
      (NEW.industries IS NULL OR array_length(NEW.industries, 1) IS NULL OR i.industry = ANY(NEW.industries))
      AND (NEW.stage_required IS NULL OR array_length(NEW.stage_required, 1) IS NULL OR i.stage = ANY(NEW.stage_required))
      AND (NEW.region IS NULL OR NEW.region = '' OR i.region ILIKE '%' || NEW.region || '%')
      AND (NEW.funding_min IS NULL OR NEW.funding_min = 0 OR i.funding_required >= NEW.funding_min)
      AND (NEW.funding_max IS NULL OR NEW.funding_max = 0 OR i.funding_required <= NEW.funding_max)
  LOOP
    -- Notify the company about the matching idea
    INSERT INTO public.notifications (user_id, type, title, message, idea_id, filter_id)
    VALUES (
      NEW.company_id,
      'match',
      'New Match: ' || idea_record.title,
      'An idea in ' || idea_record.industry || ' matches your innovation filter.',
      idea_record.id,
      NEW.id
    );
    -- Notify the innovator that their idea was matched
    INSERT INTO public.notifications (user_id, type, title, message, idea_id, filter_id)
    VALUES (
      idea_record.user_id,
      'match',
      'Your idea matched a company!',
      'Your idea "' || idea_record.title || '" matched a company''s innovation filter.',
      idea_record.id,
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

-- Trigger on filter insert/update
CREATE TRIGGER on_company_filter_change
  AFTER INSERT OR UPDATE ON public.company_filters
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_matching_ideas();

-- Also notify when a new idea is submitted and matches existing filters
CREATE OR REPLACE FUNCTION public.notify_matching_filters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  filter_record RECORD;
BEGIN
  FOR filter_record IN
    SELECT cf.id, cf.company_id, p.company_name
    FROM public.company_filters cf
    JOIN public.profiles p ON p.user_id = cf.company_id
    WHERE 
      (cf.industries IS NULL OR array_length(cf.industries, 1) IS NULL OR NEW.industry = ANY(cf.industries))
      AND (cf.stage_required IS NULL OR array_length(cf.stage_required, 1) IS NULL OR NEW.stage = ANY(cf.stage_required))
      AND (cf.region IS NULL OR cf.region = '' OR NEW.region ILIKE '%' || cf.region || '%')
      AND (cf.funding_min IS NULL OR cf.funding_min = 0 OR NEW.funding_required >= cf.funding_min)
      AND (cf.funding_max IS NULL OR cf.funding_max = 0 OR NEW.funding_required <= cf.funding_max)
  LOOP
    -- Notify company
    INSERT INTO public.notifications (user_id, type, title, message, idea_id, filter_id)
    VALUES (
      filter_record.company_id,
      'match',
      'New Match: ' || NEW.title,
      'A new idea in ' || NEW.industry || ' matches your innovation filter.',
      NEW.id,
      filter_record.id
    );
    -- Notify innovator
    INSERT INTO public.notifications (user_id, type, title, message, idea_id, filter_id)
    VALUES (
      NEW.user_id,
      'match',
      'Your idea matched ' || COALESCE(filter_record.company_name, 'a company') || '!',
      'Your idea "' || NEW.title || '" matched an innovation filter.',
      NEW.id,
      filter_record.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_idea_submitted
  AFTER INSERT ON public.ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_matching_filters();
