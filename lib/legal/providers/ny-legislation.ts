/**
 * New York State Senate Open Legislation API v3 adapter: consolidated laws
 * (statute sections) by law ID and location, plus law full-text search.
 *
 * Docs: https://legislation.nysenate.gov/static/docs/html/  (free API key;
 * verify terms before enabling for a pilot).
 */
import { extractCitations } from "../citations";
import { httpRequest, sha256, type HttpOptions } from "../http";
import { htmlToText, segment } from "../text";
import {
  ProviderError,
  type Authority,
  type AuthorityText,
  type CitationResolution,
  type LegalProviderAdapter,
  type ProviderCoverage,
  type SearchHit,
  type SearchQuery,
} from "../types";
import { HealthTracker } from "./health";

const API = "https://legislation.nysenate.gov/api/3";
const PUBLIC = "https://www.nysenate.gov/legislation/laws";

/** Display names for law IDs used in titles. */
export const NY_LAW_NAMES: Readonly<Record<string, string>> = {
  GBS: "General Business Law",
  GOB: "General Obligations Law",
  CVP: "Civil Practice Law and Rules",
  PEN: "Penal Law",
  LAB: "Labor Law",
  EXC: "Executive Law",
  EPT: "Estates, Powers and Trusts Law",
  RPP: "Real Property Law",
  DOM: "Domestic Relations Law",
  ISC: "Insurance Law",
  JUD: "Judiciary Law",
  BSC: "Business Corporation Law",
  LLC: "Limited Liability Company Law",
  VAT: "Vehicle and Traffic Law",
  CPL: "Criminal Procedure Law",
  PBH: "Public Health Law",
  EDN: "Education Law",
};

interface OlLawDoc {
  lawId: string;
  locationId: string;
  title?: string;
  docType?: string;
  docLevelId?: string;
  activeDate?: string;
  text?: string;
}
interface OlEnvelope<T> {
  success: boolean;
  message?: string;
  result: T;
}
interface OlSearchResult {
  items: {
    result: OlLawDoc;
    highlights?: { text?: string[] };
    rank?: number;
  }[];
  size?: number;
}

const LOCATION_RE = /^[A-Z0-9-]{1,24}$/i;

export interface NyLegislationOptions {
  apiKey?: string;
  enabled: boolean;
  http?: HttpOptions;
  now?: () => Date;
}

export class NyLegislationAdapter implements LegalProviderAdapter {
  readonly id = "ny_legislation" as const;
  private readonly health = new HealthTracker();

  constructor(private readonly opts: NyLegislationOptions) {}

  private requireEnabled() {
    if (!this.opts.enabled || !this.opts.apiKey)
      throw new ProviderError(
        this.id,
        "not_configured",
        "NY Open Legislation is not enabled (set NY_OPENLEG_API_KEY and list it in CASEVEX_LEGAL_PROVIDERS).",
      );
  }

