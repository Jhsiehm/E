-- P1 identity slice: profiles, workspaces, memberships.
-- RLS is enabled and forced on every table; access is default deny.
-- Roles live only on memberships; profiles never carry permissions.

create type public.membership_role as enum ('owner', 'admin', 'attorney', 'paralegal', 'viewer');
create type public.membership_status as enum ('invited', 'active', 'suspended', 'removed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  job_title text not null default '' check (char_length(job_title) <= 80),
  firm_name text not null default '' check (char_length(firm_name) <= 120),
  time_zone text not null default 'America/New_York' check (char_length(time_zone) <= 64),
  avatar_color text not null default 'navy' check (avatar_color in ('navy', 'teal', 'rose', 'olive')),
  accent text not null default 'teal' check (accent in ('navy', 'teal', 'rose', 'olive')),
  density text not null default 'comfortable' check (density in ('comfortable', 'compact')),
  practice_areas text[] not null default '{}' check (cardinality(practice_areas) <= 3),
  primary_area text check (primary_area is null or primary_area = any (practice_areas)),
  niches text[] not null default '{}' check (cardinality(niches) <= 24),
  jurisdictions text[] not null default '{}' check (cardinality(jurisdictions) <= 24),
  layout jsonb not null default '{}'::jsonb check (jsonb_typeof(layout) = 'object'),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,64}$'),
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.memberships (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.membership_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;

-- Helper evaluated as the definer so membership policies don't recurse.
create function public.is_active_member(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;
revoke all on function public.is_active_member(uuid) from public, anon;
grant execute on function public.is_active_member(uuid) to authenticated;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "workspaces: members read" on public.workspaces
  for select to authenticated using (public.is_active_member(id));

create policy "memberships: members read" on public.memberships
  for select to authenticated using (public.is_active_member(workspace_id));

revoke all on public.profiles, public.workspaces, public.memberships from anon;
grant select, update on public.profiles to authenticated;
grant select on public.workspaces, public.memberships to authenticated;
-- Only these columns are user-editable; id/created_at are not.
revoke update on public.profiles from authenticated;
grant update (full_name, job_title, firm_name, time_zone, avatar_color, accent, density,
  practice_areas, primary_area, niches, jurisdictions, layout, onboarded_at)
  on public.profiles to authenticated;

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Every new auth user gets an empty profile.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Creates a firm workspace and makes the caller its owner. The only way a
-- browser can create a workspace or a membership.
create function public.create_workspace(ws_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  base text;
  new_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.memberships where user_id = uid and role = 'owner') then
    raise exception 'user already owns a workspace' using errcode = '23505';
  end if;
  base := trim(both '-' from regexp_replace(lower(coalesce(ws_name, '')), '[^a-z0-9]+', '-', 'g'));
  if base = '' then base := 'firm'; end if;
  insert into public.workspaces (name, slug, created_by)
  values (trim(ws_name), left(base, 55) || '-' || substr(md5(gen_random_uuid()::text), 1, 8), uid)
  returning id into new_id;
  insert into public.memberships (workspace_id, user_id, role) values (new_id, uid, 'owner');
  return new_id;
end;
$$;
revoke all on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;
