-- Run in Supabase SQL Editor after migration 0002.
-- Test fixtures and mutations are rolled back; this makes no AI requests.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
('a1111111-1111-4111-8111-111111111111', 'outfyt-check-a@example.invalid', '{"display_name":"Test A"}'),
('b1111111-1111-4111-8111-111111111111', 'outfyt-check-b@example.invalid', '{"display_name":"Test B"}');
insert into public.wardrobe_items (id, user_id, name, category, primary_color) values
('a2222222-2222-4222-8222-222222222222', 'a1111111-1111-4111-8111-111111111111', 'Delete test', 'Tops', 'Black'),
('a3333333-3333-4333-8333-333333333333', 'a1111111-1111-4111-8111-111111111111', 'Version test', 'Tops', 'White'),
('b2222222-2222-4222-8222-222222222222', 'b1111111-1111-4111-8111-111111111111', 'Other user item', 'Shoes', 'Black');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
do $$
declare approval jsonb; result jsonb; i integer; rejected boolean;
begin
  if exists (select 1 from public.wardrobe_items where user_id = 'b1111111-1111-4111-8111-111111111111') then raise exception 'FAIL: other user visible'; end if;
  update public.wardrobe_items set name = 'Unauthorized edit' where id = 'b2222222-2222-4222-8222-222222222222';
  if found then raise exception 'FAIL: cross-user edit allowed'; end if;
  rejected := false;
  begin perform public.prepare_wardrobe_delete('b2222222-2222-4222-8222-222222222222');
  exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: cross-user deletion prepared'; end if;
  begin
    delete from public.wardrobe_items where id = 'a2222222-2222-4222-8222-222222222222';
    raise exception 'FAIL: direct delete bypassed confirmation';
  exception when insufficient_privilege then null; end;
  for i in 1..10 loop
    if not public.consume_clothing_analysis_budget() then raise exception 'FAIL: budget rejected request %', i; end if;
  end loop;
  if public.consume_clothing_analysis_budget() then raise exception 'FAIL: budget allowed request 11'; end if;
  approval := public.prepare_wardrobe_delete('a2222222-2222-4222-8222-222222222222');
  result := public.confirm_wardrobe_delete((approval->>'token')::uuid);
  if result->>'id' <> 'a2222222-2222-4222-8222-222222222222' then raise exception 'FAIL: incorrect deletion'; end if;
  if exists (select 1 from public.wardrobe_items where id = 'a2222222-2222-4222-8222-222222222222') then raise exception 'FAIL: confirmed item still exists'; end if;
  result := public.confirm_wardrobe_delete((approval->>'token')::uuid);
  if not (result->>'already_deleted')::boolean then raise exception 'FAIL: deletion retry not idempotent'; end if;
  -- transaction time now() is constant: use a distinct explicit timestamp to
  -- exercise optimistic version checks even within this single transaction.
  approval := public.prepare_wardrobe_delete('a3333333-3333-4333-8333-333333333333');
  perform set_config('outfyt.check_token', approval->>'token', true);
end;
$$;

reset role;
-- Simulate a later update while preserving production trigger behavior.
update public.wardrobe_delete_requests set item_updated_at = item_updated_at - interval '1 second'
where token = current_setting('outfyt.check_token')::uuid;
set local role authenticated;
do $$
declare rejected boolean := false;
begin
  begin perform public.confirm_wardrobe_delete(current_setting('outfyt.check_token')::uuid);
  exception when others then
    if sqlerrm like '%changed%' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'FAIL: stale deletion accepted'; end if;
end;
$$;

reset role;
update public.wardrobe_delete_requests set expires_at = now() - interval '1 second'
where token = current_setting('outfyt.check_token')::uuid;
set local role authenticated;
do $$
declare rejected boolean := false;
begin
  begin perform public.confirm_wardrobe_delete(current_setting('outfyt.check_token')::uuid);
  exception when others then
    if sqlerrm like '%expired%' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'FAIL: expired deletion accepted'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'b1111111-1111-4111-8111-111111111111', true);
do $$
declare rejected boolean := false;
begin
  if exists (select 1 from public.wardrobe_delete_requests where token = current_setting('outfyt.check_token')::uuid) then raise exception 'FAIL: another user approval visible'; end if;
  begin perform public.confirm_wardrobe_delete(current_setting('outfyt.check_token')::uuid);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: another user approval accepted'; end if;
end;
$$;
reset role;
select 'PASS: ownership, confirmation, expiry, version checks, idempotency and analysis budget' as result;
rollback;
