/**
 * Where Casevex looks by default. The pilot is New York civil practice, so a
 * matter's legal research is limited to the courts that bind or persuade a
 * New York civil court: NY state courts, the Second Circuit, the four NY
 * federal district courts and the US Supreme Court, plus NY and federal
 * statutes and regulations. This keeps results relevant and cuts the number
 * of out-of-state opinions read and checked on every question (less cost,
 * faster answers).
 *
 * Keys match COURTS_BY_JURISDICTION in providers/courtlistener-wire.ts and
 * the jurisdictionIds each provider reports in getCoverage().
 */
export const NY_CIVIL_JURISDICTIONS: readonly string[] = [
  "NY",
  "2d-cir",
  "sdny",
  "edny",
  "ndny",
  "wdny",
  "US",
];

/** Plain-language summary for "What Casevex searched". */
export const NY_CIVIL_SCOPE_LABEL =
  "New York state courts, the Second Circuit, New York federal courts and the US Supreme Court";
