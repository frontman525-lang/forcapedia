
ALTER TABLE study_rooms
  ADD COLUMN IF NOT EXISTS room_name      TEXT,
  ADD COLUMN IF NOT EXISTS topic         TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- ── New columns: room_members ────────────────────────────────────────────────
ALTER TABLE room_members
  ADD COLUMN IF NOT EXISTS join_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (join_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS badge       TEXT,
  ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT now();

-- ── New columns: room_messages ───────────────────────────────────────────────
ALTER TABLE room_messages
  ADD COLUMN IF NOT EXISTS pinned     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS doubt_id   UUID REFERENCES room_messages(id) ON DELETE SET NULL;

-- Extend 'kind' to include 'doubt'
ALTER TABLE room_messages DROP CONSTRAINT IF EXISTS room_messages_kind_check;
ALTER TABLE room_messages
  ADD CONSTRAINT room_messages_kind_check
  CHECK (kind IN ('text', 'explain', 'highlight', 'system', 'doubt'));

-- ── session_summaries ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_summaries (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          UUID        NOT NULL,          -- foreign key not enforced (room may be gone)
  host_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  room_name        TEXT,
  room_code        CHAR(6)     NOT NULL,
  article_slugs    TEXT[]      NOT NULL DEFAULT '{}',
  article_titles   TEXT[]      NOT NULL DEFAULT '{}',
  member_ids       UUID[]      NOT NULL DEFAULT '{}',
  member_names     TEXT[]      NOT NULL DEFAULT '{}',
  member_count     INT         NOT NULL DEFAULT 0,
  doubts_resolved  INT         NOT NULL DEFAULT 0,
  message_count    INT         NOT NULL DEFAULT 0,
  started_at       TIMESTAMPTZ NOT NULL,
  ended_at         TIMESTAMPTZ NOT NULL,
  duration_seconds INT         NOT NULL DEFAULT 0,
  messages_json    JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_summaries_host_idx
  ON session_summaries(host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS session_summaries_room_idx
  ON session_summaries(room_code);

ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;

-- Participants (host + members) can view their own session summaries
CREATE POLICY "participants view session summaries" ON session_summaries
  FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR auth.uid() = ANY(member_ids));

-- ── Indexes for new columns ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS room_members_pending_idx
  ON room_members(room_id, join_status)
  WHERE join_status = 'pending';

CREATE INDEX IF NOT EXISTS room_messages_pinned_idx
  ON room_messages(room_id, pinned)
  WHERE pinned = true;
