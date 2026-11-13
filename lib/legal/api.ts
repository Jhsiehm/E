/**
 * HTTP handlers for the legal data endpoints (03 "Precedents and public
 * sources"). Framework-free (Request -> Response) so they are unit-testable;
 * app/api/v1/** route files are one-line wrappers.
 *
 * AUTH: these serve only public legal sources, never matter data. They are
 * not yet behind sign-in because P1 auth is not merged; the auth middleware
 * must wrap them (capability research.run / research.view) before a pilot.
 */
import {
  error,
  json,
  list,
  noProviders,
  providerFailure,
  readJson,
} from "./api-responses";
import type { Complete } from "./model";
import { splitSourceId, type LegalRegistry } from "./registry";
import { answerQuestion } from "./research";
import { retrieve } from "./retrieve";
import type { AuthorityKind } from "./types";

const KINDS: AuthorityKind[] = ["opinion", "statute", "regulation"];
const MAX_Q = 500;
const MAX_QUESTION = 2000;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/v1/legal-data/coverage */
export function getCoverage(registry: LegalRegistry) {
  return json(registry, {
    items: registry.providers.map((p) => p.getCoverage()),
    nextCursor: null,
    totalEstimate: registry.providers.length,
  });
}

/** GET /api/v1/authorities?q=&jurisdictionId=&kind=&decisionFrom=&decisionTo=&limit= */
export async function searchAuthorities(registry: LegalRegistry, req: Request) {
  const blocked = noProviders(registry);
  if (blocked) return blocked;
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim();
  const kinds = list(u.searchParams.get("kind")) as AuthorityKind[] | undefined;
  const from = u.searchParams.get("decisionFrom") ?? undefined;
  const to = u.searchParams.get("decisionTo") ?? undefined;
  const limit = Math.min(
    Math.max(Number(u.searchParams.get("limit") ?? 20) || 20, 1),
    50,
  );
  const fieldErrors: Record<string, string[]> = {};
  if (!q || q.length > MAX_Q)
    fieldErrors.q = [`Required, at most ${MAX_Q} characters.`];
  if (kinds?.some((k) => !KINDS.includes(k)))
    fieldErrors.kind = [`One of ${KINDS.join(", ")}.`];
  if (from && !DATE.test(from)) fieldErrors.decisionFrom = ["YYYY-MM-DD"];
  if (to && !DATE.test(to)) fieldErrors.decisionTo = ["YYYY-MM-DD"];
  if (Object.keys(fieldErrors).length)
    return error(
      registry,
      422,
      "validation_failed",
      "Invalid search.",
      {},
      fieldErrors,
    );

  const results = await Promise.allSettled(
    registry.enabled.map((p) =>
      p.search({
        q,
        jurisdictionIds: list(u.searchParams.get("jurisdictionId")),
        kinds,
        decisionFrom: from,
        decisionTo: to,
        limit,
      }),
    ),
  );
  const items = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );
  items.sort((a, b) => a.providerRank - b.providerRank);
  const failed = results.flatMap((r, i) =>
    r.status === "rejected"
      ? [
          {
            provider: registry.enabled[i].id,
            reason: (r.reason as Error).message,
          },
        ]
      : [],
  );
  if (!items.length && failed.length === results.length)
    return providerFailure(
      registry,
      (results[0] as PromiseRejectedResult).reason,
    );
  return json(registry, {
    items: items.slice(0, limit),
    nextCursor: null,
    totalEstimate: null,
    coverage: registry.enabled.map((p) => p.getCoverage()),
    degradedProviders: failed.map((f) => f.provider),
  });
}

function resolveId(registry: LegalRegistry, raw: string) {
  const parts = splitSourceId(decodeURIComponent(raw));
  if (!parts) return null;
  const provider = registry.get(parts[0]);
  return provider ? { provider, recordId: parts[1] } : null;
}

/** GET /api/v1/authorities/:id */
export async function getAuthority(registry: LegalRegistry, rawId: string) {
  const target = resolveId(registry, rawId);
  if (!target) return error(registry, 404, "not_found", "No such authority.");
  try {
    const a = await target.provider.fetchAuthority(target.recordId);
    return json(registry, {
      data: { ...a, treatmentStatus: "not_checked" },
      requestId: crypto.randomUUID(),
    });
  } catch (err) {
    return providerFailure(registry, err);
  }
}

