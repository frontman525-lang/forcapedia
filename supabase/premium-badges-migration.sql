-- Premium Badges Migration
-- Adds preferred_badge to user_usage so badge choice persists across room sessions.
-- The badge column already exists in room_members (added by rooms-v2-migration.sql).
-- When a user joins a room, the server will read this column and set their room badge.

ALTER TABLE public.user_usage
  ADD COLUMN IF NOT EXISTS preferred_badge TEXT;

-- Validate badge values against the known set
ALTER TABLE public.user_usage
  DROP CONSTRAINT IF EXISTS user_usage_preferred_badge_check;

ALTER TABLE public.user_usage
  ADD CONSTRAINT user_usage_preferred_badge_check
  CHECK (preferred_badge IS NULL OR preferred_badge IN (
    'scholar', 'star', 'science', 'bookworm',          -- tier1
    'researcher', 'diamond', 'explorer', 'elite', 'legend'  -- tier2
  ));

-- RLS: users can only update their own preferred_badge
CREATE POLICY IF NOT EXISTS "usage_update_own_badge"
  ON public.user_usage
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
