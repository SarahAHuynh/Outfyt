-- Run once after 0002. Preserves existing wardrobe and outfits.
begin;

create table public.stylist_turns (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'running' check (status in ('running','completed','failed')),
  response jsonb, created_at timestamptz not null default now(), completed_at timestamptz,
  unique (id, user_id)
);
create index stylist_turns_user_idx on public.stylist_turns(user_id, created_at desc);
create table public.stylist_messages (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  turn_id uuid not null, role text not null check (role in ('user','assistant')),
  content text not null check (length(content) between 1 and 8000), created_at timestamptz not null default now(),
  foreign key (turn_id, user_id) references public.stylist_turns(id, user_id) on delete cascade,
  unique (turn_id, role)
);
create index stylist_messages_user_idx on public.stylist_messages(user_id, created_at desc);
create table public.outfit_candidates (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  turn_id uuid not null, ordinal integer not null check (ordinal between 1 and 3), payload jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (turn_id, user_id) references public.stylist_turns(id, user_id) on delete cascade,
  unique (turn_id, ordinal)
);
create index outfit_candidates_user_idx on public.outfit_candidates(user_id, created_at desc);
create table public.agent_pending_actions (
  token uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  action_name text not null check (action_name in ('delete_outfit','delete_clothing_item','update_style_profile')),
  payload jsonb not null, log_id uuid not null references public.agent_action_logs(id),
  status text not null default 'awaiting_confirmation' check (status in ('awaiting_confirmation','completed','rejected')),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now(), result jsonb
);
create index agent_pending_user_idx on public.agent_pending_actions(user_id, created_at desc);

alter table public.stylist_turns enable row level security;
alter table public.stylist_messages enable row level security;
alter table public.outfit_candidates enable row level security;
alter table public.agent_pending_actions enable row level security;
revoke all on public.stylist_turns, public.stylist_messages, public.outfit_candidates, public.agent_pending_actions from anon, authenticated;
grant select on public.stylist_turns, public.stylist_messages, public.outfit_candidates, public.agent_pending_actions to authenticated;
create policy "own stylist turns" on public.stylist_turns for select to authenticated using (user_id = (select auth.uid()));
create policy "own stylist messages" on public.stylist_messages for select to authenticated using (user_id = (select auth.uid()));
create policy "own outfit candidates" on public.outfit_candidates for select to authenticated using (user_id = (select auth.uid()));
create policy "own pending actions" on public.agent_pending_actions for select to authenticated using (user_id = (select auth.uid()));

-- Agent logs and sensitive aggregate writes use checked functions below.
revoke insert, update, delete on public.agent_action_logs, public.outfits, public.outfit_items, public.style_profiles from anon, authenticated;

create function public.begin_stylist_turn(p_id uuid, p_message text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); existing public.stylist_turns;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if length(trim(p_message)) not between 1 and 2000 then raise exception 'Message must be between 1 and 2000 characters'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  select * into existing from public.stylist_turns where id = p_id;
  if found then
    if existing.user_id <> actor then raise exception 'Request unavailable'; end if;
    return jsonb_build_object('status',existing.status,'response',existing.response);
  end if;
  if exists (select 1 from public.stylist_turns where user_id = actor and status = 'running' and created_at > now() - interval '5 minutes') then
    raise exception 'A stylist request is already running. Wait for it to finish.';
  end if;
  if (select count(*) from public.stylist_turns where user_id = actor and created_at >= date_trunc('hour',now())) >= 10 then
    raise exception 'Hourly stylist limit reached. Try again next hour.';
  end if;
  insert into public.stylist_turns(id,user_id) values(p_id,actor);
  insert into public.stylist_messages(user_id,turn_id,role,content) values(actor,p_id,'user',trim(p_message));
  return jsonb_build_object('status','claimed');
end;
$$;

