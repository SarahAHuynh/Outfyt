-- Read-only deployment readiness checks after migrations 0001 through 0006.
do $$
declare name text; signature text;
begin
  foreach name in array array['profiles','wardrobe_items','outfits','outfit_items','style_profiles','inspiration_images','agent_action_logs','pinterest_connections','pinterest_pins','wardrobe_analysis_limits','wardrobe_delete_requests','stylist_turns','stylist_messages','outfit_candidates','agent_pending_actions','stylist_chats','stylist_photo_searches','inspiration_analyses','inspiration_delete_requests'] loop
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=name and c.relkind='r' and c.relrowsecurity) then raise exception 'Missing table or row security: %',name; end if;
  end loop;
  foreach signature in array array['public.consume_clothing_analysis_budget()','public.begin_stylist_turn(uuid,text,uuid)','public.resolve_agent_action(uuid,boolean)','public.reserve_photo_search(uuid)','public.prepare_style_profile(jsonb,timestamp with time zone)','public.claim_inspiration_analysis(uuid[])','public.resolve_inspiration_delete(uuid,boolean)'] loop
    if to_regprocedure(signature) is null then raise exception 'Missing migration function: %',signature; end if;
  end loop;
  if has_function_privilege('authenticated','public.resolve_agent_action_legacy(uuid,boolean)','EXECUTE') then raise exception 'Legacy approval implementation must not be callable by users'; end if;
  if has_table_privilege('authenticated','public.outfits','INSERT') or has_table_privilege('authenticated','public.wardrobe_items','DELETE') then raise exception 'Sensitive writes must go through checked functions'; end if;
  if (select count(*) from storage.buckets where id in ('wardrobe-images','inspiration-images') and public=false and file_size_limit>=4194304 and allowed_mime_types @> array['image/jpeg','image/png','image/webp'])<>2 then raise exception 'Private image bucket configuration is incomplete'; end if;
end;
$$;
select 'PASS: release tables, private buckets and checked mutation functions are configured' as result;
