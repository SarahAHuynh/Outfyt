-- Run once after 0005. Preserves existing profiles, clothes, chats and looks.
begin;
alter table public.style_profiles add column notes text not null default '';
alter table public.inspiration_images add column name text not null default 'Inspiration';
revoke insert,update,delete on public.inspiration_images,public.pinterest_connections from anon,authenticated;

create table public.inspiration_analyses (
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
  image_ids uuid[] not null,status text not null default 'running' check(status in ('running','completed','failed')),
  proposal jsonb,created_at timestamptz not null default now()
);
create index inspiration_analyses_user_idx on public.inspiration_analyses(user_id,created_at desc);
alter table public.inspiration_analyses enable row level security;
revoke all on public.inspiration_analyses from anon,authenticated;
grant select on public.inspiration_analyses to authenticated;
create policy "own inspiration analyses" on public.inspiration_analyses for select to authenticated using(user_id=(select auth.uid()));

create table public.inspiration_delete_requests (
  token uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
  image_id uuid not null,image_path text not null,expires_at timestamptz not null default now()+interval '10 minutes',
  resolved boolean not null default false,approved boolean
);
alter table public.inspiration_delete_requests enable row level security;
revoke all on public.inspiration_delete_requests from anon,authenticated;

create function public.register_inspiration(p_id uuid,p_path text,p_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); image public.inspiration_images;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,6));
  select * into image from public.inspiration_images where id=p_id;
  if found then
    if image.user_id<>actor then raise exception 'Image unavailable'; end if;
    return to_jsonb(image);
  end if;
  if exists(select 1 from public.inspiration_delete_requests where image_id=p_id) then raise exception 'Image unavailable'; end if;
  if p_path is null or p_path !~ ('^'||actor::text||'/'||p_id::text||'\.(jpg|png|webp)$') or coalesce(length(trim(p_name)),0) not between 1 and 100 then raise exception 'Invalid inspiration image'; end if;
  if (select count(*) from public.inspiration_images where user_id=actor)>=50 then raise exception 'Keep up to 50 inspiration images. Remove an image before adding another.'; end if;
  insert into public.inspiration_images(id,user_id,image_path,name,source_type) values(p_id,actor,p_path,trim(p_name),'upload') returning * into image;
  return to_jsonb(image);
end;
$$;

create function public.claim_inspiration_analysis(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ids uuid[]; existing public.inspiration_analyses;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,7));
  if coalesce(cardinality(p_ids),0) not between 1 and 5 or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x) then raise exception 'Select one to five distinct images'; end if;
  select array_agg(x order by x) into ids from unnest(p_ids) x;
  if (select count(*) from public.inspiration_images where user_id=actor and id=any(ids))<>cardinality(ids) then raise exception 'Image unavailable'; end if;
  select * into existing from public.inspiration_analyses where user_id=actor and image_ids=ids and status='completed' order by created_at desc limit 1;
  if found then return jsonb_build_object('id',existing.id,'status','cached','proposal',existing.proposal); end if;
  if exists(select 1 from public.inspiration_analyses where user_id=actor and status='running' and created_at>now()-interval '5 minutes') then raise exception 'An inspiration analysis is already running. Wait for it to finish.'; end if;
  if (select count(*) from public.inspiration_analyses where user_id=actor and created_at>=date_trunc('hour',now()))>=10 then raise exception 'Inspiration analysis limit reached: 10 requests per hour. Try next hour.'; end if;
  insert into public.inspiration_analyses(user_id,image_ids) values(actor,ids) returning * into existing;
  return jsonb_build_object('id',existing.id,'status','claimed');
end;
$$;
create function public.finish_inspiration_analysis(p_id uuid,p_proposal jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); analysis public.inspiration_analyses;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into analysis from public.inspiration_analyses where id=p_id and user_id=actor and status='running' for update;
  if not found then raise exception 'Analysis unavailable'; end if;
  if p_proposal is not null and (jsonb_typeof(p_proposal) is distinct from 'object' or octet_length(p_proposal::text)>10000) then raise exception 'Invalid analysis'; end if;
  if p_proposal is not null and (select count(*) from public.inspiration_images where user_id=actor and id=any(analysis.image_ids))<>cardinality(analysis.image_ids) then raise exception 'An inspiration image changed. Analyze again.'; end if;
  update public.inspiration_analyses set status=case when p_proposal is null then 'failed' else 'completed' end,proposal=p_proposal where id=analysis.id;
end;
$$;

