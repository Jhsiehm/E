import { describe, expect, it, vi } from "vitest";
import {
  AiError,
  RunBudget,
  complete,
  resolveRoute,
  runAiFunction,
  toUsageEvent,
  type AiUsage,
} from "@/lib/ai";

const ENV = { OPENROUTER_API_KEY: "test-key" };

function reply(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const ok = (content: string, extra: Record<string, unknown> = {}) =>
  reply({
    id: "gen-1",
    model: "openai/gpt-6-luna",
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 100, completion_tokens: 10, cost: 0.00042 },
    ...extra,
  });

const deps = (fetchImpl: typeof fetch, env: Record<string, string> = ENV) => ({
  env,
  fetch: fetchImpl,
  sleep: async () => {},
  random: () => 0,
});

const msgs = [{ role: "user" as const, content: "Is this a fraud claim?" }];

describe("runAiFunction", () => {
  it("is off without an API key", async () => {
    await expect(
      runAiFunction("research.route", { messages: msgs }, deps(vi.fn(), {})),
    ).rejects.toMatchObject({ code: "not_configured" });
  });

  it("sends the approved chain with privacy routing and parses JSON", async () => {
    const f = vi.fn(async () => ok('```json\n{"route":"research"}\n```'));
    const usages: AiUsage[] = [];
    const r = await runAiFunction(
      "research.route",
      {
        messages: msgs,
        promptVersion: "route@1",
        onUsage: (u) => void usages.push(u),
      },
      deps(f as unknown as typeof fetch),
    );
    expect(r.data).toEqual({ route: "research" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-key",
    );
    const body = JSON.parse(init.body as string);
    expect(body.models).toEqual([
      "openai/gpt-6-luna",
      "anthropic/claude-haiku-5.5",
    ]);
    expect(body.provider).toMatchObject({
      data_collection: "deny",
      zdr: true,
      only: ["openai", "anthropic"],
    });
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.usage).toEqual({ include: true });
    expect(usages[0]).toMatchObject({
      functionKey: "research.route",
      tier: "fast",
      costUsd: 0.00042,
      costSource: "openrouter",
      fellBack: false,
      promptVersion: "route@1",
    });
  });

  it("does not ask for zero retention on public-data functions", async () => {
    const f = vi.fn(async () =>
      ok('{"kind":"new"}', { model: "deepseek/deepseek-v4.1-flash" }),
    );
    await runAiFunction(
      "monitor.classify_event",
      { messages: msgs },
      deps(f as unknown as typeof fetch),
    );
    const body = JSON.parse(
      (f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.provider.zdr).toBeUndefined();
    expect(body.provider.data_collection).toBe("deny");
  });

  it("flags a fallback model and records cost against the run budget", async () => {
    const f = vi.fn(async () =>
      ok("A title", {
        model: "anthropic/claude-haiku-5.5",
        usage: { prompt_tokens: 50, completion_tokens: 5 },
      }),
    );
    const budget = new RunBudget(1);
    const r = await runAiFunction(
      "research.thread_title",
      { messages: msgs, budget },
      deps(f as unknown as typeof fetch),
    );
    expect(r.usage.fellBack).toBe(true);
    expect(r.usage.costSource).toBe("estimate");
    expect(budget.spentUsd).toBeCloseTo(r.usage.costUsd);
  });

  it("retries 429 then succeeds", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply({ error: { message: "slow down" } }, 429))
      .mockResolvedValueOnce(ok("Title"));
    const r = await runAiFunction(
      "research.thread_title",
      { messages: msgs },
      deps(f as unknown as typeof fetch),
    );
    expect(r.usage.attempts).toBe(2);
  });

  it("does not retry missing credits", async () => {
    const f = vi.fn(async () =>
      reply({ error: { message: "no credits" } }, 402),
    );
    await expect(
      runAiFunction(
        "research.thread_title",
        { messages: msgs },
        deps(f as unknown as typeof fetch),
      ),
    ).rejects.toMatchObject({ code: "insufficient_credits", status: 402 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("refuses a call that could exceed the run budget before sending it", async () => {
    const f = vi.fn();
    const budget = new RunBudget(0.0001);
    await expect(
      runAiFunction(
        "research.draft",
        { messages: msgs, budget },
        deps(f as unknown as typeof fetch),
      ),
    ).rejects.toBeInstanceOf(AiError);
    expect(f).not.toHaveBeenCalled();
  });

  it("refuses oversized context against the per-call ceiling", async () => {
    const huge = [{ role: "user" as const, content: "x".repeat(4 * 400_000) }];
    await expect(
      runAiFunction("research.thread_title", { messages: huge }, deps(vi.fn())),
    ).rejects.toMatchObject({ code: "budget_exceeded" });
  });

  it("reports invalid structured output", async () => {
    const f = vi.fn(async () => ok("not json"));
    await expect(
      runAiFunction(
        "research.route",
        { messages: msgs },
        deps(f as unknown as typeof fetch),
      ),
    ).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("exposes the complete() shape and a usage_events row", async () => {
    const f = vi.fn(async () =>
      ok('{"issue":"reliance"}', {
        model: "anthropic/claude-sonnet-5.5",
        provider: "Anthropic",
      }),
    );
    const r = await complete(
      {
        task: "research.plan",
        messages: msgs,
        responseSchema: { parse: (v: unknown) => v as { issue: string } },
        budgetUsd: RunBudget.fromAgentProfile({
          budgets: { maxUSDPerRun: 1.5 },
        }),
      },
      deps(f as unknown as typeof fetch),
    );
    expect(r).toMatchObject({
      output: { issue: "reliance" },
      modelId: "anthropic/claude-sonnet-5.5",
      provider: "Anthropic",
      costUsd: 0.00042,
    });
    const row = toUsageEvent(r.usage, {
      workspaceId: "w1",
      userId: "u1",
      runId: "r1",
    });
    expect(row).toMatchObject({
      workspace_id: "w1",
      user_id: "u1",
      run_id: "r1",
      provider: "openrouter/Anthropic",
      cost_usd: 0.00042,
      units: {
        function_key: "research.plan",
        input_tokens: 100,
        output_tokens: 10,
      },
    });
    expect(JSON.stringify(row)).not.toContain("Is this a fraud claim");
  });

  it("requires pinned providers for client data in pilot", () => {
    const env = {
      CASEVEX_DEPLOYMENT: "pilot",
      CASEVEX_AI_OVERRIDES: JSON.stringify({ "research.plan": "some-lab/x" }),
    };
    expect(() => resolveRoute("research.plan", env)).toThrow();
    expect(
      resolveRoute("research.plan", { CASEVEX_DEPLOYMENT: "pilot" }).providers,
    ).toEqual(["anthropic", "google-vertex"]);
  });
});
