// The live document API and the browser upload helper, without a database.

import { describe, expect, it, vi } from "vitest";
import { toDocument } from "@/lib/adapters/live/documents";
import { createApiClient } from "@/lib/api/client";
import { uploadDocument } from "@/lib/api/upload";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("live documents", () => {
  it("shows the newest version's size and reading state", () => {
    expect(
      toDocument({
        id: "d1",
        matter_id: "m1",
        name: "Complaint",
        ext: "pdf",
        doc_type: "Uploaded document",
        status: "draft",
        updated_at: "2026-11-13T01:00:00Z",
        document_versions: [
          {
            size_bytes: 10,
            version: 1,
            processing_state: "ready",
            processing_error: null,
          },
          {
            size_bytes: 20,
            version: 2,
            processing_state: "failed",
            processing_error: "No text.",
          },
        ],
      }),
    ).toMatchObject({
      matterId: "m1",
      sizeBytes: 20,
      processing: "failed",
      processingError: "No text.",
    });
  });
});

describe("uploadDocument", () => {
  const file = new File(["%PDF-1.4 hello"], "Complaint.pdf", {
    type: "application/pdf",
  });

  it("sends the file straight to storage, then finishes once", async () => {
    const calls: { url: string; method: string; body?: unknown }[] = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body });
      if (url.endsWith("/documents/uploads"))
        return json({
          mode: "direct",
          documentId: "d1",
          versionId: "v1",
          uploadUrl: "https://storage.example/upload?token=t",
        });
      if (url.startsWith("https://storage.example")) return new Response("{}");
      return json({ id: "d1", processing: "uploaded" }, 201);
    });
    const api = createApiClient({
      fetch: fetch as typeof globalThis.fetch,
      retries: 0,
    });
    const doc = await uploadDocument(
      api,
      file,
      "m1",
      fetch as typeof globalThis.fetch,
    );
    expect(doc).toEqual({ id: "d1", processing: "uploaded" });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/documents/uploads",
      "PUT https://storage.example/upload?token=t",
      "POST /api/documents/d1/versions/v1/complete",
    ]);
    const intent = JSON.parse(String(calls[0].body));
    expect(intent).toMatchObject({
      matterId: "m1",
      name: "Complaint.pdf",
      mimeType: "application/pdf",
      sizeBytes: file.size,
    });
    expect(intent.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(calls[1].body).toBe(file);
  });

  it("falls back to the demo's form post", async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) =>
      url.endsWith("/uploads")
        ? json({ mode: "form" })
        : json({ id: "x", seen: init?.body instanceof FormData }, 201),
    );
    const api = createApiClient({
      fetch: fetch as typeof globalThis.fetch,
      retries: 0,
    });
    expect(await uploadDocument(api, file, "m1")).toEqual({
      id: "x",
      seen: true,
    });
  });

  it("stops if storage refuses the file", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.startsWith("https://")
        ? new Response("no", { status: 403 })
        : json({
            mode: "direct",
            documentId: "d",
            versionId: "v",
            uploadUrl: "https://s/u",
          }),
    );
    const api = createApiClient({
      fetch: fetch as typeof globalThis.fetch,
      retries: 0,
    });
    await expect(
      uploadDocument(api, file, "m1", fetch as typeof globalThis.fetch),
    ).rejects.toThrow(/could not be uploaded/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
