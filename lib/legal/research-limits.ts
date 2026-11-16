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
