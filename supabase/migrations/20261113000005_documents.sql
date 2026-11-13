-- Bedrock 4, part 1: documents on a matter. A document has one or more
-- versions; each version is one stored file (never changed once uploaded)
-- plus the text the worker pulled out of it, split into chunks for research.
-- Access follows the matter: you see a document only if you are on its
-- matter (private.can). Files live in the private "matter-files" bucket
-- (next migration); the database decides who may upload or download them.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  matter_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 200),
  ext text not null check (ext in ('pdf', 'docx')),
  doc_type text not null default '' check (char_length(doc_type) <= 80),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'final')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, matter_id, id),
  foreign key (workspace_id, matter_id) references public.matters (workspace_id, id) on delete cascade
);
create index documents_matter_idx on public.documents (matter_id, updated_at desc);
create index documents_ws_idx on public.documents (workspace_id, updated_at desc);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  matter_id uuid not null,
  document_id uuid not null,
  version integer not null check (version >= 1),
  -- <workspace>/<matter>/<document>/<version>; set here, never by the app.
  object_key text not null unique,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  -- pending: waiting for the file; uploaded: file is in storage, queued;
  -- extracting: worker is reading it; ready / failed: done.
  processing_state text not null default 'pending'
    check (processing_state in ('pending', 'uploaded', 'extracting', 'ready', 'failed')),
  processing_error text check (processing_error is null or char_length(processing_error) <= 300),
  page_count integer,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, version),
  unique (workspace_id, matter_id, id),
  foreign key (workspace_id, matter_id, document_id)
    references public.documents (workspace_id, matter_id, id) on delete cascade
);
create index document_versions_doc_idx on public.document_versions (document_id, version desc);

create table public.document_chunks (
  workspace_id uuid not null,
  matter_id uuid not null,
  document_version_id uuid not null,
  ordinal integer not null check (ordinal >= 0),
  page_number integer,
  body text not null check (char_length(body) between 1 and 8000),
  primary key (document_version_id, ordinal),
  foreign key (workspace_id, matter_id, document_version_id)
    references public.document_versions (workspace_id, matter_id, id) on delete cascade
);
create index document_chunks_matter_idx on public.document_chunks (matter_id);

alter table public.documents enable row level security;
alter table public.documents force row level security;
alter table public.document_versions enable row level security;
alter table public.document_versions force row level security;
alter table public.document_chunks enable row level security;
alter table public.document_chunks force row level security;

create policy "documents: read" on public.documents for select to authenticated
  using (private.can(workspace_id, matter_id, 'read'));
create policy "documents: edit" on public.documents for update to authenticated
  using (private.can(workspace_id, matter_id, 'write'))
  with check (private.can(workspace_id, matter_id, 'write'));
create policy "documents: delete" on public.documents for delete to authenticated
  using (private.can(workspace_id, matter_id, 'delete'));
create policy "versions: read" on public.document_versions for select to authenticated
  using (private.can(workspace_id, matter_id, 'read'));
create policy "chunks: read" on public.document_chunks for select to authenticated
  using (private.can(workspace_id, matter_id, 'read'));
-- New documents and versions only through start_document_upload();
-- processing state and chunks only from the worker.

revoke all on public.documents, public.document_versions, public.document_chunks from anon, authenticated;
grant select, delete on public.documents to authenticated;
grant update (name, doc_type, status) on public.documents to authenticated;
grant select on public.document_versions to authenticated;
grant select on public.document_chunks to authenticated;

create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();
create trigger document_versions_touch before update on public.document_versions
  for each row execute function public.touch_updated_at();
create trigger documents_audit after insert or update or delete on public.documents
  for each row execute function private.audit_row('document');
create trigger document_versions_audit after insert on public.document_versions
  for each row execute function private.audit_row('document_version');

-- ---- upload: start, then finish -------------------------------------------------

-- Step 1: reserve a place for the file. Pass document to add a new version
-- of an existing document. Returns where the file must be uploaded.
create function public.start_document_upload(
  matter uuid,
  file_name text,
  mime text,
  size_bytes bigint,
  sha256 text,
  document uuid default null
)
returns table (document_id uuid, version_id uuid, object_key text)
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ws uuid;
  doc uuid := document;
  ver uuid := gen_random_uuid();
  n integer;
  file_ext text := lower(substring(coalesce(file_name, '') from '\.([A-Za-z0-9]+)$'));
  key text;
begin
  select m.workspace_id into ws from public.matters m where m.id = matter;
  if uid is null or ws is null or not private.can(ws, matter, 'write') then
    raise exception 'not allowed to add documents to this matter' using errcode = '42501';
  end if;
  if (file_ext, mime) not in (
    ('pdf', 'application/pdf'),
    ('docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) then
    raise exception 'Choose a PDF or DOCX file' using errcode = '22023';
  end if;
  if doc is null then
    insert into public.documents (workspace_id, matter_id, name, ext, doc_type, created_by)
    values (ws, matter, left(trim(regexp_replace(file_name, '\.[^.]*$', '')), 200), file_ext, 'Uploaded document', uid)
    returning id into doc;
    n := 1;
  else
    if not exists (select 1 from public.documents d where d.id = doc and d.matter_id = matter) then
      raise exception 'that document is not on this matter' using errcode = '42501';
    end if;
    if not exists (select 1 from public.documents d where d.id = doc and d.ext = file_ext) then
      raise exception 'A new version must be the same file type' using errcode = '22023';
    end if;
    select coalesce(max(v.version), 0) + 1 into n
    from public.document_versions v where v.document_id = doc;
  end if;
  key := ws || '/' || matter || '/' || doc || '/' || ver;
  insert into public.document_versions
    (id, workspace_id, matter_id, document_id, version, object_key, sha256, mime_type, size_bytes, created_by)
  values (ver, ws, matter, doc, n, key, lower(sha256), mime, size_bytes, uid);
  return query select doc, ver, key;
end;
$$;

revoke all on function public.start_document_upload(uuid, text, text, bigint, text, uuid) from public, anon;
grant execute on function public.start_document_upload(uuid, text, text, bigint, text, uuid) to authenticated;
