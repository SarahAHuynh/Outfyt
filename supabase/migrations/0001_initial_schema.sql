-- Run once against a new Outfyt project. All changes commit together.
begin;
create extension if not exists "pgcrypto";
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.wardrobe_items (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, category text not null, subcategory text, primary_color text, secondary_colors text[] not null default '{}', style_tags text[] not null default '{}', season_tags text[] not null default '{}', image_path text, description text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.outfits (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, occasion text, aesthetic text, description text, is_favorite boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.outfit_items (outfit_id uuid not null references public.outfits(id) on delete cascade, wardrobe_item_id uuid not null references public.wardrobe_items(id) on delete restrict, position integer not null, primary key (outfit_id, wardrobe_item_id));
create table public.style_profiles (id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade, aesthetic_tags text[] not null default '{}', preferred_colors text[] not null default '{}', favorite_clothing_types text[] not null default '{}', disliked_styles text[] not null default '{}', comfort_preferences text, style_summary text, updated_at timestamptz not null default now());
create table public.inspiration_images (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, image_path text not null, source_type text not null default 'upload', extracted_tags jsonb not null default '{}', created_at timestamptz not null default now());
create table public.agent_action_logs (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, action_name text not null, sanitized_arguments jsonb not null default '{}', status text not null, confirmation_status text, error_message text, created_at timestamptz not null default now());
create table public.pinterest_connections (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, board_url text not null, board_id text, connection_status text not null default 'reference_only', last_synced_at timestamptz, last_sync_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.pinterest_pins (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, pinterest_connection_id uuid not null references public.pinterest_connections(id) on delete cascade, pinterest_pin_id text not null, image_reference text, analysis_tags jsonb not null default '{}', last_seen_at timestamptz, created_at timestamptz not null default now(), unique (pinterest_connection_id, pinterest_pin_id));
create index wardrobe_items_user_id_idx on public.wardrobe_items(user_id); create index outfits_user_id_idx on public.outfits(user_id); create index action_logs_user_id_idx on public.agent_action_logs(user_id);
alter table public.profiles enable row level security; alter table public.wardrobe_items enable row level security; alter table public.outfits enable row level security; alter table public.outfit_items enable row level security; alter table public.style_profiles enable row level security; alter table public.inspiration_images enable row level security; alter table public.agent_action_logs enable row level security; alter table public.pinterest_connections enable row level security; alter table public.pinterest_pins enable row level security;
create policy "own profiles" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid()); create policy "own wardrobe" on public.wardrobe_items for all using (user_id = auth.uid()) with check (user_id = auth.uid()); create policy "own outfits" on public.outfits for all using (user_id = auth.uid()) with check (user_id = auth.uid()); create policy "own style" on public.style_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid()); create policy "own inspiration" on public.inspiration_images for all using (user_id = auth.uid()) with check (user_id = auth.uid()); create policy "own logs" on public.agent_action_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid()); create policy "own connections" on public.pinterest_connections for all using (user_id = auth.uid()) with check (user_id = auth.uid()); create policy "own pins" on public.pinterest_pins for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own outfit items" on public.outfit_items for all using (exists (select 1 from public.outfits o where o.id = outfit_id and o.user_id = auth.uid())) with check (exists (select 1 from public.outfits o where o.id = outfit_id and o.user_id = auth.uid()) and exists (select 1 from public.wardrobe_items w where w.id = wardrobe_item_id and w.user_id = auth.uid()));
insert into storage.buckets (id, name, public) values ('wardrobe-images', 'wardrobe-images', false) on conflict (id) do nothing; insert into storage.buckets (id, name, public) values ('inspiration-images', 'inspiration-images', false) on conflict (id) do nothing;
create policy "users manage own wardrobe images" on storage.objects for all using (bucket_id = 'wardrobe-images' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'wardrobe-images' and (storage.foldername(name))[1] = auth.uid()::text); create policy "users manage own inspiration images" on storage.objects for all using (bucket_id = 'inspiration-images' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'inspiration-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Enforce relationship ownership in PostgreSQL as well as in RLS.
alter table public.outfits add constraint outfits_id_user_unique unique (id, user_id);
alter table public.wardrobe_items add constraint wardrobe_id_user_unique unique (id, user_id);
alter table public.outfit_items add column user_id uuid not null default auth.uid() references auth.users(id) on delete cascade;
alter table public.outfit_items add constraint outfit_owner_fk foreign key (outfit_id, user_id) references public.outfits(id, user_id) on delete cascade;
alter table public.outfit_items add constraint wardrobe_owner_fk foreign key (wardrobe_item_id, user_id) references public.wardrobe_items(id, user_id) on delete restrict;
alter table public.outfit_items add constraint positive_position check (position >= 0);
alter table public.pinterest_connections add constraint connections_id_user_unique unique (id, user_id);
alter table public.pinterest_pins add constraint pin_connection_owner_fk foreign key (pinterest_connection_id, user_id) references public.pinterest_connections(id, user_id) on delete cascade;

create index outfit_items_wardrobe_idx on public.outfit_items(wardrobe_item_id);
create index inspiration_user_idx on public.inspiration_images(user_id);
create index connections_user_idx on public.pinterest_connections(user_id);
create index pins_user_idx on public.pinterest_pins(user_id);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger wardrobe_updated before update on public.wardrobe_items for each row execute function public.set_updated_at();
create trigger outfits_updated before update on public.outfits for each row execute function public.set_updated_at();
create trigger style_updated before update on public.style_profiles for each row execute function public.set_updated_at();
create trigger connections_updated before update on public.pinterest_connections for each row execute function public.set_updated_at();

-- Create a profile on signup; metadata remains untrusted display text only.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 100));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

update storage.buckets
set public = false, file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('wardrobe-images', 'inspiration-images');
commit;
