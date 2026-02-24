
drop policy if exists "articles_insert_auth" on public.articles;
create policy "articles_insert_auth"
  on public.articles for insert
  with check (auth.uid() is not null and created_by = auth.uid());



drop policy if exists "usage_own" on public.user_usage;
create policy "usage_select_own"
  on public.user_usage for select
  using (auth.uid() = user_id);



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
  -- Reject unauthenticated (null) AND cross-user calls
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