create function public.finish_stylist_turn(p_id uuid, p_text text, p_failed boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Authentication required'; end if;
  perform 1 from public.stylist_turns where id = p_id and user_id = actor and status = 'running' for update;
  if not found then raise exception 'Running request unavailable'; end if;
  insert into public.stylist_messages(user_id,turn_id,role,content) values(actor,p_id,'assistant',left(p_text,8000));
  update public.stylist_turns set status = case when p_failed then 'failed' else 'completed' end,
    response = jsonb_build_object('message',left(p_text,8000)), completed_at = now() where id = p_id and user_id = actor;
end;
$$;

create function public.record_agent_action(p_id uuid, p_action text, p_args jsonb, p_status text, p_confirmation text, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if p_status not in ('pending','awaiting_confirmation','completed','failed','rejected') then raise exception 'Invalid action status'; end if;
  if jsonb_typeof(p_args) is distinct from 'object' or octet_length(p_args::text) > 3000 then raise exception 'Invalid log arguments'; end if;
  if length(p_action) > 80 then raise exception 'Invalid action name'; end if;
  if exists (select 1 from public.agent_action_logs where id = p_id and user_id <> actor) then raise exception 'Action unavailable'; end if;
  insert into public.agent_action_logs(id,user_id,action_name,sanitized_arguments,status,confirmation_status,error_message)
    values(p_id,actor,p_action,p_args,p_status,p_confirmation,left(p_error,500))
  on conflict(id) do update set status = excluded.status, confirmation_status = excluded.confirmation_status, error_message = excluded.error_message
    where public.agent_action_logs.user_id = actor and public.agent_action_logs.status not in ('completed','rejected');
end;
$$;

create function public.store_outfit_candidates(p_turn uuid, p_candidates jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); candidate jsonb; ids uuid[];
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.stylist_turns where id = p_turn and user_id = actor and status = 'running') then raise exception 'Running request unavailable'; end if;
  if jsonb_typeof(p_candidates) is distinct from 'array' or jsonb_array_length(p_candidates) not between 1 and 3 then raise exception 'Invalid candidates'; end if;
  for candidate in select value from jsonb_array_elements(p_candidates) loop
    select array_agg(value::uuid) into ids from jsonb_array_elements_text(candidate->'item_ids');
    if coalesce(cardinality(ids),0) not between 1 and 12 or cardinality(ids) <> (select count(distinct x) from unnest(ids) x) then raise exception 'Invalid clothing references'; end if;
    if exists (select 1 from unnest(ids) x where not exists (select 1 from public.wardrobe_items w where w.id = x and w.user_id = actor)) then raise exception 'Missing or unowned clothing reference'; end if;
    insert into public.outfit_candidates(id,user_id,turn_id,ordinal,payload)
      values((candidate->>'id')::uuid,actor,p_turn,(candidate->>'ordinal')::integer,candidate - 'id' - 'turn_id' - 'ordinal');
  end loop;
end;
$$;

create function public.write_outfit(p_id uuid, p_details jsonb, p_item_ids uuid[], p_expected timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_outfit public.outfits; saved public.outfits;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 2));
  if coalesce(cardinality(p_item_ids),0) not between 1 and 12 or cardinality(p_item_ids) <> (select count(distinct x) from unnest(p_item_ids) x) then raise exception 'Invalid outfit items'; end if;
  -- Lock clothing references until the full outfit transaction commits.
  perform 1 from public.wardrobe_items where user_id = actor and id = any(p_item_ids) for share;
  if (select count(*) from public.wardrobe_items where user_id = actor and id = any(p_item_ids)) <> cardinality(p_item_ids) then raise exception 'Missing or unowned clothing reference'; end if;
  if length(trim(p_details->>'name')) not between 1 and 100 or length(coalesce(p_details->>'description','')) > 1000 then raise exception 'Invalid outfit details'; end if;
  select * into current_outfit from public.outfits where id = p_id for update;
  if found then
    if current_outfit.user_id <> actor then raise exception 'Outfit unavailable'; end if;
    if p_expected is null then return to_jsonb(current_outfit) || jsonb_build_object('item_ids',(select jsonb_agg(wardrobe_item_id order by position) from public.outfit_items where outfit_id = p_id and user_id = actor)); end if;
    if current_outfit.updated_at <> p_expected then raise exception 'Outfit changed. Refresh before editing.'; end if;
    update public.outfits set name = p_details->>'name', occasion = p_details->>'occasion', aesthetic = p_details->>'aesthetic',
      description = p_details->>'description', is_favorite = coalesce((p_details->>'is_favorite')::boolean,false)
      where id = p_id and user_id = actor returning * into saved;
    delete from public.outfit_items where outfit_id = p_id and user_id = actor;
  else
    if p_expected is not null then raise exception 'Outfit unavailable'; end if;
    insert into public.outfits(id,user_id,name,occasion,aesthetic,description,is_favorite)
      values(p_id,actor,p_details->>'name',p_details->>'occasion',p_details->>'aesthetic',p_details->>'description',coalesce((p_details->>'is_favorite')::boolean,false)) returning * into saved;
  end if;
  insert into public.outfit_items(outfit_id,wardrobe_item_id,user_id,position)
    select p_id, item_id, actor, (position - 1)::integer from unnest(p_item_ids) with ordinality as x(item_id,position);
  return to_jsonb(saved) || jsonb_build_object('item_ids',to_jsonb(p_item_ids));
