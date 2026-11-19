import {
  MAX_FILE_BYTES,
  checkFile,
  docxPages,
  pdfPages,
  toChunks,
} from "@/worker/extract";
import { JobError } from "@/worker/types";
import type { LiveContext } from "./context";

const BUCKET = "matter-files";
/** A file stuck "being read" this long was abandoned; read it again. */
const STALE_MS = 5 * 60_000;

interface PendingVersion {
  id: string;
  object_key: string;
  mime_type: string;
  size_bytes: number | string;
  sha256: string;
  processing_state: string;
  updated_at: string;
}

/**
 * Reads the text of one uploaded file (PDF or Word) and stores it in chunks,
 * as the person, so research can quote it. The same checks as the worker:
 * the file must match what was announced and really be a PDF or Word file.
 * A file that cannot be read gets a plain reason on the document instead.
 */
async function readOne(ctx: LiveContext, v: PendingVersion) {
  try {
    const file = await ctx.db.storage.from(BUCKET).download(v.object_key);
    if (file.error || !file.data) return "not_downloaded";
    if (file.data.size > MAX_FILE_BYTES)
      throw new JobError("The file is larger than 20 MB.", false);
    const buf = Buffer.from(await file.data.arrayBuffer());
    checkFile(buf, v);
    const paged = v.mime_type === "application/pdf";
    const pages = paged ? await pdfPages(buf) : docxPages(buf);
    const chunks = toChunks(pages, paged);
    if (!chunks.length)
      throw new JobError(
        "No text was found. If this is a scanned document, reading scans is not supported yet.",
        false,
      );
    const saved = await ctx.db.rpc("save_document_text", {
      version_id: v.id,
      chunks,
      pages: paged ? pages.length : null,
    });
    return saved.error ? "not_saved" : "ready";
  } catch (err) {
    if (!(err instanceof JobError) || err.retryable) return "error";
    await ctx.db.rpc("save_document_text", {
      version_id: v.id,
      chunks: [],
      reason: err.message,
    });
    return "failed";
  }
}

/**
 * Reads any uploaded files on these documents (or this matter) that nobody
 * has read yet. Used right after an upload finishes, and again before the
 * chat answers, so a question never misses a file just because it is new.
 * Read-only members cannot store text; their files wait for someone who can.
 */
export async function readNewDocuments(
  ctx: LiveContext,
  scope: { matterId?: string; versionId?: string },
  limit = 6,
) {
  let q = ctx.db
    .from("document_versions")
    .select(
      "id, object_key, mime_type, size_bytes, sha256, processing_state, updated_at",
    )
    .in("processing_state", ["uploaded", "extracting"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (scope.matterId) q = q.eq("matter_id", scope.matterId);
  if (scope.versionId) q = q.eq("id", scope.versionId);
  const { data, error } = await q;
  if (error || !data?.length) return [];
  const due = (data as PendingVersion[]).filter(
    (v) =>
      v.processing_state === "uploaded" ||
      Date.now() - Date.parse(v.updated_at) > STALE_MS,
  );
  const results: string[] = [];
  // One at a time: a 20 MB PDF is heavy to parse inside a web request.
  for (const v of due) results.push(await readOne(ctx, v));
  if (results.length)
    console.info("documents read", {
      count: results.length,
      ready: results.filter((r) => r === "ready").length,
    });
  return results;
}