  private async get<T>(path: string, params: Record<string, string> = {}) {
    this.requireEnabled();
    const url = new URL(`${API}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("key", this.opts.apiKey!);
    const env = await this.health.track(
      httpRequest<OlEnvelope<T>>(
        { provider: this.id, url: url.toString() },
        this.opts.http,
      ),
    );
    if (!env.success)
      throw new ProviderError(
        this.id,
        /not found/i.test(env.message ?? "") ? "not_found" : "bad_response",
        `Open Legislation: ${env.message ?? "request failed"}`,
      );
    return env.result;
  }

  getCoverage(): ProviderCoverage {
    const configured = this.opts.enabled && !!this.opts.apiKey;
    return {
      provider: this.id,
      displayName: "NY Senate Open Legislation",
      enabled: configured,
      disabledReason: configured
        ? null
        : !this.opts.apiKey
          ? "NY_OPENLEG_API_KEY is not set."
          : "Not listed in CASEVEX_LEGAL_PROVIDERS.",
      kinds: ["statute"],
      jurisdictionIds: ["NY"],
      scope:
        "Current text of New York consolidated laws as published by the NY Senate. Not an official annotated code; historical versions limited to what the API exposes.",
      treatmentCoverage: "none",
      collections: ["ny_legislation"],
      ...this.health.snapshot(),
      corpusConfirmed: configured && this.health.confirmed(),
      termsUrl: "https://legislation.nysenate.gov/",
    };
  }

  private async toAuthority(
    doc: OlLawDoc,
    checksum?: string,
  ): Promise<Authority> {
    const name = NY_LAW_NAMES[doc.lawId] ?? `${doc.lawId} Law`;
    const section = doc.docLevelId ?? doc.locationId;
    const sum =
      checksum ??
      (await sha256(
        `${doc.lawId}|${doc.locationId}|${doc.activeDate}|${doc.title}`,
      ));
    return {
      id: `ny_legislation:${doc.lawId}/${doc.locationId}`,
      kind: "statute",
      title: `N.Y. ${name} § ${section}${doc.title ? ` — ${doc.title.trim()}` : ""}`,
      citations: [],
      court: null,
      jurisdictionId: "NY",
      decisionDate: doc.activeDate ?? null,
      docketNumber: null,
      textAvailability: doc.text ? "full_text" : "metadata_only",
      provenance: {
        provider: this.id,
        providerRecordId: `${doc.lawId}/${doc.locationId}`,
        canonicalUrl: `${PUBLIC}/${encodeURIComponent(doc.lawId)}/${encodeURIComponent(doc.locationId)}`,
        sourceTimestamp: doc.activeDate ?? null,
        fetchedAt: (this.opts.now?.() ?? new Date()).toISOString(),
        checksum: sum,
        // Open Legislation versions law text by active date.
        versionId: doc.activeDate
          ? `${doc.activeDate}-${sum.slice(0, 8)}`
          : sum.slice(0, 16),
        publicationStatus: "published",
        licenseStatus: "public_domain",
        attribution: "New York State Senate Open Legislation",
      },
    };
  }

  private parseId(providerRecordId: string): [string, string] {
    const [lawId, locationId] = providerRecordId.split("/");
    if (
      !lawId ||
      !locationId ||
      !LOCATION_RE.test(lawId) ||
      !LOCATION_RE.test(locationId)
    )
      throw new ProviderError(
        this.id,
        "not_found",
        `Invalid law location ${providerRecordId}`,
      );
    return [lawId.toUpperCase(), locationId];
  }

  private async loadDoc(lawId: string, locationId: string): Promise<OlLawDoc> {
    try {
      return await this.get<OlLawDoc>(`/laws/${lawId}/${locationId}/`);
    } catch (err) {
      // CPLR rules live at "R<number>", sections at "<number>".
      if (
        err instanceof ProviderError &&
        err.code === "not_found" &&
        lawId === "CVP" &&
        /^\d/.test(locationId)
      )
        return this.get<OlLawDoc>(`/laws/${lawId}/R${locationId}/`);
      throw err;
    }
  }

  async search(q: SearchQuery): Promise<SearchHit[]> {
    if (q.kinds && !q.kinds.includes("statute")) return [];
    if (q.jurisdictionIds?.length && !q.jurisdictionIds.includes("NY"))
      return [];
    const res = await this.get<OlSearchResult>("/laws/search", {
      term: q.q,
      limit: String(Math.min(q.limit ?? 10, 50)),
    });
    const hits: SearchHit[] = [];
    for (const [i, item] of (res.items ?? []).entries())
      hits.push({
        authority: await this.toAuthority(item.result),
        snippet: item.highlights?.text?.length
          ? htmlToText(item.highlights.text.join(" … "))
              .replace(/\s+/g, " ")
              .trim()
          : null,
        providerRank: i + 1,
      });
    return hits;
  }

  async resolveCitations(text: string): Promise<CitationResolution[]> {
    const out: CitationResolution[] = [];
    for (const c of extractCitations(text)) {
      if (c.kind !== "ny_statute") continue;
      try {
        const doc = await this.loadDoc(c.lawId, c.section);
        out.push({
          citation: c.raw,
          normalized: c.normalized,
          status: "resolved",
          candidates: [await this.toAuthority(doc)],
          provider: this.id,
        });
      } catch (err) {
        if (!(err instanceof ProviderError) || err.code !== "not_found")
          throw err;
        out.push({
          citation: c.raw,
          normalized: c.normalized,
          status: "unresolved",
          candidates: [],
          provider: this.id,
          message: "No such section in NY Open Legislation.",
        });
      }
    }
    return out;
  }

  async fetchAuthority(providerRecordId: string): Promise<Authority> {
    const [lawId, loc] = this.parseId(providerRecordId);
    return this.toAuthority(await this.loadDoc(lawId, loc));
  }

  async fetchFullText(providerRecordId: string): Promise<AuthorityText> {
    const [lawId, loc] = this.parseId(providerRecordId);
    const doc = await this.loadDoc(lawId, loc);
    const text = (doc.text ?? "").replace(/\\n/g, "\n");
    if (!text.trim())
      throw new ProviderError(
        this.id,
        "bad_response",
        `${providerRecordId} has no text.`,
      );
    // Statute subdivisions start on their own line ("  1. ...", "(a) ...").
    const paragraphs = text.replace(
      /\n\s*(?=(?:\d+\.|\([a-z0-9]+\))\s)/g,
      "\n\n",
    );
    const authority = await this.toAuthority(doc, await sha256(text));
    const passages = segment(
      authority.id,
      authority.provenance.versionId,
      paragraphs,
      {
        minChars: 120,
        maxChars: 1200,
      },
    ).map((p) => ({ ...p, pinpoint: `${authority.title.split(" — ")[0]}` }));
    return { authority, passages };
  }
}
