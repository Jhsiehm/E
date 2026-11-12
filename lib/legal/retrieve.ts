/**
 * Retrieval: question -> candidate authorities -> full text -> ranked,
 * pinpointed evidence passages (04 "Retrieve" and "Evidence assembly").
 *
 * Order of trust:
 * 1. Citations written in the question, resolved by a provider's citation
 *    index (never by the parser alone, never by a model).
 * 2. Provider keyword search.
 * Every evidence passage comes from text fetched from the provider in this
 * run (or the cache of an earlier fetch), with its checksum and version.
 */
import { Bm25Index, keywordQuery } from "./bm25";
import { extractCitations } from "./citations";
import type { LegalRegistry } from "./registry";
import {
  ProviderError,
  type Authority,
  type AuthorityKind,
  type AuthorityText,
  type CitationResolution,
  type Passage,
  type ProviderId,
} from "./types";

export type SourceStage = "located" | "fetched" | "passage_matched" | "checked";

/** Mirrors the SSE contract: source.progress / source.failed (03). */
export type RetrievalEvent =
  | {
      type: "source.progress";
      sourceId: string;
      stage: SourceStage;
      title: string;
    }
  | { type: "source.failed"; sourceId: string; reason: string }
  | { type: "provider.failed"; provider: ProviderId; reason: string };

export interface RetrievalRequest {
  question: string;
  jurisdictionIds?: string[];
  kinds?: AuthorityKind[];
  /** Extra provider queries, e.g. from a research.plan model step. */
  searchQueries?: string[];
  maxAuthorities?: number;
  maxPassages?: number;
  maxPassagesPerAuthority?: number;
  onEvent?: (e: RetrievalEvent) => void;
  signal?: AbortSignal;
}

export interface Evidence {
  /** Server-issued passage ID; the only thing a model may cite. */
  sourceId: string;
  authority: Authority;
  passage: Passage;
  score: number;
  /** True when the authority came from resolving a citation in the question. */
  citedInQuestion: boolean;
}

export interface RetrievalResult {
  evidence: Evidence[];
  authorities: Authority[];
  citations: CitationResolution[];
  /** Citation-shaped strings in the question no provider could resolve. */
  unresolvedCitations: string[];
  providerErrors: { provider: ProviderId; reason: string }[];
  coverage: {
    provider: ProviderId;
    stale: boolean;
    lastSucceededAt: string | null;
  }[];
}

