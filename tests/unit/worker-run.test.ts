import { describe, expect, it } from "vitest";
import { runOnce } from "@/worker/run";
import { JobError, type Job, type JobStore } from "@/worker/types";

function memoryStore(jobs: Partial<Job>[]) {
  const queue: Job[] = jobs.map((j, i) => ({
    id: `j${i}`,
    workspace_id: "w",
    matter_id: null,
    kind: "system.ping",
    payload: {},
    attempts: 1,
    max_attempts: 3,
    ...j,
  }));
  const done: Record<string, unknown> = {};
  const failed: Record<string, { reason: string; retryable: boolean }> = {};
  const store: JobStore = {
    claim: async (_w, _kinds, n) => queue.splice(0, n),
    complete: async (id, _w, result) => ((done[id] = result), true),
    fail: async (id, _w, reason, retryable) => {
      failed[id] = { reason, retryable };
      return retryable ? "queued" : "failed";
    },
    heartbeat: async () => true,
  };
  return { store, done, failed };
}

describe("worker runOnce", () => {
  it("runs a job and stores its result", async () => {
    const m = memoryStore([{}]);
    const n = await runOnce(m.store, {
      workerId: "t",
      handlers: { "system.ping": async () => ({ pong: true }) },
    });
    expect(n).toBe(1);
    expect(m.done.j0).toEqual({ pong: true });
  });

  it("a JobError gives a readable reason and can stop retries", async () => {
    const m = memoryStore([{}]);
    await runOnce(m.store, {
      workerId: "t",
      handlers: {
        "system.ping": async () => {
          throw new JobError("That file is not a PDF.", false);
        },
      },
    });
    expect(m.failed.j0).toEqual({
      reason: "That file is not a PDF.",
      retryable: false,
    });
  });

  it("unexpected errors are retried and never leak their message", async () => {
    const m = memoryStore([{}]);
    await runOnce(m.store, {
      workerId: "t",
      handlers: {
        "system.ping": async () => {
          throw new Error("client SSN 123-45-6789 in text");
        },
      },
    });
    expect(m.failed.j0.retryable).toBe(true);
    expect(m.failed.j0.reason).not.toContain("123-45");
  });

  it("stops a job that runs past its time limit", async () => {
    const m = memoryStore([{}]);
    await runOnce(m.store, {
      workerId: "t",
      timeoutMs: 20,
      handlers: { "system.ping": () => new Promise(() => {}) },
    });
    expect(m.failed.j0.reason).toMatch(/too long/);
  });

  it("a job with no handler fails without retrying", async () => {
    const m = memoryStore([{ kind: "document.extract" }]);
    await runOnce(m.store, { workerId: "t", handlers: {} });
    expect(m.failed.j0).toMatchObject({ retryable: false });
  });
});
