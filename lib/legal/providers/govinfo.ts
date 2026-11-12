/**
 * GovInfo (U.S. Government Publishing Office) API adapter: United States Code
 * and Code of Federal Regulations sections (granules).
 *
 * Docs: https://api.govinfo.gov/docs/  (api.data.gov key). Public-domain
 * federal text. Annual editions only; not the up-to-the-minute eCFR.
 */
import { httpRequest, sha256, type HttpOptions } from "../http";
import { htmlToText, segment } from "../text";
import {
  ProviderError,
  type Authority,
  type AuthorityText,
  type LegalProviderAdapter,
  type ProviderCoverage,
  type SearchHit,
  type SearchQuery,
} from "../types";
import { HealthTracker } from "./health";

const API = "https://api.govinfo.gov";
const COLLECTIONS = { statute: "USCODE", regulation: "CFR" } as const;

interface GiSearchResult {
  title?: string;
  packageId: string;
  granuleId?: string;
  lastModified?: string;
  dateIssued?: string;
  collectionCode?: string;
  resultLink?: string;
}
interface GiSearchResponse {
  count?: number;
  results?: GiSearchResult[];
}
interface GiGranuleSummary {
  title?: string;
  packageId: string;
  granuleId: string;
  dateIssued?: string;
  lastModified?: string;
  collectionCode?: string;
  detailsLink?: string;
  download?: { txtLink?: string; htmLink?: string; pdfLink?: string };
}

const ID_RE = /^[A-Za-z0-9._-]{3,160}$/;

export interface GovInfoOptions {
  apiKey?: string;
  enabled: boolean;
  http?: HttpOptions;
  now?: () => Date;
}

export class GovInfoAdapter implements LegalProviderAdapter {
  readonly id = "govinfo" as const;
  private readonly health = new HealthTracker();

  constructor(private readonly opts: GovInfoOptions) {}

  private requireEnabled() {
    if (!this.opts.enabled || !this.opts.apiKey)
      throw new ProviderError(
        this.id,
        "not_configured",
        "GovInfo is not enabled (set GOVINFO_API_KEY and list it in CASEVEX_LEGAL_PROVIDERS).",
      );
  }

  private withKey(raw: string): string {
    const url = new URL(raw);
    url.searchParams.set("api_key", this.opts.apiKey!);
    return url.toString();
  }

  getCoverage(): ProviderCoverage {
    const configured = this.opts.enabled && !!this.opts.apiKey;
    return {
      provider: this.id,
      displayName: "GovInfo (U.S. GPO)",
      enabled: configured,
      disabledReason: configured
        ? null
        : !this.opts.apiKey
          ? "GOVINFO_API_KEY is not set."
          : "Not listed in CASEVEX_LEGAL_PROVIDERS.",
      kinds: ["statute", "regulation"],
      jurisdictionIds: ["US"],
      scope:
        "United States Code and annual Code of Federal Regulations editions published on GovInfo. Annual editions can lag current law.",
      treatmentCoverage: "none",
      collections: ["federal_statutes_regulations"],
      ...this.health.snapshot(),
      corpusConfirmed: configured && this.health.confirmed(),
      termsUrl: "https://www.govinfo.gov/about/policies",
    };
  }

  private async toAuthority(
    g: GiGranuleSummary | GiSearchResult,
    checksum?: string,
  ): Promise<Authority> {
    const granuleId = g.granuleId ?? "";
    const sum =
      checksum ??
      (await sha256(
        `${g.packageId}|${granuleId}|${g.lastModified}|${g.title}`,
      ));
    const isCfr = (g.collectionCode ?? g.packageId)
      .toUpperCase()
      .startsWith("CFR");
    return {
      id: `govinfo:${g.packageId}/${granuleId}`,
      kind: isCfr ? "regulation" : "statute",
      title: (g.title ?? granuleId).trim(),
      citations: [],
      court: null,
      jurisdictionId: "US",
      decisionDate: g.dateIssued ?? null,
      docketNumber: null,
      textAvailability: "full_text",
      provenance: {
        provider: this.id,
        providerRecordId: `${g.packageId}/${granuleId}`,
        canonicalUrl: `https://www.govinfo.gov/app/details/${encodeURIComponent(g.packageId)}/${encodeURIComponent(granuleId)}`,
        sourceTimestamp: g.lastModified ?? null,
        fetchedAt: (this.opts.now?.() ?? new Date()).toISOString(),
        checksum: sum,
        versionId: sum.slice(0, 16),
        publicationStatus: "published",
        licenseStatus: "public_domain",
        attribution: "U.S. Government Publishing Office, GovInfo",
      },
    };
  }

  async search(q: SearchQuery): Promise<SearchHit[]> {
    if (q.jurisdictionIds?.length && !q.jurisdictionIds.includes("US"))
      return [];
    const kinds = (q.kinds ?? ["statute", "regulation"]).filter(
      (k): k is keyof typeof COLLECTIONS => k in COLLECTIONS,
    );
    if (!kinds.length) return [];
    this.requireEnabled();
    const collections = kinds.map((k) => COLLECTIONS[k]).join(",");
    const res = await this.health.track(
      httpRequest<GiSearchResponse>(
        {
          provider: this.id,
          url: this.withKey(`${API}/search`),
          method: "POST",
          idempotent: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `collection:(${collections}) AND (${q.q})`,
            pageSize: Math.min(q.limit ?? 10, 50),
            offsetMark: "*",
            sorts: [{ field: "score", sortOrder: "DESC" }],
          }),
        },
        this.opts.http,
      ),
    );
    const hits: SearchHit[] = [];
    for (const [i, r] of (res.results ?? []).entries())
      if (r.granuleId)
        hits.push({
          authority: await this.toAuthority(r),
          snippet: null,
          providerRank: i + 1,
        });
    return hits;
  }

  private parseId(id: string): [string, string] {
    const [pkg, granule] = id.split("/");
    if (!pkg || !granule || !ID_RE.test(pkg) || !ID_RE.test(granule))
      throw new ProviderError(this.id, "not_found", `Invalid GovInfo id ${id}`);
    return [pkg, granule];
  }

  private summary(pkg: string, granule: string) {
    this.requireEnabled();
    return this.health.track(
      httpRequest<GiGranuleSummary>(
        {
          provider: this.id,
          url: this.withKey(
            `${API}/packages/${pkg}/granules/${granule}/summary`,
          ),
        },
        this.opts.http,
      ),
    );
  }

  async fetchAuthority(providerRecordId: string): Promise<Authority> {
    const [pkg, granule] = this.parseId(providerRecordId);
    return this.toAuthority(await this.summary(pkg, granule));
  }

  async fetchFullText(providerRecordId: string): Promise<AuthorityText> {
    const [pkg, granule] = this.parseId(providerRecordId);
    const s = await this.summary(pkg, granule);
    const link = s.download?.htmLink ?? s.download?.txtLink;
    if (!link)
      throw new ProviderError(
        this.id,
        "bad_response",
        `${providerRecordId} has no text rendition.`,
      );
    const raw = await this.health.track(
      httpRequest<string>(
        { provider: this.id, url: this.withKey(link), accept: "text" },
        this.opts.http,
      ),
    );
    const text = htmlToText(raw);
    if (!text.trim())
      throw new ProviderError(
        this.id,
        "bad_response",
        `${providerRecordId} text was empty.`,
      );
    const authority = await this.toAuthority(s, await sha256(text));
    const passages = segment(
      authority.id,
      authority.provenance.versionId,
      text,
      {
        minChars: 150,
      },
    ).map((p) => ({ ...p, pinpoint: authority.title }));
    return { authority, passages };
  }
}
