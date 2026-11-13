// QA: checks added after deliberately breaking the backend code (mutation
// testing). Each one failed to be caught before it existed.

import { describe, expect, it, vi } from "vitest";
import { liveContext } from "@/lib/adapters/live/context";
import { getMatter } from "@/lib/adapters/live/matters";
import { fromDbError } from "@/lib/adapters/live/respond";
import { aiUsageHooks } from "@/lib/usage/ai-usage";
import { runOnce } from "@/worker/run";
import type { Job, JobStore } from "@/worker/types";

vi.mock("@/lib/adapters/live/context", () => ({ liveContext: vi.fn() }));

describe("QA break probes", () => {
  it("the worker log never repeats an error's message", async () => {
    const job: Job = {
      id: "j0",
      workspace_id: "w",
      matter_id: null,
      kind: "system.ping",
      payload: {},
      attempts: 1,
      max_attempts: 3,
    } as Job;
    const queue = [job];
    const store: JobStore = {
      claim: async (_w, _k, n) => queue.splice(0, n),
      complete: async () => true,
      fail: async () => "queued",
      heartbeat: async () => true,
    };
    const lines: string[] = [];
    await runOnce(store, {
      workerId: "t",
      log: (msg, fields) => lines.push(msg + JSON.stringify(fields ?? {})),
      handlers: {
        "system.ping": async () => {
          throw new Error("client SSN 123-45-6789 in text");
        },
      },
    });
    expect(lines.join("\n")).not.toContain("123-45");
  });

  it("the daily AI budget stops work once spend reaches the limit exactly", async () => {
    const at = async (spent: number) => {
      vi.mocked(liveContext).mockResolvedValueOnce({
        db: { rpc: async () => ({ data: spent, error: null }) },
        userId: "u1",
        workspaceId: "w1",
      } as never);
      return (await aiUsageHooks()).overLimit;
    };
    vi.stubEnv("CASEVEX_AI_DAILY_LIMIT_USD", "25");
    expect(await at(24.99)).toBe(false);
    expect(await at(25)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("database errors map to the right API answer without SQL details", async () => {
    const status = (code: string) => fromDbError({ code, message: "x" }).status;
    expect(status("42501")).toBe(403);
    expect(status("PGRST116")).toBe(404);
    expect(status("23505")).toBe(422);
    expect(status("28000")).toBe(401);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = fromDbError({ code: "XX000", message: "relation secret_table" });
    spy.mockRestore();
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("secret_table");
  });

  it("a matter you are not on answers 404, the same as one that does not exist", async () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    const ctx = { db: { from: () => chain }, userId: "u", workspaceId: "w" };
    const r = await getMatter(ctx as never, "m-walled");
    expect(r.status).toBe(404);
  });
});
