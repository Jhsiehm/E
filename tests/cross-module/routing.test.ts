// Model routing: the chosen chain works when it should, falls back when a
// model is down, and fails safely: typed errors, never silently, never over
// budget, never sending client data to an unapproved model or host.
//
// OpenRouter does fallback server-side: one request lists the chain in
// `models`, and the response names the model that served it. The fake in
// tests/shared/fakes simulates exactly that.

import { describe, expect, it } from "vitest";
import {
  fakeOpenRouter,
  scriptedFetch,
  type ModelHealth,
} from "../shared/fakes/scripted-fetch";
import { routingAdapter, THREADS, type RoutingRequest } from "./adapters";

const routing = await routingAdapter();

const PROMPT = "Summarize the elements of a deceptive practices claim.";

function contentFor(task: string) {
  return routing!.structured(task) ? '{"ok":true}' : "plain answer";
}

function setup(
  task: string,
  health: Record<string, ModelHealth> = {},
  extra: Partial<Parameters<typeof fakeOpenRouter>[0]> = {},
) {
  return scriptedFetch([
    fakeOpenRouter({ health, content: contentFor(task), ...extra }),
  ]);
}

const req = (task: string, more: Partial<RoutingRequest> = {}) => ({
  task,
  prompt: PROMPT,
  ...more,
});

