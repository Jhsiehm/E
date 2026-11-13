import { documentExtract, documentPurge, type DocumentDeps } from "./documents";
import type { JobHandler } from "./types";

/**
 * Job kinds this worker runs. Each later step adds its own here
 * (research.run in bedrock 5, ...); document jobs come from buildHandlers.
 * Handlers must be safe to run twice for the same job: a worker can die
 * after doing the work but before marking it done.
 */
export const HANDLERS: Record<string, JobHandler> = {
  /** Health check: proves the queue and worker are connected end to end. */
  "system.ping": async ({ job }) => ({ pong: true, attempt: job.attempts }),
};

/** All handlers, adding document jobs when file storage is configured. */
export function buildHandlers(docs?: DocumentDeps): Record<string, JobHandler> {
  if (!docs) return HANDLERS;
  return {
    ...HANDLERS,
    "document.extract": documentExtract(docs),
    "document.purge": documentPurge(docs),
  };
}
