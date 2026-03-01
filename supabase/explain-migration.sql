-- ─── Explain usage tracking ────────────────────────────────────────────────
alter table public.user_usage
  add column if not exists explain_count        integer not null default 0,
  add column if not exists explain_period_start date    not null default current_date;

-- ─── explain_shares ─────────────────────────────────────────────────────────
create table if not exists public.explain_shares (
  id               uuid        primary key default gen_random_uuid(),
  hash             text        unique not null,
  highlighted_text text        not null,
  explanation      text        not null,
  mode             text        not null check (mode in ('simple', 'eli10')),
  article_slug     text,
  created_by       uuid        references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

alter table public.explain_shares enable row level security;

-- Public read: share links work without login
create policy "explain_shares_public_read"
  on public.explain_shares for select
  using (true);

-- Only authenticated users can insert their own
create policy "explain_shares_insert_own"
  on public.explain_shares for insert
  with check (auth.uid() = created_by);