async function pool<T, R>(
  items: T[],
  n: number,
  fn: (t: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

function reason(err: unknown): string {
  if (err instanceof ProviderError) return `${err.code}: ${err.message}`;
  return "unexpected error";
}

export async function retrieve(
  registry: LegalRegistry,
  req: RetrievalRequest,
): Promise<RetrievalResult> {
  const emit = req.onEvent ?? (() => {});
  const maxAuthorities = req.maxAuthorities ?? 8;
  const maxPassages = req.maxPassages ?? 12;
  const perAuthority = req.maxPassagesPerAuthority ?? 3;
  const providerErrors: RetrievalResult["providerErrors"] = [];
  const fail = (provider: ProviderId, err: unknown) => {
    const r = reason(err);
    providerErrors.push({ provider, reason: r });
    emit({ type: "provider.failed", provider, reason: r });
  };

  // 1. Citations in the question.
  const parsed = extractCitations(req.question);
  const citations: CitationResolution[] = [];
  const cited = new Map<string, Authority>();
  await Promise.all(
    registry.enabled
      // Real citation indexes are only called when the question holds a
      // citation; the synthetic fixture uses its own reporter and is free.
      .filter(
        (p) => p.resolveCitations && (parsed.length > 0 || p.id === "fixture"),
      )
      .map(async (p) => {
        try {
          for (const r of await p.resolveCitations!(req.question)) {
            citations.push(r);
            if (r.status === "resolved")
              for (const a of r.candidates) cited.set(a.id, a);
          }
        } catch (err) {
          fail(p.id, err);
        }
      }),
  );
  const resolvedNorm = new Set(
    citations
      .filter((c) => c.status === "resolved")
      .flatMap((c) => [c.normalized, c.citation]),
  );
  const unresolvedCitations = [
    ...new Set([
      ...parsed
        .filter(
          (c) => !resolvedNorm.has(c.normalized) && !resolvedNorm.has(c.raw),
        )
        .map((c) => c.raw),
      // Cites a provider recognized but could not resolve (incl. reporters
      // the parser does not know), unless another provider resolved them.
      ...citations
        .filter(
          (c) =>
            (c.status === "unresolved" || c.status === "unsupported") &&
            !resolvedNorm.has(c.normalized) &&
            !resolvedNorm.has(c.citation),
        )
        .map((c) => c.citation),
    ]),
  ];

  // 2. Provider search (main query, planned queries, OR fallback on zero).
  const queries = [
    keywordQuery(req.question),
    ...(req.searchQueries ?? []),
  ].filter(Boolean);
  const searched: Authority[][] = await Promise.all(
    registry.enabled.map(async (p) => {
      const found = new Map<string, { a: Authority; rank: number }>();
      try {
        for (const q of queries) {
          let hits = await p.search({
            q,
            jurisdictionIds: req.jurisdictionIds,
            kinds: req.kinds,
            limit: maxAuthorities,
          });
          if (!hits.length && q.includes(" "))
            hits = await p.search({
              q: q.split(" ").join(" OR "),
              jurisdictionIds: req.jurisdictionIds,
              kinds: req.kinds,
              limit: maxAuthorities,
            });
          for (const h of hits)
            if (
              !found.has(h.authority.id) ||
              found.get(h.authority.id)!.rank > h.providerRank
            )
              found.set(h.authority.id, {
                a: h.authority,
                rank: h.providerRank,
              });
        }
      } catch (err) {
        fail(p.id, err);
      }
      return [...found.values()]
        .sort((x, y) => x.rank - y.rank)
        .map((x) => x.a);
    }),
  );

  // Interleave providers by rank so one source cannot crowd out the others.
  const candidates = new Map<string, Authority>(cited);
  for (let i = 0; candidates.size < maxAuthorities; i++) {
    const row = searched.map((list) => list[i]).filter(Boolean);
    if (!row.length) break;
    for (const a of row)
      if (candidates.size < maxAuthorities) candidates.set(a.id, a);
  }
  for (const a of candidates.values())
    emit({
      type: "source.progress",
      sourceId: a.id,
      stage: "located",
      title: a.title,
    });

  // 3. Full text (cache first).
  const texts = (
    await pool(
      [...candidates.values()],
      3,
      async (a): Promise<AuthorityText | null> => {
        if (req.signal?.aborted) return null;
        const provider = registry.get(a.provenance.provider);
        if (!provider) return null;
        try {
          let t = await registry.store.get(a.id);
          if (!t) {
            t = await provider.fetchFullText(a.provenance.providerRecordId);
            await registry.store.put(t);
          }
          if (t.authority.provenance.publicationStatus === "withdrawn") {
            emit({
              type: "source.failed",
              sourceId: a.id,
              reason: "withdrawn",
            });
            return null;
          }
          emit({
            type: "source.progress",
            sourceId: a.id,
            stage: "fetched",
            title: t.authority.title,
          });
          return t;
        } catch (err) {
          emit({ type: "source.failed", sourceId: a.id, reason: reason(err) });
          return null;
        }
      },
    )
  ).filter((t): t is AuthorityText => !!t && t.passages.length > 0);

  // 4. Rank passages across all fetched authorities.
  const byId = new Map(texts.map((t) => [t.authority.id, t.authority]));
  const index = new Bm25Index(texts.flatMap((t) => t.passages));
  const rankQuery = [req.question, ...(req.searchQueries ?? [])].join(" ");
  const ranked = index.search(rankQuery, index.size);
  const perCount = new Map<string, number>();
  const evidence: Evidence[] = [];
  for (const { doc, score } of ranked) {
    if (evidence.length >= maxPassages) break;
    const n = perCount.get(doc.authorityId) ?? 0;
    if (n >= perAuthority) continue;
    perCount.set(doc.authorityId, n + 1);
    evidence.push({
      sourceId: doc.id,
      authority: byId.get(doc.authorityId)!,
      passage: doc,
      score: Math.round(score * 1000) / 1000,
      citedInQuestion: cited.has(doc.authorityId),
    });
  }
  // A cited authority with no keyword overlap still contributes its opening.
  for (const t of texts)
    if (
      cited.has(t.authority.id) &&
      !perCount.has(t.authority.id) &&
      evidence.length < maxPassages + 3
    ) {
      perCount.set(t.authority.id, 1);
      evidence.push({
        sourceId: t.passages[0].id,
        authority: t.authority,
        passage: t.passages[0],
        score: 0,
        citedInQuestion: true,
      });
    }

  for (const a of texts.map((t) => t.authority)) {
    if (!perCount.has(a.id)) continue;
    emit({
      type: "source.progress",
      sourceId: a.id,
      stage: "passage_matched",
      title: a.title,
    });
    // source_exists: text was returned by the provider under this ID/version.
    emit({
      type: "source.progress",
      sourceId: a.id,
      stage: "checked",
      title: a.title,
    });
  }

  return {
    evidence,
    authorities: texts.map((t) => t.authority),
    citations,
    unresolvedCitations,
    providerErrors,
    coverage: registry.enabled.map((p) => {
      const c = p.getCoverage();
      return {
        provider: p.id,
        stale: c.stale,
        lastSucceededAt: c.lastSucceededAt,
      };
    }),
  };
}
