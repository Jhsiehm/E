/**
 * What the matter chat can see of a case: the case details entered in
 * Casevex, passages from the case's own documents, and (when the question
 * needs it) court opinions and statutes. Each is a numbered source the model
 * may cite: M1 for case details, D1, D2, ... for document passages, S1, S2,
 * ... for law. Choosing which document passages to show is plain keyword
 * ranking (BM25), never a model.
 */
import { Bm25Index } from "./bm25";
import type { Evidence } from "./retrieve";

export interface CaseSource {
  /** The label the model cites: M1, D3, S2. */
  label: string;
  kind: "matter" | "document" | "law";
  title: string;
  /** "page 3" for a PDF passage; the reporter pinpoint for law. */
  pinpoint: string | null;
  text: string;
  /** Where the lawyer can open it: the matter's documents, or the opinion. */
  href: string;
  /** Present for law: the retrieved authority and passage. */
  evidence?: Evidence;
  /** Present for documents. */
  documentId?: string;
}

export interface DocChunk {
  documentId: string;
  documentName: string;
  ext: string;
  page: number | null;
  ordinal: number;
  body: string;
}

export interface MatterFacts {
  id: string;
  name: string;
  docket: string;
  court: string;
  practiceArea: string;
  partyRole: string;
  status: string;
  summary: string;
  strategy: string;
  deadlines: { title: string; dueOn: string }[];
}

/** The case details as one source, M1. Empty fields are left out. */
export function matterSource(m: MatterFacts): CaseSource {
  const lines = [
    ["Case name", m.name],
    ["Docket", m.docket],
    ["Court", m.court],
    ["Practice area", m.practiceArea],
    ["Our client's side", m.partyRole],
    ["Status", m.status],
    ["Summary", m.summary],
    ["Strategy notes", m.strategy.slice(0, 4000)],
  ]
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k}: ${v.trim()}`);
  if (m.deadlines.length)
    lines.push(
      "Deadlines:",
      ...m.deadlines.slice(0, 12).map((d) => `- ${d.dueOn}: ${d.title}`),
    );
  return {
    label: "M1",
    kind: "matter",
    title: "Case details in Casevex",
    pinpoint: null,
    text: lines.join("\n"),
    href: `/matters/${m.id}`,
  };
}

export interface PassageLimits {
  maxChars?: number;
  maxPassages?: number;
}

/**
 * Picks the document passages to show for a question. A small case is shown
 * whole. Otherwise: the passages that best match the question, plus the
 * opening of every document, so a broad question ("thoughts on this case?")
 * still sees what each document is. Returned in reading order.
 */
export function selectPassages(
  chunks: DocChunk[],
  query: string,
  limits: PassageLimits = {},
): DocChunk[] {
  const maxChars = limits.maxChars ?? 30_000;
  const maxPassages = limits.maxPassages ?? 16;
  const key = (c: DocChunk) => `${c.documentId}:${c.ordinal}`;
  const total = chunks.reduce((n, c) => n + c.body.length, 0);
  let picked: DocChunk[];
  if (total <= maxChars && chunks.length <= maxPassages) picked = chunks;
  else {
    const chosen = new Map<string, DocChunk>();
    let chars = 0;
    const add = (c: DocChunk) => {
      if (chosen.has(key(c)) || chosen.size >= maxPassages) return;
      if (chars + c.body.length > maxChars) return;
      chosen.set(key(c), c);
      chars += c.body.length;
    };
    const index = new Bm25Index(
      chunks.map((c) => ({ id: key(c), text: c.body, c })),
    );
    const hits = index.search(query, Math.ceil(maxPassages * 0.6));
    for (const h of hits) add(h.doc.c);
    // The opening of each document, then the next part, in turn.
    const byDoc = new Map<string, DocChunk[]>();
    for (const c of [...chunks].sort((a, b) => a.ordinal - b.ordinal))
      byDoc.set(c.documentId, [...(byDoc.get(c.documentId) ?? []), c]);
    for (let depth = 0; depth < 3; depth++)
      for (const list of byDoc.values()) if (list[depth]) add(list[depth]);
    picked = [...chosen.values()];
  }
  const docOrder = new Map<string, number>();
  for (const c of chunks)
    if (!docOrder.has(c.documentId)) docOrder.set(c.documentId, docOrder.size);
  return [...picked].sort(
    (a, b) =>
      docOrder.get(a.documentId)! - docOrder.get(b.documentId)! ||
      a.ordinal - b.ordinal,
  );
}

/** Document passages as sources D1, D2, ... that open the matter's documents. */
export function documentSources(
  matterId: string,
  chunks: DocChunk[],
): CaseSource[] {
  return chunks.map((c, i) => ({
    label: `D${i + 1}`,
    kind: "document",
    title: `${c.documentName}.${c.ext}`,
    pinpoint: c.page ? `page ${c.page}` : null,
    text: c.body,
    href: `/matters/${matterId}/documents`,
    documentId: c.documentId,
  }));
}

/** Retrieved law as sources S1, S2, ... */
export function lawSources(evidence: Evidence[]): CaseSource[] {
  return evidence.map((e, i) => ({
    label: `S${i + 1}`,
    kind: "law",
    title: e.authority.title,
    pinpoint: e.passage.pinpoint ?? e.authority.citations[0]?.cite ?? null,
    text: e.passage.text,
    href: e.authority.provenance.canonicalUrl,
    evidence: e,
  }));
}
