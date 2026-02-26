-- ─────────────────────────────────────────────────────────────
-- Forcapedia — Event Date Migration
-- Run in: Supabase Dashboard → SQL Editor
-- Adds event_date column to articles table.
-- Safe to run multiple times (IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────

alter table public.articles
  add column if not exists event_date text;

-- Verify
select column_name, data_type
from information_schema.columns
where table_name = 'articles' and column_name = 'event_date';
