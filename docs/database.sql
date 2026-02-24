-- ══════════════════════════════════════════════════════════════
--  FORCAPEDIA — Full Database Schema
--  HOW TO RUN:
--    1. Go to https://supabase.com → your project
--    2. Left sidebar → SQL Editor → New query
--    3. Copy everything below this block → Paste → Run
-- ══════════════════════════════════════════════════════════════


-- ─── 0. Extensions ────────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- ─── 1. Articles ──────────────────────────────────────────────
-- Core cache. Once generated, never regenerated.
-- Every search checks this table first (slug = unique query key).

create table if not exists public.articles (
  id           uuid        primary key default uuid_generate_v4(),
  slug         text        unique not null,
  title        text        not null,
  summary      text        not null,
  content      text        not null,          -- rendered HTML
  category     text        not null default 'Other',
  tags         text[]      default '{}',
  sources      text[]      default '{}',
  verified_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  created_by   uuid        references auth.users(id) on delete set null,
  view_count   integer     not null default 0
);

create index if not exists articles_slug_idx     on public.articles(slug);
create index if not exists articles_category_idx on public.articles(category);
create index if not exists articles_created_idx  on public.articles(created_at desc);


-- ─── 2. User Usage & Tier Tracking ───────────────────────────
-- One row per user. Tracks tier + tokens used this period.
-- Auto-created on first login via trigger (Section 6).

create table if not exists public.user_usage (
  id            uuid        primary key default uuid_generate_v4(),
  user_id       uuid        references auth.users(id) on delete cascade unique,
  tier          text        not null default 'free',  -- 'free' | 'tier1' | 'tier2'
  tokens_used   integer     not null default 0,
  period_start  timestamptz not null default date_trunc('month', now()),
  updated_at    timestamptz not null default now()
);

create index if not exists usage_user_idx on public.user_usage(user_id);


-- ─── 3. Follow-up Questions ───────────────────────────────────
-- Stores Q&A follow-ups per user per article.
-- Free tier: 1 per article. Paid: unlimited.

create table if not exists public.follow_ups (
  id            uuid        primary key default uuid_generate_v4(),
  user_id       uuid        references auth.users(id) on delete cascade,
  article_slug  text        references public.articles(slug) on delete cascade,
  question      text        not null,
  answer        text        not null,
  created_at    timestamptz not null default now()
);

create index if not exists followups_user_article_idx
  on public.follow_ups(user_id, article_slug);


-- ─── 4. Saved Articles ────────────────────────────────────────
-- User's saved/bookmarked articles.

create table if not exists public.saved_articles (
  id            uuid        primary key default uuid_generate_v4(),
  user_id       uuid        references auth.users(id) on delete cascade,
  article_slug  text        references public.articles(slug) on delete cascade,
  created_at    timestamptz not null default now(),
  unique(user_id, article_slug)
);

create index if not exists saved_user_idx on public.saved_articles(user_id);


-- ─── 5. Functions / RPCs ──────────────────────────────────────

-- Increment token usage (called after every DeepSeek API call)
create or replace function public.increment_token_usage(
  p_user_id     uuid,
  p_tokens      integer,
  p_period_start timestamptz
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.user_usage (user_id, tokens_used, period_start)
  values (p_user_id, p_tokens, p_period_start)
  on conflict (user_id) do update
    set tokens_used = public.user_usage.tokens_used + excluded.tokens_used,
        updated_at  = now();
end;
$$;

-- Increment article view count
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


-- ─── 6. Auto-create user_usage row on first login ─────────────
-- Fires when a new user signs up / logs in for the first time.
-- Creates their usage row automatically with tier = 'free'.

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

-- Drop trigger first if it exists (safe to re-run)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─── 7. Row Level Security ────────────────────────────────────
-- Every table locked down. Users only see their own data.

alter table public.articles       enable row level security;
alter table public.user_usage     enable row level security;
alter table public.follow_ups     enable row level security;
alter table public.saved_articles enable row level security;

-- Articles: anyone can read, only logged-in users can insert
drop policy if exists "articles_read_all"    on public.articles;
drop policy if exists "articles_insert_auth" on public.articles;

create policy "articles_read_all"
  on public.articles for select using (true);

create policy "articles_insert_auth"
  on public.articles for insert
  with check (auth.uid() is not null);

-- User usage: each user sees only their own row
drop policy if exists "usage_own" on public.user_usage;

create policy "usage_own"
  on public.user_usage for all
  using (auth.uid() = user_id);

-- Follow-ups: each user sees only their own
drop policy if exists "followups_own" on public.follow_ups;

create policy "followups_own"
  on public.follow_ups for all
  using (auth.uid() = user_id);

-- Saved articles: each user sees only their own
drop policy if exists "saved_own" on public.saved_articles;

create policy "saved_own"
  on public.saved_articles for all
  using (auth.uid() = user_id);


-- ══════════════════════════════════════════════════════════════
--  Done. Tables created:
--    ✓ articles        — AI-generated knowledge cache
--    ✓ user_usage      — tier + token tracking per user
--    ✓ follow_ups      — Q&A follow-ups per article
--    ✓ saved_articles  — user bookmarks
--  Functions:
--    ✓ increment_token_usage()
--    ✓ increment_view_count()
--  Triggers:
--    ✓ on_auth_user_created → auto-creates user_usage row
-- ══════════════════════════════════════════════════════════════
