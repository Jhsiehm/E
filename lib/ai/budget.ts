import { AiError } from "./errors";
import { priceCall } from "./models";
import type { ResolvedRoute } from "./routing";
import type { ChatMessage } from "./types";

const CHARS_PER_TOKEN = 4;

/**
 * Hard spending ceiling shared by all calls in one research run or job
 * (agent profile `budgets.maxUSDPerRun`, 04_RESEARCH_AGENTS.md).
 */
export class RunBudget {
  spentUsd = 0;
  constructor(public readonly limitUsd: number) {}
  /** Budget from an agent profile version's config_json. */
  static fromAgentProfile(config: { budgets?: { maxUSDPerRun?: number } }) {
    const limit = config.budgets?.maxUSDPerRun;
    if (typeof limit !== "number" || !(limit > 0))
      throw new AiError(
        "budget_exceeded",
        "Agent profile has no positive budgets.maxUSDPerRun.",
      );
    return new RunBudget(limit);
  }
  get remainingUsd() {
    return Math.max(0, this.limitUsd - this.spentUsd);
  }
  record(usd: number) {
    this.spentUsd += usd;
  }
}

/** Worst-case cost of a call before sending it, using the priciest model in the chain. */
export function estimateWorstCaseUsd(
  route: ResolvedRoute,
  messages: ChatMessage[],
  maxOutputTokens: number,
): number {
  const inputTokens = Math.ceil(
    messages.reduce((n, m) => n + m.content.length, 0) / CHARS_PER_TOKEN,
  );
  const costs = route.specs.map((s) =>
    s ? priceCall(s, inputTokens, maxOutputTokens) : 0,
  );
  return Math.max(0, ...costs);
}