create function public.prepare_style_profile(p_profile jsonb,p_expected timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current_style public.style_profiles; log_id uuid:=gen_random_uuid(); pending jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,1));
  select * into current_style from public.style_profiles where user_id=actor for share;
  if current_style.updated_at is distinct from p_expected then raise exception 'Style DNA changed. Reload your saved preferences before reviewing.'; end if;
  if jsonb_typeof(p_profile->'comfort_preferences') is distinct from 'string' or length(p_profile->>'comfort_preferences')>1000
     or jsonb_typeof(p_profile->'notes') is distinct from 'string' or length(p_profile->>'notes')>1000 then raise exception 'Invalid style details'; end if;
  perform public.record_agent_action(log_id,'update_style_profile','{"source":"style_dna_editor"}','pending','not_required',null);
  pending:=public.prepare_agent_action('update_style_profile',p_profile-'comfort_preferences'-'notes',log_id);
  update public.agent_pending_actions set payload=jsonb_set(payload,'{proposal}',p_profile) where token=(pending->>'token')::uuid and user_id=actor;
  return pending || jsonb_build_object('payload',(pending->'payload')||jsonb_build_object('proposal',p_profile));
end;
$$;

-- Keep existing atomic approval checks and extend only the approved profile fields.
alter function public.resolve_agent_action(uuid,boolean) rename to resolve_agent_action_legacy;
revoke all on function public.resolve_agent_action_legacy(uuid,boolean) from public,anon,authenticated;
create function public.resolve_agent_action(p_token uuid,p_approve boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); pending public.agent_pending_actions; result jsonb; proposal jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,1));
  select * into pending from public.agent_pending_actions where token=p_token and user_id=actor for update;
  result:=public.resolve_agent_action_legacy(p_token,p_approve);
  if pending.status='awaiting_confirmation' and pending.action_name='update_style_profile' and result->>'status'='completed' then
    proposal:=pending.payload->'proposal';
    if proposal ? 'comfort_preferences' and proposal ? 'notes' then
      if jsonb_typeof(proposal->'comfort_preferences') is distinct from 'string' or length(proposal->>'comfort_preferences')>1000
        or jsonb_typeof(proposal->'notes') is distinct from 'string' or length(proposal->>'notes')>1000 then raise exception 'Invalid style details'; end if;
      update public.style_profiles set comfort_preferences=proposal->>'comfort_preferences',notes=proposal->>'notes' where user_id=actor;
    end if;
  end if;
  return result;
end;
$$;

create function public.prepare_inspiration_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); image public.inspiration_images; pending public.inspiration_delete_requests;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into image from public.inspiration_images where id=p_id and user_id=actor for share;
  if not found then raise exception 'Image unavailable'; end if;
  insert into public.inspiration_delete_requests(user_id,image_id,image_path) values(actor,image.id,image.image_path) returning * into pending;
  return jsonb_build_object('token',pending.token,'expires_at',pending.expires_at,'name',image.name);
end;
$$;
create function public.resolve_inspiration_delete(p_token uuid,p_approve boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); pending public.inspiration_delete_requests;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into pending from public.inspiration_delete_requests where token=p_token and user_id=actor for update;
  if not found then raise exception 'Confirmation unavailable'; end if;
  if not pending.resolved then
    if p_approve is true and pending.expires_at>now() then
      delete from public.inspiration_images where id=pending.image_id and user_id=actor and image_path=pending.image_path;
      delete from public.inspiration_analyses where user_id=actor and pending.image_id=any(image_ids);
      update public.inspiration_delete_requests set resolved=true,approved=true where token=p_token;
      pending.approved:=true;
    else
      update public.inspiration_delete_requests set resolved=true,approved=false where token=p_token;
      pending.approved:=false;
    end if;
  end if;
  return jsonb_build_object('deleted',pending.approved,'image_path',case when pending.approved then pending.image_path else null end);
end;
$$;

create function public.save_pinterest_reference(p_url text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); connection_id uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if p_url is null or length(p_url)>500 or p_url !~ '^https://www\.pinterest\.com/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/$' or p_url ~ '^https://www\.pinterest\.com/(pin|search|ideas|settings|business)/' then raise exception 'Invalid Pinterest board URL'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,8));
  select id into connection_id from public.pinterest_connections where user_id=actor order by created_at desc limit 1;
  if found then update public.pinterest_connections set board_url=p_url,board_id=null,connection_status='reference_only',last_synced_at=null,last_sync_error=null where id=connection_id;
  else insert into public.pinterest_connections(user_id,board_url) values(actor,p_url); end if;
end;
$$;

revoke all on function public.register_inspiration(uuid,text,text),public.claim_inspiration_analysis(uuid[]),public.finish_inspiration_analysis(uuid,jsonb),public.prepare_style_profile(jsonb,timestamptz),public.resolve_agent_action(uuid,boolean),public.prepare_inspiration_delete(uuid),public.resolve_inspiration_delete(uuid,boolean),public.save_pinterest_reference(text) from public,anon;
grant execute on function public.register_inspiration(uuid,text,text),public.claim_inspiration_analysis(uuid[]),public.finish_inspiration_analysis(uuid,jsonb),public.prepare_style_profile(jsonb,timestamptz),public.resolve_agent_action(uuid,boolean),public.prepare_inspiration_delete(uuid),public.resolve_inspiration_delete(uuid,boolean),public.save_pinterest_reference(text) to authenticated;
commit;
