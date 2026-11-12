import { AI_FUNCTIONS, type AiFunctionKey } from "./functions";
import { MODELS, isModelId, priceCall } from "./models";
import { defaultPrimary } from "./routing";

/**
 * Cost model. Volumes are planning assumptions for one pilot firm, not
 * measurements; replace them with usage_events data once it exists.
 */

/** Model calls that make up one user-visible action. */
export const PIPELINES: Record<
  string,
  Partial<Record<AiFunctionKey, number>>
> = {
  "Research run (one answer, ~8 claims)": {
    "research.route": 1,
    "research.plan": 1,
    "research.rerank": 1,
    "research.draft": 1,
    "research.verify_support": 8,
  },
  "Document upload": {
    "document.classify": 1,
    "document.summarize": 1,
    "document.extract_deadlines": 1,
  },
  "Motion draft": {
    "research.plan": 1,
    "research.rerank": 1,
    "motion.draft": 1,
    "research.verify_support": 15,
  },
  "Monitoring event that reaches a matter": {
    "monitor.classify_event": 1,
    "monitor.citation_treatment": 1,
    "monitor.impact_hypothesis": 1,
  },
};

export interface Scenario {
  name: string;
  description: string;
  /** Calls per month for each function. */
  monthlyCalls: Partial<Record<AiFunctionKey, number>>;
  /** Functions on public data that run once for all firms; cost is split. */
  sharedAcrossFirms: number;
}

export const PILOT_FIRM: Scenario = {
  name: "Pilot firm (10 attorneys)",
  description:
    "400 research runs, 600 uploads, 20 motion drafts and 40 comparisons a month; monitoring feed shared by 5 firms.",
  monthlyCalls: {
    "research.route": 1_200,
    "research.plan": 420,
    "research.rerank": 420,
    "research.draft": 400,
    "research.verify_support": 400 * 8 + 20 * 15,
    "research.thread_title": 150,
    "research.compare_authorities": 40,
    "research.document_qa": 200,
    "motion.draft": 20,
    "document.chronology": 30,
    "letter.draft": 40,
    "document.classify": 600,
    "document.summarize": 600,
    "document.extract_deadlines": 600,
    "matter.suggest_summary": 30,
    "matter.suggest_issue_tags": 30,
    "monitor.classify_event": 20_000,
    "monitor.citation_treatment": 1_000,
    "monitor.impact_hypothesis": 300,
    "notice.digest": 220,
    "search.interpret_query": 1_000,
  },
  sharedAcrossFirms: 5,
};

export interface FunctionCost {
  key: AiFunctionKey;
  tier: string;
  model: string;
  usdPerCall: number;
  usdPerCallWorst: number;
  calls: number;
  usdPerMonth: number;
}

export function costPerCall(key: AiFunctionKey, model = defaultPrimary(key)) {
  const fn = AI_FUNCTIONS[key];
  if (!isModelId(model)) return { typical: NaN, worst: NaN };
  const spec = MODELS[model];
  return {
    typical: priceCall(spec, fn.typicalInputTokens, fn.typicalOutputTokens),
    worst: priceCall(spec, fn.typicalInputTokens * 1.5, fn.maxOutputTokens),
  };
}

export function pipelineCost(name: keyof typeof PIPELINES): number {
  return Object.entries(PIPELINES[name]).reduce(
    (sum, [k, n]) => sum + costPerCall(k as AiFunctionKey).typical * (n ?? 0),
    0,
  );
}

export function scenarioCost(s: Scenario = PILOT_FIRM): {
  rows: FunctionCost[];
  totalUsdPerMonth: number;
  byTier: Record<string, number>;
} {
  const rows = (Object.keys(AI_FUNCTIONS) as AiFunctionKey[]).map((key) => {
    const fn = AI_FUNCTIONS[key];
    const model = defaultPrimary(key);
    const { typical, worst } = costPerCall(key, model);
    const raw = s.monthlyCalls[key] ?? 0;
    const calls =
      fn.dataClass === "public" && fn.tier === "bulk"
        ? raw / s.sharedAcrossFirms
        : raw;
    return {
      key,
      tier: fn.tier,
      model,
      usdPerCall: typical,
      usdPerCallWorst: worst,
      calls,
      usdPerMonth: typical * calls,
    };
  });
  const byTier: Record<string, number> = {};
  for (const r of rows) byTier[r.tier] = (byTier[r.tier] ?? 0) + r.usdPerMonth;
  return {
    rows,
    totalUsdPerMonth: rows.reduce((a, r) => a + r.usdPerMonth, 0),
    byTier,
  };
}
