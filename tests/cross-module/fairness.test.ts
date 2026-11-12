// Bias and fairness across modules.
//
// Deterministic checks (run on every PR, no model calls):
//  - Model routing depends on the task, not on who the client is.
//  - Safety features (citation verification, human-review flags) are on for
//    every AI experience level; experience changes presentation, not safety.
//
// Model-output checks (live, opt-in): run the counterfactual personas
// through the real answer path and compare decisions, scores, citations,
// length and language. Needs OPENROUTER_API_KEY and CASEVEX_BIAS_EVAL=1, and
// runs from the scheduled "bias-eval" CI job, not on every PR.

import { describe, expect, it } from "vitest";
import {
  personas,
  scenarios,
  variants,
  auditScenario,
} from "../shared/bias/counterfactual";
import { experienceAdapter, routingAdapter, THREADS } from "./adapters";

const routing = await routingAdapter();
const experience = await experienceAdapter();

describe.skipIf(!routing)(
  `routing is blind to client identity [${THREADS.routing}]`,
  () => {
    for (const s of scenarios) {
      it(`same model plan for every persona: ${s.id}`, async () => {
        const plans = await Promise.all(
          variants(s).map(async (v) => ({
            id: v.persona.id,
            plan: await routing!.plan({
              task: "research.draft",
              prompt: v.prompt,
            }),
          })),
        );
        expect(plans.length).toBe(personas.length);
        const control = JSON.stringify(plans[0].plan);
        const diverged = plans
          .filter((p) => JSON.stringify(p.plan) !== control)
          .map((p) => p.id);
        expect(diverged).toEqual([]);
      });
    }
  },
);

const SAFETY_FEATURES = [
  "citation_verification",
  "human_review_flag",
  "source_links",
  "unverified_warning",
];

describe.skipIf(!experience)(
  `safety is equal across AI experience levels [${THREADS.auth}]`,
  () => {
    for (const level of ["new", "some", "advanced"] as const)
      it(`${level}: all safety features on`, async () => {
        const f = await experience!.featuresFor(level);
        expect(SAFETY_FEATURES.filter((x) => !f.includes(x))).toEqual([]);
      });
  },
);

const live =
  process.env.CASEVEX_BIAS_EVAL === "1" &&
  !!process.env.OPENROUTER_API_KEY &&
  !!routing;

describe.skipIf(!live)("counterfactual model-output audit (live)", () => {
  for (const s of scenarios)
    it(`no disparity across ${personas.length} personas: ${s.id}`, async () => {
      const { findings } = await auditScenario(s, async (prompt) => {
        const r = await routing!.run(
          { task: "research.draft", prompt },
          { fetch, calls: [], callsTo: () => [], reset() {} },
        );
        return { text: r.text };
      });
      // Attribute echoes are reported for attorney review, not auto-failed:
      // some attributes can be legally relevant (e.g. disability access).
      const blocking = findings.filter((f) => f.kind !== "attribute_leak");
      expect(blocking).toEqual([]);
    }, 120_000);
});

describe.skipIf(!!routing && !!experience)("fairness (pending)", () => {
  it.todo(
    "routing and experience-level adapters not wired yet; see tests/cross-module/adapters.ts",
  );
});
