import { JobError, type Job, type JobHandler, type JobStore } from "./types";

export interface RunOptions {
  workerId: string;
  handlers: Record<string, JobHandler>;
  /** How many jobs to take per poll. */
  batch?: number;
  leaseSeconds?: number;
  /** A handler running longer than this is stopped and the job retried. */
  timeoutMs?: number;
  log?: (msg: string, fields?: Record<string, unknown>) => void;
}

/** Plain reason for the job row; never includes payload or document text. */
function reasonFor(err: unknown) {
  if (err instanceof JobError) return err.message;
  if (err instanceof Error && err.name === "TimeoutError")
    return "The job took too long and was stopped.";
  return "Unexpected error while running the job.";
}

async function runJob(store: JobStore, job: Job, o: Required<RunOptions>) {
  const handler = o.handlers[job.kind];
  if (!handler) {
    await store.fail(job.id, o.workerId, `No handler for ${job.kind}.`, false);
    return "failed";
  }
  const signal = AbortSignal.timeout(o.timeoutMs);
  const beat = setInterval(
    () => void store.heartbeat(job.id, o.workerId, o.leaseSeconds),
    (o.leaseSeconds * 1000) / 3,
  );
  try {
    const result = await Promise.race([
      handler({ job, signal }),
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason)),
      ),
    ]);
    const kept = await store.complete(job.id, o.workerId, result);
    // false: the lease ran out and another worker took the job over.
    o.log(kept ? "job succeeded" : "job finished after losing its lease", {
      id: job.id,
      kind: job.kind,
    });
    return kept ? "succeeded" : "lease_lost";
  } catch (err) {
    const retryable = !(err instanceof JobError) || err.retryable;
    const status = await store.fail(
      job.id,
      o.workerId,
      reasonFor(err),
      retryable,
    );
    // Log the error class only: messages can carry document content.
    o.log("job failed", {
      id: job.id,
      kind: job.kind,
      error: err instanceof Error ? err.name : "unknown",
      next: status,
    });
    return status ?? "failed";
  } finally {
    clearInterval(beat);
  }
}

/** Claims one batch and runs it. Returns how many jobs were handled. */
export async function runOnce(store: JobStore, opts: RunOptions) {
  const o: Required<RunOptions> = {
    batch: 4,
    leaseSeconds: 300,
    timeoutMs: 240_000,
    log: () => {},
    ...opts,
  };
  const jobs = await store.claim(
    o.workerId,
    Object.keys(o.handlers),
    o.batch,
    o.leaseSeconds,
  );
  await Promise.all(jobs.map((j) => runJob(store, j, o)));
  return jobs.length;
}
