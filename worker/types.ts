/** A claimed job, as the worker sees it. Payloads hold ids, never text. */
export interface Job {
  id: string;
  workspace_id: string;
  matter_id: string | null;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

/** What the worker needs from the database; PgJobStore is the real one. */
export interface JobStore {
  claim(
    workerId: string,
    kinds: string[],
    n: number,
    leaseSeconds: number,
  ): Promise<Job[]>;
  complete(id: string, workerId: string, result: unknown): Promise<boolean>;
  fail(
    id: string,
    workerId: string,
    reason: string,
    retryable: boolean,
  ): Promise<string | null>;
  heartbeat(
    id: string,
    workerId: string,
    leaseSeconds: number,
  ): Promise<boolean>;
}

export interface JobContext {
  job: Job;
  signal: AbortSignal;
}

export type JobHandler = (ctx: JobContext) => Promise<unknown>;

/**
 * Throw this from a handler for a failure with a reason people can read.
 * retryable=false stops retries (e.g. the file is not a PDF).
 */
export class JobError extends Error {
  constructor(
    message: string,
    public readonly retryable = true,
  ) {
    super(message);
    this.name = "JobError";
  }
}
