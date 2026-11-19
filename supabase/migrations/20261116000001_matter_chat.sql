-- Matter chat, part 1: the AI can read case documents and remember the
-- conversation.
--
-- 1. matter_chat_messages keeps each person's conversation on a matter, so a
--    follow-up question builds on earlier ones and the chat is still there
--    after leaving the page. A conversation is private to the person who had
--    it, and only while they are still on the matter (private.can).
-- 2. save_document_text lets the site itself store the text it read from an
--    uploaded file, so documents become readable without the separate worker
--    (whose hosting is not decided yet). Only someone who may add documents to
--    the matter can call it, and only for a file that has finished uploading.
--
-- Re-runnable: every statement checks what already exists.

create table if not exists public.matter_chat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  matter_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'agent')),
  body text not null check (char_length(body) between 1 and 20000),
  -- The numbered sources shown under an answer: [{ index, title, meta, href, verified }].
  sources jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) <= 40),
  -- How an answer was made: 'model' (AI, checked) or 'extractive' (quotes only).
  mode text check (mode is null or mode in ('model', 'extractive')),
  created_at timestamptz not null default now(),
  foreign key (workspace_id, matter_id) references public.matters (workspace_id, id) on delete cascade
);
create index if not exists matter_chat_messages_thread_idx
  on public.matter_chat_messages (user_id, matter_id, created_at desc);
create index if not exists matter_chat_messages_matter_idx
  on public.matter_chat_messages (matter_id);

alter table public.matter_chat_messages enable row level security;
alter table public.matter_chat_messages force row level security;

drop policy if exists "chat: read own" on public.matter_chat_messages;
drop policy if exists "chat: add own" on public.matter_chat_messages;
drop policy if exists "chat: clear own" on public.matter_chat_messages;
create policy "chat: read own" on public.matter_chat_messages for select to authenticated
  using (user_id = (select auth.uid()) and private.can(workspace_id, matter_id, 'read'));
create policy "chat: add own" on public.matter_chat_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can(workspace_id, matter_id, 'read'));
create policy "chat: clear own" on public.matter_chat_messages for delete to authenticated
  using (user_id = (select auth.uid()) and private.can(workspace_id, matter_id, 'read'));

revoke all on public.matter_chat_messages from anon, authenticated;
grant select, insert, delete on public.matter_chat_messages to authenticated;

-- ---- reading uploaded files without the worker ------------------------------------

-- Saves the text read from a file as chunks [{ "page": 1, "body": "..." }, ...]
-- and marks it ready; or, with reason, marks it as unreadable with that
-- plain-language reason. Returns false when there is nothing to do (deleted,
-- still uploading, or already read).
create or replace function public.save_document_text(
  version_id uuid,
  chunks jsonb,
  pages integer default null,
  reason text default null
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v public.document_versions;
begin
  select * into v from public.document_versions dv
  where dv.id = save_document_text.version_id for update;
  if v.id is null then return false; end if;
  if (select auth.uid()) is null or not private.can(v.workspace_id, v.matter_id, 'write') then
    raise exception 'not allowed to read documents on this matter' using errcode = '42501';
  end if;
  if v.processing_state not in ('uploaded', 'extracting') then return false; end if;
  if reason is not null then
    update public.document_versions
    set processing_state = 'failed', processing_error = left(reason, 300)
    where id = v.id;
    return true;
  end if;
  if jsonb_typeof(chunks) <> 'array' or jsonb_array_length(chunks) not between 1 and 5000 then
    raise exception 'chunks must be an array of 1 to 5000 items' using errcode = '22023';
  end if;
  delete from public.document_chunks c where c.document_version_id = v.id;
  insert into public.document_chunks (workspace_id, matter_id, document_version_id, ordinal, page_number, body)
  select v.workspace_id, v.matter_id, v.id, (e.ord - 1)::integer, (e.item ->> 'page')::integer, e.item ->> 'body'
  from jsonb_array_elements(chunks) with ordinality as e(item, ord);
  update public.document_versions
  set processing_state = 'ready', processing_error = null, page_count = pages
  where id = v.id;
  return true;
end;
$$;
revoke all on function public.save_document_text(uuid, jsonb, integer, text) from public, anon;
grant execute on function public.save_document_text(uuid, jsonb, integer, text) to authenticated;
