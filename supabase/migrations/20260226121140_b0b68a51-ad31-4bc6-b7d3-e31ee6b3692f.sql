
-- Replace the overly permissive INSERT policy with a restrictive one
-- Notifications are inserted by SECURITY DEFINER trigger functions, not directly by users
DROP POLICY "Service can insert notifications" ON public.notifications;

-- Only allow system/trigger inserts (users should never insert notifications directly)
CREATE POLICY "No direct user inserts on notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (false);
