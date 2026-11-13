import type { createApiClient } from "./client";

type Api = ReturnType<typeof createApiClient>;

/** What POST /api/documents/uploads answers. */
export type UploadIntent =
  | { mode: "form" }
  | {
      mode: "direct";
      documentId: string;
      versionId: string;
      uploadUrl: string;
    };

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

async function sha256(file: Blob) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Uploads a document to a matter. With the real database the file goes
 * straight from the browser to private storage through a one-time link,
 * so large files never pass through the website; the demo keeps its
 * simple form post.
 */
export async function uploadDocument(
  api: Api,
  file: File,
  matterId: string,
  put: typeof fetch = fetch,
) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = MIME[ext] ?? file.type;
  const intent = await api.post<UploadIntent>("documents/uploads", {
    matterId,
    name: file.name,
    mimeType,
    sizeBytes: file.size,
    sha256: await sha256(file),
  });
  if (intent.mode === "form") {
    const form = new FormData();
    form.set("file", file);
    form.set("matterId", matterId);
    return api.post("documents", form);
  }
  const res = await put(intent.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType, "x-upsert": "false" },
    body: file,
  });
  if (!res.ok)
    throw new Error("The file could not be uploaded. Please try again.");
  return api.post(
    `documents/${intent.documentId}/versions/${intent.versionId}/complete`,
    {},
    { idempotencyKey: intent.versionId },
  );
}
