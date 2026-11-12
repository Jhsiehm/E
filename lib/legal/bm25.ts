/**
 * Small in-memory BM25 ranker for passages fetched during one retrieval.
 * The production path is Postgres full-text search over authority_passages
 * (02 architecture); this ranker keeps the same contract for the per-run
 * candidate set and for tests.
 */
import { normalizeForMatch } from "./text";

const STOPWORDS = new Set(
  "a an and are as at be but by can could did do does for from had has have how if in into is it its may might must not of on or our shall should so than that the their them then there these they this those to under upon was were what when where whether which while who whom why will with would you your".split(
    " ",
  ),
);

function stem(t: string): string {
  if (t.length <= 4 || /^\d/.test(t)) return t;
  return t
    .replace(/(?:ies)$/, "y")
    .replace(/(?:ing|edly|ed|es|s)$/, "")
    .replace(/(?:ly)$/, "");
}

export function tokenize(text: string): string[] {
  return (normalizeForMatch(text).match(/§?[a-z0-9]+(?:[-.][a-z0-9]+)*/g) ?? [])
    .map((t) => t.replace(/^§/, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

export interface Bm25Doc {
  id: string;
  text: string;
}

export class Bm25Index<D extends Bm25Doc> {
  private readonly docs: { doc: D; tf: Map<string, number>; len: number }[] =
    [];
  private readonly df = new Map<string, number>();
  private totalLen = 0;

  constructor(
    docs: Iterable<D>,
    private readonly k1 = 1.2,
    private readonly b = 0.75,
  ) {
    for (const doc of docs) {
      const tokens = tokenize(doc.text);
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.docs.push({ doc, tf, len: tokens.length });
      this.totalLen += tokens.length;
    }
  }

  get size() {
    return this.docs.length;
  }

  search(query: string, limit = 10): { doc: D; score: number }[] {
    const terms = [...new Set(tokenize(query))];
    const n = this.docs.length;
    if (!n || !terms.length) return [];
    const avg = this.totalLen / n || 1;
    const scored = this.docs.map(({ doc, tf, len }) => {
      let score = 0;
      for (const t of terms) {
        const f = tf.get(t);
        if (!f) continue;
        const df = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score +=
          (idf * f * (this.k1 + 1)) /
          (f + this.k1 * (1 - this.b + (this.b * len) / avg));
      }
      return { doc, score };
    });
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id))
      .slice(0, limit);
  }
}

/** A keyword query for provider search from a natural-language question. */
export function keywordQuery(question: string, max = 8): string {
  const words = (
    normalizeForMatch(question).match(/[a-z0-9§.-]+/g) ?? []
  ).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return [...new Set(words)].slice(0, max).join(" ");
}
