-- Run once after 0004. Photo references belong to a turn, never to the closet.
begin;
create table public.stylist_photo_searches (
  turn_id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb, created_at timestamptz not null default now(),
  foreign key (turn_id,user_id) references public.stylist_turns(id,user_id) on delete cascade
);
create index stylist_photo_searches_time_idx on public.stylist_photo_searches(created_at);
alter table public.stylist_photo_searches enable row level security;
revoke all on public.stylist_photo_searches from anon,authenticated;
grant select on public.stylist_photo_searches to authenticated;
create policy "own reference photos" on public.stylist_photo_searches for select to authenticated using (user_id=(select auth.uid()));

create function public.reserve_photo_search(p_turn uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(587431005);
  if not exists(select 1 from public.stylist_turns where id=p_turn and user_id=actor and status='running' and created_at>now()-interval '5 minutes') then raise exception 'Running request unavailable'; end if;
  if exists(select 1 from public.stylist_photo_searches where turn_id=p_turn) then raise exception 'Only one photo search is allowed per request'; end if;
  -- Rolling window and headroom for other requests using this Demo key.
  if (select count(*) from public.stylist_photo_searches where created_at>now()-interval '1 hour') >= 45 then raise exception 'Shared photo-search allowance reached. Try again later; written recommendations still work.'; end if;
  insert into public.stylist_photo_searches(turn_id,user_id) values(p_turn,actor);
end;
$$;
create function public.store_reference_photos(p_turn uuid,p_payload jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>20000
     or jsonb_typeof(p_payload->'photos') is distinct from 'array'
     or jsonb_typeof(p_payload->'query') is distinct from 'string'
     or coalesce(length(p_payload->>'query'),0) not between 1 and 120 then raise exception 'Invalid reference photos'; end if;
  if jsonb_array_length(p_payload->'photos')>3 then raise exception 'Too many reference photos'; end if;
  update public.stylist_photo_searches s set payload=p_payload where s.turn_id=p_turn and s.user_id=actor and s.payload is null
    and exists(select 1 from public.stylist_turns t where t.id=p_turn and t.user_id=actor and t.status='running');
  if not found then raise exception 'Photo search unavailable or already stored'; end if;
end;
$$;
revoke all on function public.reserve_photo_search(uuid),public.store_reference_photos(uuid,jsonb) from public,anon;
grant execute on function public.reserve_photo_search(uuid),public.store_reference_photos(uuid,jsonb) to authenticated;
commit;
