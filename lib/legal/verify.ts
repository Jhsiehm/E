/**
 * Deterministic verification checks (04 "Verify"). Each check is separate:
 * a source can exist and a quote can match while the claim is still
 * unsupported, which only the support check (model or reviewer) decides.
 */
import { normalizeForMatch } from "./text";

export type QuoteStatus = "exact" | "fuzzy" | "mismatch";

export interface QuoteCheck {
  status: QuoteStatus;
  /** Similarity in [0,1] of the best window. */
  similarity: number;
  /** Offsets of the matched span in the normalized passage text. */
  span: [number, number] | null;
}

const FUZZY_THRESHOLD = 0.9;
const MIN_QUOTE_CHARS = 12;

function words(s: string): string[] {
  return s.split(" ").filter(Boolean);
}

/** Word-level LCS length (O(n*m), quotes are short). */
function lcs(a: string[], b: string[]): number {
  const prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] =
        a[i - 1] === b[j - 1] ? diag + 1 : Math.max(prev[j], prev[j - 1]);
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Checks a quoted string against passage text. Exact after normalization
 * (case, curly quotes, dashes, whitespace, footnote/star-page markers), else
 * the best word window with >= 90% LCS similarity, else mismatch.
 */
export function checkQuote(quote: string, passageText: string): QuoteCheck {
  const q = normalizeForMatch(quote)
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s*(\.\.\.|…)\s*/g, " … ");
  const p = normalizeForMatch(passageText);
  if (q.replace(/[^a-z0-9]/g, "").length < MIN_QUOTE_CHARS)
    return { status: "mismatch", similarity: 0, span: null };

  // Ellipses: every fragment must appear, in order.
  const fragments = q
    .split(" … ")
    .map((f) => f.trim())
    .filter(Boolean);
  if (fragments.length > 1) {
    let from = 0;
    let start = -1;
    for (const f of fragments) {
      const at = p.indexOf(f, from);
      if (at < 0) {
        start = -2;
        break;
      }
      if (start === -1) start = at;
      from = at + f.length;
    }
    if (start >= 0)
      return { status: "exact", similarity: 1, span: [start, from] };
  } else {
    const at = p.indexOf(q);
    if (at >= 0)
      return { status: "exact", similarity: 1, span: [at, at + q.length] };
  }

  const qw = words(q.replace(/ … /g, " "));
  const pw = words(p);
  let best = 0;
  let bestStart = -1;
  let bestLen = 0;
  const lens = [qw.length - 1, qw.length, qw.length + 1].filter((n) => n > 0);
  for (const len of lens)
    for (let i = 0; i + len <= pw.length; i++) {
      const window = pw.slice(i, i + len);
      const sim = (2 * lcs(qw, window)) / (qw.length + window.length);
      if (sim > best) {
        best = sim;
        bestStart = i;
        bestLen = len;
      }
    }
  if (best >= FUZZY_THRESHOLD) {
    const start = pw.slice(0, bestStart).join(" ").length + (bestStart ? 1 : 0);
    const end =
      start + pw.slice(bestStart, bestStart + bestLen).join(" ").length;
    return { status: "fuzzy", similarity: round(best), span: [start, end] };
  }
  return { status: "mismatch", similarity: round(best), span: null };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
