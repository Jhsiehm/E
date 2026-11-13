-- Bedrock 1: matters and the matter access list (ethical walls).
--
-- Rules (docs/handoff/02, tests/shared/fixtures/access-matrix.ts):
-- * Default deny. A person sees a matter only if they are an ACTIVE member of
--   its firm AND on that matter's access list. Firm owners and admins are not
--   an exception: membership never bypasses the matter list.
-- * Role decides what they can do once in: owner/admin/attorney/paralegal
--   write; owner/admin/attorney delete, export, confirm deadlines and share.
-- * Every row carries workspace_id; composite foreign keys stop a child row
--   from pointing at another firm's matter. workspace_id never changes.
-- * private.can() is the single place these rules live. RLS policies call
--   it; the API calls it for actions that have no table yet (export).

create table public.matters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  docket text not null default '' check (char_length(docket) <= 120),
  court text not null default '' check (char_length(court) <= 120),
  practice_area text not null default '' check (char_length(practice_area) <= 80),
  party_role text not null default '' check (char_length(party_role) <= 40),
  summary text not null default '' check (char_length(summary) <= 4000),
  status text not null default 'active'
    check (status in ('active', 'pending', 'closed', 'archived')),
  assigned_agent_key text check (assigned_agent_key is null or assigned_agent_key ~ '^[a-z0-9_-]{1,64}$'),
  version integer not null default 1,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create index matters_workspace_idx on public.matters (workspace_id, updated_at desc);

create table public.matter_members (
  workspace_id uuid not null,
  matter_id uuid not null,
  user_id uuid not null,
  added_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (matter_id, user_id),
  foreign key (workspace_id, matter_id) references public.matters (workspace_id, id) on delete cascade,
  foreign key (workspace_id, user_id) references public.memberships (workspace_id, user_id) on delete cascade
);
create index matter_members_user_idx on public.matter_members (user_id, workspace_id);

create table public.matter_deadlines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  matter_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  due_on date not null,
  kind text not null default 'deadline' check (kind in ('deadline', 'hearing', 'filing', 'meeting', 'other')),
  -- Deadlines are never computed silently: an attorney confirms each one.
  confirmed_by uuid references auth.users (id),
  confirmed_at timestamptz,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, matter_id) references public.matters (workspace_id, id) on delete cascade
);
create index matter_deadlines_matter_idx on public.matter_deadlines (matter_id, due_on);

create table public.matter_strategy (
  matter_id uuid primary key,
  workspace_id uuid not null,
  body text not null default '' check (char_length(body) <= 50000),
  version integer not null default 1,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, matter_id) references public.matters (workspace_id, id) on delete cascade
);

-- ---- the one permission function ------------------------------------------

create function private.member_role(ws uuid)
returns public.membership_role
language sql stable security definer set search_path = ''
as $$
  select m.role from public.memberships m
  where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.status = 'active';
$$;

