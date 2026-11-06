-- Run after migration 0003 in Supabase SQL Editor. Everything rolls back.
-- Uses fixture users and RPCs only: no email, provider calls, or real-user data.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('f1111111-1111-4111-8111-111111111111','outfyt-stylist-a@example.invalid','{"display_name":"Stylist test A"}'),
('e1111111-1111-4111-8111-111111111111','outfyt-stylist-b@example.invalid','{"display_name":"Stylist test B"}');
insert into public.wardrobe_items(id,user_id,name,category,primary_color) values
('f2222222-2222-4222-8222-222222222222','f1111111-1111-4111-8111-111111111111','Test top','Tops','Black'),
('f3333333-3333-4333-8333-333333333333','f1111111-1111-4111-8111-111111111111','Test bottom','Bottoms','Cream'),
('f4444444-4444-4444-8444-444444444444','f1111111-1111-4111-8111-111111111111','Test shoes','Shoes','Black'),
('e2222222-2222-4222-8222-222222222222','e1111111-1111-4111-8111-111111111111','Other shoes','Shoes','Black');

set local role authenticated;
select set_config('request.jwt.claim.sub','f1111111-1111-4111-8111-111111111111',true);
do $$
declare
  turn uuid := 'f5555555-5555-4555-8555-555555555555';
  target_outfit uuid := 'f6666666-6666-4666-8666-666666666666';
  ids uuid[] := array['f2222222-2222-4222-8222-222222222222'::uuid,'f3333333-3333-4333-8333-333333333333'::uuid,'f4444444-4444-4444-8444-444444444444'::uuid];
  details jsonb := '{"name":"Fixture look","occasion":"Dinner","aesthetic":"Minimalist","description":"Grounded test look","is_favorite":false}';
  proposal jsonb := '{"aesthetic_tags":["Minimalist"],"preferred_colors":["Black"],"favorite_clothing_types":["Cardigans"],"disliked_styles":[],"style_summary":"Simple grounded styling"}';
  response jsonb; approval jsonb; saved jsonb; log_id uuid; rejected boolean; i integer; another_turn uuid;
