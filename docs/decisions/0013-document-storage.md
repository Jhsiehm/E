# 13. Document storage and reading

Date: 2026-11-13
Status: Accepted

## Context
Firms need to put their files on a matter, and research needs the text of
those files. Files hold privileged client material, so the rules that guard
a matter must guard its files too, and a file must never pass through code
that could leak it.

## Decision
- **Tables:** `documents` (name, type, review status), `document_versions`
  (one stored file each, never changed: storage key, SHA-256, type, size,
  reading state) and `document_chunks` (the file's text in pieces of about
  2,000 characters, with page numbers for PDFs). Every row carries the
  firm and matter, and `private.can` decides access, as for matters.
- **Files** live in a private Supabase Storage bucket, `matter-files`
  (PDF and Word only, 20 MB at most). Its key is
  `<firm>/<matter>/<document>/<version>` and is chosen by the database.
- **Upload:** the browser asks `start_document_upload()` for a place (the
  database checks the matter, the type, the size), gets a one-time signed
  link from Storage, sends the file straight to Storage, then calls
  `finish_document_upload()`. Storage's own policies let a person upload only
  to a place they reserved and have not used yet, so nobody can overwrite a
  file or drop one into another matter. Files never pass through the website,
  which also avoids Vercel's 4.5 MB request limit.
- **Download:** a signed link that works for 60 seconds, issued only if the
  person can read the matter. Nobody can delete or replace a stored file
  directly.
- **Reading:** finishing an upload queues a `document.extract` job. The
  worker downloads the file with the Storage service key (only the worker
  has it; the website never does), checks the size and SHA-256 match what
  was announced, checks the contents really are a PDF or Word file (the name
  and the browser's claim are not trusted), extracts text with `unpdf`
  (PDF.js, with eval off) or `fflate` (Word, refusing zip bombs), and saves
  the chunks. Problems that will not fix themselves are shown on the
  document in plain words.
- **Delete:** deleting a document (attorney, admin or owner on the matter)
  removes its rows and queues `document.purge`, which deletes the file.

## Not done yet (before the pilot)
- Malware scanning (planned: ClamAV in the worker before reading).
- Reading scanned PDFs (OCR). For now a scan is marked "no text found".
- When a whole firm is deleted, its files are not purged automatically; a
  periodic sweep that compares storage to `document_versions` will do this.
- Moving a document to another matter (upload it there instead).

## Consequences
The worker needs four more settings, `CASEVEX_WORKER_S3_ENDPOINT`,
`CASEVEX_WORKER_S3_REGION`, `CASEVEX_WORKER_S3_KEY_ID` and
`CASEVEX_WORKER_S3_SECRET` (Supabase dashboard, Storage, S3 access keys). Without them it still runs but skips document
jobs. Tests cover the access rules, uploads, the worker reading real PDF and
Word files, and refusal of disguised or swapped files.
