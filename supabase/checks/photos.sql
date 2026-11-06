-- Run after 0005. All fixtures roll back. No live API requests.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('e1111111-1111-4111-8111-111111111111','outfyt-photo-a@example.invalid','{}'),
('f1111111-1111-4111-8111-111111111111','outfyt-photo-b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','e1111111-1111-4111-8111-111111111111',true);
select public.begin_stylist_turn('e2222222-2222-4222-8222-222222222222','Show bottom examples');
select public.reserve_photo_search('e2222222-2222-4222-8222-222222222222');
do $$
declare rejected boolean := false;
begin
  begin perform public.reserve_photo_search('e2222222-2222-4222-8222-222222222222');
  exception when others then if sqlerrm like '%Only one%' then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: repeated photo search accepted'; end if;
end;
$$;
select public.store_reference_photos('e2222222-2222-4222-8222-222222222222','{"query":"blue jeans","photos":[]}');
do $$
declare rejected boolean := false;
begin
  begin perform public.store_reference_photos('e2222222-2222-4222-8222-222222222222','{"query":"replace","photos":[]}');
  exception when others then if sqlerrm like '%already stored%' then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: stored reference photos overwritten'; end if;
  rejected:=false;
  begin insert into public.stylist_photo_searches(turn_id,user_id) values(gen_random_uuid(),auth.uid());
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'FAIL: client bypassed search reservation'; end if;
  rejected:=false;
  begin perform public.store_reference_photos('e2222222-2222-4222-8222-222222222222','{"photos":[]}');
  exception when others then if sqlerrm like '%Invalid%' then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: missing photo query accepted'; end if;
end;
$$;
select set_config('request.jwt.claim.sub','f1111111-1111-4111-8111-111111111111',true);
do $$
declare rejected boolean := false;
begin
  if exists(select 1 from public.stylist_photo_searches) then raise exception 'FAIL: reference photos crossed users'; end if;
  begin perform public.reserve_photo_search('e2222222-2222-4222-8222-222222222222');
  exception when others then if sqlerrm like '%unavailable%' then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: foreign turn accepted'; end if;
  rejected:=false;
  begin perform public.store_reference_photos('e2222222-2222-4222-8222-222222222222','{"query":"pants","photos":[]}');
  exception when others then if sqlerrm like '%unavailable%' then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: foreign photos changed'; end if;
end;
$$;
reset role;
-- Fill the shared rolling allowance without consuming live requests.
insert into public.stylist_turns(id,user_id,status,chat_id)
select gen_random_uuid(),'e1111111-1111-4111-8111-111111111111','completed',
  (select chat_id from public.stylist_turns where id='e2222222-2222-4222-8222-222222222222') from generate_series(1,44);
insert into public.stylist_photo_searches(turn_id,user_id)
select id,user_id from public.stylist_turns where user_id='e1111111-1111-4111-8111-111111111111' and status='completed';
set local role authenticated;
select public.begin_stylist_turn('f2222222-2222-4222-8222-222222222222','Shared budget check');
do $$
declare rejected boolean := false;
begin
  begin perform public.reserve_photo_search('f2222222-2222-4222-8222-222222222222');
  exception when others then if sqlerrm like '%allowance%' then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'FAIL: shared allowance exceeded'; end if;
end;
$$;
reset role;
select 'PASS: private reference photos, one search per turn and shared rolling allowance' as result;
rollback;
