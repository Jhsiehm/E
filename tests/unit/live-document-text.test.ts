// The site reads uploaded files itself (no worker needed): new files are read
// and stored, a damaged one gets a plain reason, a stuck one is retried.

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { LiveContext } from "@/lib/adapters/live/context";
import { readNewDocuments } from "@/lib/adapters/live/document-text";
import { tinyDocx, tinyPdf } from "../shared/fixtures/files";

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function fakeCtx(
  versions: Record<string, unknown>[],
  files: Record<string, Buffer>,
) {
  const rpcs: { fn: string; args: Record<string, unknown> }[] = [];
  const query = {
    select: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    eq: () => query,
    then: (res: (v: unknown) => unknown) =>
      res({ data: versions, error: null }),
  };
  const db = {
    from: () => query,
    storage: {
      from: () => ({
        download: async (key: string) =>
          files[key]
            ? { data: new Blob([new Uint8Array(files[key])]), error: null }
            : { data: null, error: { message: "not found" } },
      }),
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args });
      return { data: true, error: null };
    },
  };
  return { ctx: { db } as unknown as LiveContext, rpcs };
}

const version = (
  id: string,
  buf: Buffer,
  mime = "application/pdf",
  extra = {},
) => ({
  id,
  object_key: `k/${id}`,
  mime_type: mime,
  size_bytes: String(buf.length),
  sha256: sha(buf),
  processing_state: "uploaded",
  updated_at: new Date().toISOString(),
  ...extra,
});

describe("reading uploaded files on the site", () => {
  it("stores the text of new PDF and Word files by page", async () => {
    const pdf = tinyPdf("The tenant paid a deposit of $3,000.");
    const docx = tinyDocx(["Demand letter to Northside."]);
    const { ctx, rpcs } = fakeCtx(
      [version("v1", pdf), version("v2", docx, DOCX)],
      { "k/v1": pdf, "k/v2": docx },
    );
    expect(await readNewDocuments(ctx, { matterId: "m" })).toEqual([
      "ready",
      "ready",
    ]);
    expect(rpcs[0].fn).toBe("save_document_text");
    expect(rpcs[0].args).toMatchObject({ version_id: "v1", pages: 1 });
    expect(JSON.stringify(rpcs[0].args.chunks)).toContain("deposit of $3,000");
    expect(rpcs[1].args).toMatchObject({ version_id: "v2", pages: null });
  });

  it("marks a file that is not what was uploaded as unreadable, with a reason", async () => {
    const pdf = tinyPdf("x");
    const { ctx, rpcs } = fakeCtx(
      [version("v1", pdf, "application/pdf", { sha256: "0".repeat(64) })],
      { "k/v1": pdf },
    );
    expect(await readNewDocuments(ctx, { versionId: "v1" })).toEqual([
      "failed",
    ]);
    expect(rpcs[0].args.reason).toMatch(/does not match/);
  });

  it("leaves a file another request is reading, unless it has been stuck a while", async () => {
    const pdf = tinyPdf("x");
    const recent = version("v1", pdf, "application/pdf", {
      processing_state: "extracting",
    });
    const stuck = version("v2", pdf, "application/pdf", {
      processing_state: "extracting",
      updated_at: new Date(Date.now() - 10 * 60_000).toISOString(),
    });
    const { ctx } = fakeCtx([recent, stuck], { "k/v1": pdf, "k/v2": pdf });
    expect(await readNewDocuments(ctx, { matterId: "m" })).toEqual(["ready"]);
  });
});
