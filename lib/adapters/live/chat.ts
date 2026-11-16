import { complete, type CompleteRequest } from "@/lib/ai";
import { toChatMessage } from "@/lib/legal/chat-message";
import { getRegistry } from "@/lib/legal/registry";
import { answerQuestion } from "@/lib/legal/research";
import { retrieve } from "@/lib/legal/retrieve";
import { aiUsageHooksFor } from "@/lib/usage/ai-usage";
import type { LiveContext } from "./context";
import { fail, fromDbError, ok } from "./respond";

const MAX_QUESTION = 2000;

/**
 * GET/POST /api/matters/:id/chat in live mode.
 *
 * POST runs real research: retrieval from the enabled legal sources, a model
 * draft that may cite only what was retrieved, then a check of every point by
 * a model from a different vendor (lib/legal/research.ts). With no AI key the
 * answer is quoted passages only. Conversations are not stored yet, so GET
 * answers an empty thread and the screen keeps the conversation for the visit.
 */
export async function matterChat(
  ctx: LiveContext,
  req: Request,
  id: string,
  method: string,
  body: Record<string, unknown>,
) {
  if (method === "GET") return ok([]);
  if (method !== "POST") return fail(405, "bad_request", "Not supported.");

  const question = typeof body.text === "string" ? body.text.trim() : "";
  if (!question)
    return fail(422, "validation_failed", "Type a question first.");
  if (question.length > MAX_QUESTION)
    return fail(
      422,
      "validation_failed",
      `Keep questions under ${MAX_QUESTION.toLocaleString("en-US")} characters.`,
    );

  const matter = await ctx.db
    .from("matters")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (matter.error) return fromDbError(matter.error);
  if (!matter.data) return fail(404, "not_found", "Matter not found.");

  const registry = getRegistry();
  if (!registry.enabled.length)
    return fail(
      503,
      "service_not_configured",
      "Legal research is not switched on yet: no source of court opinions or statutes is connected.",
    );

  const hooks = await aiUsageHooksFor(ctx);
  if (hooks.overLimit)
    return fail(
      429,
      "rate_limited",
      "Your firm has reached today's AI research budget. It resets at midnight UTC.",
    );

  try {
    const retrieval = await retrieve(registry, {
      question,
      signal: req.signal,
    });
    const result = await answerQuestion(question, retrieval, {
      signal: req.signal,
      complete: <T>(r: CompleteRequest<T>) =>
        complete<T>({ ...r, onUsage: hooks.onUsage ?? r.onUsage }),
    });
    return ok(toChatMessage(result, crypto.randomUUID()));
  } catch (err) {
    console.error("matter chat research failed", (err as Error)?.name);
    return fail(
      502,
      "provider_error",
      "Casevex could not finish this answer. Nothing was saved. Please try again.",
    );
  }
}
