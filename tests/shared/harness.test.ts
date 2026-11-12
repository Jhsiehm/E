// Self-tests for the shared QA harness. Each helper is checked both ways:
// it passes a correct implementation AND it catches a broken one. A harness
// that cannot fail is worse than none.

import { describe, expect, it } from "vitest";
import {
  accessCases,
  expectedDecision,
  runAccessMatrix,
} from "./fixtures/access-matrix";
import { actors, resources } from "./fixtures/tenancy";
import { citationProbes, corpus, L1_V1, L1_V2 } from "./fixtures/citations";
import {
  openRouterCompletion,
  openRouterModel,
  scriptedFetch,
} from "./fakes/scripted-fetch";
import {
  auditScenario,
  personas,
  render,
  scenarios,
  variants,
} from "./bias/counterfactual";

describe("access matrix oracle", () => {
  const cases = accessCases();

  it("covers every (resource, action) with at least one allow AND one deny", () => {
    const seen = new Map<string, Set<string>>();
    for (const c of cases) {
      const k = `${c.resource}:${c.action}`;
      if (!seen.has(k)) seen.set(k, new Set());
      seen.get(k)!.add(c.expected);
    }
    // invite/delete on a matter legitimately has allows only for some roles;
    // every pair must still contain a deny, and read/write must contain allows.
    for (const [k, s] of seen) {
      expect(s.has("deny"), `${k} has no deny case`).toBe(true);
      if (/:(read|write)$/.test(k) && !k.startsWith("matterM2"))
        expect(s.has("allow"), `${k} has no allow case`).toBe(true);
    }
  });

  it("encodes the handoff rules", () => {
    const d = (
      a: keyof typeof actors,
      act: Parameters<typeof expectedDecision>[1],
      r: keyof typeof resources,
    ) => expectedDecision(actors[a], act, resources[r]);
    expect(d("attorneyA1", "read", "matterM1")).toBe("allow");
    expect(d("paralegalA2", "read", "matterM1")).toBe("deny"); // ethical wall
    expect(d("ownerA", "read", "matterM1")).toBe("deny"); // membership never bypasses matter ACL
    expect(d("attorneyB1", "read", "matterM1")).toBe("deny"); // cross-tenant
    expect(d("revokedA4", "read", "matterM1")).toBe("deny");
    expect(d("anonymous", "read", "workspaceA")).toBe("deny");
    expect(d("viewerA3", "write", "matterOpen")).toBe("deny");
    expect(d("paralegalA2", "write", "matterOpen")).toBe("allow");
    expect(d("paralegalA2", "invite", "workspaceA")).toBe("deny");
    expect(d("ownerA", "invite", "workspaceA")).toBe("allow");
  });

  it("passes a correct checker", async () => {
    const fails = await runAccessMatrix((c) =>
      expectedDecision(actors[c.actor], c.action, resources[c.resource]),
    );
    expect(fails).toEqual([]);
  });

  it("catches an always-allow checker", async () => {
    const fails = await runAccessMatrix(() => "allow");
    expect(fails.length).toBeGreaterThan(0);
    expect(fails.every((f) => f.case.expected === "deny")).toBe(true);
  });

  it("catches an always-deny checker (things must work when they should)", async () => {
    const fails = await runAccessMatrix(() => "deny");
    expect(fails.length).toBeGreaterThan(0);
    expect(fails.every((f) => f.case.expected === "allow")).toBe(true);
  });

  it("catches a checker that forgets the matter wall", async () => {
    const fails = await runAccessMatrix((c) => {
      const a = actors[c.actor];
      const r = resources[c.resource];
      return a.status === "active" &&
        a.workspaceId === r.workspaceId &&
        c.action === "read"
        ? "allow"
        : expectedDecision(a, c.action, r);
    });
    expect(fails.map((f) => f.case.actor)).toContain("paralegalA2");
  });

  it("treats a thrown error as an acceptable deny but never as an allow", async () => {
    const fails = await runAccessMatrix(() => {
      throw new Error("boom");
    });
    expect(fails.every((f) => f.case.expected === "allow")).toBe(true);
  });
});

describe("citation fixtures", () => {
  it("are all synthetic (example.invalid) and never real-looking live law", () => {
    for (const a of [...corpus, L1_V1])
      expect(new URL(a.url).hostname).toMatch(/example\.invalid$/);
  });

  it("include positive and negative probes", () => {
    expect(
      citationProbes.filter((p) => !p.mustReject).length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      citationProbes.filter((p) => p.mustReject).length,
    ).toBeGreaterThanOrEqual(8);
  });

  it("V2 corrected a passage so stale-version quotes can be detected", () => {
    expect(L1_V1.passages[1].text).not.toBe(L1_V2.passages[1].text);
  });
});

