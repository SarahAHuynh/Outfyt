-- Rollback-only ownership and profile-update regression check. No external calls.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('71111111-1111-4111-8111-111111111111','outfyt-profile-a@example.invalid','{"display_name":"First"}'),
('72222222-2222-4222-8222-222222222222','outfyt-profile-b@example.invalid','{"display_name":"Second"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','71111111-1111-4111-8111-111111111111',true);
do $$
declare changed integer;
begin
  update public.profiles set display_name='Changed by owner' where id=auth.uid();
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'FAIL: own profile cannot be updated'; end if;
  update public.profiles set display_name='Unauthorized' where id='72222222-2222-4222-8222-222222222222';
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'FAIL: another user profile changed'; end if;
  update public.profiles set display_name='Stale overwrite' where id=auth.uid() and updated_at=now()-interval '1 day';
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'FAIL: stale version changed a profile'; end if;
end;
$$;
reset role;
do $$
begin
  if (select display_name from public.profiles where id='72222222-2222-4222-8222-222222222222')<>'Second' then raise exception 'FAIL: second user profile was not preserved'; end if;
end;
$$;
select 'PASS: profile updates preserve ownership and reject stale versions' as result;
rollback;
