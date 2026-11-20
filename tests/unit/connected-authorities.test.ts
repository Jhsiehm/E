// Detailed precedent passages: every quotation is on the page it cites.
// Bundled opinions are checked against the PDF; connected authorities
// against the CourtListener text kept in tests/fixtures/courtlistener/.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { beforeAll, describe, expect, it } from "vitest";
import { COURT_RECORDS, type CourtRecordId } from "@/lib/demo/court-records";
import { OPINION_DETAILS } from "@/lib/demo/opinion-passages";
import { CONNECTED } from "@/lib/demo/connected-authorities";
import { seed } from "@/lib/mock/data";

const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const ids = Object.keys(COURT_RECORDS) as CourtRecordId[];
const pages: Partial<Record<CourtRecordId, string[]>> = {};

/** A fixture split on "=== PAGE n ===" markers, keyed by reporter page. */
function reporterPages(fixture: string) {
  const text = readFileSync(
    join(process.cwd(), "tests/fixtures/courtlistener", fixture),
    "utf8",
  );
  const out: Record<string, string> = {};
  for (const part of text.split(/^=== PAGE /m).slice(1)) {
    const [label, ...rest] = part.split("\n");
    out[label.replace(/ ===\s*$/, "")] = rest.join("\n");
  }
  return out;
}

beforeAll(async () => {
  for (const id of ids) {
    const file = join(process.cwd(), "public", COURT_RECORDS[id].publicPath);
    const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)));
    pages[id] = (await extractText(pdf, { mergePages: false })).text;
  }
}, 60_000);

describe("bundled opinion passages", () => {
  it.each(ids)("%s: each passage is on its PDF page", (id) => {
    const detail = OPINION_DETAILS[id];
    expect(detail.passages.some((p) => p.kind === "holding")).toBe(true);
    for (const p of detail.passages)
      expect(
        letters(pages[id]![p.page - 1]).includes(letters(p.quote)),
        `${id} p.${p.page}: ${p.quote.slice(0, 60)}`,
      ).toBe(true);
  });
});

describe("connected authorities", () => {
  it.each(Object.values(CONNECTED))(
    "$caseName: each passage is on its reporter page",
    (a) => {
      for (const p of a.passages) {
        const page = reporterPages(p.fixture)[p.reporterPage];
        expect(page, `${a.id} has page ${p.reporterPage}`).toBeTruthy();
        expect(
          letters(page).includes(letters(p.quote)),
          `${a.id} at ${p.reporterPage}: ${p.quote.slice(0, 60)}`,
        ).toBe(true);
      }
    },
  );

  it.each(Object.values(CONNECTED))(
    "$caseName: Gonzalez cites it on the page given",
    (a) => {
      const page = pages.gonzalez![a.gonzalez.page - 1];
      expect(letters(page).includes(letters(a.gonzalez.quote))).toBe(true);
      expect(page).toContain(a.caseName.split(" ")[0]);
    },
  );

  it("a quotation on the wrong reporter page is caught", () => {
    const p = CONNECTED.henry.passages[0];
    const other = reporterPages(p.fixture)["624"];
    expect(letters(other).includes(letters(p.quote))).toBe(false);
  });

  it("appear in the precedent library without simulated verification", () => {
    const linked = seed().precedents.filter((p) => p.authority);
    expect(linked.map((p) => p.id).sort()).toEqual([
      "disorbo",
      "gasperini",
      "henry",
    ]);
    for (const p of linked) expect(p.verified).toBe(false);
  });
});
