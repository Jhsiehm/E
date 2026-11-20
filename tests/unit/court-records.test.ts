// Public court records bundled with the demo: the files are the ones pinned,
// and every prepared quotation is on the page it names.

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { beforeAll, describe, expect, it } from "vitest";
import {
  COURT_RECORDS,
  courtRecordBySha,
  type CourtRecordId,
} from "@/lib/demo/court-records";
import { FINDINGS, LIMITATIONS } from "@/lib/demo/gonzalez-workflow";
import {
  GONZALEZ_COMPARISON,
  preparedComparisonFor,
} from "@/lib/demo/prepared-comparison";
import { demoAnswer, seed, withoutSamples } from "@/lib/mock/data";
import { workspaceAction } from "@/lib/adapters/fixture/samples";

const file = (id: CourtRecordId) =>
  join(process.cwd(), "public", COURT_RECORDS[id].publicPath);
const pages: Partial<Record<CourtRecordId, string[]>> = {};

/** Letters only: survives line breaks, margin line numbers and hyphenation. */
const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const onPage = (id: CourtRecordId, page: number, quote: string) =>
  letters(pages[id]![page - 1]).includes(letters(quote));

const ids = Object.keys(COURT_RECORDS) as CourtRecordId[];

beforeAll(async () => {
  for (const id of ids) {
    const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file(id))));
    pages[id] = (await extractText(pdf, { mergePages: false })).text;
  }
}, 60_000);

describe("bundled court records", () => {
  it.each(ids)("%s is the pinned file", (id) => {
    const r = COURT_RECORDS[id];
    const bytes = readFileSync(file(id));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(r.sha256);
    expect(statSync(file(id)).size).toBe(r.sizeBytes);
    expect(pages[id]).toHaveLength(r.pages);
    expect(r.publicPath).toBe(`/court-records/${r.fileName}`);
    expect(r.sourceUrl).toMatch(/^https:\/\//);
  });

  it.each(ids)("%s holding is quoted from its page", (id) => {
    const h = COURT_RECORDS[id].holding!;
    expect(onPage(id, h.page, h.quote)).toBe(true);
  });

  it("the prepared comparison pins the bundled Gonzalez opinion", () => {
    const c = GONZALEZ_COMPARISON;
    expect(courtRecordBySha(c.sha256)?.id).toBe("gonzalez");
    for (const side of [c.left, c.right])
      expect(onPage("gonzalez", side.page, side.quote)).toBe(true);
  });

  it("every workflow quotation is on the page it names", () => {
    const all = FINDINGS.flatMap((f) => f.citations);
    expect(all.length).toBeGreaterThanOrEqual(8);
    for (const c of all) expect(onPage(c.source, c.page, c.quote)).toBe(true);
  });

  it("a misquoted or misplaced passage is caught", () => {
    const c = GONZALEZ_COMPARISON.left;
    expect(onPage("gonzalez", c.page + 1, c.quote)).toBe(false);
    expect(
      onPage("gonzalez", c.page, c.quote.replace("$850,000", "$950")),
    ).toBe(
      true, // digits are ignored, so check words instead
    );
    expect(onPage("gonzalez", c.page, c.quote.replace("did not", "did"))).toBe(
      false,
    );
  });

  it("states what was not checked and claims no AI or treatment check", () => {
    expect(LIMITATIONS.join(" ")).toMatch(/Casevex AI did not write it/);
    expect(LIMITATIONS.join(" ")).toMatch(
      /Subsequent treatment .* not been checked/,
    );
  });
});

describe("the Gonzalez demo matter", () => {
  it("is the sixth preloaded matter, built from the public record", () => {
    const s = seed();
    expect(s.matters).toHaveLength(6);
    const g = s.matters.find((m) => m.id === "gonzalez")!;
    expect(g.publicRecord).toBe(true);
    expect(g.name).toBe("Gonzalez v. United States");
    expect(s.deadlines.some((d) => d.matterId === "gonzalez")).toBe(false);
    const docs = s.documents.filter((d) => d.matterId === "gonzalez");
    expect(docs.map((d) => courtRecordBySha(d.sha256)?.id).sort()).toEqual([
      "gonzalez",
      "malmberg",
    ]);
    for (const d of docs) expect(d.publicUrl).toMatch(/^\/court-records\//);
    expect(preparedComparisonFor(g.name, s.documents)?.documentId).toBe(
      "court-record-gonzalez",
    );
  });

  it("keeps the five fictional matters", () => {
    const fictional = seed().matters.filter((m) => !m.publicRecord);
    expect(fictional.map((m) => m.id)).toEqual([
      "anderson",
      "parker",
      "ridgeway",
      "diaz",
      "elmwood",
    ]);
  });

  it("is removed with the samples and restored with them", () => {
    const s = seed();
    const cleared = withoutSamples(s);
    expect(cleared.matters).toHaveLength(0);
    expect(cleared.documents.some((d) => d.publicUrl)).toBe(false);
    Object.assign(s, cleared);
    workspaceAction(s, "samples", "POST");
    expect(s.matters).toHaveLength(6);
  });

  it("real authorities carry no simulated verification", () => {
    const real = seed().precedents.filter((p) => p.record);
    expect(real.map((p) => p.id).sort()).toEqual(
      ["carpenter", "gonzalez", "malmberg", "mantikas", "meyer"].sort(),
    );
    for (const p of real) {
      expect(p.verified).toBe(false);
      expect(p.holding).toBe(COURT_RECORDS[p.record!].holding!.quote);
    }
  });

  it("chat on the public record says no AI answer was given", () => {
    const a = demoAnswer(
      { id: "gonzalez", name: "Gonzalez v. United States" },
      "Summarize the ruling",
    );
    expect(a.text).toMatch(/no AI answers/);
    expect(a.sources).toEqual([]);
  });
});
