-- DESIGN DRAFT ONLY. Not a production migration: add reviewed RLS policies,
-- identity integration, indexes, lifecycle jobs, and migrations before use.
create table workspaces (
 id uuid primary key, name text not null, created_at timestamptz not null default now()
);
create table app_users (
 id uuid primary key, auth_subject text not null unique, name text not null,
 email text not null, created_at timestamptz not null default now()
);
create table memberships (
 workspace_id uuid references workspaces(id), user_id uuid references app_users(id),
 role text not null check (role in ('admin','attorney','paralegal','viewer')),
 status text not null default 'active', primary key(workspace_id,user_id)
);
create table matters (
 id uuid primary key, workspace_id uuid not null references workspaces(id),
 name text not null, docket text, court text, practice_area text,
 party_role text, summary text not null default '',
 status text not null check(status in ('active','in_review','archived')),
 version integer not null default 1, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(workspace_id,id)
);
create table matter_members (
 workspace_id uuid not null, matter_id uuid not null, user_id uuid not null,
 access text not null check(access in ('view','edit','review')),
 primary key(workspace_id,matter_id,user_id),
 foreign key(workspace_id,matter_id) references matters(workspace_id,id),
 foreign key(workspace_id,user_id) references memberships(workspace_id,user_id)
);
create table documents (
 id uuid primary key, workspace_id uuid not null, matter_id uuid not null,
 name text not null, status text not null, created_by uuid not null references app_users(id),
 deleted_at timestamptz, unique(workspace_id,matter_id,id),
 foreign key(workspace_id,matter_id) references matters(workspace_id,id)
);
create table document_versions (
 id uuid primary key, workspace_id uuid not null, matter_id uuid not null, document_id uuid not null,
 version integer not null, object_key text not null, sha256 text not null,
 mime_type text not null, size_bytes bigint not null check(size_bytes>0),
 processing_state text not null, extraction_error text, created_at timestamptz not null default now(),
 unique(workspace_id,matter_id,id), unique(document_id,version),
 foreign key(workspace_id,matter_id,document_id) references documents(workspace_id,matter_id,id)
);
create table document_chunks (
 id uuid primary key, workspace_id uuid not null, matter_id uuid not null, document_version_id uuid not null,
 ordinal integer not null, page_number integer, body text not null, content_hash text not null,
 unique(document_version_id,ordinal),
 foreign key(workspace_id,matter_id,document_version_id) references document_versions(workspace_id,matter_id,id)
);
create table research_threads (
 id uuid primary key, workspace_id uuid not null, matter_id uuid not null,
 created_by uuid not null references app_users(id), title text not null,
 unique(workspace_id,matter_id,id),
 foreign key(workspace_id,matter_id) references matters(workspace_id,id)
);
create table research_runs (
 id uuid primary key, workspace_id uuid not null, matter_id uuid not null, thread_id uuid not null,
 requested_by uuid not null references app_users(id), status text not null,
 model_version text, prompt_version text, idempotency_key text not null, request_hash text not null,
 started_at timestamptz, finished_at timestamptz, usage jsonb not null default '{}',
 unique(workspace_id,matter_id,id), unique(workspace_id,requested_by,idempotency_key),
 foreign key(workspace_id,matter_id,thread_id) references research_threads(workspace_id,matter_id,id)
);
create table run_events (
 workspace_id uuid not null, matter_id uuid not null, run_id uuid not null,
 sequence bigint not null, event_type text not null, payload jsonb not null,
 created_at timestamptz not null default now(), primary key(run_id,sequence),
 foreign key(workspace_id,matter_id,run_id) references research_runs(workspace_id,matter_id,id)
);
create table events (
 id uuid primary key, workspace_id uuid not null, matter_id uuid not null,
 title text not null, kind text not null, due_date date, starts_at timestamptz, time_zone text not null,
 confirmed_by uuid references app_users(id), provenance jsonb not null default '{}', version integer not null default 1,
 check((due_date is not null) <> (starts_at is not null)),
 foreign key(workspace_id,matter_id) references matters(workspace_id,id)
);
create table notices (
 id uuid primary key, workspace_id uuid not null references workspaces(id),
 title text not null, kind text not null, deduplication_key text not null,
 payload jsonb not null, created_at timestamptz not null default now(),
 unique(workspace_id,id), unique(workspace_id,deduplication_key)
);
create table notice_reads (
 workspace_id uuid not null, notice_id uuid not null, user_id uuid not null,
 read_at timestamptz not null default now(), primary key(workspace_id,notice_id,user_id),
 foreign key(workspace_id,notice_id) references notices(workspace_id,id),
 foreign key(workspace_id,user_id) references memberships(workspace_id,user_id)
);
create table outbox_events (
 id uuid primary key, workspace_id uuid not null references workspaces(id),
 event_type text not null, payload jsonb not null, created_at timestamptz not null default now(), published_at timestamptz
);
-- Intentionally no permissive policies. RLS below denies ordinary non-owner roles
-- until explicit tested policies and a non-owner application role are provisioned.
alter table matters enable row level security;
alter table matters force row level security;
alter table documents enable row level security;
alter table documents force row level security;
alter table document_versions enable row level security;
alter table document_versions force row level security;
alter table document_chunks enable row level security;
alter table document_chunks force row level security;
alter table research_threads enable row level security;
alter table research_threads force row level security;
alter table research_runs enable row level security;
alter table research_runs force row level security;
alter table run_events enable row level security;
alter table run_events force row level security;
alter table events enable row level security;
alter table events force row level security;
alter table notices enable row level security;
alter table notices force row level security;
alter table notice_reads enable row level security;
alter table notice_reads force row level security;
