-- ── Wikipedia integration columns ────────────────────────────────
-- Run this in Supabase SQL Editor

alter table public.articles
  add column if not exists wiki_revid      bigint,
  add column if not exists wiki_url        text,
  add column if not exists wiki_checked_at timestamptz;

-- Index for the daily cron (finds articles due for a freshness check)
create index if not exists articles_wiki_checked_at_idx
  on public.articles (wiki_checked_at asc nulls first)
  where wiki_url is not null;
