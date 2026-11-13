/**
 * Casevex background worker. Runs in its own container (worker/Dockerfile),
 * polls the jobs table, and runs each job with a time limit.
 *
 * Env:
 *   CASEVEX_WORKER_DATABASE_URL  Postgres URL for a login role that is a
 *                                member of casevex_worker (required)
 *   CASEVEX_WORKER_POLL_MS       idle wait between polls (default 2000)
 */
import { hostname } from "node:os";
import pg from "pg";
import { HANDLERS } from "./handlers";
import { runOnce } from "./run";
import { PgJobStore } from "./store";

const url = process.env.CASEVEX_WORKER_DATABASE_URL;
if (!url) {
  console.error("CASEVEX_WORKER_DATABASE_URL is not set.");
  process.exit(1);
}
const pollMs = Number(process.env.CASEVEX_WORKER_POLL_MS) || 2000;
const workerId = `${hostname()}:${process.pid}`;
const pool = new pg.Pool({ connectionString: url, max: 5 });
const store = new PgJobStore(pool);
let stopping = false;

const log = (msg: string, fields: Record<string, unknown> = {}) =>
  console.log(
    JSON.stringify({ at: new Date().toISOString(), msg, workerId, ...fields }),
  );

for (const sig of ["SIGTERM", "SIGINT"] as const)
  process.on(sig, () => {
    log("stopping after current jobs", { signal: sig });
    stopping = true;
  });

log("worker started", { kinds: Object.keys(HANDLERS) });
while (!stopping) {
  try {
    const n = await runOnce(store, { workerId, handlers: HANDLERS, log });
    if (n === 0) await new Promise((r) => setTimeout(r, pollMs));
  } catch (err) {
    log("poll failed", { error: err instanceof Error ? err.name : "unknown" });
    await new Promise((r) => setTimeout(r, pollMs * 5));
  }
}
await pool.end();
log("worker stopped");
