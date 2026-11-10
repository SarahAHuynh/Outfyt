import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("PostgreSQL executes migrations, ownership policies, outfit transactions and persisted approvals",{ timeout:60_000 },async () => {
  const db = new PGlite();
  try {
    // Supabase Auth/Storage API behavior is mocked, but public schemas,
    // PL/pgSQL, grants, row-level security and transactions are real Postgres.
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key,email text unique,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
      grant usage on schema public,auth,storage to anon,authenticated;
      grant all on storage.objects to anon,authenticated;
      alter default privileges in schema public grant all on tables to anon,authenticated;
    `);
    for (const name of ["0001_initial_schema.sql","0002_wardrobe_safety.sql","0003_stylist_agent.sql"]) {
      const source = await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),"utf8");
      // PGlite has native gen_random_uuid(); it does not package pgcrypto.
      await db.exec(source.replace('create extension if not exists "pgcrypto";',''));
    }
    // Seed a pre-session conversation to verify migration backfill preserves it.
    await db.exec(`
      insert into auth.users(id,email) values('a9999999-9999-4999-8999-999999999999','legacy-chat@example.invalid');
      set role authenticated;
      select set_config('request.jwt.claim.sub','a9999999-9999-4999-8999-999999999999',false);
      select public.begin_stylist_turn('a8888888-8888-4888-8888-888888888888','Keep this conversation');
      select public.finish_stylist_turn('a8888888-8888-4888-8888-888888888888','History survives.',false);
      reset role;
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/0004_chat_sessions.sql",import.meta.url),"utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/0005_reference_photos.sql",import.meta.url),"utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/0006_style_dna.sql",import.meta.url),"utf8"));
    const preserved = await db.query<{ count:number }>("select count(*)::integer as count from public.stylist_messages m join public.stylist_turns t on t.id=m.turn_id join public.stylist_chats c on c.id=t.chat_id where c.title='Previous conversation'");
    assert.equal(preserved.rows[0].count,2,"migration must preserve both legacy messages");
    await db.exec("delete from auth.users where id='a9999999-9999-4999-8999-999999999999'");
    for (const name of ["wardrobe.sql","stylist.sql","chats.sql","photos.sql","style-dna.sql","profile.sql","release.sql"]) {
      const source = await readFile(new URL(`../supabase/checks/${name}`,import.meta.url),"utf8");
      const results = await db.exec(source);
      assert.ok(results.some(result => result.rows.some(row => String((row as { result?:string }).result).startsWith("PASS:"))),`${name} must return its PASS result`);
    }
    const fixtures = await db.query<{ count:number }>("select count(*)::integer as count from auth.users");
    assert.equal(fixtures.rows[0].count,0,"database check fixtures must roll back");
  } finally {
    await db.exec("rollback").catch(() => {});
    await db.close();
  }
});
