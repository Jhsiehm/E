-- Bedrock 1, part 2: the only ways to create a matter or change who is on it,
-- plus firm-level permission checks. Each function re-checks permission with
-- private.can / private.can_workspace before writing, as the definer.

-- action: read | invite | manage_members | manage (rename, settings) | export (whole firm) | delete
create function private.can_workspace(ws uuid, action text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.membership_role := private.member_role(ws);
begin
  if r is null then return false; end if;
  return case action
    when 'read' then true
    when 'invite' then r in ('owner', 'admin')
    when 'manage_members' then r in ('owner', 'admin')
    when 'manage' then r = 'owner'
    when 'export' then r = 'owner'
    when 'delete' then r = 'owner'
    else false
  end;
end;
$$;
revoke all on function private.can_workspace(uuid, text) from public, anon;
grant execute on function private.can_workspace(uuid, text) to authenticated;

-- Creates a matter and puts the creator on its access list.
create function public.create_matter(
  ws uuid,
  matter_name text,
  docket text default '',
  court text default '',
  practice_area text default '',
  party_role text default '',
  summary text default '',
  assigned_agent_key text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not private.can(ws, null, 'create') then
    raise exception 'not allowed to create matters in this workspace' using errcode = '42501';
  end if;
  insert into public.matters
    (workspace_id, name, docket, court, practice_area, party_role, summary, assigned_agent_key, created_by)
  values
    (ws, trim(matter_name), coalesce(docket, ''), coalesce(court, ''), coalesce(practice_area, ''),
     coalesce(party_role, ''), coalesce(summary, ''), assigned_agent_key, uid)
  returning id into new_id;
  insert into public.matter_members (workspace_id, matter_id, user_id, added_by)
  values (ws, new_id, uid, uid);
  return new_id;
end;
$$;

-- Adds an active member of the same firm to a matter's access list.
create function public.add_matter_member(matter uuid, member uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  ws uuid;
begin
  select m.workspace_id into ws from public.matters m where m.id = matter;
  if ws is null or not private.can(ws, matter, 'share') then
    raise exception 'not allowed to share this matter' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.memberships ms
    where ms.workspace_id = ws and ms.user_id = member and ms.status = 'active'
  ) then
    raise exception 'that person is not an active member of this firm' using errcode = '23503';
  end if;
  insert into public.matter_members (workspace_id, matter_id, user_id, added_by)
  values (ws, matter, member, (select auth.uid()))
  on conflict (matter_id, user_id) do nothing;
end;
$$;

-- Removes someone from a matter. The last person on a matter cannot be removed.
create function public.remove_matter_member(matter uuid, member uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  ws uuid;
begin
  select m.workspace_id into ws from public.matters m where m.id = matter;
  if ws is null or not private.can(ws, matter, 'share') then
    raise exception 'not allowed to share this matter' using errcode = '42501';
  end if;
  if (select count(*) from public.matter_members mm where mm.matter_id = matter) <= 1 then
    raise exception 'a matter must keep at least one person' using errcode = '23514';
  end if;
  delete from public.matter_members mm where mm.matter_id = matter and mm.user_id = member;
end;
$$;

revoke all on function public.create_matter(uuid, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.add_matter_member(uuid, uuid) from public, anon;
revoke all on function public.remove_matter_member(uuid, uuid) from public, anon;
grant execute on function public.create_matter(uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.add_matter_member(uuid, uuid) to authenticated;
grant execute on function public.remove_matter_member(uuid, uuid) to authenticated;

-- Owners rename the firm; members leave memberships to owners/admins (later).
create policy "workspaces: owner updates" on public.workspaces for update to authenticated
  using (private.can_workspace(id, 'manage'))
  with check (private.can_workspace(id, 'manage'));
grant update (name) on public.workspaces to authenticated;
