/**
 * CourtListener (Free Law Project) REST API v4 adapter: case law search,
 * citation lookup and opinion text.
 *
 * Docs: https://www.courtlistener.com/help/api/rest/  (verify terms and rate
 * limits before enabling for a pilot; see docs/legal-data/PROVIDERS.md).
 * Requires an API token; citation lookup is unavailable anonymously.
 */
import { normalizeReporter } from "../citations";
import { httpRequest, sha256, type HttpOptions } from "../http";
import { htmlToText, markPlainStarPages, segment } from "../text";
import {
  ProviderError,
  type Authority,
  type AuthorityText,
  type CitationRef,
  type CitationResolution,
  type LegalProviderAdapter,
  type Provenance,
  type ProviderCoverage,
  type SearchHit,
  type SearchQuery,
} from "../types";
import { HealthTracker } from "./health";

const BASE = "https://www.courtlistener.com";
const API = `${BASE}/api/rest/v4`;

/** Casevex jurisdiction IDs -> CourtListener court IDs. */
export const COURTS_BY_JURISDICTION: Readonly<Record<string, string[]>> = {
  NY: [
    "ny",
    "nyappdiv",
    "nyappterm",
    "nysupct",
    "nyfamct",
    "nysurct",
    "nycivct",
    "nycrimct",
    "nyclaimsct",
    "nycountyct",
  ],
  "2d-cir": ["ca2"],
  sdny: ["nysd"],
  edny: ["nyed"],
  ndny: ["nynd"],
  wdny: ["nywd"],
  US: ["scotus"],
};

const JURISDICTION_BY_COURT = new Map<string, string>(
  Object.entries(COURTS_BY_JURISDICTION).flatMap(([j, courts]) =>
    courts.map((c) => [c, j] as const),
  ),
);

// --- wire shapes (only the fields we read) ---------------------------------

interface ClCitation {
  volume: number | string;
  reporter: string;
  page: string;
  type?: number;
}
interface ClCluster {
  id: number;
  absolute_url: string;
  case_name?: string;
  case_name_full?: string;
  date_filed?: string | null;
  date_modified?: string | null;
  docket_id?: number;
  docket?: string;
  citations?: ClCitation[];
  sub_opinions?: string[];
  precedential_status?: string;
}
interface ClDocket {
  court_id?: string;
  docket_number?: string | null;
}
interface ClOpinion {
  id: number;
  type?: string;
  plain_text?: string;
  html_with_citations?: string;
  html_columbia?: string;
  html_lawbox?: string;
  html?: string;
  xml_harvard?: string;
  sha1?: string;
  date_modified?: string | null;
  author_str?: string;
}
interface ClSearchResult {
  cluster_id: number;
  absolute_url: string;
  caseName?: string;
  citation?: string[];
  court?: string;
  court_id?: string;
  dateFiled?: string | null;
  docketNumber?: string | null;
  status?: string;
  opinions?: { id: number; snippet?: string }[];
}
interface ClSearchResponse {
  count?: number;
  results: ClSearchResult[];
}
interface ClLookupResult {
  citation: string;
  normalized_citations?: string[];
  status: number;
  error_message?: string;
  clusters?: ClCluster[];
}

const COURT_NAMES: Record<string, string> = {
  ny: "New York Court of Appeals",
  nyappdiv: "Appellate Division of the Supreme Court of New York",
  nyappterm: "Appellate Terms of the Supreme Court of New York",
  nysupct: "New York Supreme Court",
  ca2: "Court of Appeals for the Second Circuit",
  nysd: "District Court, S.D. New York",
  nyed: "District Court, E.D. New York",
  nynd: "District Court, N.D. New York",
  nywd: "District Court, W.D. New York",
  scotus: "Supreme Court of the United States",
};