describe.skipIf(!routing)(`model routing [${THREADS.routing}]`, () => {
  const tasks = routing?.tasks ?? [];
  const withFallback = tasks.filter(
    (t) => routing!.plan(req(t)).fallbacks.length > 0,
  );

  it("every AI function has at least one fallback model", () => {
    expect(tasks.filter((t) => !withFallback.includes(t))).toEqual([]);
  });

  for (const task of tasks) {
    describe(task, () => {
      it("uses the primary model when it is healthy", async () => {
        const plan = routing!.plan(req(task));
        const fake = setup(task);
        const r = await routing!.run(req(task), fake);
        expect(r).toMatchObject({
          ok: true,
          modelUsed: plan.primary,
          fellBack: false,
        });
        const body = fake.calls[0].body as {
          model?: string;
          models?: string[];
        };
        expect(body.models ?? [body.model]).toEqual([
          plan.primary,
          ...plan.fallbacks,
        ]);
      });

      it.skipIf(!withFallback.includes(task))(
        "falls back when the primary is rate limited or down, and reports it",
        async () => {
          const plan = routing!.plan(req(task));
          for (const h of [
            { kind: "http", status: 429 },
            { kind: "http", status: 503 },
          ] as ModelHealth[]) {
            const r = await routing!.run(
              req(task),
              setup(task, { [plan.primary]: h }),
            );
            expect(r).toMatchObject({
              ok: true,
              modelUsed: plan.fallbacks[0],
              fellBack: true,
            });
          }
        },
      );

      if (routing!.dataClass(task) === "confidential")
        it("client data only goes to approved, zero-retention, pinned providers", async () => {
          const plan = routing!.plan(req(task));
          for (const m of [plan.primary, ...plan.fallbacks])
            expect(routing!.approvedForConfidential, m).toContain(m);
          const fake = setup(task);
          await routing!.run(req(task), fake);
          const p =
            (fake.calls[0].body as { provider?: Record<string, unknown> })
              .provider ?? {};
          expect(p.data_collection).toBe("deny");
          expect(p.zdr).toBe(true);
          expect(Array.isArray(p.only) && (p.only as string[]).length > 0).toBe(
            true,
          );
        });
    });
  }

  const T = "research.plan";

  it("fails with a typed error and no text when every model is down, after bounded retries", async () => {
    const plan = routing!.plan(req(T));
    const all = Object.fromEntries(
      [plan.primary, ...plan.fallbacks].map((m) => [
        m,
        { kind: "http", status: 503 } as ModelHealth,
      ]),
    );
    const fake = setup(T, all);
    const r = await routing!.run(req(T), fake);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("provider_error");
    expect(r.text).toBeUndefined();
    expect(fake.calls.length).toBeGreaterThan(1); // retried
    expect(fake.calls.length).toBeLessThanOrEqual(5); // but bounded
  });

  it("maps a network failure to a typed error", async () => {
    const fake = scriptedFetch([
      { name: "net", match: () => true, steps: [{ kind: "network" }] },
    ]);
    const r = await routing!.run(req(T), fake);
    expect(r).toMatchObject({ ok: false, error: "provider_error" });
  });

  it("maps a malformed 200 response body to a typed error (not a raw SyntaxError)", async () => {
    const fake = scriptedFetch([
      { name: "bad", match: () => true, steps: [{ kind: "malformed" }] },
    ]);
    const r = await routing!.run(req(T), fake);
    expect(r.ok).toBe(false);
    expect(r.error, r.errorMessage).not.toMatch(/^untyped:/);
  });

  it("refuses non-JSON output from a structured function", async () => {
    const r = await routing!.run(
      req(T),
      setup(T, {}, { content: "Sure! Here is your plan..." }),
    );
    expect(r).toMatchObject({ ok: false, error: "invalid_output" });
  });

  it("refuses a call that could exceed the run budget, before sending anything", async () => {
    const fake = setup(T);
    const r = await routing!.run(req(T, { budgetUsd: 0.000001 }), fake);
    expect(r).toMatchObject({ ok: false, error: "budget_exceeded" });
    expect(fake.calls).toHaveLength(0);
  });

  it("works within a sensible budget", async () => {
    const r = await routing!.run(req(T, { budgetUsd: 1 }), setup(T));
    expect(r.ok).toBe(true);
  });

  it("counts cost against the budget even when OpenRouter omits usage.cost and returns a dated model slug", async () => {
    const fake = setup(
      T,
      {},
      {
        usage: { prompt_tokens: 50_000, completion_tokens: 2_000 },
        servedAs: (m) => `${m}-20261101`,
      },
    );
    const r = await routing!.run(req(T, { budgetUsd: 1 }), fake);
    expect(r.ok).toBe(true);
    expect(r.costUsd ?? 0).toBeGreaterThan(0);
  });

  it.skipIf(!routing?.runShared)(
    "a shared run budget stops later calls once spent",
    async () => {
      const fake = setup(
        T,
        {},
        { usage: { prompt_tokens: 1000, completion_tokens: 500, cost: 0.2 } },
      );
      const rs = await routing!.runShared!(
        [req(T), req(T), req(T)],
        0.25,
        fake,
      );
      expect(rs[0].ok).toBe(true);
      expect(rs.slice(1).some((r) => r.error === "budget_exceeded")).toBe(true);
    },
  );

  it("refuses to route a confidential function to a public-only model via overrides", () => {
    const conf = (routing?.tasks ?? []).find(
      (t) => routing!.dataClass(t) === "confidential",
    )!;
    expect(() =>
      routing!.plan(
        req(conf, {
          env: {
            CASEVEX_AI_OVERRIDES: JSON.stringify({
              [conf]: "deepseek/deepseek-v4.1-flash",
            }),
          },
        }),
      ),
    ).toThrow();
  });

  it("refuses experimental (uncatalogued) models in a pilot deployment", () => {
    expect(() =>
      routing!.plan(
        req(T, {
          env: { CASEVEX_AI_EXPERIMENTS: "1", CASEVEX_DEPLOYMENT: "pilot" },
        }),
      ),
    ).toThrow();
  });

  it("reports not_configured instead of calling out when there is no API key", async () => {
    const fake = setup(T);
    const r = await routing!.run(
      req(T, { env: { OPENROUTER_API_KEY: "" } }),
      fake,
    );
    expect(r).toMatchObject({ ok: false, error: "not_configured" });
    expect(fake.calls).toHaveLength(0);
  });

  it("honours cancellation", async () => {
    const ac = new AbortController();
    ac.abort();
    const fake = scriptedFetch([
      { name: "slow", match: () => true, steps: [{ kind: "timeout" }] },
    ]);
    const r = await routing!.run(req(T, { signal: ac.signal }), fake);
    expect(r).toMatchObject({ ok: false, error: "cancelled" });
  });

  it("sends the API key only to OpenRouter and never echoes it in errors", async () => {
    const fake = scriptedFetch([
      {
        name: "401",
        match: () => true,
        steps: [
          {
            kind: "http",
            status: 401,
            body: '{"error":{"message":"bad key"}}',
          },
        ],
      },
    ]);
    const r = await routing!.run(req(T), fake);
    for (const c of fake.calls)
      expect(new URL(c.url).hostname).toMatch(/(^|\.)openrouter\.ai$/);
    expect(r).toMatchObject({ ok: false, error: "unauthorized" });
    expect(r.errorMessage ?? "").not.toContain("sk-or-test-key");
  });
});

describe.skipIf(!!routing)("model routing (pending)", () => {
  it.todo(
    `waiting on "${THREADS.routing}" to land; wire routingAdapter() in tests/cross-module/adapters.ts`,
  );
});