-- action: read | write | delete | export | share (share = change who is on the matter)
--   | confirm (sign off a deadline).
-- matter null = a firm-level check (create a matter in this firm).
create function private.can(ws uuid, matter uuid, action text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.membership_role := private.member_role(ws);
begin
  if r is null then return false; end if;
  if matter is null then
    return action = 'create' and r in ('owner', 'admin', 'attorney', 'paralegal');
  end if;
  if not exists (
    select 1 from public.matter_members mm
    where mm.matter_id = matter and mm.workspace_id = ws and mm.user_id = (select auth.uid())
  ) then
    return false;
  end if;
  return case action
    when 'read' then true
    when 'write' then r in ('owner', 'admin', 'attorney', 'paralegal')
    when 'delete' then r in ('owner', 'admin', 'attorney')
    when 'export' then r in ('owner', 'admin', 'attorney')
    when 'confirm' then r in ('owner', 'admin', 'attorney')
    when 'share' then r in ('owner', 'admin', 'attorney')
    else false
  end;
end;
$$;
revoke all on function private.member_role(uuid) from public, anon;
revoke all on function private.can(uuid, uuid, text) from public, anon;
grant execute on function private.member_role(uuid) to authenticated;
grant execute on function private.can(uuid, uuid, text) to authenticated;

-- ---- row-level security ------------------------------------------------------

alter table public.matters enable row level security;
alter table public.matters force row level security;
alter table public.matter_members enable row level security;
alter table public.matter_members force row level security;
alter table public.matter_deadlines enable row level security;
alter table public.matter_deadlines force row level security;
alter table public.matter_strategy enable row level security;
alter table public.matter_strategy force row level security;

create policy "matters: read" on public.matters for select to authenticated
  using (private.can(workspace_id, id, 'read'));
create policy "matters: write" on public.matters for update to authenticated
  using (private.can(workspace_id, id, 'write'))
  with check (private.can(workspace_id, id, 'write'));
create policy "matters: delete" on public.matters for delete to authenticated
  using (private.can(workspace_id, id, 'delete'));
-- No insert policy: matters are created only through public.create_matter().

create policy "matter_members: read" on public.matter_members for select to authenticated
  using (private.can(workspace_id, matter_id, 'read'));
-- Changes go through add_matter_member / remove_matter_member.

create policy "deadlines: read" on public.matter_deadlines for select to authenticated
  using (private.can(workspace_id, matter_id, 'read'));
create policy "deadlines: add" on public.matter_deadlines for insert to authenticated
  with check (private.can(workspace_id, matter_id, 'write') and created_by = (select auth.uid()));
create policy "deadlines: edit" on public.matter_deadlines for update to authenticated
  using (private.can(workspace_id, matter_id, 'write'))
  with check (private.can(workspace_id, matter_id, 'write'));
create policy "deadlines: delete" on public.matter_deadlines for delete to authenticated
  using (private.can(workspace_id, matter_id, 'delete'));

create policy "strategy: read" on public.matter_strategy for select to authenticated
  using (private.can(workspace_id, matter_id, 'read'));
create policy "strategy: add" on public.matter_strategy for insert to authenticated
  with check (private.can(workspace_id, matter_id, 'write'));
create policy "strategy: edit" on public.matter_strategy for update to authenticated
  using (private.can(workspace_id, matter_id, 'write'))
  with check (private.can(workspace_id, matter_id, 'write'));

revoke all on public.matters, public.matter_members, public.matter_deadlines, public.matter_strategy from anon;
revoke all on public.matters, public.matter_members, public.matter_deadlines, public.matter_strategy from authenticated;
grant select, delete on public.matters to authenticated;
grant update (name, docket, court, practice_area, party_role, summary, status, assigned_agent_key)
  on public.matters to authenticated;
grant select on public.matter_members to authenticated;
grant select, delete on public.matter_deadlines to authenticated;
grant insert (workspace_id, matter_id, title, due_on, kind, created_by, confirmed_by, confirmed_at)
  on public.matter_deadlines to authenticated;
grant update (title, due_on, kind, confirmed_by, confirmed_at) on public.matter_deadlines to authenticated;
grant select on public.matter_strategy to authenticated;
grant insert (matter_id, workspace_id, body) on public.matter_strategy to authenticated;
grant update (body) on public.matter_strategy to authenticated;

-- ---- bookkeeping triggers ------------------------------------------------------

-- Bumps version and updated_at on every change; stamps who edited strategy.
create function private.bump_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create function private.stamp_strategy()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.version := old.version + 1; end if;
  return new;
end;
$$;
-- A deadline is confirmed only by an attorney, admin or owner on the matter,
-- only in their own name, and the time is stamped here (any confirmed_at the
-- app sends is ignored). Changing the title,
-- date or kind of a confirmed deadline clears the confirmation.
create function private.guard_deadline_confirmation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.confirmed_by is not distinct from old.confirmed_by then
      if (new.title, new.due_on, new.kind) is distinct from (old.title, old.due_on, old.kind) then
        new.confirmed_by := null;
        new.confirmed_at := null;
      else
        new.confirmed_at := old.confirmed_at;
      end if;
      return new;
    end if;
  end if;
  if new.confirmed_by is null then
    new.confirmed_at := null;
    return new;
  end if;
  if new.confirmed_by is distinct from (select auth.uid())
     or not private.can(new.workspace_id, new.matter_id, 'confirm') then
    raise exception 'only an attorney on this matter can confirm a deadline, in their own name'
      using errcode = '42501';
  end if;
  new.confirmed_at := now();
  return new;
end;
$$;
create trigger deadlines_confirm before insert or update on public.matter_deadlines
  for each row execute function private.guard_deadline_confirmation();

create trigger matters_bump before update on public.matters
  for each row execute function private.bump_version();
create trigger deadlines_touch before update on public.matter_deadlines
  for each row execute function public.touch_updated_at();
create trigger strategy_stamp before insert or update on public.matter_strategy
  for each row execute function private.stamp_strategy();
