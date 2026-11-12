/**
 * Turns provider text (HTML or plain) into clean, pinpointable passages.
 *
 * Provider markup is untrusted: scripts/styles are dropped, every tag is
 * stripped, and only text plus reporter star-page markers survive.
 */
import type { Passage } from "./types";

const PAGE = "\u0000PAGE:";
const END = "\u0000";

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  sect: "§",
  para: "¶",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1] === "x" || e[1] === "X"
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : "";
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** HTML -> text with paragraph breaks and star-page sentinels preserved. */
export function htmlToText(html: string): string {
  let s = html
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  // Star pagination: CourtListener/Harvard use spans or anchors with these
  // classes; keep only the page number.
  s = s.replace(
    /<(span|a)\b[^>]*class\s*=\s*["'][^"']*(?:star-pagination|page-label)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _t, inner: string) => {
      const n = inner.replace(/<[^>]+>/g, "").match(/\*?\s*(\d{1,5})/);
      return n ? ` ${PAGE}${n[1]}${END} ` : " ";
    },
  );
  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/?(p|div|blockquote|h[1-6]|li|ul|ol|table|tr|section|article|pre)\b[^>]*>/gi,
      "\n\n",
    )
    .replace(/<[^>]+>/g, "");
  return decodeEntities(s);
}

/**
 * Plain text: marks "*556"-style star pages only when the number is plausible
 * for the opinion's first page, so footnote asterisks are not mistaken.
 */
export function markPlainStarPages(text: string, firstPage?: number): string {
  if (!firstPage) return text;
  return text.replace(
    /(^|\s)\*(\d{1,5})(?=\s)/g,
    (m, pre: string, n: string) => {
      const p = Number(n);
      return p >= firstPage && p <= firstPage + 400
        ? `${pre}${PAGE}${n}${END}`
        : m;
    },
  );
}

function squash(s: string): string {
  return s
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

const SENTENCE_SPLIT = /(?<=[.?!][”"’)]?)\s+(?=[A-Z“"(])/;

export interface SegmentOptions {
  /** Reporter cite whose star pages are marked, e.g. {volume:"550",reporter:"U.S."}. */
  reporter?: { volume: string; reporter: string; page: string };
  minChars?: number;
  maxChars?: number;
}

/**
 * Splits text into passages of roughly paragraph size. Each passage records
 * the star page in force where it starts, e.g. "550 U.S. at 556".
 */
export function segment(
  authorityId: string,
  versionId: string,
  text: string,
  opts: SegmentOptions = {},
): Passage[] {
  const min = opts.minChars ?? 280;
  const max = opts.maxChars ?? 1400;
  const at = (start: string | null, end: string | null) =>
    start && opts.reporter
      ? `${opts.reporter.volume} ${opts.reporter.reporter} at ${start}${end && end !== start ? `–${end}` : ""}`
      : null;

  let page: string | null = opts.reporter?.page ?? null;
  const chunks: {
    text: string;
    page: string | null;
    endPage: string | null;
  }[] = [];
  let buf = "";
  let bufPage: string | null = page;

  const flush = () => {
    const t = squash(buf).replace(/\n+/g, " ");
    if (t) chunks.push({ text: t, page: bufPage, endPage: page });
    buf = "";
    bufPage = page;
  };
  const pushPiece = (piece: string) => {
    if (!buf.trim()) bufPage = page;
    buf += (buf ? " " : "") + piece;
    if (buf.length >= max) flush();
  };

  const paragraphs = text.split(/\n\s*\n/);
  for (const para of paragraphs) {
    // Walk the paragraph, updating the page when a sentinel passes.
    const parts = para.split(new RegExp(`${PAGE}(\\d+)${END}`));
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        page = parts[i];
        continue;
      }
      const piece = squash(parts[i]);
      if (!piece) continue;
      if (piece.length > max) {
        for (const sentence of piece.split(SENTENCE_SPLIT)) pushPiece(sentence);
      } else pushPiece(piece);
    }
    if (squash(buf).length >= min) flush();
  }
  flush();

  return chunks.map((c, i) => ({
    id: `${authorityId}#p${i + 1}`,
    authorityId,
    versionId,
    ordinal: i + 1,
    pinpoint: at(c.page, c.endPage),
    text: c.text,
  }));
}

/** Normalization used for quote matching and indexing. */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\[\d+\]|\*\d+/g, " ") // footnote and star-page markers
    .replace(/\s+/g, " ")
    .trim();
}