const OPINION_TYPE_LABEL: Record<string, string> = {
  "010combined": "Opinion",
  "015unamimous": "Unanimous opinion",
  "020lead": "Lead opinion",
  "025plurality": "Plurality opinion",
  "030concurrence": "Concurrence",
  "035concurrenceinpart": "Concurrence in part",
  "040dissent": "Dissent",
  "050addendum": "Addendum",
  "060remittitur": "Remittitur",
  "070rehearing": "Rehearing",
  "080onthemerits": "On the merits",
  "090onmotiontostrike": "On motion to strike",
};

function toCitation(c: ClCitation): CitationRef {
  const reporter = normalizeReporter(c.reporter) ?? c.reporter;
  const volume = String(c.volume);
  return {
    volume,
    reporter,
    page: c.page,
    cite: `${volume} ${reporter} ${c.page}`,
  };
}

function parseCiteString(s: string): CitationRef | null {
  const m = s.match(/^(\d+)\s+(.+?)\s+(\S+)$/);
  if (!m) return null;
  return toCitation({ volume: m[1], reporter: m[2], page: m[3] });
}

const stripTags = (s: string) => htmlToText(s).replace(/\s+/g, " ").trim();

function idFromUrl(url: string | undefined): string | undefined {
  return url?.match(/\/(\d+)\/?$/)?.[1];
}

export interface CourtListenerOptions {
  token?: string;
  enabled: boolean;
  http?: HttpOptions;
  now?: () => Date;
}

export class CourtListenerAdapter implements LegalProviderAdapter {
  readonly id = "courtlistener" as const;
  private readonly health = new HealthTracker();

  constructor(private readonly opts: CourtListenerOptions) {}

  private get headers(): Record<string, string> {
    return this.opts.token ? { Authorization: `Token ${this.opts.token}` } : {};
  }

  private now() {
    return (this.opts.now?.() ?? new Date()).toISOString();
  }

  private requireEnabled() {
    if (!this.opts.enabled || !this.opts.token)
      throw new ProviderError(
        this.id,
        "not_configured",
        "CourtListener is not enabled (set COURTLISTENER_API_TOKEN and list it in CASEVEX_LEGAL_PROVIDERS).",
      );
  }

  private get<T>(path: string, params?: Record<string, string>): Promise<T> {
    this.requireEnabled();
    const url = new URL(`${API}${path}`);
    for (const [k, v] of Object.entries(params ?? {}))
      url.searchParams.set(k, v);
    return this.health.track(
      httpRequest<T>(
        { provider: this.id, url: url.toString(), headers: this.headers },
        this.opts.http,
      ),
    );
  }

  getCoverage(): ProviderCoverage {
    const configured = this.opts.enabled && !!this.opts.token;
    return {
      provider: this.id,
      displayName: "CourtListener (Free Law Project)",
      enabled: configured,
      disabledReason: configured
        ? null
        : !this.opts.token
          ? "COURTLISTENER_API_TOKEN is not set."
          : "Not listed in CASEVEX_LEGAL_PROVIDERS.",
      kinds: ["opinion"],
      jurisdictionIds: Object.keys(COURTS_BY_JURISDICTION),
      scope:
        "Opinions CourtListener holds for NY state courts, the Second Circuit, NY federal district courts and the Supreme Court. Coverage varies by court and date; not a complete reporter set.",
      treatmentCoverage: "none",
      ...this.health.snapshot(),
      termsUrl: "https://www.courtlistener.com/terms/",
    };
  }