begin
  response := public.begin_stylist_turn(turn,'Create a fixture look');
  if response->>'status' <> 'claimed' then raise exception 'FAIL: turn not claimed'; end if;
  response := public.begin_stylist_turn(turn,'Create a fixture look');
  if response->>'status' <> 'running' then raise exception 'FAIL: duplicate turn was executed twice'; end if;
  if (select count(*) from public.stylist_messages where turn_id = turn) <> 1 then raise exception 'FAIL: duplicate user message'; end if;
  perform public.store_outfit_candidates(turn,jsonb_build_array(jsonb_build_object('id',target_outfit,'ordinal',1,'name','Fixture look','occasion','Dinner','aesthetic','Minimalist','description','Grounded test look','explanation','Real owned pieces','item_ids',to_jsonb(ids))));
  saved := public.write_outfit(target_outfit,details,ids,null);
  if (select count(*) from public.outfit_items oi where oi.outfit_id = target_outfit) <> 3 then raise exception 'FAIL: incomplete atomic save'; end if;
  response := public.write_outfit(target_outfit,details || '{"name":"Should not overwrite"}',ids,null);
  if response->>'name' <> 'Fixture look' then raise exception 'FAIL: repeated save overwrote the look'; end if;
  if (select count(*) from public.outfits where id = target_outfit) <> 1 then raise exception 'FAIL: duplicate saved outfit'; end if;
  saved := public.write_outfit(target_outfit,details || '{"name":"Renamed look","is_favorite":true}',ids,(saved->>'updated_at')::timestamptz);
  if saved->>'name' <> 'Renamed look' or not (saved->>'is_favorite')::boolean then raise exception 'FAIL: outfit update failed'; end if;
  rejected := false;
  begin perform public.write_outfit(target_outfit,details,ids,'2000-01-01T00:00:00Z'::timestamptz);
  exception when others then if sqlerrm like '%changed%' then rejected := true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: stale outfit update allowed'; end if;
  rejected := false;
  begin perform public.write_outfit(gen_random_uuid(),details,array[ids[1],ids[2],'e2222222-2222-4222-8222-222222222222'::uuid],null);
  exception when others then if sqlerrm like '%unowned%' then rejected := true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: cross-user outfit item allowed'; end if;
  begin delete from public.outfits where id = target_outfit; raise exception 'FAIL: direct deletion bypassed confirmation';
  exception when insufficient_privilege then null; end;
  log_id := gen_random_uuid();
  perform public.record_agent_action(log_id,'delete_outfit',jsonb_build_object('id',target_outfit),'pending','not_required',null);
  approval := public.prepare_agent_action('delete_outfit',jsonb_build_object('id',target_outfit),log_id);
  if not exists (select 1 from public.outfits where id = target_outfit) then raise exception 'FAIL: outfit deleted before approval'; end if;
  response := public.resolve_agent_action((approval->>'token')::uuid,false);
  if response->>'status' <> 'rejected' or not exists (select 1 from public.outfits where id = target_outfit) then raise exception 'FAIL: rejection changed the outfit'; end if;
  log_id := gen_random_uuid();
  perform public.record_agent_action(log_id,'delete_outfit',jsonb_build_object('id',target_outfit),'pending','not_required',null);
  approval := public.prepare_agent_action('delete_outfit',jsonb_build_object('id',target_outfit),log_id);
  response := public.resolve_agent_action((approval->>'token')::uuid,null);
  if response->>'status' <> 'rejected' or not exists (select 1 from public.outfits where id = target_outfit) then raise exception 'FAIL: null decision was treated as approval'; end if;
  log_id := gen_random_uuid();
  perform public.record_agent_action(log_id,'update_style_profile','{}','pending','not_required',null);
  approval := public.prepare_agent_action('update_style_profile',proposal,log_id);
  if exists (select 1 from public.style_profiles where user_id = auth.uid()) then raise exception 'FAIL: preferences changed before approval'; end if;
  response := public.resolve_agent_action((approval->>'token')::uuid,true);
  if response->>'status' <> 'completed' or not exists (select 1 from public.style_profiles where user_id = auth.uid() and aesthetic_tags = array['Minimalist']) then raise exception 'FAIL: approved preferences not persisted'; end if;
  log_id := gen_random_uuid();
  perform public.record_agent_action(log_id,'delete_outfit',jsonb_build_object('id',target_outfit),'pending','not_required',null);
  approval := public.prepare_agent_action('delete_outfit',jsonb_build_object('id',target_outfit),log_id);
  response := public.resolve_agent_action((approval->>'token')::uuid,true);
  if exists (select 1 from public.outfits where id = target_outfit) then raise exception 'FAIL: approved outfit not deleted'; end if;
  response := public.resolve_agent_action((approval->>'token')::uuid,true);
  if not (response->>'already_resolved')::boolean then raise exception 'FAIL: approval replay not idempotent'; end if;
  if not exists (select 1 from public.agent_action_logs where id = log_id and status = 'completed' and confirmation_status = 'approved') then raise exception 'FAIL: approval not logged'; end if;
  -- Prepare another proposal to test expiry and cross-user approval below.
  log_id := gen_random_uuid();
  perform public.record_agent_action(log_id,'update_style_profile','{}','pending','not_required',null);
  approval := public.prepare_agent_action('update_style_profile',proposal,log_id);
  perform set_config('outfyt.stylist_check_token',approval->>'token',true);
  perform public.finish_stylist_turn(turn,'Fixture look was saved, edited, then deleted after approval.',false);
  response := public.begin_stylist_turn(turn,'Same request retry');
  if response->>'status' <> 'completed' then raise exception 'FAIL: completed request replayed'; end if;
  for i in 2..10 loop
    another_turn := gen_random_uuid(); perform public.begin_stylist_turn(another_turn,'Budget fixture'); perform public.finish_stylist_turn(another_turn,'Done.',false);
  end loop;
  rejected := false;
  begin perform public.begin_stylist_turn(gen_random_uuid(),'Over budget');
  exception when others then if sqlerrm like '%Hourly%' then rejected := true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: stylist budget allowed request 11'; end if;
end;
$$;

reset role;
update public.agent_pending_actions set expires_at = now() - interval '1 second' where token = current_setting('outfyt.stylist_check_token')::uuid;
set local role authenticated;
do $$
declare response jsonb;
begin
  response := public.resolve_agent_action(current_setting('outfyt.stylist_check_token')::uuid,true);
  if response->>'status' <> 'rejected' then raise exception 'FAIL: expired action approved'; end if;
end;
$$;

select set_config('request.jwt.claim.sub','e1111111-1111-4111-8111-111111111111',true);
do $$
declare rejected boolean := false;
begin
  if exists (select 1 from public.stylist_messages) or exists (select 1 from public.outfit_candidates) or exists (select 1 from public.agent_action_logs) then raise exception 'FAIL: another user history visible'; end if;
  begin perform public.resolve_agent_action(current_setting('outfyt.stylist_check_token')::uuid,true);
  exception when others then if sqlerrm like '%unavailable%' then rejected := true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: another user approval accepted'; end if;
end;
$$;
reset role;
select 'PASS: ownership, outfit transactions, retries, confirmations, style approval, expiry, logs, turn budget' as result;
rollback;
