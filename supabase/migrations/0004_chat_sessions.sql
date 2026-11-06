-- Run once after 0003. Preserves all existing conversations and saved outfits.
begin;
create table public.stylist_chats (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat' check (length(title) between 1 and 80),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,user_id)
);
create index stylist_chats_user_idx on public.stylist_chats(user_id,updated_at desc);
alter table public.stylist_chats enable row level security;
revoke all on public.stylist_chats from anon,authenticated;
grant select on public.stylist_chats to authenticated;
create policy "own chat sessions" on public.stylist_chats for select to authenticated using(user_id = (select auth.uid()));
alter table public.stylist_turns add column chat_id uuid;
alter table public.agent_action_logs add column chat_id uuid;
alter table public.agent_pending_actions add column chat_id uuid;
insert into public.stylist_chats(user_id,title,created_at,updated_at)
  select user_id,'Previous conversation',min(created_at),max(created_at) from public.stylist_turns group by user_id;
update public.stylist_turns t set chat_id = c.id from public.stylist_chats c where t.user_id = c.user_id;
update public.agent_action_logs l set chat_id = c.id from public.stylist_chats c where l.user_id = c.user_id;
update public.agent_pending_actions a set chat_id = c.id from public.stylist_chats c where a.user_id = c.user_id;
alter table public.stylist_turns alter column chat_id set not null;
alter table public.stylist_turns add constraint turn_chat_owner_fk foreign key(chat_id,user_id) references public.stylist_chats(id,user_id);
alter table public.agent_action_logs add constraint log_chat_owner_fk foreign key(chat_id,user_id) references public.stylist_chats(id,user_id);
alter table public.agent_pending_actions add constraint pending_chat_owner_fk foreign key(chat_id,user_id) references public.stylist_chats(id,user_id);
create index stylist_turns_chat_idx on public.stylist_turns(chat_id,created_at desc);

create function public.create_stylist_chat() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); chat public.stylist_chats;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if (select count(*) from public.stylist_chats where user_id = actor and created_at > now() - interval '1 hour') >= 50 then raise exception 'Too many new chats. Try again later.'; end if;
  insert into public.stylist_chats(user_id) values(actor) returning * into chat;
  return jsonb_build_object('id',chat.id,'title',chat.title,'updated_at',chat.updated_at);
end;
$$;

create function public.begin_stylist_turn(p_id uuid, p_message text, p_chat uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); existing public.stylist_turns;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.stylist_chats where id = p_chat and user_id = actor) then raise exception 'Chat unavailable'; end if;
  if length(trim(p_message)) not between 1 and 2000 then raise exception 'Message must be between 1 and 2000 characters'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  select * into existing from public.stylist_turns where id = p_id;
  if found then
    if existing.user_id <> actor or existing.chat_id <> p_chat then raise exception 'Request unavailable'; end if;
    return jsonb_build_object('status',existing.status,'response',existing.response);
  end if;
  if exists (select 1 from public.stylist_turns where user_id = actor and status = 'running' and created_at > now() - interval '5 minutes') then
    raise exception 'A stylist request is already running. Wait for it to finish.';
  end if;
  if (select count(*) from public.stylist_turns where user_id = actor and created_at >= date_trunc('hour',now())) >= 10 then
    raise exception 'Hourly stylist limit reached. Try again next hour.';
  end if;
  insert into public.stylist_turns(id,user_id,chat_id) values(p_id,actor,p_chat);
  update public.stylist_chats set title = case when title = 'New chat' then left(trim(p_message),60) else title end, updated_at = now() where id = p_chat and user_id = actor;
  insert into public.stylist_messages(user_id,turn_id,role,content) values(actor,p_id,'user',trim(p_message));
  return jsonb_build_object('status','claimed');
end;
$$;

-- Compatibility for older clients and the existing milestone SQL checks.
create or replace function public.begin_stylist_turn(p_id uuid,p_message text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target uuid; created jsonb;
begin
  select id into target from public.stylist_chats where user_id = auth.uid() order by updated_at desc,id limit 1;
  if target is null then created := public.create_stylist_chat(); target := (created->>'id')::uuid; end if;
  return public.begin_stylist_turn(p_id,p_message,target);
end;
$$;

create function public.record_agent_action(p_id uuid,p_action text,p_args jsonb,p_status text,p_confirmation text,p_error text,p_chat uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.stylist_chats where id = p_chat and user_id = actor) then raise exception 'Chat unavailable'; end if;
  if exists (select 1 from public.agent_action_logs where id = p_id and (user_id <> actor or (chat_id is not null and chat_id <> p_chat))) then raise exception 'Action unavailable'; end if;
  perform public.record_agent_action(p_id,p_action,p_args,p_status,p_confirmation,p_error);
  update public.agent_action_logs set chat_id = p_chat where id = p_id and user_id = actor;
end;
$$;

create function public.bind_pending_action_chat() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select chat_id into new.chat_id from public.agent_action_logs where id = new.log_id and user_id = new.user_id;
  return new;
end;
$$;
create trigger bind_pending_chat before insert on public.agent_pending_actions for each row execute function public.bind_pending_action_chat();
revoke all on function public.bind_pending_action_chat() from public,anon,authenticated;
revoke all on function public.create_stylist_chat(),public.begin_stylist_turn(uuid,text,uuid),public.record_agent_action(uuid,text,jsonb,text,text,text,uuid) from public,anon;
grant execute on function public.create_stylist_chat(),public.begin_stylist_turn(uuid,text,uuid),public.record_agent_action(uuid,text,jsonb,text,text,text,uuid) to authenticated;
commit;
