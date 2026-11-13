import type { NextRequest } from "next/server";
import type { LiveContext } from "./context";
import {
  deleteDocument,
  downloadLink,
  finishUpload,
  getDocument,
  listDocuments,
  startUpload,
  updateDocument,
} from "./documents";
import { fail, notBuilt } from "./respond";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** /api/documents/... in live mode. */
export function routeDocuments(
  ctx: LiveContext,
  req: NextRequest,
  [id, sub, versionId, action]: string[],
  body: Record<string, unknown>,
) {
  const method = req.method;
  if (!id) {
    if (method === "GET") return listDocuments(ctx, req.nextUrl.searchParams);
    // Files go straight to storage (see /uploads), never through the site.
    if (method === "POST")
      return fail(400, "bad_request", "Use the upload button to add a file.");
    return fail(405, "bad_request", "Not supported.");
  }
  if (id === "uploads" && method === "POST") return startUpload(ctx, body);
  if (!UUID.test(id)) return fail(404, "not_found", "Document not found.");
  if (!sub) {
    if (method === "GET") return getDocument(ctx, id);
    if (method === "PATCH") return updateDocument(ctx, id, body);
    if (method === "DELETE") return deleteDocument(ctx, id);
    return fail(405, "bad_request", "Not supported.");
  }
  if (sub === "download" && method === "GET") return downloadLink(ctx, id);
  if (sub === "versions" && action === "complete" && method === "POST") {
    if (!versionId || !UUID.test(versionId))
      return fail(404, "not_found", "Upload not found.");
    return finishUpload(ctx, versionId);
  }
  return notBuilt();
}