describe("scripted fetch", () => {
  it("plays steps in order and records calls", async () => {
    const f = scriptedFetch([
      openRouterModel("primary/model", [
        { kind: "http", status: 429, headers: { "retry-after": "1" } },
        { kind: "json", body: openRouterCompletion("primary/model", "ok") },
      ]),
    ]);
    const req = {
      method: "POST",
      body: JSON.stringify({ model: "primary/model" }),
    };
    const r1 = await f.fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      req,
    );
    const r2 = await f.fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      req,
    );
    expect(r1.status).toBe(429);
    expect((await r2.json()).choices[0].message.content).toBe("ok");
    expect(f.callsTo("primary/model")).toHaveLength(2);
  });

  it("rejects unmatched requests so unexpected network calls fail loudly", async () => {
    const f = scriptedFetch([]);
    await expect(f.fetch("https://example.invalid/x")).rejects.toThrow(
      /no route/,
    );
  });

  it("timeout step honours AbortSignal", async () => {
    const f = scriptedFetch([
      { name: "slow", match: () => true, steps: [{ kind: "timeout" }] },
    ]);
    const p = f.fetch("https://example.invalid/slow", {
      signal: AbortSignal.timeout(20),
    });
    await expect(p).rejects.toThrow(/abort/i);
  });
});

describe("counterfactual bias harness", () => {
  it("renders variants that differ only in persona", () => {
    const s = scenarios[0];
    const vs = variants(s);
    expect(vs).toHaveLength(personas.length);
    const strip = (t: string, p: (typeof personas)[number]) =>
      t
        .replace(p.name, "X")
        .replace(p.descriptor, "")
        .replace(/\b(he|she|they|him|her|them|his|their)\b/gi, "P")
        .replace(/\s+/g, " ")
        .trim();
    const base = strip(vs[0].prompt, vs[0].persona);
    for (const v of vs) expect(strip(v.prompt, v.persona)).toBe(base);
    expect(render(s, personas[0])).not.toMatch(/\{\{/);
  });

  it("passes a system that ignores the persona", async () => {
    const { findings } = await auditScenario(scenarios[0], () => ({
      decision: "pursue",
      score: 0.72,
      citations: ["src_l1", "src_l2"],
      text: "The claim is strong: the product was represented as removing lead and testing shows it does not.",
    }));
    expect(findings).toEqual([]);
  });

  it("catches a decision that flips on a name", async () => {
    const { findings } = await auditScenario(scenarios[0], (_p, persona) => ({
      decision: persona.id === "race_black" ? "decline" : "pursue",
    }));
    expect(findings).toContainEqual(
      expect.objectContaining({
        personaId: "race_black",
        kind: "decision_changed",
      }),
    );
  });

  it("catches score drift, citation drift, loaded language, effort gap and attribute leaks", async () => {
    const base =
      "The claim is strong because the representation was false and the receipt proves purchase.";
    const { findings } = await auditScenario(scenarios[0], (_p, persona) => {
      switch (persona.id) {
        case "age_older":
          return { score: 0.4, text: base };
        case "origin_immigrant":
          return {
            score: 0.72,
            citations: ["src_l2"],
            text:
              base +
              " There may be a language barrier since he is an immigrant.",
          };
        case "gender_f":
          return {
            score: 0.72,
            text: base + " She may come across as emotional.",
          };
        case "income_low":
          return { score: 0.72, text: "Weak." };
        case "religion_muslim":
          return { score: 0.72, text: base + " Note the client is Muslim." };
        default:
          return { score: 0.72, citations: ["src_l1", "src_l2"], text: base };
      }
    });
    const kinds = (id: string) =>
      findings.filter((f) => f.personaId === id).map((f) => f.kind);
    expect(kinds("age_older")).toContain("score_drift");
    expect(kinds("origin_immigrant")).toEqual(
      expect.arrayContaining([
        "citation_drift",
        "loaded_language",
        "attribute_leak",
      ]),
    );
    expect(kinds("gender_f")).toContain("loaded_language");
    expect(kinds("income_low")).toContain("length_disparity");
    expect(kinds("religion_muslim")).toContain("attribute_leak");
    expect(kinds("race_white")).toEqual([]);
  });
});
