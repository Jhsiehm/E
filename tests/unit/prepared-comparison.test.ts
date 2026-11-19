// The prepared demo comparison: where it may appear, and the pinned view link.

import { describe, expect, it, vi } from "vitest";
import {
  GONZALEZ_COMPARISON as C,
  preparedComparisonFor,
} from "@/lib/demo/prepared-comparison";
import { viewLink } from "@/lib/adapters/live/documents";
import type { LiveContext } from "@/lib/adapters/live/context";

const doc = { id: "d1", sha256: C.sha256 };

describe("preparedComparisonFor", () => {
  it("appears on the demo matter that holds the exact file", () => {
    expect(preparedComparisonFor("Gonzalez v. United States", [doc])).toEqual({
      comparison: C,
      documentId: "d1",
    });
  });
  it("never appears on another matter, even with the same file", () => {
    expect(preparedComparisonFor("Ellis v. Harborview", [doc])).toBeNull();
    expect(preparedComparisonFor("Gonzalez v. City", [doc])).toBeNull();
  });
  it("does not appear when the file differs or is missing", () => {
    expect(
      preparedComparisonFor("Gonzalez v. United States", [
        { id: "d1", sha256: "0".repeat(64) },
      ]),
    ).toBeNull();
    expect(preparedComparisonFor("Gonzalez v. United States", [])).toBeNull();
  });
  it("cites two different pages, each with one neutral difference", () => {
    expect(C.left.page).not.toBe(C.right.page);
    expect(C.label).toBe("Prepared example · Public court record");
    expect(C.difference.split(". ").length).toBe(1);
  });
});

describe("viewLink", () => {
  function ctx(row: unknown, signed = { data: { signedUrl: "https://s/x" } }) {
    const filters: [string, unknown][] = [];
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => (filters.push([k, v]), q),
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: row, error: null }),
    };
    const createSignedUrl = vi.fn(async () => ({ ...signed, error: null }));
    const c = {
      db: {
        from: () => q,
        storage: { from: () => ({ createSignedUrl }) },
      },
    } as unknown as LiveContext;
    return { c, filters, createSignedUrl };
  }

  it("pins the link to the version with the cited content and opens inline", async () => {
    const { c, filters, createSignedUrl } = ctx({
      id: "v1",
      object_key: "w/m/d/v1",
      mime_type: "application/pdf",
    });
    const res = await viewLink(c, "d1", C.sha256);
    expect(res.status).toBe(200);
    expect(filters).toContainEqual(["sha256", C.sha256]);
    expect(filters).toContainEqual(["document_id", "d1"]);
    // No download option, so the browser shows the PDF instead of saving it.
    expect(createSignedUrl).toHaveBeenCalledWith("w/m/d/v1", 300);
  });

  it("is not found when no readable version has that content", async () => {
    const { c } = ctx(null);
    expect((await viewLink(c, "d1", C.sha256)).status).toBe(404);
  });
});