/** GET /api/v1/authorities/:id/passages */
export async function getPassages(registry: LegalRegistry, rawId: string) {
  const target = resolveId(registry, rawId);
  if (!target) return error(registry, 404, "not_found", "No such authority.");
  try {
    const id = `${target.provider.id}:${target.recordId}`;
    let t = await registry.store.get(id);
    if (!t) {
      t = await target.provider.fetchFullText(target.recordId);
      await registry.store.put(t);
    }
    return json(registry, {
      items: t.passages,
      nextCursor: null,
      totalEstimate: t.passages.length,
      authority: t.authority,
    });
  } catch (err) {
    return providerFailure(registry, err);
  }
}

/** POST /api/v1/authority-resolutions {citation} -> resolved|ambiguous|unresolved, never invented. */
export async function resolveAuthority(registry: LegalRegistry, req: Request) {
  const blocked = noProviders(registry);
  if (blocked) return blocked;
  const body = await readJson(req);
  const citation =
    typeof body?.citation === "string" ? body.citation.trim() : "";
  if (!citation || citation.length > MAX_Q)
    return error(
      registry,
      422,
      "validation_failed",
      "citation is required.",
      {},
      { citation: ["Required."] },
    );
  const resolvers = registry.enabled.filter((p) => p.resolveCitations);
  const settled = await Promise.allSettled(
    resolvers.map((p) => p.resolveCitations!(citation)),
  );
  const results = settled.flatMap((s) =>
    s.status === "fulfilled" ? s.value : [],
  );
  const resolved = results.filter((r) => r.status === "resolved");
  const ambiguous = results.filter((r) => r.status === "ambiguous");
  const status = resolved.length
    ? "resolved"
    : ambiguous.length
      ? "ambiguous"
      : "unresolved";
  return json(registry, {
    data: {
      citation,
      status,
      candidates: [...resolved, ...ambiguous].flatMap((r) => r.candidates),
      results,
      degradedProviders: settled.flatMap((s, i) =>
        s.status === "rejected" ? [resolvers[i].id] : [],
      ),
    },
    requestId: crypto.randomUUID(),
  });
}

/**
 * POST /api/v1/legal-research/preview {question, jurisdictionIds?, kinds?}
 * Synchronous retrieval + answer. Stand-in until durable research-runs with
 * SSE (03) land on top of the P1 database; same retrieval and checks.
 */
export async function researchPreview(
  registry: LegalRegistry,
  req: Request,
  deps: { complete?: Complete } = {},
) {
  const blocked = noProviders(registry);
  if (blocked) return blocked;
  const body = await readJson(req);
  const question =
    typeof body?.question === "string" ? body.question.trim() : "";
  const jurisdictionIds = Array.isArray(body?.jurisdictionIds)
    ? (body.jurisdictionIds as unknown[])
        .filter((x): x is string => typeof x === "string")
        .slice(0, 8)
    : undefined;
  const kinds = Array.isArray(body?.kinds)
    ? (body.kinds as unknown[]).filter((x): x is AuthorityKind =>
        KINDS.includes(x as AuthorityKind),
      )
    : undefined;
  if (!question || question.length > MAX_QUESTION)
    return error(
      registry,
      422,
      "validation_failed",
      "question is required.",
      {},
      {
        question: [`Required, at most ${MAX_QUESTION} characters.`],
      },
    );
  const events: unknown[] = [];
  const retrieval = await retrieve(registry, {
    question,
    jurisdictionIds,
    kinds,
    signal: req.signal,
    onEvent: (e) => events.push(e),
  });
  try {
    const result = await answerQuestion(question, retrieval, {
      complete: deps.complete,
      signal: req.signal,
    });
    return json(registry, {
      data: {
        ...result,
        citations: retrieval.citations.map((c) => ({
          ...c,
          candidates: c.candidates.map((a) => a.id),
        })),
        unresolvedCitations: retrieval.unresolvedCitations,
        providerErrors: retrieval.providerErrors,
        coverage: retrieval.coverage,
        events,
      },
      requestId: crypto.randomUUID(),
    });
  } catch {
    return error(
      registry,
      502,
      "provider_error",
      "The AI model step failed; no answer was produced.",
    );
  }
}
