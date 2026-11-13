/**
 * CourtListener wire shapes, court tables and parsing helpers, kept apart
 * from the adapter class so each file stays short.
 */
import { normalizeReporter } from "../citations";
import { htmlToText, markPlainStarPages } from "../text";
import type { CitationRef, Provenance } from "../types";

export const BASE = "https://www.courtlistener.com";
export const API = `${BASE}/api/rest/v4`;

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

export const JURISDICTION_BY_COURT = new Map<string, string>(
  Object.entries(COURTS_BY_JURISDICTION).flatMap(([j, courts]) =>
    courts.map((c) => [c, j] as const),
  ),
);

// --- wire shapes (only the fields we read) ---------------------------------

export interface ClCitation {
  volume: number | string;
  reporter: string;
  page: string;
  type?: number;
}
export interface ClCluster {
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
export interface ClDocket {
  court_id?: string;
  docket_number?: string | null;
}
export interface ClOpinion {
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
export interface ClSearchResult {
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
export interface ClSearchResponse {
  count?: number;
  results: ClSearchResult[];
}
export interface ClLookupResult {
  citation: string;
  normalized_citations?: string[];
  status: number;
  error_message?: string;
  clusters?: ClCluster[];
}

export const COURT_NAMES: Record<string, string> = {
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

export const OPINION_TYPE_LABEL: Record<string, string> = {
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

export function toCitation(c: ClCitation): CitationRef {
  const reporter = normalizeReporter(c.reporter) ?? c.reporter;
  const volume = String(c.volume);
  return {
    volume,
    reporter,
    page: c.page,
    cite: `${volume} ${reporter} ${c.page}`,
  };
}

export function parseCiteString(s: string): CitationRef | null {
  const m = s.match(/^(\d+)\s+(.+?)\s+(\S+)$/);
  if (!m) return null;
  return toCitation({ volume: m[1], reporter: m[2], page: m[3] });
}

export const stripTags = (s: string) =>
  htmlToText(s).replace(/\s+/g, " ").trim();

export function idFromUrl(url: string | undefined): string | undefined {
  return url?.match(/\/(\d+)\/?$/)?.[1];
}

export function publication(
  status: string | undefined,
): Provenance["publicationStatus"] {
  if (!status) return "unknown";
  if (/^published$/i.test(status)) return "published";
  if (/withdrawn|vacated/i.test(status)) return "withdrawn";
  if (/unpublished|non-precedential/i.test(status)) return "unpublished";
  return "unknown";
}

/** Official reporters first so star pages and pinpoints use them. */
export function reporterRank(reporter: string): number {
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
