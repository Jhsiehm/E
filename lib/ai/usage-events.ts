import type { AiUsage } from "./types";

/** Row for usage_events (02_ARCHITECTURE_DATA_SECURITY.md). Holds no prompt or reply text. */
export interface UsageEventRow {
  workspace_id: string;
  user_id: string | null;
  run_id: string | null;
  provider: string;
  units: {
    function_key: string;
    tier: string;
    model_id: string;
    requested_model_id: string;
    fell_back: boolean;
    input_tokens: number;
    output_tokens: number;
    cost_source: "openrouter" | "estimate";
    prompt_version?: string;
    generation_id?: string;
    latency_ms: number;
  };
  cost_usd: number;
}

export function toUsageEvent(
  usage: AiUsage,
  ctx: { workspaceId: string; userId?: string | null; runId?: string | null },
): UsageEventRow {
  return {
    workspace_id: ctx.workspaceId,
    user_id: ctx.userId ?? null,
    run_id: ctx.runId ?? null,
    provider:
      usage.gateway === "anthropic"
        ? "anthropic"
        : usage.provider
          ? `openrouter/${usage.provider}`
          : "openrouter",
    units: {
      function_key: usage.functionKey,
      tier: usage.tier,
      model_id: usage.modelUsed,
      requested_model_id: usage.requestedModel,
      fell_back: usage.fellBack,
      input_tokens: usage.promptTokens,
      output_tokens: usage.completionTokens,
      cost_source: usage.costSource,
      prompt_version: usage.promptVersion,
      generation_id: usage.generationId,
      latency_ms: usage.latencyMs,
    },
    cost_usd: usage.costUsd,
  };
}
