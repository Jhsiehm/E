import type pg from "pg";
import {
  MAX_FILE_BYTES,
  checkFile,
  docxPages,
  pdfPages,
  toChunks,
  type Expected,
} from "./extract";
import type { FileStore } from "./files";
import { JobError, type JobContext, type JobHandler } from "./types";

export interface DocumentDeps {
  /** Pool logged in as a member of casevex_worker. */
  pool: pg.Pool;
  files: FileStore;
}

const versionId = (ctx: JobContext) => {
  const id = ctx.job.payload.version_id;
  if (typeof id !== "string")
    throw new JobError("Job is missing its document.", false);
  return id;
};

/**
 * document.extract: reads an uploaded file and stores its text in chunks so
 * research can quote it. Failures that will not fix themselves (wrong file
 * type, damaged file, a scan with no text) are shown on the document.
 */
export function documentExtract(deps: DocumentDeps): JobHandler {
  return async (ctx) => {
    const id = versionId(ctx);
    try {
      const { rows } = await deps.pool.query<Expected & { object_key: string }>(
        "select * from worker.begin_extract($1)",
        [id],
      );
      // Deleted, or already read by an earlier attempt: nothing to do.
      if (!rows[0]) return { skipped: true };
      const v = rows[0];
      const buf = await deps.files.download(
        v.object_key,
        MAX_FILE_BYTES,
        ctx.signal,
      );
      checkFile(buf, v);
      const paged = v.mime_type === "application/pdf";
      const pages = paged ? await pdfPages(buf) : docxPages(buf);
      const chunks = toChunks(pages, paged);
      if (chunks.length === 0)
        throw new JobError(
          "No text was found. If this is a scanned document, reading scans is not supported yet.",
          false,
        );
      await deps.pool.query("select worker.save_extract($1, $2, $3)", [
        id,
        JSON.stringify(chunks),
        paged ? pages.length : null,
      ]);
      return { pages: pages.length, chunks: chunks.length };
    } catch (err) {
      const final =
        (err instanceof JobError && !err.retryable) ||
        ctx.job.attempts >= ctx.job.max_attempts;
      if (final)
        await deps.pool.query("select worker.fail_extract($1, $2)", [
          id,
          err instanceof JobError ? err.message : "The file could not be read.",
        ]);
      throw err;
    }
  };
}

/** document.purge: removes the stored file of a deleted document. */
export function documentPurge(deps: DocumentDeps): JobHandler {
  return async (ctx) => {
    const key = ctx.job.payload.object_key;
    if (typeof key !== "string")
      throw new JobError("Job is missing its file.", false);
    await deps.files.remove(key, ctx.signal);
    return { removed: true };
  };
}
