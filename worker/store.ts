import pg from "pg";
import type { Job, JobStore } from "./types";

/**
 * Talks to Postgres as the casevex_worker role, which may only call the
 * worker.* functions (supabase/migrations/20261113000004_jobs.sql).
 */
export class PgJobStore implements JobStore {
  constructor(private readonly pool: pg.Pool) {}

  async claim(
    workerId: string,
    kinds: string[],
    n: number,
    leaseSeconds: number,
  ) {
    const { rows } = await this.pool.query<Job>(
      "select id, workspace_id, matter_id, kind, payload, attempts, max_attempts from worker.claim_jobs($1, $2, $3, $4)",
      [workerId, kinds, n, leaseSeconds],
    );
    return rows;
  }

  async complete(id: string, workerId: string, result: unknown) {
    const { rows } = await this.pool.query(
      "select worker.complete_job($1, $2, $3) as ok",
      [id, workerId, result === undefined ? null : JSON.stringify(result)],
    );
    return Boolean(rows[0]?.ok);
  }

  async fail(id: string, workerId: string, reason: string, retryable: boolean) {
    const { rows } = await this.pool.query(
      "select worker.fail_job($1, $2, $3, $4) as status",
      [id, workerId, reason, retryable],
    );
    return (rows[0]?.status as string | null) ?? null;
  }

  async heartbeat(id: string, workerId: string, leaseSeconds: number) {
    const { rows } = await this.pool.query(
      "select worker.heartbeat($1, $2, $3) as ok",
      [id, workerId, leaseSeconds],
    );
    return Boolean(rows[0]?.ok);
  }
}
