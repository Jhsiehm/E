-- Palette options match the Casevex highlight colors on the navy sidebar
-- (rose is today's look); the membership helper moves out of the exposed
-- API schema; ai_experience uses the levels shared with the agents work.


alter table public.profiles drop constraint profiles_avatar_color_check;
alter table public.profiles drop constraint profiles_accent_check;
alter table public.profiles alter column avatar_color set default 'rose';
alter table public.profiles alter column accent set default 'rose';
update public.profiles set avatar_color = 'rose' where avatar_color not in ('rose', 'teal', 'olive', 'plum');
update public.profiles set accent = 'rose' where accent not in ('rose', 'teal', 'olive', 'plum');
alter table public.profiles add constraint profiles_avatar_color_check
  check (avatar_color in ('rose', 'teal', 'olive', 'plum'));
alter table public.profiles add constraint profiles_accent_check
  check (accent in ('rose', 'teal', 'olive', 'plum'));

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.is_active_member(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;
revoke all on function private.is_active_member(uuid) from public, anon;
grant execute on function private.is_active_member(uuid) to authenticated;

drop policy "workspaces: members read" on public.workspaces;
drop policy "memberships: members read" on public.memberships;
create policy "workspaces: members read" on public.workspaces
  for select to authenticated using (private.is_active_member(id));
create policy "memberships: members read" on public.memberships
  for select to authenticated using (private.is_active_member(workspace_id));
drop function public.is_active_member(uuid);

alter table public.profiles drop constraint profiles_ai_experience_check;
update public.profiles set ai_experience = 'advanced' where ai_experience = 'regular';
alter table public.profiles add constraint profiles_ai_experience_check
  check (ai_experience is null or ai_experience in ('new', 'some', 'advanced'));

-- Practice areas are stable keys from lib/practice-areas.ts.
alter table public.profiles add constraint profiles_practice_area_keys_check
  check (array_to_string(practice_areas, ',') ~ '^[a-z_,]*$');

-- Who the person is (students get a learning mode). Display/tailoring only,
-- never a permission.
alter table public.profiles
  add column persona text
  check (persona is null or persona in ('attorney', 'paralegal', 'student', 'other'));
grant update (persona) on public.profiles to authenticated;