end;
$$;

create function public.prepare_agent_action(p_action text, p_payload jsonb, p_log_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); pending public.agent_pending_actions; outfit public.outfits; style public.style_profiles; inner_approval jsonb; payload jsonb; field text;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.agent_action_logs where id = p_log_id and user_id = actor and action_name = p_action and status = 'pending') then raise exception 'Action log unavailable'; end if;
  if p_action = 'delete_outfit' then
    select * into outfit from public.outfits where id = (p_payload->>'id')::uuid and user_id = actor for share;
    if not found then raise exception 'Outfit unavailable'; end if;
    payload := jsonb_build_object('id',outfit.id,'name',outfit.name,'expected_version',outfit.updated_at);
  elsif p_action = 'delete_clothing_item' then
    inner_approval := public.prepare_wardrobe_delete((p_payload->>'id')::uuid);
    payload := jsonb_build_object('id',p_payload->>'id','name',inner_approval->>'name','wardrobe_token',inner_approval->>'token');
  elsif p_action = 'update_style_profile' then
    foreach field in array array['aesthetic_tags','preferred_colors','favorite_clothing_types','disliked_styles'] loop
      if jsonb_typeof(p_payload->field) is distinct from 'array' or jsonb_array_length(p_payload->field) > 12 then raise exception 'Invalid style preferences'; end if;
      if exists (select 1 from jsonb_array_elements(p_payload->field) v where jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}') not between 1 and 40) then raise exception 'Invalid style preference'; end if;
    end loop;
    if jsonb_typeof(p_payload->'style_summary') is distinct from 'string' or length(p_payload->>'style_summary') > 1000 then raise exception 'Invalid style summary'; end if;
    select * into style from public.style_profiles where user_id = actor for share;
    payload := jsonb_build_object('proposal',p_payload,'expected_version',style.updated_at,'name','Style DNA preferences');
  else raise exception 'Action is not allowlisted'; end if;
  insert into public.agent_pending_actions(user_id,action_name,payload,log_id) values(actor,p_action,payload,p_log_id) returning * into pending;
  update public.agent_action_logs set status = 'awaiting_confirmation', confirmation_status = 'awaiting_confirmation' where id = p_log_id and user_id = actor;
  return jsonb_build_object('status','awaiting_confirmation','token',pending.token,'action_name',pending.action_name,'payload',payload - 'wardrobe_token' - 'expected_version','expires_at',pending.expires_at);
end;
$$;

