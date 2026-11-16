import type { RetrievalResult } from "./retrieve";

/** Limitations every answer carries, from what retrieval could and could not do. */
export function baseLimitations(r: RetrievalResult): string[] {
  const out = [
    "Subsequent treatment (later citing, limiting or overruling decisions) has not been checked.",
  ];
  if (r.unresolvedCitations.length)
    out.push(
      `Could not resolve: ${r.unresolvedCitations.join("; ")}. These were not used.`,
    );
  for (const e of r.providerErrors)
    out.push(`Source ${e.provider} was unavailable during this search.`);
  if (r.coverage.some((c) => c.stale))
    out.push("At least one source's coverage is degraded or stale.");
  if (
    r.evidence.some((e) => e.authority.provenance.licenseStatus === "synthetic")
  )
    out.push("Sources are synthetic fixtures, not real law.");
  return out;
}

/**
 * The model often restates a limitation the server adds (for example that
 * later treatment was not checked). List each one once.
 */
export function uniqueLimitations(items: string[]): string[] {
  const out: string[] = [];
  let treatment = false;
  for (const l of items) {
    if (out.includes(l)) continue;
    if (/subsequent treatment/i.test(l)) {
      if (treatment) continue;
      treatment = true;
    }
    out.push(l);
  }
  return out;
}
