-- Run after 0004. Fixtures and all mutations are rolled back; no email or AI.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('c1111111-1111-4111-8111-111111111111','outfyt-chat-a@example.invalid','{}'),
('d1111111-1111-4111-8111-111111111111','outfyt-chat-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','d1111111-1111-4111-8111-111111111111',true);
select set_config('outfyt.other_chat',public.create_stylist_chat()->>'id',true);
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
do $$
declare first_chat uuid; second_chat uuid; first_turn uuid := gen_random_uuid(); second_turn uuid := gen_random_uuid(); response jsonb; rejected boolean; log_id uuid := gen_random_uuid(); approval jsonb;
begin
  first_chat := (public.create_stylist_chat()->>'id')::uuid;
  second_chat := (public.create_stylist_chat()->>'id')::uuid;
  perform public.begin_stylist_turn(first_turn,'First conversation',first_chat);
  perform public.finish_stylist_turn(first_turn,'First answer',false);
  perform public.begin_stylist_turn(second_turn,'Separate conversation',second_chat);
  perform public.finish_stylist_turn(second_turn,'Separate answer',false);
  if (select count(*) from public.stylist_messages m join public.stylist_turns t on t.id = m.turn_id where t.chat_id = first_chat) <> 2 then raise exception 'FAIL: first chat history missing'; end if;
  if (select count(*) from public.stylist_messages m join public.stylist_turns t on t.id = m.turn_id where t.chat_id = second_chat) <> 2 then raise exception 'FAIL: second chat history missing'; end if;
  if (select title from public.stylist_chats where id = first_chat) <> 'First conversation' then raise exception 'FAIL: chat title not derived from first message'; end if;
  rejected := false;
  begin perform public.begin_stylist_turn(first_turn,'Replay in another chat',second_chat);
  exception when others then if sqlerrm like '%unavailable%' then rejected := true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: request replay crossed chats'; end if;
  rejected := false;
  begin perform public.begin_stylist_turn(gen_random_uuid(),'Other user chat',current_setting('outfyt.other_chat')::uuid);
  exception when others then if sqlerrm like '%unavailable%' then rejected := true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: another user chat accepted'; end if;
  if exists (select 1 from public.stylist_chats where id = current_setting('outfyt.other_chat')::uuid) then raise exception 'FAIL: another user chat visible'; end if;
  perform public.record_agent_action(log_id,'update_style_profile','{}','pending','not_required',null,first_chat);
  approval := public.prepare_agent_action('update_style_profile','{"aesthetic_tags":["Minimalist"],"preferred_colors":[],"favorite_clothing_types":[],"disliked_styles":[],"style_summary":"Review proposal"}',log_id);
  if not exists (select 1 from public.agent_pending_actions where token = (approval->>'token')::uuid and chat_id = first_chat) then raise exception 'FAIL: approval was not bound to source chat'; end if;
  perform public.create_stylist_chat();
  if (select count(*) from public.stylist_messages) <> 4 then raise exception 'FAIL: new chat erased history'; end if;
end;
$$;
reset role;
select 'PASS: chat isolation, history preservation, request replay and approval scoping' as result;
rollback;
