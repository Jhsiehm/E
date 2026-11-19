import type { DocChunk, MatterFacts } from "@/lib/legal/case-passages";
import type { LiveContext } from "./context";
import { readNewDocuments } from "./document-text";
import { MATTER_COLUMNS, type MatterRow } from "./matter-rows";

/** At most this much document text is loaded per question (about 600 pages). */
const MAX_CHUNKS = 1500;

export interface CaseRecord {
  matter: MatterFacts;
  chunks: DocChunk[];
  /** Plain cautions about documents the answer could not use. */
  notes: string[];
  documentCount: number;
}

interface DocRow {
  id: string;
  name: string;
  ext: string;
  document_versions: {
    id: string;
    version: number;
    processing_state: string;
    processing_error: string | null;
  }[];
}

/**
 * Everything the chat may use about one case, read as the signed-in person
 * so row-level security limits it to matters they are on. Files uploaded but
 * not read yet are read first. Returns null when the matter is not theirs.
 */
export async function loadCaseRecord(
  ctx: LiveContext,
  matterId: string,
): Promise<CaseRecord | null | { error: unknown }> {
  const matter = await ctx.db
    .from("matters")
    .select(MATTER_COLUMNS)
    .eq("id", matterId)
    .maybeSingle();
  if (matter.error) return { error: matter.error };
  if (!matter.data) return null;
  const m = matter.data as MatterRow;

  await readNewDocuments(ctx, { matterId }).catch((err) =>
    console.error("document read failed", { error: (err as Error)?.name }),
  );

  const [strategy, deadlines, docs] = await Promise.all([
    ctx.db
      .from("matter_strategy")
      .select("body")
      .eq("matter_id", matterId)
      .maybeSingle(),
    ctx.db
      .from("matter_deadlines")
      .select("title, due_on")
      .eq("matter_id", matterId)
      .order("due_on")
      .limit(20),
    ctx.db
      .from("documents")
      .select(
        "id, name, ext, document_versions(id, version, processing_state, processing_error)",
      )
      .eq("matter_id", matterId)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);
  const failed = [strategy, deadlines, docs].find((r) => r.error);
  if (failed) return { error: failed.error };

  const latest = new Map<string, DocRow>();
  const versionToDoc = new Map<string, DocRow>();
  const notes: string[] = [];
  const unreadable: string[] = [];
  let reading = 0;
  for (const d of (docs.data ?? []) as DocRow[]) {
    const v = [...d.document_versions].sort((a, b) => b.version - a.version)[0];
    if (!v) continue;
    latest.set(d.id, d);
    if (v.processing_state === "ready") versionToDoc.set(v.id, d);
    else if (v.processing_state === "failed")
      unreadable.push(`${d.name}.${d.ext}`);
    else reading++;
  }
  if (reading)
    notes.push(
      `${reading} document${reading === 1 ? " is" : "s are"} still being read and ${reading === 1 ? "was" : "were"} not included.`,
    );
  if (unreadable.length)
    notes.push(
      `Could not read: ${unreadable.slice(0, 5).join(", ")}${unreadable.length > 5 ? " and others" : ""} (for example a scan with no text layer). ${unreadable.length === 1 ? "It was" : "They were"} not included.`,
    );

  let chunks: DocChunk[] = [];
  if (versionToDoc.size) {
    const rows = await ctx.db
      .from("document_chunks")
      .select("document_version_id, ordinal, page_number, body")
      .in("document_version_id", [...versionToDoc.keys()])
      .order("ordinal", { ascending: true })
      .limit(MAX_CHUNKS);
    if (rows.error) return { error: rows.error };
    chunks = (rows.data ?? []).map((r) => {
      const d = versionToDoc.get(r.document_version_id)!;
      return {
        documentId: d.id,
        documentName: d.name,
        ext: d.ext,
        page: r.page_number,
        ordinal: r.ordinal,
        body: r.body,
      };
    });
    if (rows.data?.length === MAX_CHUNKS)
      notes.push(
        "This case has more document text than Casevex reads at once; the longest documents were only partly searched.",
      );
  }

  return {
    matter: {
      id: m.id,
      name: m.name,
      docket: m.docket,
      court: m.court,
      practiceArea: m.practice_area,
      partyRole: m.party_role,
      status: m.status,
      summary: m.summary,
      strategy: strategy.data?.body ?? "",
      deadlines: (deadlines.data ?? []).map((d) => ({
        title: d.title,
        dueOn: d.due_on,
      })),
    },
    chunks,
    notes,
    documentCount: latest.size,
  };
}
