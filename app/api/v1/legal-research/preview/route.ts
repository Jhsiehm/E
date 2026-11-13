import { complete, type CompleteRequest } from "@/lib/ai";
import { researchPreview } from "@/lib/legal/api";
import { getRegistry } from "@/lib/legal/registry";
import { aiUsageHooks } from "@/lib/usage/ai-usage";

export const dynamic = "force-dynamic";
// Provider fetches plus up to two model calls.
export const maxDuration = 60;

/**
 * Uses the AI model routing module for research.draft and
 * research.verify_support. Without an AI key it answers extractively.
 * Signed-in firm members have each model call logged to usage_events, and
 * the firm's daily AI budget is enforced before any call is made.
 */
export async function POST(req: Request) {
  const hooks = await aiUsageHooks();
  if (hooks.overLimit)
    return Response.json(
      {
        error: {
          code: "rate_limited",
          message:
            "Your firm has reached today's AI research budget. It resets at midnight UTC.",
          requestId: crypto.randomUUID(),
        },
      },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  return researchPreview(getRegistry(), req, {
    complete: <T>(r: CompleteRequest<T>) =>
      complete<T>({ ...r, onUsage: hooks.onUsage ?? r.onUsage }),
  });
}
