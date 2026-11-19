import { complete, type CompleteRequest } from "@/lib/ai";
import { answerCaseQuestion } from "@/lib/legal/case-answer";
import {
  documentSources,
  lawSources,
  matterSource,
  selectPassages,
  type CaseSource,
} from "@/lib/legal/case-passages";
import { planCaseQuestion } from "@/lib/legal/case-plan";
import { toChatMessage } from "@/lib/legal/chat-message";
import { NY_CIVIL_JURISDICTIONS } from "@/lib/legal/jurisdictions";
import { getRegistry } from "@/lib/legal/registry";
import { retrieve } from "@/lib/legal/retrieve";
import { aiUsageHooksFor } from "@/lib/usage/ai-usage";
import { loadCaseRecord } from "./case-context";
import {
  clearConversation,
  loadConversation,
  recentTurns,
  saveExchange,
} from "./chat-history";
import type { LiveContext } from "./context";
import { fail, fromDbError, ok } from "./respond";

const MAX_QUESTION = 2000;
/** Stop well inside the route's 300-second limit and say so plainly. */
const DEADLINE_MS = 240_000;
/** Law passages added next to the case's own documents. */
const MAX_LAW = 10;

/**
 * /api/matters/:id/chat in live mode. GET is the person's own conversation
 * on the matter; DELETE starts it over.
 *
 * POST answers from the case itself: the case details, the text of the
 * documents uploaded to it (read on upload, or now if still unread) and the
 * last few turns of the conversation, so follow-ups build on earlier ones.
 * When the question needs law, or the case has no readable documents, it
 * also searches court opinions and statutes. The model may cite only these
 * numbered sources, and a model from another vendor checks every point
 * (lib/legal/case-answer.ts). The question and answer are then saved.
 */
export async function matterChat(
  ctx: LiveContext,
  req: Request,
  id: string,
  method: string,
  body: Record<string, unknown>,
) {
  if (method === "GET") return ok(await loadConversation(ctx, id));
  if (method === "DELETE") {
    const error = await clearConversation(ctx, id);
    return error ? fromDbError(error) : ok({ ok: true });
  }
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

  const hooks = await aiUsageHooksFor(ctx);
  if (hooks.overLimit)
    return fail(
      429,
      "rate_limited",
      "Your firm has reached today's AI research budget. It resets at midnight UTC.",
    );

  const deadline = AbortSignal.timeout(DEADLINE_MS);
  const signal = AbortSignal.any([req.signal, deadline]);
  const started = Date.now();
  const since = () => Date.now() - started;
  const model = async <T>(r: CompleteRequest<T>) => {
    const t = Date.now();
    try {
      return await complete<T>({ ...r, onUsage: hooks.onUsage ?? r.onUsage });
    } finally {
      console.info("matter chat model call", {
        task: r.task,
        ms: Date.now() - t,
      });
    }
  };
  let stage = "case";
  try {
    const record = await loadCaseRecord(ctx, id);
    if (!record) return fail(404, "not_found", "Matter not found.");
    if ("error" in record)
      return fromDbError(record.error as Parameters<typeof fromDbError>[0]);
    const turns = recentTurns(await loadConversation(ctx, id, 8));

    stage = "plan";
    const plan = await planCaseQuestion(question, turns, {
      complete: model,
      signal,
      matterName: record.matter.name,
    });
    const passages = selectPassages(record.chunks, plan.question);
    const notes = [...record.notes];
    if (!record.documentCount)
      notes.push(
        "No documents are uploaded to this case yet. Upload pleadings, contracts or letters and Casevex will read them.",
      );
    const sources: CaseSource[] = [
      matterSource(record.matter),
      ...documentSources(id, passages),
    ];

    // Law when the question needs it, or when there is nothing else to go on.
    const registry = getRegistry();
    if (plan.searchLaw || !passages.length) {
      stage = "retrieve";
      if (!registry.enabled.length) {
        if (plan.searchLaw)
          notes.push(
            "No source of court opinions or statutes is connected, so no case law was searched.",
          );
      } else {
        const retrieval = await retrieve(registry, {
          question: plan.lawQuery || plan.question,
          jurisdictionIds: [...NY_CIVIL_JURISDICTIONS],
          signal,
        });
        console.info("matter chat retrieved", {
          ms: since(),
          evidence: retrieval.evidence.length,
          providerErrors: retrieval.providerErrors.map((e) => e.provider),
        });
        const failed =
          !retrieval.evidence.length && retrieval.providerErrors.length;
        // Nothing at all to answer from: say why instead of an empty answer.
        if (failed && !passages.length && !record.matter.summary.trim())
          return fail(
            503,
            "service_unavailable",
            "The case-law source is not responding right now (it may be busy or limiting requests). Nothing was charged. Please try again in a few minutes.",
          );
        if (failed)
          notes.push(
            "The case-law source was not responding, so no case law was searched for this answer.",
          );
        sources.push(...lawSources(retrieval.evidence.slice(0, MAX_LAW)));
      }
    }

    stage = "answer";
    const result = await answerCaseQuestion(question, sources, turns, {
      complete: model,
      signal,
      notes,
    });
    console.info("matter chat answered", {
      ms: since(),
      mode: result.mode,
      documents: passages.length,
      law: sources.filter((s) => s.kind === "law").length,
      turns: turns.length,
    });
    const answer = toChatMessage(result, crypto.randomUUID());
    return ok(await saveExchange(ctx, id, question, answer));
  } catch (err) {
    console.error("matter chat research failed", {
      stage,
      ms: since(),
      error: (err as Error)?.name,
      code: (err as { code?: string })?.code,
    });
    const aiSetup = aiAccountProblem(err);
    if (aiSetup) return fail(503, "service_unavailable", aiSetup);
    if (deadline.aborted)
      return fail(
        504,
        "provider_error",
        "This question took too long to answer. Try a narrower question, for example one document, one statute or one issue.",
      );
    return fail(
      502,
      "provider_error",
      "Casevex could not finish this answer. Nothing was saved. Please try again.",
    );
  }
}

/**
 * A model failure caused by the AI account (key rejected, no credits, or an
 * account setting that leaves no model available), worded for the person.
 */
export function aiAccountProblem(err: unknown): string | null {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return null;
  if (e.code === "unauthorized")
    return "The AI service rejected Casevex's key. Ask your administrator to check the OpenRouter key.";
  if (e.code === "insufficient_credits")
    return "The AI service account is out of credits. Ask your administrator to add credits on OpenRouter.";
  if (/no endpoints found|provider key|byok/i.test(e.message ?? ""))
    return "The AI service account is set so that no model can answer (it only allows the firm's own provider keys, and none are added). Ask your administrator to check the OpenRouter workspace settings.";
  return null;
}
