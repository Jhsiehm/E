-- Bedrock 4, part 2: the files themselves. They live in a private Supabase
-- Storage bucket. People upload and download with short-lived signed links
-- that Storage only issues when these policies allow it, so the same matter
-- rules guard the files as guard the rows. Nobody can overwrite or delete a
-- stored file directly; deleting a document queues the worker to remove it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('matter-files', 'matter-files', false, 20971520, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- May the caller read (download) or upload the file stored at this key?
-- Upload is allowed once, by the person who started it, while it is pending.
create function private.can_file(key text, action text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.document_versions v
    where v.object_key = key
      and case action
        when 'read' then private.can(v.workspace_id, v.matter_id, 'read')
        when 'upload' then v.processing_state = 'pending'
          and v.created_by = (select auth.uid())
          and private.can(v.workspace_id, v.matter_id, 'write')
        else false
      end
  );
$$;
revoke all on function private.can_file(text, text) from public, anon;
grant execute on function private.can_file(text, text) to authenticated;

create policy "matter files: download" on storage.objects for select to authenticated
  using (bucket_id = 'matter-files' and private.can_file(name, 'read'));
create policy "matter files: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'matter-files' and private.can_file(name, 'upload'));
-- No update or delete policy: stored files cannot be replaced or removed by users.

-- Step 2 of an upload: the file is in storage. Checks it arrived with the
-- size that was announced, then queues the worker to read it.
create function public.finish_document_upload(version_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v public.document_versions;
  stored_size bigint;
begin
  select * into v from public.document_versions dv where dv.id = version_id;
  if v.id is null or v.created_by <> (select auth.uid())
     or not private.can(v.workspace_id, v.matter_id, 'write') then
    raise exception 'not allowed to finish this upload' using errcode = '42501';
  end if;
  if v.processing_state <> 'pending' then
    return v.document_id; -- already finished: safe to call twice
  end if;
  select (o.metadata ->> 'size')::bigint into stored_size
  from storage.objects o where o.bucket_id = 'matter-files' and o.name = v.object_key;
  if not found then
    raise exception 'The file has not finished uploading' using errcode = '22023';
  end if;
  if stored_size is not null and stored_size <> v.size_bytes then
    raise exception 'The uploaded file is not the expected size' using errcode = '22023';
  end if;
  update public.document_versions set processing_state = 'uploaded' where id = v.id;
  update public.documents set updated_at = now() where id = v.document_id;
  insert into public.jobs (workspace_id, matter_id, kind, payload, idempotency_key, created_by)
  values (v.workspace_id, v.matter_id, 'document.extract', jsonb_build_object('version_id', v.id),
          'document.extract:' || v.id, v.created_by)
  on conflict (workspace_id, idempotency_key) do nothing;
  return v.document_id;
end;
$$;
revoke all on function public.finish_document_upload(uuid) from public, anon;
grant execute on function public.finish_document_upload(uuid) to authenticated;

-- When a version goes (document or matter deleted), queue removal of its
-- file. Skipped when the whole firm is being deleted (see ADR 0013).
create function private.queue_file_purge()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
    insert into public.jobs (workspace_id, kind, payload, idempotency_key)
    values (old.workspace_id, 'document.purge', jsonb_build_object('object_key', old.object_key),
            'document.purge:' || old.id)
    on conflict (workspace_id, idempotency_key) do nothing;
  end if;
  return null;
end;
$$;
revoke all on function private.queue_file_purge() from public, anon, authenticated;
create trigger document_versions_purge after delete on public.document_versions
  for each row execute function private.queue_file_purge();

-- ---- worker side ------------------------------------------------------------------

-- What the worker needs to read one version. Marks it extracting.
create function worker.begin_extract(version_id uuid)
returns table (object_key text, mime_type text, size_bytes bigint, sha256 text)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  update public.document_versions v set processing_state = 'extracting', processing_error = null
  where v.id = begin_extract.version_id and v.processing_state in ('uploaded', 'extracting', 'failed')
  returning v.object_key, v.mime_type, v.size_bytes, v.sha256;
end;
$$;

-- Saves the text as chunks [{ "page": 1, "body": "..." }, ...] and marks the
-- version ready. Replaces earlier chunks, so a retry is harmless.
create function worker.save_extract(version_id uuid, chunks jsonb, pages integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v public.document_versions;
begin
  select * into v from public.document_versions dv where dv.id = version_id for update;
  if v.id is null then return false; end if;
  if jsonb_typeof(chunks) <> 'array' or jsonb_array_length(chunks) > 5000 then
    raise exception 'chunks must be an array of at most 5000 items' using errcode = '22023';
  end if;
  delete from public.document_chunks c where c.document_version_id = v.id;
  insert into public.document_chunks (workspace_id, matter_id, document_version_id, ordinal, page_number, body)
  select v.workspace_id, v.matter_id, v.id, (e.ord - 1)::integer, (e.item ->> 'page')::integer, e.item ->> 'body'
  from jsonb_array_elements(chunks) with ordinality as e(item, ord);
  update public.document_versions set processing_state = 'ready', processing_error = null, page_count = pages
  where id = v.id;
  return true;
end;
$$;

-- Records a plain-language reason the file could not be read.
create function worker.fail_extract(version_id uuid, reason text)
returns void
language sql security definer set search_path = ''
as $$
  update public.document_versions set processing_state = 'failed',
    processing_error = left(coalesce(reason, 'The file could not be read.'), 300)
  where id = fail_extract.version_id;
$$;

revoke all on function worker.begin_extract(uuid) from public;
revoke all on function worker.save_extract(uuid, jsonb, integer) from public;
revoke all on function worker.fail_extract(uuid, text) from public;
grant execute on function worker.begin_extract(uuid) to casevex_worker, service_role;
grant execute on function worker.save_extract(uuid, jsonb, integer) to casevex_worker, service_role;
grant execute on function worker.fail_extract(uuid, text) to casevex_worker, service_role;
