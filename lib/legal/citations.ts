/**
 * Deterministic citation extraction and normalization.
 *
 * This only *recognizes* citation-shaped strings. Whether a citation refers to
 * a real authority is decided by a provider lookup (resolveCitations), never
 * by this parser and never by a model.
 */

export type ParsedCitation =
  | {
      kind: "case";
      raw: string;
      start: number;
      end: number;
      volume: string;
      reporter: string;
      page: string;
      pinpoint: string | null;
      /** "550 U.S. 544" */
      normalized: string;
    }
  | {
      kind: "ny_slip_op";
      raw: string;
      start: number;
      end: number;
      year: string;
      number: string;
      normalized: string;
    }
  | {
      kind: "ny_statute";
      raw: string;
      start: number;
      end: number;
      /** NY Open Legislation law ID, e.g. "GBS". */
      lawId: string;
      section: string;
      normalized: string;
    }
  | {
      kind: "usc" | "cfr";
      raw: string;
      start: number;
      end: number;
      title: string;
      section: string;
      normalized: string;
    };

/** Canonical reporter abbreviations recognised in case citations. */
export const REPORTERS = [
  "U.S.",
  "S. Ct.",
  "L. Ed.",
  "L. Ed. 2d",
  "F.",
  "F.2d",
  "F.3d",
  "F.4th",
  "F. Supp.",
  "F. Supp. 2d",
  "F. Supp. 3d",
  "F. App'x",
  "F.R.D.",
  "B.R.",
  "N.Y.",
  "N.Y.2d",
  "N.Y.3d",
  "A.D.",
  "A.D.2d",
  "A.D.3d",
  "Misc.",
  "Misc. 2d",
  "Misc. 3d",
  "N.Y.S.",
  "N.Y.S.2d",
  "N.Y.S.3d",
  "N.E.",
  "N.E.2d",
  "N.E.3d",
  "A.",
  "A.2d",
  "A.3d",
  "P.",
  "P.2d",
  "P.3d",
  "Cal. Rptr.",
  "Cal. Rptr. 2d",
  "Cal. Rptr. 3d",
  "So. 2d",
  "So. 3d",
  "S.W.2d",
  "S.W.3d",
  "N.W.2d",
  "S.E.2d",
] as const;