  async search(q: SearchQuery): Promise<SearchHit[]> {
    if (q.kinds && !q.kinds.includes("opinion")) return [];
    const courts = (q.jurisdictionIds ?? [])
      .flatMap((j) => COURTS_BY_JURISDICTION[j] ?? [])
      .join(" ");
    if (q.jurisdictionIds?.length && !courts) return [];
    const params: Record<string, string> = {
      q: q.q,
      type: "o",
      order_by: "score desc",
    };
    if (courts) params.court = courts;
    if (q.decisionFrom) params.filed_after = q.decisionFrom;
    if (q.decisionTo) params.filed_before = q.decisionTo;
    const res = await this.get<ClSearchResponse>("/search/", params);
    const fetchedAt = this.now();
    const limit = q.limit ?? 20;
    const hits: SearchHit[] = [];
    for (const [i, r] of (res.results ?? []).slice(0, limit).entries()) {
      const meta = `${r.cluster_id}|${r.caseName}|${r.dateFiled}|${(r.citation ?? []).join(";")}`;
      const checksum = await sha256(meta);
      const courtId = r.court_id ?? null;
      hits.push({
        providerRank: i + 1,
        snippet: r.opinions?.[0]?.snippet
          ? stripTags(r.opinions[0].snippet)
          : null,
        authority: {
          id: `courtlistener:${r.cluster_id}`,
          kind: "opinion",
          title: r.caseName?.trim() || "Untitled opinion",
          citations: (r.citation ?? [])
            .map(parseCiteString)
            .filter((c): c is CitationRef => !!c),
          court: courtId
            ? { id: courtId, name: r.court ?? COURT_NAMES[courtId] ?? courtId }
            : null,
          jurisdictionId: courtId
            ? (JURISDICTION_BY_COURT.get(courtId) ?? null)
            : null,
          decisionDate: r.dateFiled ?? null,
          docketNumber: r.docketNumber ?? null,
          textAvailability: "full_text",
          provenance: {
            provider: this.id,
            providerRecordId: String(r.cluster_id),
            canonicalUrl: `${BASE}${r.absolute_url}`,
            sourceTimestamp: null,
            fetchedAt,
            checksum,
            versionId: checksum.slice(0, 16),
            publicationStatus: publication(r.status),
            licenseStatus: "provider_terms",
            attribution: "CourtListener, Free Law Project",
          },
        },
      });
    }
    return hits;
  }

