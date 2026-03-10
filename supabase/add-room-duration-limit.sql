-- Migration: add max_duration_seconds to study_rooms
-- Enforces tier-based session time limits (tier1=2h, tier2=5h).
-- The cron job checks this column every 2 minutes and closes expired rooms.
-- Set at room creation time based on host tier in /api/rooms/create.

ALTER TABLE study_rooms
  ADD COLUMN IF NOT EXISTS max_duration_seconds INTEGER DEFAULT NULL;

-- Backfill existing rooms with a sensible default (2h = tier1 minimum)
-- Leave NULL for rooms that were created before this migration; they won't be closed.
-- (Or set a default: UPDATE study_rooms SET max_duration_seconds = 7200 WHERE max_duration_seconds IS NULL AND status = 'active';)
