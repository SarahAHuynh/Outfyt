-- Run after 0006. No external calls; all fixtures roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('61111111-1111-4111-8111-111111111111','outfyt-style-a@example.invalid','{}'),
('62222222-2222-4222-8222-222222222222','outfyt-style-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);
do $$
declare pending jsonb; result jsonb; analysis jsonb; cached jsonb; rejected boolean; n integer; expected timestamptz;
profile jsonb:='{"aesthetic_tags":["Tomboy","Minimalist"],"preferred_colors":["Navy"],"favorite_clothing_types":["Jeans"],"disliked_styles":["Coquette"],"style_summary":"Relaxed layers","comfort_preferences":"Flat shoes","notes":"Walk to class"}';
begin
  pending:=public.prepare_style_profile(profile,null);
  if exists(select 1 from public.style_profiles) then raise exception 'FAIL: preferences saved before approval'; end if;
  perform public.resolve_agent_action((pending->>'token')::uuid,false);
  if exists(select 1 from public.style_profiles) then raise exception 'FAIL: rejected preferences saved'; end if;
  pending:=public.prepare_style_profile(profile,null);
  perform set_config('outfyt.style_token',pending->>'token',true);
  result:=public.resolve_agent_action((pending->>'token')::uuid,true);
  if result->>'status'<>'completed' or not exists(select 1 from public.style_profiles where notes='Walk to class' and comfort_preferences='Flat shoes' and cardinality(aesthetic_tags)=2) then raise exception 'FAIL: approved profile incomplete'; end if;
  if not (public.resolve_agent_action((pending->>'token')::uuid,true)->>'already_resolved')::boolean then raise exception 'FAIL: approval replay not idempotent'; end if;
  select updated_at into expected from public.style_profiles;
  rejected:=false;
  begin perform public.prepare_style_profile(profile,expected+interval '1 day');
  exception when others then if sqlerrm like '%changed%' then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: stale draft accepted'; end if;
  pending:=public.prepare_style_profile(profile,expected);
  perform public.register_inspiration('63333333-3333-4333-8333-333333333333','61111111-1111-4111-8111-111111111111/63333333-3333-4333-8333-333333333333.jpg','Fall layers');
  perform public.register_inspiration('64444444-4444-4444-8444-444444444444','61111111-1111-4111-8111-111111111111/64444444-4444-4444-8444-444444444444.png','Denim');
  perform public.register_inspiration('63333333-3333-4333-8333-333333333333','61111111-1111-4111-8111-111111111111/63333333-3333-4333-8333-333333333333.jpg','Replay');
  if (select count(*) from public.inspiration_images)<>2 then raise exception 'FAIL: repeated upload duplicated'; end if;
  rejected:=false;
  begin perform public.register_inspiration(gen_random_uuid(),'another-owner/image.jpg','Bad');
  exception when others then if sqlerrm like '%Invalid%' then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: foreign storage path accepted'; end if;
  analysis:=public.claim_inspiration_analysis(array['63333333-3333-4333-8333-333333333333'::uuid,'64444444-4444-4444-8444-444444444444'::uuid]);
  rejected:=false;
  begin perform public.claim_inspiration_analysis(array['63333333-3333-4333-8333-333333333333'::uuid]);
  exception when others then if sqlerrm like '%already running%' then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: simultaneous analysis accepted'; end if;
  perform public.finish_inspiration_analysis((analysis->>'id')::uuid,profile-'comfort_preferences'-'notes');
  cached:=public.claim_inspiration_analysis(array['64444444-4444-4444-8444-444444444444'::uuid,'63333333-3333-4333-8333-333333333333'::uuid]);
  if cached->>'status'<>'cached' or cached->>'id'<>analysis->>'id' then raise exception 'FAIL: analysis was not reused'; end if;
  if (select notes from public.style_profiles)<>'Walk to class' then raise exception 'FAIL: analysis changed profile'; end if;
  for n in 1..9 loop
    analysis:=public.claim_inspiration_analysis(array['64444444-4444-4444-8444-444444444444'::uuid]);
    perform public.finish_inspiration_analysis((analysis->>'id')::uuid,null);
  end loop;
  rejected:=false;
  begin perform public.claim_inspiration_analysis(array['64444444-4444-4444-8444-444444444444'::uuid]);
  exception when others then if sqlerrm like '%limit reached%' then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: analysis budget exceeded'; end if;
  perform public.save_pinterest_reference('https://www.pinterest.com/sarah/fall-style/');
  perform public.save_pinterest_reference('https://www.pinterest.com/sarah/spring-style/');
  if (select count(*) from public.pinterest_connections)<>1 or exists(select 1 from public.pinterest_connections where connection_status<>'reference_only' or last_synced_at is not null) then raise exception 'FAIL: reference incorrectly connected or duplicated'; end if;
  rejected:=false;
  begin update public.inspiration_images set source_type='pinterest';
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'FAIL: direct inspiration mutation bypassed RPC'; end if;
  pending:=public.prepare_inspiration_delete('63333333-3333-4333-8333-333333333333');
  perform public.resolve_inspiration_delete((pending->>'token')::uuid,false);
  if (select count(*) from public.inspiration_images)<>2 then raise exception 'FAIL: cancellation deleted image'; end if;
  pending:=public.prepare_inspiration_delete('63333333-3333-4333-8333-333333333333');
  perform set_config('outfyt.image_delete_token',pending->>'token',true);
end;
$$;
select set_config('request.jwt.claim.sub','62222222-2222-4222-8222-222222222222',true);
do $$
declare rejected boolean;
begin
  if exists(select 1 from public.style_profiles) or exists(select 1 from public.inspiration_images) or exists(select 1 from public.inspiration_analyses) or exists(select 1 from public.pinterest_connections) then raise exception 'FAIL: Style DNA crossed users'; end if;
  rejected:=false;
  begin perform public.claim_inspiration_analysis(array['63333333-3333-4333-8333-333333333333'::uuid]);
  exception when others then if sqlerrm like '%unavailable%' then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: foreign analysis allowed'; end if;
  rejected:=false;
  begin perform public.resolve_inspiration_delete(current_setting('outfyt.image_delete_token')::uuid,true);
  exception when others then if sqlerrm like '%unavailable%' then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: foreign removal allowed'; end if;
end;
$$;
select set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);
select public.resolve_inspiration_delete(current_setting('outfyt.image_delete_token')::uuid,true);
do $$
begin
  if exists(select 1 from public.inspiration_images where id='63333333-3333-4333-8333-333333333333') then raise exception 'FAIL: approved deletion not executed'; end if;
  if exists(select 1 from public.inspiration_analyses where '63333333-3333-4333-8333-333333333333'=any(image_ids)) then raise exception 'FAIL: removed image analysis retained'; end if;
  if not exists(select 1 from public.style_profiles where comfort_preferences='Flat shoes' and notes='Walk to class') then raise exception 'FAIL: image deletion erased preferences'; end if;
end;
$$;
reset role;
select 'PASS: Style DNA approvals, comfort/notes, uploads, cache, budgets, deletion, references and cross-user isolation' as result;
rollback;