const keyOf = (s: string) => s.toLowerCase().replace(/[\s.']/g, "");

const REPORTER_BY_KEY = new Map<string, string>(
  REPORTERS.map((r) => [keyOf(r), r]),
);

function reporterPattern(): string {
  const keys = [...REPORTER_BY_KEY.keys()].sort((a, b) => b.length - a.length);
  // Each key char may be separated by periods/spaces/apostrophes: "F.Supp.2d",
  // "F. Supp. 2d", "NY2d" and "N.Y.2d" all normalize the same way.
  return keys
    .map((k) =>
      [...k].map((c) => c.replace(/[^a-z0-9]/g, "\\$&")).join("[.\\s']{0,2}"),
    )
    .join("|");
}

const CASE_RE = new RegExp(
  `\\b(\\d{1,4})\\s+(${reporterPattern()})\\.?\\s+(\\d{1,5})\\b(?:\\s*,\\s*(\\d{1,5}(?:\\s*[-–]\\s*\\d{1,5})?))?`,
  "gi",
);

const SLIP_RE = /\b(\d{4})\s+N\.?\s*Y\.?\s+Slip\s+Op\.?\s+(\d{5}(?:\(U\))?)/gi;

/** NY consolidated law names -> NY Open Legislation law IDs. */
export const NY_LAW_IDS: Readonly<Record<string, string>> = {
  "gen bus": "GBS",
  "general business": "GBS",
  gbl: "GBS",
  "gen oblig": "GOB",
  "general obligations": "GOB",
  cplr: "CVP",
  "civ prac l & r": "CVP",
  penal: "PEN",
  lab: "LAB",
  labor: "LAB",
  exec: "EXC",
  executive: "EXC",
  "est powers & trusts": "EPT",
  "real prop": "RPP",
  "real property": "RPP",
  "dom rel": "DOM",
  "domestic relations": "DOM",
  ins: "ISC",
  insurance: "ISC",
  jud: "JUD",
  judiciary: "JUD",
  "bus corp": "BSC",
  "business corporation": "BSC",
  "ltd liab co": "LLC",
  "veh & traf": "VAT",
  "crim proc": "CPL",
  cpl: "CPL",
  "pub health": "PBH",
  "public health": "PBH",
  educ: "EDN",
  education: "EDN",
};

const NY_LAW_RE = new RegExp(
  String.raw`\b(?:N\.?\s*Y\.?\s+)?(` +
    Object.keys(NY_LAW_IDS)
      .sort((a, b) => b.length - a.length)
      .map((k) => k.split(" ").join(String.raw`\.?\s*`))
      .map((k) => k + String.raw`\.?`)
      .join("|") +
    String.raw`)(?:\s+(?:Law|Act))?\s*(?:§§?|sec(?:tion)?\.?)\s*(\d+[a-z]?(?:-[a-z0-9]+)*(?:\.\d+)?)`,
  "gi",
);

/** Acronym forms are often written without "§": "CPLR 3211", "GBL 349". */
const NY_ACRONYM_RE =
  /\b(CPLR|GBL|CPL)\s*(?:§§?|R(?:ule)?\.?)?\s*(\d+[a-z]?(?:-[a-z0-9]+)*(?:\.\d+)?)\b/g;

const USC_RE =
  /\b(\d{1,2})\s+U\.?\s*S\.?\s*C\.?(?:\s*A\.?)?\s*(?:§§?|sec(?:tion)?\.?)\s*(\d+[a-z]?(?:-\d+)?)/gi;
const CFR_RE =
  /\b(\d{1,2})\s+C\.?\s*F\.?\s*R\.?\s*(?:§§?|sec(?:tion)?\.?|pt\.?|part)\s*(\d+(?:\.\d+[a-z]?)?)/gi;

function nyLawId(name: string): string | undefined {
  const k = name.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  return NY_LAW_IDS[k];
}

export function normalizeReporter(raw: string): string | undefined {
  return REPORTER_BY_KEY.get(keyOf(raw));
}

/** Extracts citations in text order; overlapping matches keep the first. */
export function extractCitations(text: string): ParsedCitation[] {
  const out: ParsedCitation[] = [];
  for (const m of text.matchAll(CASE_RE)) {
    const reporter = normalizeReporter(m[2]);
    if (!reporter) continue;
    // Single-letter reporters ("F.", "A.", "P.") need their period, otherwise
    // "Room 12 F 7" would read as a citation.
    if (
      keyOf(reporter).length === 1 &&
      !/\.\s*$/.test(m[0].slice(0, m[0].indexOf(m[3], m[1].length + 1)))
    )
      continue;
    const [volume, page] = [m[1], m[3]];
    out.push({
      kind: "case",
      raw: m[0],
      start: m.index!,
      end: m.index! + m[0].length,
      volume,
      reporter,
      page,
      pinpoint: m[4]?.replace(/\s+/g, "") ?? null,
      normalized: `${volume} ${reporter} ${page}`,
    });
  }
  for (const m of text.matchAll(SLIP_RE))
    out.push({
      kind: "ny_slip_op",
      raw: m[0],
      start: m.index!,
      end: m.index! + m[0].length,
      year: m[1],
      number: m[2],
      normalized: `${m[1]} NY Slip Op ${m[2]}`,
    });
  for (const m of text.matchAll(NY_LAW_RE)) {
    const lawId = nyLawId(m[1]);
    if (!lawId) continue;
    out.push({
      kind: "ny_statute",
      raw: m[0],
      start: m.index!,
      end: m.index! + m[0].length,
      lawId,
      section: m[2],
      normalized: `NY ${lawId} § ${m[2]}`,
    });
  }
  for (const m of text.matchAll(NY_ACRONYM_RE)) {
    const lawId = nyLawId(m[1])!;
    out.push({
      kind: "ny_statute",
      raw: m[0],
      start: m.index!,
      end: m.index! + m[0].length,
      lawId,
      section: m[2],
      normalized: `NY ${lawId} § ${m[2]}`,
    });
  }
  for (const m of text.matchAll(USC_RE))
    out.push({
      kind: "usc",
      raw: m[0],
      start: m.index!,
      end: m.index! + m[0].length,
      title: m[1],
      section: m[2],
      normalized: `${m[1]} U.S.C. § ${m[2]}`,
    });
  for (const m of text.matchAll(CFR_RE))
    out.push({
      kind: "cfr",
      raw: m[0],
      start: m.index!,
      end: m.index! + m[0].length,
      title: m[1],
      section: m[2],
      normalized: `${m[1]} C.F.R. § ${m[2]}`,
    });
  out.sort((a, b) => a.start - b.start);
  const kept: ParsedCitation[] = [];
  for (const c of out)
    if (!kept.length || c.start >= kept[kept.length - 1].end) kept.push(c);
  return kept;
}