  async resolveCitations(text: string): Promise<CitationResolution[]> {
    this.requireEnabled();
    const body = new URLSearchParams({ text }).toString();
    const results = await this.health.track(
      httpRequest<ClLookupResult[]>(
        {
          provider: this.id,
          url: `${API}/citation-lookup/`,
          method: "POST",
          idempotent: true, // a pure lookup; safe to retry
          headers: {
            ...this.headers,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        },
        this.opts.http,
      ),
    );
    const out: CitationResolution[] = [];
    for (const r of results) {
      const candidates = await Promise.all(
        (r.clusters ?? []).map((c) => this.clusterToAuthority(c, null)),
      );
      out.push({
        citation: r.citation,
        normalized: r.normalized_citations?.[0] ?? null,
        provider: this.id,
        candidates,
        status:
          r.status === 200 && candidates.length === 1
            ? "resolved"
            : r.status === 300 || candidates.length > 1
              ? "ambiguous"
              : r.status === 400
                ? "unsupported"
                : "unresolved",
        message:
          r.status === 200 || r.status === 300 ? undefined : r.error_message,
      });
    }
    return out;
  }

  private async clusterToAuthority(
    c: ClCluster,
    docket: ClDocket | null,
    textChecksum?: string,
    sourceTimestamp?: string | null,
  ): Promise<Authority> {
    const checksum =
      textChecksum ??
      (await sha256(
        `${c.id}|${c.case_name}|${c.date_filed}|${(c.citations ?? []).map((x) => `${x.volume} ${x.reporter} ${x.page}`).join(";")}`,
      ));
    const courtId = docket?.court_id ?? null;
    return {
      id: `courtlistener:${c.id}`,
      kind: "opinion",
      title: (c.case_name || c.case_name_full || "Untitled opinion").trim(),
      citations: (c.citations ?? []).map(toCitation),
      court: courtId
        ? { id: courtId, name: COURT_NAMES[courtId] ?? courtId }
        : null,
      jurisdictionId: courtId
        ? (JURISDICTION_BY_COURT.get(courtId) ?? null)
        : null,
      decisionDate: c.date_filed ?? null,
      docketNumber: docket?.docket_number ?? null,
      textAvailability: textChecksum ? "full_text" : "full_text",
      provenance: {
        provider: this.id,
        providerRecordId: String(c.id),
        canonicalUrl: `${BASE}${c.absolute_url}`,
        sourceTimestamp: sourceTimestamp ?? c.date_modified ?? null,
        fetchedAt: this.now(),
        checksum,
        versionId: checksum.slice(0, 16),
        publicationStatus: publication(c.precedential_status),
        licenseStatus: "provider_terms",
        attribution: "CourtListener, Free Law Project",
      },
    };
  }

  private async loadCluster(id: string) {
    if (!/^\d+$/.test(id))
      throw new ProviderError(this.id, "not_found", `Invalid cluster id ${id}`);
    const cluster = await this.get<ClCluster>(`/clusters/${id}/`);
    const docketId = cluster.docket_id ?? idFromUrl(cluster.docket);
    const docket = docketId
      ? await this.get<ClDocket>(`/dockets/${docketId}/`, {
          fields: "court_id,docket_number",
        }).catch(() => null)
      : null;
    return { cluster, docket };
  }

  async fetchAuthority(providerRecordId: string): Promise<Authority> {
    const { cluster, docket } = await this.loadCluster(providerRecordId);
    return this.clusterToAuthority(cluster, docket);
  }

  async fetchFullText(providerRecordId: string): Promise<AuthorityText> {
    const { cluster, docket } = await this.loadCluster(providerRecordId);
    const opinionIds = (cluster.sub_opinions ?? [])
      .map(idFromUrl)
      .filter((x): x is string => !!x);
    const opinions = await Promise.all(
      opinionIds.map((oid) => this.get<ClOpinion>(`/opinions/${oid}/`)),
    );
    const primary = (cluster.citations ?? [])
      .map(toCitation)
      .sort((a, b) => reporterRank(a.reporter) - reporterRank(b.reporter))[0];

    const sections: string[] = [];
    let latest: string | null = null;
    for (const op of opinions) {
      const body = opinionText(op, primary ? Number(primary.page) : undefined);
      if (!body.trim()) continue;
      const label = OPINION_TYPE_LABEL[op.type ?? ""] ?? "Opinion";
      sections.push(
        `${label}${op.author_str ? ` (${op.author_str})` : ""}\n\n${body}`,
      );
      if (op.date_modified && (!latest || op.date_modified > latest))
        latest = op.date_modified;
    }
    const full = sections.join("\n\n");
    if (!full.trim())
      throw new ProviderError(
        this.id,
        "bad_response",
        `Cluster ${providerRecordId} has no opinion text available.`,
      );
    const checksum = await sha256(full);
    const authority = await this.clusterToAuthority(
      cluster,
      docket,
      checksum,
      latest,
    );
    const passages = segment(
      authority.id,
      authority.provenance.versionId,
      full,
      {
        reporter: primary,
      },
    );
    return { authority, passages };
  }
}

function publication(
  status: string | undefined,
): Provenance["publicationStatus"] {
  if (!status) return "unknown";
  if (/^published$/i.test(status)) return "published";
  if (/withdrawn|vacated/i.test(status)) return "withdrawn";
  if (/unpublished|non-precedential/i.test(status)) return "unpublished";
  return "unknown";
}

/** Official reporters first so star pages and pinpoints use them. */
function reporterRank(reporter: string): number {
  const order = [
    "U.S.",
    "N.Y.3d",
    "N.Y.2d",
    "N.Y.",
    "A.D.3d",
    "A.D.2d",
    "Misc. 3d",
    "F.4th",
    "F.3d",
    "F.2d",
    "F. Supp. 3d",
    "F. Supp. 2d",
  ];
  const i = order.indexOf(reporter);
  return i === -1 ? order.length : i;
}

/** Best available text for one opinion, with star pages marked. */
export function opinionText(op: ClOpinion, firstPage?: number): string {
  const html =
    op.html_with_citations ||
    op.html_columbia ||
    op.html_lawbox ||
    op.xml_harvard ||
    op.html;
  if (html?.trim()) return htmlToText(html);
  return markPlainStarPages(op.plain_text ?? "", firstPage);
}
