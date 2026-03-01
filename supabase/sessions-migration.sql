-- Sessions table: tracks browser sessions per user for Account → Sessions tab
-- Run this in your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_key  text        NOT NULL,
  country      text,
  city         text,
  timezone     text,
  browser      text,
  os           text,
  device_type  text,                      -- 'mobile' | 'tablet' | 'desktop'
  last_active  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_key)
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx
  ON public.user_sessions (user_id);

-- RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions"
  ON public.user_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.user_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.user_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.user_sessions FOR DELETE
  USING (auth.uid() = user_id);
