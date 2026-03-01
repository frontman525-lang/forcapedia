-- ══════════════════════════════════════════════════════════════════════════════
-- STUDY TOGETHER — DATABASE MIGRATION
-- Run in Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. study_rooms ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS study_rooms (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code          CHAR(6)     NOT NULL UNIQUE,
  host_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_slug  TEXT        NOT NULL,
  article_title TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  max_members   INT         NOT NULL DEFAULT 30,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ
);

-- 2. room_members ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_members (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID        NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT        NOT NULL,
  avatar_color  TEXT        NOT NULL,
  is_host       BOOLEAN     NOT NULL DEFAULT false,
  is_observer   BOOLEAN     NOT NULL DEFAULT false,  -- free tier: read-only
  kicked_at     TIMESTAMPTZ,                          -- non-null = banned from room
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at       TIMESTAMPTZ,
  UNIQUE (room_id, user_id)
);

-- 3. room_messages (wiped on room close) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID        NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT        NOT NULL,
  avatar_color TEXT        NOT NULL,
  content      TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  kind         TEXT        NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'explain', 'highlight', 'system')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. room_highlights (wiped on room close) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS room_highlights (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID        NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT        NOT NULL,
  highlight_color TEXT        NOT NULL,
  selected_text   TEXT        NOT NULL,
  explanation     TEXT,
  article_slug    TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. room_navigation_history (wiped on room close) ───────────────────────────
CREATE TABLE IF NOT EXISTS room_navigation_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID        NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  article_slug  TEXT        NOT NULL,
  article_title TEXT        NOT NULL,
  navigated_by  UUID        REFERENCES auth.users(id),
  navigated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. room_reports ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID        NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  reporter_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  message_id   UUID        REFERENCES room_messages(id) ON DELETE SET NULL,
  reason       TEXT        NOT NULL DEFAULT 'inappropriate',
  reviewed     BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS study_rooms_code_idx       ON study_rooms(code);
CREATE INDEX IF NOT EXISTS study_rooms_status_idx     ON study_rooms(status);
CREATE INDEX IF NOT EXISTS room_members_room_id_idx   ON room_members(room_id);
CREATE INDEX IF NOT EXISTS room_members_user_id_idx   ON room_members(user_id);
CREATE INDEX IF NOT EXISTS room_messages_room_id_idx  ON room_messages(room_id);
CREATE INDEX IF NOT EXISTS room_messages_created_idx  ON room_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS room_highlights_room_idx   ON room_highlights(room_id);
CREATE INDEX IF NOT EXISTS room_nav_history_room_idx  ON room_navigation_history(room_id, navigated_at);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE study_rooms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_highlights         ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_navigation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_reports            ENABLE ROW LEVEL SECURITY;

-- Helper: is caller an active member of the room?
-- (Used in multiple policies; defined once as an inline subquery)

-- study_rooms: members can view their active rooms
CREATE POLICY "members view their rooms" ON study_rooms
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = study_rooms.id
        AND room_members.user_id = auth.uid()
        AND room_members.kicked_at IS NULL
    )
  );

-- room_members: members see each other
CREATE POLICY "members view room members" ON room_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_members rm2
      WHERE rm2.room_id = room_members.room_id
        AND rm2.user_id = auth.uid()
        AND rm2.kicked_at IS NULL
    )
  );

-- room_messages: members read messages
CREATE POLICY "members read messages" ON room_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_messages.room_id
        AND room_members.user_id = auth.uid()
        AND room_members.kicked_at IS NULL
    )
  );

-- room_highlights: members read highlights
CREATE POLICY "members read highlights" ON room_highlights
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_highlights.room_id
        AND room_members.user_id = auth.uid()
        AND room_members.kicked_at IS NULL
    )
  );

-- room_navigation_history: members read nav history
CREATE POLICY "members read nav history" ON room_navigation_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = room_navigation_history.room_id
        AND room_members.user_id = auth.uid()
        AND room_members.kicked_at IS NULL
    )
  );

-- room_reports: reporters read their own reports
CREATE POLICY "reporters read own reports" ON room_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- ── Enable Realtime for relevant tables ──────────────────────────────────────
-- (Run these in Supabase Dashboard → Database → Replication if not auto-enabled)
-- ALTER PUBLICATION supabase_realtime ADD TABLE study_rooms;
-- ALTER PUBLICATION supabase_realtime ADD TABLE room_members;
