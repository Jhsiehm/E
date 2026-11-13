// The worker's file storage client: signed S3 requests to the private bucket,
// refusing odd keys and oversized files.

import { afterEach, describe, expect, it, vi } from "vitest";
import { S3Files, s3FromEnv } from "@/worker/files";

const KEY = [1, 2, 3, 4].map(() => crypto.randomUUID()).join("/");
const files = new S3Files({
  endpoint: "https://proj.storage.supabase.co/storage/v1/s3/",
  region: "us-east-1",
  accessKeyId: "id",
  secretAccessKey: "secret",
});
const signal = new AbortController().signal;

describe("S3Files", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("signs a GET for the file in the private bucket", async () => {
    const fetch = vi.fn<(req: Request) => Promise<Response>>(
      async () => new Response("%PDF-1"),
    );
    vi.stubGlobal("fetch", fetch);
    expect((await files.download(KEY, 100, signal)).toString()).toBe("%PDF-1");
    const req = fetch.mock.calls[0][0] as Request;
    expect(req.url).toBe(
      `https://proj.storage.supabase.co/storage/v1/s3/matter-files/${KEY}`,
    );
    expect(req.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 /);
  });

  it("refuses keys that are not a reserved file place", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(
      files.download("../other-bucket/x", 100, signal),
    ).rejects.toThrow(/unexpected name/);
  });

  it("stops reading a file over the limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("x".repeat(200))),
    );
    await expect(files.download(KEY, 100, signal)).rejects.toThrow(/20 MB/);
  });

  it("treats an already-removed file as removed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    await expect(files.remove(KEY, signal)).resolves.toBeUndefined();
  });

  it("is only enabled when every setting is present", () => {
    expect(s3FromEnv({ CASEVEX_WORKER_S3_ENDPOINT: "x" })).toBeUndefined();
  });
});
