-- Bedrock 3: background jobs. Slow work (reading a PDF, a full research run,
-- nightly precedent checks, reminder emails) is queued here and run by the
-- worker container, instead of inside a 60-second web request.
--
-- * People queue jobs through enqueue_job(), which checks their access.
-- * Only the worker (role casevex_worker) can claim, finish or fail a job.
-- * A claim is a lease: if a worker dies, the job is picked up again once
--   the lease runs out. Two workers never hold the same job at once.
-- * A job retries with growing waits, then stops as "failed" with a short,
--   plain reason. Payloads hold ids, never document text.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'casevex_worker') then
    create role casevex_worker nologin;
  end if;
end $$;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  matter_id uuid,
  kind text not null check (kind ~ '^[a-z_]+\.[a-z_]+$'),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) < 8192),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  run_after timestamptz not null default now(),
  locked_by text,
  locked_until timestamptz,
  idempotency_key text check (idempotency_key is null or char_length(idempotency_key) <= 200),
  last_error text check (last_error is null or char_length(last_error) <= 500),
  result jsonb check (result is null or pg_column_size(result) < 8192),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, matter_id) references public.matters (workspace_id, id) on delete cascade
);
create index jobs_ready_idx on public.jobs (run_after) where status = 'queued';
create index jobs_lease_idx on public.jobs (locked_until) where status = 'running';
create index jobs_ws_idx on public.jobs (workspace_id, created_at desc);

alter table public.jobs enable row level security;
alter table public.jobs force row level security;

-- People see jobs on matters they can read, and firm-level jobs they started.
create policy "jobs: read" on public.jobs for select to authenticated
  using (
    case when matter_id is null
      then created_by = (select auth.uid()) and private.can_workspace(workspace_id, 'read')
      else private.can(workspace_id, matter_id, 'read')
    end
  );
revoke all on public.jobs from anon, authenticated;
grant select (id, workspace_id, matter_id, kind, status, attempts, max_attempts, run_after,
  last_error, result, created_by, created_at, updated_at, finished_at)
  on public.jobs to authenticated;

create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();

-- ---- people: queue and cancel -------------------------------------------------

create function public.enqueue_job(
  ws uuid,
  job_kind text,
  job_payload jsonb default '{}'::jsonb,
  matter uuid default null,
  idem_key text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  job_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if (matter is null and not private.can_workspace(ws, 'read'))
     or (matter is not null and not private.can(ws, matter, 'write')) then
    raise exception 'not allowed to start this job' using errcode = '42501';
  end if;
  insert into public.jobs (workspace_id, matter_id, kind, payload, idempotency_key, created_by)
  values (ws, matter, job_kind, coalesce(job_payload, '{}'::jsonb), idem_key, uid)
  on conflict (workspace_id, idempotency_key) do nothing
  returning id into job_id;
  if job_id is null then
    select j.id into job_id from public.jobs j
    where j.workspace_id = ws and j.idempotency_key = idem_key;
  end if;
  return job_id;
end;
$$;

create function public.cancel_job(job uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  update public.jobs j set status = 'cancelled', finished_at = now(), locked_by = null, locked_until = null
  where j.id = job and j.status = 'queued'
    and (j.created_by = (select auth.uid())
         or (j.matter_id is not null and private.can(j.workspace_id, j.matter_id, 'write')));
  return found;
end;
$$;

revoke all on function public.enqueue_job(uuid, text, jsonb, uuid, text) from public, anon;
revoke all on function public.cancel_job(uuid) from public, anon;
grant execute on function public.enqueue_job(uuid, text, jsonb, uuid, text) to authenticated;
grant execute on function public.cancel_job(uuid) to authenticated;

-- ---- worker: claim, finish, fail -----------------------------------------------

create schema if not exists worker;
revoke all on schema worker from public, anon, authenticated;
grant usage on schema worker to casevex_worker, service_role;

-- Takes up to n ready jobs of the given kinds, including ones whose previous
-- worker's lease ran out. SKIP LOCKED keeps two workers off the same job.
create function worker.claim_jobs(worker_id text, kinds text[], n integer default 1, lease_seconds integer default 300)
returns setof public.jobs
language sql security definer set search_path = ''
as $$
  update public.jobs j
  set status = 'running', attempts = j.attempts + 1, locked_by = worker_id,
      locked_until = now() + make_interval(secs => lease_seconds)
  where j.id in (
    select c.id from public.jobs c
    where c.kind = any (kinds)
      and ((c.status = 'queued' and c.run_after <= now())
           or (c.status = 'running' and c.locked_until < now()))
    order by c.run_after
    limit greatest(1, least(n, 50))
    for update skip locked
  )
  returning j.*;
$$;

create function worker.complete_job(job uuid, worker_id text, job_result jsonb default null)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  update public.jobs j set status = 'succeeded', result = job_result, finished_at = now(),
    locked_by = null, locked_until = null, last_error = null
  where j.id = job and j.status = 'running' and j.locked_by = worker_id;
  return found;
end;
$$;

-- Retries after 30s, 2m, 8m, ... until max_attempts, then marks it failed.
-- The reason must be plain and short; never put document text in it.
create function worker.fail_job(job uuid, worker_id text, reason text, retryable boolean default true)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  next_status text;
begin
  update public.jobs j set
    status = case when retryable and j.attempts < j.max_attempts then 'queued' else 'failed' end,
    run_after = now() + make_interval(secs => 30 * power(4, greatest(j.attempts - 1, 0))),
    finished_at = case when retryable and j.attempts < j.max_attempts then null else now() end,
    last_error = left(coalesce(reason, 'Unknown error'), 500),
    locked_by = null, locked_until = null
  where j.id = job and j.status = 'running' and j.locked_by = worker_id
  returning j.status into next_status;
  return next_status;
end;
$$;

-- Extends a lease for long jobs; false means the job is no longer this worker's.
create function worker.heartbeat(job uuid, worker_id text, lease_seconds integer default 300)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  update public.jobs j set locked_until = now() + make_interval(secs => lease_seconds)
  where j.id = job and j.status = 'running' and j.locked_by = worker_id;
  return found;
end;
$$;

revoke all on function worker.claim_jobs(text, text[], integer, integer) from public;
revoke all on function worker.complete_job(uuid, text, jsonb) from public;
revoke all on function worker.fail_job(uuid, text, text, boolean) from public;
revoke all on function worker.heartbeat(uuid, text, integer) from public;
grant execute on function worker.claim_jobs(text, text[], integer, integer) to casevex_worker, service_role;
grant execute on function worker.complete_job(uuid, text, jsonb) to casevex_worker, service_role;
grant execute on function worker.fail_job(uuid, text, text, boolean) to casevex_worker, service_role;
grant execute on function worker.heartbeat(uuid, text, integer) to casevex_worker, service_role;
