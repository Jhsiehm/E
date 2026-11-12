import { describe, expect, it } from "vitest";
import { extractCitations, normalizeReporter } from "@/lib/legal/citations";

describe("extractCitations", () => {
  it("normalizes reporter spacing variants", () => {
    const text =
      "See Bell Atl. Corp. v. Twombly, 550 U.S. 544, 556 (2007); 85 N.Y.2d 20; 85 NY2d 20; 123 F.Supp.2d 456 and 12 F. Supp. 3d 7; 5 F. App'x 9.";
    const got = extractCitations(text).map((c) => c.normalized);
    expect(got).toEqual([
      "550 U.S. 544",
      "85 N.Y.2d 20",
      "85 N.Y.2d 20",
      "123 F. Supp. 2d 456",
      "12 F. Supp. 3d 7",
      "5 F. App'x 9",
    ]);
    const first = extractCitations(text)[0];
    expect(first.kind === "case" && first.pinpoint).toBe("556");
  });

  it("prefers the longest reporter (A.D.3d over A.D.)", () => {
    expect(extractCitations("110 A.D.3d 1032")[0].normalized).toBe(
      "110 A.D.3d 1032",
    );
    expect(normalizeReporter("ad3d")).toBe("A.D.3d");
  });

  it("recognizes NY statutes, slip ops, U.S.C. and C.F.R.", () => {
    const text =
      "Claims under N.Y. Gen. Bus. Law § 349 and GBL § 350, CPLR § 3211, 2019 NY Slip Op 01234, 15 U.S.C. § 45 and 16 C.F.R. § 433.2.";
    expect(extractCitations(text).map((c) => c.normalized)).toEqual([
      "NY GBS § 349",
      "NY GBS § 350",
      "NY CVP § 3211",
      "2019 NY Slip Op 01234",
      "15 U.S.C. § 45",
      "16 C.F.R. § 433.2",
    ]);
  });

  it("reads acronym statute cites without a section sign", () => {
    expect(
      extractCitations("CPLR 3211(a)(7) and GBL 349-a").map(
        (c) => c.normalized,
      ),
    ).toEqual(["NY CVP § 3211", "NY GBS § 349-a"]);
  });

  it("ignores numbers that are not citations", () => {
    expect(extractCitations("We paid 500 dollars on 12 May 2020.")).toEqual([]);
    expect(extractCitations("Room 12 F 7")).toEqual([]);
    expect(extractCitations("350 F. 22")[0].normalized).toBe("350 F. 22");
  });
});
