# Casevex worker

Runs background jobs (`public.jobs`) outside the website, so slow work is
not cut off by Vercel's request time limit. One container; scale by running
more copies (claims are exclusive, so two copies never run the same job).

## Run locally

```sh
CASEVEX_WORKER_DATABASE_URL=postgres://worker_login:...@localhost:5432/postgres npm run worker
```

## Database login for the worker

The migration creates a `casevex_worker` role that can only call the
`worker.*` functions. It cannot read matters, documents or any other table.
Create a login for it once, in the Supabase SQL editor (choose a long random
password and store it only in the worker host's secret store):

```sql
create role casevex_worker_login login password '<generated>' in role casevex_worker;
```

Use the Supabase connection pooler URL with that user as
`CASEVEX_WORKER_DATABASE_URL`. Never give the worker the `postgres` or
`service_role` credentials.

## File storage access (document jobs)

To read uploads and remove deleted files, the worker needs a Supabase
Storage S3 access key (Supabase dashboard: Storage, S3 access keys, "New
access key"). It reaches file storage only, never the database. Set:

```sh
CASEVEX_WORKER_S3_ENDPOINT=https://<project-ref>.storage.supabase.co/storage/v1/s3
CASEVEX_WORKER_S3_REGION=<the region shown next to the endpoint>
CASEVEX_WORKER_S3_KEY_ID=...
CASEVEX_WORKER_S3_SECRET=...
```

Without them the worker still runs, but skips `document.*` jobs.

## Adding a job kind

1. Add a handler in `handlers.ts` (or `buildHandlers` if it needs storage). It must be safe to run twice.
2. Queue it from the app with `rpc("enqueue_job", { ws, job_kind, job_payload, matter, idem_key })`.
   Payloads carry ids only, never document text.
3. Throw `JobError("plain reason", retryable)` for failures people should read.

## Deploy

`docker build -f worker/Dockerfile -t casevex-worker .` from the repository
root. Any container host works; the recommendation is Google Cloud Run with
min instances 1 (it must keep polling). Hosting is a decision for Joshua.
