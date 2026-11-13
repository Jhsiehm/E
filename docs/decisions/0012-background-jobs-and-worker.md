# 0012. Background jobs in Postgres, run by one worker container

Date: 2026-11-13 · Status: proposed (bedrock 3 of the backend foundation plan)

## Context
Reading uploaded PDFs, full research runs, nightly precedent checks and
reminder emails take longer than a web request may run on Vercel (60 s for
research today) and must survive a closed browser tab.

## Decision
- A `jobs` table in the same Postgres database is the queue. No extra queue
  service: one less vendor holding client metadata, and a job is queued in
  the same transaction as the change that needs it.
- People queue jobs with `enqueue_job()`, which checks access (edit rights on
  the matter, or firm membership for firm-level jobs) and de-duplicates by
  idempotency key. They can see and cancel jobs they are entitled to.
- Only the `casevex_worker` database role can claim, finish, fail or extend
  a job (`worker.*` functions). It cannot read any table directly. Claims use
  `FOR UPDATE SKIP LOCKED` and a lease, so two workers never hold the same
  job and a crashed worker's job is picked up when its lease ends.
- Failures retry after 30 s, 2 min, 8 min (up to `max_attempts`), then stop
  as "failed" with a short, plain reason. Payloads, reasons and logs never
  hold document text.
- The worker is TypeScript (`worker/`), sharing `lib/` with the website,
  bundled into one file and shipped as a small non-root Docker image
  (`worker/Dockerfile`). This is the only container in the system; the
  website stays on Vercel and the database on Supabase.

## Consequences
Long work moves out of web requests one kind at a time: document reading
(bedrock 4) and research runs (bedrock 5) are the first. Hosting the
container (recommended: Google Cloud Run) is still Joshua's decision.
