import { describe, expect, it, vi } from "vitest";
import type { AiUsage } from "@/lib/ai";
import type { LiveContext } from "@/lib/adapters/live/context";
import { dailyLimitUsd, usageRecorder } from "@/lib/usage/ai-usage";

vi.mock("@/lib/adapters/live/context", () => ({ liveContext: vi.fn() }));

const usage: AiUsage = {
  functionKey: "research.draft",
  tier: "frontier",
  gateway: "openrouter",
  requestedModel: "anthropic/claude-x",
  modelUsed: "anthropic/claude-x",
  provider: "Anthropic",
  fellBack: false,
  promptTokens: 1200,
  completionTokens: 300,
  costUsd: 0.0123,
  costSource: "openrouter",
  latencyMs: 900,
  attempts: 1,
};

describe("AI usage logging", () => {
  it("reads the daily budget from the environment, with a safe default", () => {
    expect(dailyLimitUsd({ CASEVEX_AI_DAILY_LIMIT_USD: "40" })).toBe(40);
    expect(dailyLimitUsd({ CASEVEX_AI_DAILY_LIMIT_USD: "-1" })).toBe(25);
    expect(dailyLimitUsd({})).toBe(25);
  });

  it("writes one row for the caller's firm with cost and tokens, no text", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const ctx = {
      db: { from: vi.fn(() => ({ insert })) },
      userId: "u1",
      workspaceId: "w1",
    } as unknown as LiveContext;
    await usageRecorder(ctx, "run-7")(usage);
    expect(ctx.db.from).toHaveBeenCalledWith("usage_events");
    const row = insert.mock.calls[0][0];
    expect(row).toMatchObject({
      workspace_id: "w1",
      user_id: "u1",
      run_id: "run-7",
      cost_usd: 0.0123,
      provider: "openrouter/Anthropic",
    });
    expect(row.units.input_tokens).toBe(1200);
  });

  it("a failed log write never breaks the answer", async () => {
    const ctx = {
      db: {
        from: () => ({
          insert: async () => ({ error: { code: "42501" } }),
        }),
      },
      userId: "u1",
      workspaceId: "w1",
    } as unknown as LiveContext;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(usageRecorder(ctx)(usage)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
