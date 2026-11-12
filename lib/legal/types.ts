/**
 * Legal data layer: normalized records and the provider adapter contract
 * (docs/handoff/05_LEGAL_DATA_MONITORING.md, "Adapter contract").
 *
 * Everything a provider returns is normalized into these shapes before it
 * reaches retrieval, the API or a model. Provider payloads are untrusted data.
 */

export type ProviderId =
  "courtlistener" | "ny_legislation" | "govinfo" | "fixture";

export type AuthorityKind = "opinion" | "statute" | "regulation";

export type LicenseStatus =
  /** Public-domain government text served through the provider's API. */
  | "public_domain"
  /** Provider terms allow storage/display; attribution required. */
  | "provider_terms"
  /** Synthetic fixture, never real law. */
  | "synthetic";

export type TextAvailability = "full_text" | "metadata_only" | "unavailable";

/** Where a record came from. Required on every authority (03 conventions). */
export interface Provenance {
  provider: ProviderId;
  /** Provider's own primary ID (cluster id, law location, package/granule). */
  providerRecordId: string;
  canonicalUrl: string;
  /** When the provider says the record was last modified, if it says. */
  sourceTimestamp: string | null;
  fetchedAt: string;
  /** sha256 of the normalized full text (or metadata when no text). */
  checksum: string;
  /** Provider version marker when given, else the checksum. */
  versionId: string;
  publicationStatus: "published" | "unpublished" | "unknown";
  licenseStatus: LicenseStatus;
  attribution: string;
}

export interface CitationRef {
  /** e.g. "550 U.S. 544" — always the normalized form. */
  cite: string;
  volume: string;
  reporter: string;
  page: string;
}

export interface Authority {
  /** Casevex source ID: `${provider}:${providerRecordId}`. Server-issued. */
  id: string;
  kind: AuthorityKind;
  title: string;
  citations: CitationRef[];
  court: { id: string; name: string } | null;
  jurisdictionId: string | null;
  /** Opinion decision date, or statute/regulation active date. */
  decisionDate: string | null;
  docketNumber: string | null;
  textAvailability: TextAvailability;
  provenance: Provenance;
}

/** A pinpointable span of an authority's text. */
export interface Passage {
  /** `${authorityId}#p${ordinal}` — stable for a given versionId. */
  id: string;
  authorityId: string;
  versionId: string;
  ordinal: number;
  /** Reporter star page in force at this passage, e.g. "550 U.S. at 556". */
  pinpoint: string | null;
  text: string;
}

export interface AuthorityText {
  authority: Authority;
  passages: Passage[];
}

export interface SearchQuery {
  q: string;
  jurisdictionIds?: string[];
  kinds?: AuthorityKind[];
  decisionFrom?: string;
  decisionTo?: string;
  limit?: number;
}

export interface SearchHit {
  authority: Authority;
  /** Provider-supplied snippet, stripped of markup. Not a verified quote. */
  snippet: string | null;
  providerRank: number;
}

export type ResolutionStatus =
  "resolved" | "ambiguous" | "unresolved" | "unsupported";

export interface CitationResolution {
  citation: string;
  normalized: string | null;
  status: ResolutionStatus;
  candidates: Authority[];
  provider: ProviderId | null;
  message?: string;
}

export interface ProviderCoverage {
  provider: ProviderId;
  displayName: string;
  enabled: boolean;
  /** Why it is disabled, when it is. */
  disabledReason: string | null;
  kinds: AuthorityKind[];
  jurisdictionIds: string[];
  /** Human description of court/date scope; never "comprehensive". */
  scope: string;
  treatmentCoverage: "none";
  lastSucceededAt: string | null;
  lastError: string | null;
  stale: boolean;
  termsUrl: string;
}

/** Thrown by adapters; mapped to 502/503/429 by the API layer. */
export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderId,
    readonly code:
      | "not_configured"
      | "rate_limited"
      | "upstream_error"
      | "not_found"
      | "bad_response"
      | "blocked_host",
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * One legal source. Optional methods are absent when the provider does not
 * truly offer the capability — callers must not fake them.
 */
export interface LegalProviderAdapter {
  readonly id: ProviderId;
  getCoverage(): ProviderCoverage;
  search(query: SearchQuery): Promise<SearchHit[]>;
  /** Present only for providers with a real citation index. */
  resolveCitations?(text: string): Promise<CitationResolution[]>;
  fetchAuthority(providerRecordId: string): Promise<Authority>;
  /** Full text split into passages. Only when licensed/available. */
  fetchFullText(providerRecordId: string): Promise<AuthorityText>;
}
