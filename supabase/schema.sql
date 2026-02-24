-- ─────────────────────────────────────────────────
-- Forcapedia — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Articles (core cache) ────────────────────────
create table if not exists public.articles (
  id           uuid primary key default uuid_generate_v4(),
  slug         text unique not null,
  title        text not null,
  summary      text not null,
  content      text not null,              -- HTML string
  category     text not null default 'Other',
  tags         text[] default '{}',
  sources      text[] default '{}',
  verified_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null,
  view_count       integer not null default 0,
  -- Wikipedia integration (null for pure-AI articles)
  wiki_revid       bigint,
  wiki_url         text,
  wiki_checked_at  timestamptz
);

-- Index for fast slug lookup (every search hits this)
create index if not exists articles_slug_idx      on public.articles(slug);
create index if not exists articles_category_idx  on public.articles(category);
-- Daily cron: find articles due for Wikipedia freshness check
create index if not exists articles_wiki_checked_at_idx
  on public.articles (wiki_checked_at asc nulls first)
  where wiki_url is not null;

-- ─── User Usage & Tier Tracking ───────────────────
create table if not exists public.user_usage (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade unique,
  tier          text not null default 'free',   -- 'free' | 'tier1' | 'tier2'
  tokens_used   integer not null default 0,
  period_start  timestamptz not null default date_trunc('month', now()),
  updated_at    timestamptz not null default now()
);

-- ─── Follow-ups ───────────────────────────────────
create table if not exists public.follow_ups (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade,
  article_slug  text references public.articles(slug) on delete cascade,
  question      text not null,
  answer        text not null,
  created_at    timestamptz not null default now()
);

-- Index: one follow-up per user per article check
create index if not exists followups_user_article_idx
  on public.follow_ups(user_id, article_slug);

-- ─── Saved Articles ───────────────────────────────
create table if not exists public.saved_articles (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade,
  article_slug  text references public.articles(slug) on delete cascade,
  created_at    timestamptz not null default now(),
  unique(user_id, article_slug)
);

-- ─── RPC: Increment token usage ───────────────────
create or replace function public.increment_token_usage(
  p_user_id    uuid,
  p_tokens     integer,
  p_period_start timestamptz
)
returns void
language plpgsql
security definer
as $$
begin
  -- Only allow a user to increment their own token count.
  -- auth.uid() IS NULL means unauthenticated (anon) — always reject.
  if auth.uid() is null or auth.uid() != p_user_id then
    raise exception 'Unauthorized: cannot modify another user''s token usage';
  end if;

  insert into public.user_usage (user_id, tokens_used, period_start)
  values (p_user_id, p_tokens, p_period_start)
  on conflict (user_id) do update
    set tokens_used  = public.user_usage.tokens_used + excluded.tokens_used,
        updated_at   = now();
end;
$$;

-- ─── RPC: Increment view count ────────────────────
create or replace function public.increment_view_count(p_slug text)
returns void
language plpgsql
security definer
as $$
begin
  update public.articles
  set view_count = view_count + 1
  where slug = p_slug;
end;
$$;

-- ─── Row Level Security ───────────────────────────
alter table public.articles     enable row level security;
alter table public.user_usage   enable row level security;
alter table public.follow_ups   enable row level security;
alter table public.saved_articles enable row level security;

-- Articles: anyone can read, only auth users can insert (must own the row)
create policy "articles_read_all"
  on public.articles for select using (true);

create policy "articles_insert_auth"
  on public.articles for insert
  with check (auth.uid() is not null and created_by = auth.uid());

-- User usage: users can only SELECT their own row
-- INSERT is handled by handle_new_user() trigger (security definer)
-- UPDATE/DELETE of tier is server-only (service role bypasses RLS)
create policy "usage_select_own"
  on public.user_usage for select
  using (auth.uid() = user_id);

-- Follow-ups: users see only their own
create policy "followups_own"
  on public.follow_ups for all
  using (auth.uid() = user_id);

-- Saved articles: users see only their own
create policy "saved_own"
  on public.saved_articles for all
  using (auth.uid() = user_id);

-- ─── Auto-create user_usage row on signup ─────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_usage (user_id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