create function public.resolve_agent_action(p_token uuid, p_approve boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); pending public.agent_pending_actions; outfit public.outfits; style public.style_profiles; proposal jsonb; outcome jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 1));
  select * into pending from public.agent_pending_actions where token = p_token and user_id = actor for update;
  if not found then raise exception 'Confirmation unavailable'; end if;
  if pending.status <> 'awaiting_confirmation' then return jsonb_build_object('status',pending.status,'result',pending.result,'already_resolved',true); end if;
  if p_approve is distinct from true or pending.expires_at <= now() then
    outcome := jsonb_build_object('message',case when p_approve then 'Confirmation expired. Request the action again.' else 'Action rejected. Nothing was changed.' end);
    update public.agent_pending_actions set status = 'rejected', result = outcome where token = pending.token;
    update public.agent_action_logs set status = 'rejected', confirmation_status = 'rejected' where id = pending.log_id and user_id = actor;
    return jsonb_build_object('status','rejected','result',outcome);
  end if;
  if pending.action_name = 'delete_outfit' then
    select * into outfit from public.outfits where id = (pending.payload->>'id')::uuid and user_id = actor for update;
    if not found then raise exception 'Outfit unavailable'; end if;
    if outfit.updated_at <> (pending.payload->>'expected_version')::timestamptz then raise exception 'Outfit changed. Request confirmation again.'; end if;
    delete from public.outfits where id = outfit.id and user_id = actor;
    outcome := jsonb_build_object('message','Outfit deleted.','id',outfit.id);
  elsif pending.action_name = 'delete_clothing_item' then
    outcome := public.confirm_wardrobe_delete((pending.payload->>'wardrobe_token')::uuid) || jsonb_build_object('message','Clothing item deleted.');
  elsif pending.action_name = 'update_style_profile' then
    select * into style from public.style_profiles where user_id = actor for update;
    if style.updated_at is distinct from (pending.payload->>'expected_version')::timestamptz then raise exception 'Style DNA changed. Request confirmation again.'; end if;
    proposal := pending.payload->'proposal';
    insert into public.style_profiles(user_id,aesthetic_tags,preferred_colors,favorite_clothing_types,disliked_styles,style_summary)
    values(actor,array(select jsonb_array_elements_text(proposal->'aesthetic_tags')),array(select jsonb_array_elements_text(proposal->'preferred_colors')),
      array(select jsonb_array_elements_text(proposal->'favorite_clothing_types')),array(select jsonb_array_elements_text(proposal->'disliked_styles')),proposal->>'style_summary')
    on conflict(user_id) do update set aesthetic_tags = excluded.aesthetic_tags, preferred_colors = excluded.preferred_colors,
      favorite_clothing_types = excluded.favorite_clothing_types, disliked_styles = excluded.disliked_styles, style_summary = excluded.style_summary;
    outcome := jsonb_build_object('message','Style DNA preferences updated.');
  end if;
  update public.agent_pending_actions set status = 'completed', result = outcome - 'image_path' where token = pending.token;
  update public.agent_action_logs set status = 'completed', confirmation_status = 'approved' where id = pending.log_id and user_id = actor;
  return jsonb_build_object('status','completed','result',outcome);
end;
$$;

revoke all on function public.begin_stylist_turn(uuid,text) from public, anon;
revoke all on function public.finish_stylist_turn(uuid,text,boolean) from public, anon;
revoke all on function public.record_agent_action(uuid,text,jsonb,text,text,text) from public, anon;
revoke all on function public.store_outfit_candidates(uuid,jsonb) from public, anon;
revoke all on function public.write_outfit(uuid,jsonb,uuid[],timestamptz) from public, anon;
revoke all on function public.prepare_agent_action(text,jsonb,uuid) from public, anon;
revoke all on function public.resolve_agent_action(uuid,boolean) from public, anon;
grant execute on function public.begin_stylist_turn(uuid,text), public.finish_stylist_turn(uuid,text,boolean),
  public.record_agent_action(uuid,text,jsonb,text,text,text), public.store_outfit_candidates(uuid,jsonb),
  public.write_outfit(uuid,jsonb,uuid[],timestamptz), public.prepare_agent_action(text,jsonb,uuid), public.resolve_agent_action(uuid,boolean) to authenticated;
commit;
