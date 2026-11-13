import type { JobHandler } from "./types";

/**
 * Job kinds this worker runs. Each later step adds its own here
 * (document.extract in bedrock 4, research.run in bedrock 5, ...).
 * Handlers must be safe to run twice for the same job: a worker can die
 * after doing the work but before marking it done.
 */
export const HANDLERS: Record<string, JobHandler> = {
  /** Health check: proves the queue and worker are connected end to end. */
  "system.ping": async ({ job }) => ({ pong: true, attempt: job.attempts }),
};
