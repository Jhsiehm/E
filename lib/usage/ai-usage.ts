import { toUsageEvent, type AiUsage } from "@/lib/ai";
import { liveContext, type LiveContext } from "@/lib/adapters/live/context";

const DEFAULT_DAILY_LIMIT_USD = 25;

/** Firm-wide AI spend ceiling per UTC day, from CASEVEX_AI_DAILY_LIMIT_USD. */
export function dailyLimitUsd(
  env: Record<string, string | undefined> = process.env,
): number {
  const v = Number(env.CASEVEX_AI_DAILY_LIMIT_USD);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_DAILY_LIMIT_USD;
}

export interface AiUsageHooks {
  /** Writes one usage_events row per model call. Undefined when signed out or in demo mode. */
  onUsage?: (usage: AiUsage) => Promise<void>;
  /** True when the firm has spent its daily AI budget. */
  overLimit: boolean;
}

/** Recorder for a signed-in firm member. Logging failures never break the answer. */
export function usageRecorder(ctx: LiveContext, runId?: string) {
  return async (usage: AiUsage) => {
    const row = toUsageEvent(usage, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      runId,
    });
    const { error } = await ctx.db.from("usage_events").insert(row);
    if (error) console.error("usage_events insert failed", error.code);
  };
}

/**
 * Looks up the caller once per request. In demo mode, or with no firm, there
 * is nothing to record against and no firm budget to enforce.
 */
export async function aiUsageHooks(runId?: string): Promise<AiUsageHooks> {
  const ctx = await liveContext().catch(() => null);
  if (!ctx || ctx instanceof Response) return { overLimit: false };
  const { data, error } = await ctx.db.rpc("ai_spend_today", {
    ws: ctx.workspaceId,
  });
  const spent = error ? 0 : Number(data ?? 0);
  return {
    onUsage: usageRecorder(ctx, runId),
    overLimit: spent >= dailyLimitUsd(),
  };
}
