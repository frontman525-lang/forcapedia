-- ─────────────────────────────────────────────────────────────────────────────
-- Forcapedia — Explain Cooldown Migration
-- Adds last_explain_at column to user_usage for 10-second cooldown enforcement.
-- Run in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.user_usage
  add column if not exists last_explain_at timestamptz;
