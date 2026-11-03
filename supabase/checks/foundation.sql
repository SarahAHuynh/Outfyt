-- Read-only configuration checks. Run after 0001_initial_schema.sql.
-- Result 1: nine rows, each with rls_enabled = true and policy_count >= 1.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
and c.relname in ('profiles', 'wardrobe_items', 'outfits', 'outfit_items', 'style_profiles', 'inspiration_images', 'agent_action_logs', 'pinterest_connections', 'pinterest_pins')
order by c.relname;

-- Result 2: two private buckets, with 10 MiB limits and JPEG/PNG/WebP types.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('wardrobe-images', 'inspiration-images');

-- Result 3: three ownership constraints.
select conname from pg_constraint
where conname in ('outfit_owner_fk', 'wardrobe_owner_fk', 'pin_connection_owner_fk');

-- Result 4: one signup trigger.
select tgname from pg_trigger
where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created';
