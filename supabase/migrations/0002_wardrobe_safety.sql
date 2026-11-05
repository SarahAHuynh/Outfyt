-- Run once after 0001. This adds tables/functions; existing clothing is kept.
begin;

create table public.wardrobe_analysis_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null check (requests between 1 and 10),
  primary key (user_id, window_start)
);
alter table public.wardrobe_analysis_limits enable row level security;
revoke all on public.wardrobe_analysis_limits from anon, authenticated;
grant select on public.wardrobe_analysis_limits to authenticated;
create policy "read own analysis usage" on public.wardrobe_analysis_limits
for select to authenticated using (user_id = (select auth.uid()));

create function public.consume_clothing_analysis_budget() returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); accepted integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  insert into public.wardrobe_analysis_limits (user_id, window_start, requests)
  values (actor, date_trunc('hour', now()), 1)
  on conflict (user_id, window_start) do update
    set requests = public.wardrobe_analysis_limits.requests + 1
    where public.wardrobe_analysis_limits.requests < 10
  returning requests into accepted;
  return accepted is not null;
end;
$$;
revoke all on function public.consume_clothing_analysis_budget() from public, anon;
grant execute on function public.consume_clothing_analysis_budget() to authenticated;

create table public.wardrobe_delete_requests (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  item_updated_at timestamptz not null,
  image_path text,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  completed_at timestamptz
);
create index wardrobe_delete_requests_user_idx on public.wardrobe_delete_requests(user_id);
alter table public.wardrobe_delete_requests enable row level security;
revoke all on public.wardrobe_delete_requests from anon, authenticated;
grant select on public.wardrobe_delete_requests to authenticated;
create policy "read own delete requests" on public.wardrobe_delete_requests
for select to authenticated using (user_id = (select auth.uid()));

-- Only the confirmed RPC may delete clothing; ordinary direct API deletes fail.
revoke delete on public.wardrobe_items from anon, authenticated;

create function public.prepare_wardrobe_delete(p_item_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); item public.wardrobe_items; approval public.wardrobe_delete_requests;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into item from public.wardrobe_items where id = p_item_id and user_id = actor for share;
  if not found then raise exception 'Piece unavailable'; end if;
  if exists (select 1 from public.outfit_items where wardrobe_item_id = item.id) then
    raise exception 'This piece is used in saved outfits. Remove it from those outfits before deleting it.';
  end if;
  delete from public.wardrobe_delete_requests where user_id = actor and (expires_at < now() or item_id = item.id);
  insert into public.wardrobe_delete_requests (user_id, item_id, item_updated_at, image_path)
  values (actor, item.id, item.updated_at, item.image_path) returning * into approval;
  return jsonb_build_object('token', approval.token, 'expires_at', approval.expires_at, 'name', item.name);
end;
$$;

create function public.confirm_wardrobe_delete(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); approval public.wardrobe_delete_requests; item public.wardrobe_items;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into approval from public.wardrobe_delete_requests where token = p_token and user_id = actor for update;
  if not found then raise exception 'Confirmation unavailable'; end if;
  if approval.completed_at is not null then
    return jsonb_build_object('id', approval.item_id, 'image_path', null, 'already_deleted', true);
  end if;
  if approval.expires_at <= now() then raise exception 'Confirmation expired. Request deletion again.'; end if;
  select * into item from public.wardrobe_items where id = approval.item_id and user_id = actor for update;
  if not found then raise exception 'Piece unavailable'; end if;
  if item.updated_at <> approval.item_updated_at then raise exception 'This piece changed. Request deletion again.'; end if;
  if exists (select 1 from public.outfit_items where wardrobe_item_id = item.id) then
    raise exception 'This piece is used in saved outfits. Remove it from those outfits before deleting it.';
  end if;
  delete from public.wardrobe_items where id = item.id and user_id = actor;
  update public.wardrobe_delete_requests set completed_at = now() where token = approval.token;
  return jsonb_build_object('id', item.id, 'image_path', item.image_path, 'already_deleted', false);
end;
$$;
revoke all on function public.prepare_wardrobe_delete(uuid) from public, anon;
revoke all on function public.confirm_wardrobe_delete(uuid) from public, anon;
grant execute on function public.prepare_wardrobe_delete(uuid) to authenticated;
grant execute on function public.confirm_wardrobe_delete(uuid) to authenticated;
commit;
