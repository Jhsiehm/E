import type { LiveContext } from "./context";
import { fail, fromDbError, ok } from "./respond";

type Body = Record<string, unknown>;
const BUCKET = "matter-files";
const STATUSES = ["draft", "in_review", "final"];

export const DOCUMENT_COLUMNS =
  "id, matter_id, name, ext, doc_type, status, updated_at, document_versions(size_bytes, version, processing_state, processing_error)";

interface DocumentRow {
  id: string;
  matter_id: string;
  name: string;
  ext: string;
  doc_type: string;
  status: string;
  updated_at: string;
  document_versions: {
    size_bytes: number;
    version: number;
    processing_state: string;
    processing_error: string | null;
  }[];
}

/** The shape the screens use, plus how far the file has been read. */
export function toDocument(r: DocumentRow) {
  const latest = [...(r.document_versions ?? [])].sort(
    (a, b) => b.version - a.version,
  )[0];
  return {
    id: r.id,
    matterId: r.matter_id,
    name: r.name,
    ext: r.ext,
    sizeBytes: Number(latest?.size_bytes ?? 0),
    type: r.doc_type,
    ownerInitials: "",
    modifiedAt: r.updated_at,
    status: r.status,
    processing: latest?.processing_state ?? "pending",
    processingError: latest?.processing_error ?? null,
  };
}

/** GET /api/documents?matterId=&q=&type= */
export async function listDocuments(ctx: LiveContext, params: URLSearchParams) {
  let query = ctx.db
    .from("documents")
    .select(DOCUMENT_COLUMNS)
    .eq("workspace_id", ctx.workspaceId)
    .order("updated_at", { ascending: false })
    .limit(500);
  const matterId = params.get("matterId");
  const type = params.get("type");
  if (matterId) query = query.eq("matter_id", matterId);
  if (type) query = query.eq("doc_type", type);
  const { data, error } = await query;
  if (error) return fromDbError(error);
  const q = params.get("q")?.toLowerCase();
  return ok(
    (data as DocumentRow[])
      .filter((d) => !q || d.name.toLowerCase().includes(q))
      .map(toDocument),
  );
}

/**
 * POST /api/documents/uploads : reserves the file's place (the database
 * checks the matter, type and size) and returns a one-time upload link.
 * Storage only issues the link if its policies let this person upload there.
 */
export async function startUpload(ctx: LiveContext, body: Body) {
  const { matterId, name, mimeType, sizeBytes, sha256 } = body;
  if (
    typeof matterId !== "string" ||
    typeof name !== "string" ||
    typeof mimeType !== "string" ||
    typeof sizeBytes !== "number" ||
    typeof sha256 !== "string"
  )
    return fail(400, "bad_request", "Choose a file and a matter.");
  if (sizeBytes > 20 * 1024 * 1024)
    return fail(422, "validation_failed", "Maximum file size is 20 MB.");
  const { data, error } = await ctx.db
    .rpc("start_document_upload", {
      matter: matterId,
      file_name: name,
      mime: mimeType,
      size_bytes: sizeBytes,
      sha256,
    })
    .single<{ document_id: string; version_id: string; object_key: string }>();
  if (error) return fromDbError(error);
  const signed = await ctx.db.storage
    .from(BUCKET)
    .createSignedUploadUrl(data.object_key);
  if (signed.error)
    return fail(
      503,
      "service_unavailable",
      "Uploads are not available right now.",
    );
  return ok({
    mode: "direct",
    documentId: data.document_id,
    versionId: data.version_id,
    uploadUrl: signed.data.signedUrl,
  });
}

/** POST /api/documents/:id/versions/:versionId/complete */
export async function finishUpload(ctx: LiveContext, versionId: string) {
  const { data: id, error } = await ctx.db.rpc("finish_document_upload", {
    version_id: versionId,
  });
  if (error) return fromDbError(error);
  return getDocument(ctx, id as string, 201);
}

export async function getDocument(ctx: LiveContext, id: string, status = 200) {
  const { data, error } = await ctx.db
    .from("documents")
    .select(DOCUMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) return fromDbError(error);
  if (!data) return fail(404, "not_found", "Document not found.");
  return ok(toDocument(data as DocumentRow), status);
}

/** GET /api/documents/:id/download : a link that works for 60 seconds. */
export async function downloadLink(ctx: LiveContext, id: string) {
  const { data, error } = await ctx.db
    .from("document_versions")
    .select("object_key, documents(name, ext)")
    .eq("document_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return fromDbError(error);
  if (!data) return fail(404, "not_found", "Document not found.");
  const doc = data.documents as unknown as { name: string; ext: string };
  const signed = await ctx.db.storage
    .from(BUCKET)
    .createSignedUrl(data.object_key, 60, {
      download: `${doc.name}.${doc.ext}`,
    });
  if (signed.error)
    return fail(404, "not_found", "The file is not available yet.");
  return ok({ url: signed.data.signedUrl, expiresInSeconds: 60 });
}

/** PATCH /api/documents/:id : rename or change review status. */
export async function updateDocument(ctx: LiveContext, id: string, body: Body) {
  const patch: Record<string, string> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 200)
      return fail(422, "validation_failed", "Check the name.", {
        name: ["Use 1 to 200 characters."],
      });
    patch.name = name;
  }
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status))
      return fail(422, "validation_failed", "Choose a valid status.");
    patch.status = body.status;
  }
  if (typeof body.matterId === "string")
    return fail(
      422,
      "validation_failed",
      "Documents cannot be moved between matters yet. Upload it to the other matter instead.",
    );
  if (!Object.keys(patch).length) return getDocument(ctx, id);
  const { data, error } = await ctx.db
    .from("documents")
    .update(patch)
    .eq("id", id)
    .select("id");
  if (error) return fromDbError(error);
  if (!data.length) return fail(404, "not_found", "Document not found.");
  return getDocument(ctx, id);
}

/** DELETE /api/documents/:id : the worker then removes the stored file. */
export async function deleteDocument(ctx: LiveContext, id: string) {
  const { data, error } = await ctx.db
    .from("documents")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return fromDbError(error);
  if (!data.length)
    return fail(
      404,
      "not_found",
      "Document not found, or you cannot delete it.",
    );
  return ok({ ok: true });
}
