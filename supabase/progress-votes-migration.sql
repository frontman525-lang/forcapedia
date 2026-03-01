-- ─────────────────────────────────────────────────────────────────────────────
-- Forcapedia — Progress Tracking & Helpful Votes Migration
-- Run in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Reading History ──────────────────────────────────────────────────────────
-- Tracks which articles each user has read (upsert on revisit updates read_at).
create table if not exists public.reading_history (
  user_id          uuid not null references auth.users(id) on delete cascade,
  article_slug     text not null,
  article_title    text not null,
  article_category text not null default 'Other',
  read_at          timestamptz not null default now(),
  primary key (user_id, article_slug)
);

create index if not exists reading_history_user_read_idx
  on public.reading_history (user_id, read_at desc);

alter table public.reading_history enable row level security;

-- Users can only read/write their own reading history
create policy "history_own"
  on public.reading_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ─── Article Votes (Helpful Counter) ─────────────────────────────────────────
-- One row per (user, article) pair. No score — just presence/absence of a vote.
create table if not exists public.article_votes (
  user_id      uuid not null references auth.users(id) on delete cascade,
  article_slug text not null,
  created_at   timestamptz not null default now(),
  primary key (user_id, article_slug)
);

-- Fast count queries per article
create index if not exists votes_slug_idx on public.article_votes (article_slug);

alter table public.article_votes enable row level security;

-- Anyone can see vote counts (needed for public display + Supabase Realtime)
create policy "votes_read_all"
  on public.article_votes for select using (true);

-- Auth users can only add/remove their own vote
create policy "votes_insert_own"
  on public.article_votes for insert
  with check (auth.uid() = user_id);

create policy "votes_delete_own"
  on public.article_votes for delete
  using (auth.uid() = user_id);


-- ─── Enable Realtime for article_votes ───────────────────────────────────────
-- In Supabase Dashboard → Table Editor → article_votes → Enable Realtime
-- OR run: alter publication supabase_realtime add table public.article_votes;
-- (The publication may already exist — only the ADD TABLE part is needed.)
alter publication supabase_realtime add table public.article_votes;
