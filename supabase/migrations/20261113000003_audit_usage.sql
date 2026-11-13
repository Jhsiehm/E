-- Bedrock 2: who did what (audit_events) and what every AI call cost
-- (usage_events). Both are append-only: no one, the app included, can edit
-- or delete a row. Neither stores document text, prompts or replies.

create table public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references auth.users (id),
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  matter_id uuid,
  target_table text not null,
  target_id text not null,
  -- Names of the columns that changed, never their values.
  changed_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_events_ws_idx on public.audit_events (workspace_id, created_at desc);
create index audit_events_matter_idx on public.audit_events (matter_id, created_at desc);

create table public.usage_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id),
  run_id text check (run_id is null or char_length(run_id) <= 100),
  provider text not null check (char_length(provider) <= 100),
  -- Model, tier, token counts, latency (lib/ai/usage-events.ts). No text.
  units jsonb not null check (jsonb_typeof(units) = 'object' and pg_column_size(units) < 4096),
  cost_usd numeric(12, 6) not null check (cost_usd >= 0),
  created_at timestamptz not null default now()
);
create index usage_events_ws_idx on public.usage_events (workspace_id, created_at desc);

alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;
alter table public.usage_events enable row level security;
alter table public.usage_events force row level security;

-- Firm owners and admins read the audit trail and the AI bill.
create policy "audit: owners and admins read" on public.audit_events for select to authenticated
  using (private.can_workspace(workspace_id, 'manage_members'));
create policy "usage: owners and admins read" on public.usage_events for select to authenticated
  using (private.can_workspace(workspace_id, 'manage_members'));
-- Any active member records their own AI calls, for their own firm.
create policy "usage: record own calls" on public.usage_events for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_workspace(workspace_id, 'read'));

revoke all on public.audit_events, public.usage_events from anon, authenticated;
grant select on public.audit_events to authenticated;
grant select on public.usage_events to authenticated;
grant insert (workspace_id, user_id, run_id, provider, units, cost_usd) on public.usage_events to authenticated;

-- Append-only, even for the database owner. Deletes are refused unless they
-- come from a cascade (a whole firm being deleted, at trigger depth > 0).
create function private.refuse_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;
create trigger audit_events_no_update before update on public.audit_events
  for each row execute function private.refuse_change();
create trigger usage_events_no_update before update on public.usage_events
  for each row execute function private.refuse_change();
create trigger audit_events_no_delete before delete on public.audit_events
  for each row when (pg_trigger_depth() = 0) execute function private.refuse_change();
create trigger usage_events_no_delete before delete on public.usage_events
  for each row when (pg_trigger_depth() = 0) execute function private.refuse_change();

-- ---- automatic audit rows ----------------------------------------------------

-- Written as the definer so the app cannot skip or forge them.
create function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  prefix text := tg_argv[0];
  verb text := case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end;
  fields text[] := '{}';
  target text;
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}') into fields
    from jsonb_each(to_jsonb(new)) n
    where n.key not in ('version', 'updated_at', 'updated_by')
      and n.value is distinct from to_jsonb(old) -> n.key;
    if cardinality(fields) = 0 then return null; end if;
  end if;
  target := coalesce(rec ->> 'id', rec ->> 'matter_id', '');
  if rec ? 'user_id' and not rec ? 'id' then
    target := ltrim(target || ':' || (rec ->> 'user_id'), ':');
  end if;
  -- A firm being deleted takes its audit trail with it; nothing to record.
  if not exists (select 1 from public.workspaces w where w.id = (rec ->> 'workspace_id')::uuid) then
    return null;
  end if;
  insert into public.audit_events (workspace_id, actor_id, action, matter_id, target_table, target_id, changed_fields)
  values (
    (rec ->> 'workspace_id')::uuid,
    (select auth.uid()),
    prefix || '.' || verb,
    coalesce((rec ->> 'matter_id')::uuid, case when tg_table_name = 'matters' then (rec ->> 'id')::uuid end),
    tg_table_name,
    target,
    fields
  );
  return null;
end;
$$;
revoke all on function private.audit_row() from public, anon, authenticated;

create trigger matters_audit after insert or update or delete on public.matters
  for each row execute function private.audit_row('matter');
create trigger matter_members_audit after insert or delete on public.matter_members
  for each row execute function private.audit_row('matter_access');
create trigger deadlines_audit after insert or update or delete on public.matter_deadlines
  for each row execute function private.audit_row('deadline');
create trigger strategy_audit after insert or update on public.matter_strategy
  for each row execute function private.audit_row('strategy');
create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function private.audit_row('membership');

-- ---- spend limits ------------------------------------------------------------

-- Today's AI spend for the caller's firm (UTC day). Members may see this one
-- number so the app can stop a runaway job; the itemized bill stays private.
create function public.ai_spend_today(ws uuid)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select case when private.can_workspace(ws, 'read') then
    coalesce((select sum(u.cost_usd) from public.usage_events u
              where u.workspace_id = ws and u.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'), 0)
  end;
$$;
revoke all on function public.ai_spend_today(uuid) from public, anon;
grant execute on function public.ai_spend_today(uuid) to authenticated;
