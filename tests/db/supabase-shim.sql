-- Minimal stand-in for the parts of Supabase our migrations rely on, so the
-- access rules can be tested on a plain Postgres (CI service container or a
-- local install). Mirrors Supabase defaults that matter for security:
-- the anon/authenticated roles, auth.uid() from the request's JWT claims,
-- and default grants of ALL on public tables (so a missing REVOKE in a
-- migration shows up here as a failing test, as it would in production).
-- Roles are cluster-wide; tolerate another test database creating them first.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    begin
      execute format('create role %I nologin%s', r, case when r = 'service_role' then ' bypassrls' else '' end);
    exception when duplicate_object or unique_violation then null;
    end;
  end loop;
end $$;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Supabase Storage keeps file records in storage.objects and enforces
-- row-level security on it. Only the columns our policies use are here.
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
