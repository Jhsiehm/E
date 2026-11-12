/** Payload shapes follow the NY Open Legislation v3 and GovInfo API docs; text is invented. */
import { describe, expect, it } from "vitest";
import { GovInfoAdapter } from "@/lib/legal/providers/govinfo";
import { NyLegislationAdapter } from "@/lib/legal/providers/ny-legislation";
import { fakeFetch, noSleep } from "./helpers";

const ny = fakeFetch([
  [
    "/laws/GBS/349/",
    {
      json: {
        success: true,
        result: {
          lawId: "GBS",
          locationId: "349",
          title: "Deceptive acts and practices unlawful",
          docType: "SECTION",
          docLevelId: "349",
          activeDate: "2014-09-22",
          text: "  § 349. Deceptive acts and practices unlawful.\\n  (a) Deceptive acts or practices in the conduct of any business are hereby declared unlawful.\\n  (h) Any person who has been injured by reason of any violation of this section may bring an action.",
        },
      },
    },
  ],
  [
    "/laws/GBS/9999/",
    { json: { success: false, message: "Law document not found" } },
  ],
  [
    "/laws/CVP/3211/",
    { json: { success: false, message: "Law document not found" } },
  ],
  [
    "/laws/CVP/R3211/",
    {
      json: {
        success: true,
        result: {
          lawId: "CVP",
          locationId: "R3211",
          title: "Motion to dismiss",
          docType: "RULE",
          docLevelId: "3211",
          activeDate: "2020-01-01",
          text: "Rule 3211. Motion to dismiss.",
        },
      },
    },
  ],
  [
    "/laws/search",
    {
      json: {
        success: true,
        result: {
          items: [
            {
              result: {
                lawId: "GBS",
                locationId: "349",
                title: "Deceptive acts",
                docLevelId: "349",
                activeDate: "2014-09-22",
              },
              highlights: { text: ["<em>deceptive</em> acts"] },
            },
          ],
        },
      },
    },
  ],
]);
const nyAdapter = () =>
  new NyLegislationAdapter({
    apiKey: "k",
    enabled: true,
    http: { fetch: ny.fetch, ...noSleep },
  });

describe("NyLegislationAdapter", () => {
  it("fetches a section with subdivision passages and public provenance", async () => {
    const t = await nyAdapter().fetchFullText("GBS/349");
    expect(t.authority).toMatchObject({
      id: "ny_legislation:GBS/349",
      kind: "statute",
      jurisdictionId: "NY",
      title:
        "N.Y. General Business Law § 349 — Deceptive acts and practices unlawful",
      provenance: {
        licenseStatus: "public_domain",
        canonicalUrl: "https://www.nysenate.gov/legislation/laws/GBS/349",
      },
    });
    expect(t.passages.length).toBeGreaterThanOrEqual(2);
    expect(t.passages.some((p) => p.text.startsWith("(h) Any person"))).toBe(
      true,
    );
    expect(ny.calls.at(-1)!.url.searchParams.get("key")).toBe("k");
  });

  it("resolves statute citations, falls back to CPLR rules, and reports missing sections", async () => {
    const r = await nyAdapter().resolveCitations(
      "Under GBL § 349, CPLR 3211 and Gen. Bus. Law § 9999",
    );
    expect(r.map((x) => x.status)).toEqual([
      "resolved",
      "resolved",
      "unresolved",
    ]);
    expect(r[1].candidates[0].id).toBe("ny_legislation:CVP/R3211");
  });

  it("only answers NY statute searches", async () => {
    expect(
      await nyAdapter().search({ q: "deceptive", jurisdictionIds: ["2d-cir"] }),
    ).toEqual([]);
    expect(
      await nyAdapter().search({ q: "deceptive", kinds: ["opinion"] }),
    ).toEqual([]);
    const hits = await nyAdapter().search({ q: "deceptive" });
    expect(hits[0].snippet).toBe("deceptive acts");
  });

  it("rejects malformed location ids", async () => {
    await expect(
      nyAdapter().fetchAuthority("GBS/../../x"),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

const gi = fakeFetch([
  [
    "api.govinfo.gov/search",
    {
      json: {
        count: 1,
        results: [
          {
            title: "15 U.S.C. 45 - Unfair methods of competition unlawful",
            packageId: "USCODE-2023-title15",
            granuleId: "USCODE-2023-title15-chap2-subchapI-sec45",
            collectionCode: "USCODE",
            dateIssued: "2023-01-01",
            lastModified: "2024-02-01T00:00:00Z",
          },
        ],
      },
    },
  ],
  [
    "/summary",
    {
      json: {
        title: "15 U.S.C. 45 - Unfair methods of competition unlawful",
        packageId: "USCODE-2023-title15",
        granuleId: "USCODE-2023-title15-chap2-subchapI-sec45",
        collectionCode: "USCODE",
        download: {
          htmLink:
            "https://api.govinfo.gov/packages/USCODE-2023-title15/granules/USCODE-2023-title15-chap2-subchapI-sec45/htm",
        },
      },
    },
  ],
  [
    "/htm",
    {
      text: "<html><body><h3>§45. Unfair methods of competition unlawful</h3><p>(a)(1) Unfair methods of competition in or affecting commerce, and unfair or deceptive acts or practices in or affecting commerce, are hereby declared unlawful.</p></body></html>",
    },
  ],
]);
const giAdapter = () =>
  new GovInfoAdapter({
    apiKey: "g",
    enabled: true,
    http: { fetch: gi.fetch, ...noSleep },
  });

describe("GovInfoAdapter", () => {
  it("searches USCODE and fetches the granule text with the key", async () => {
    const hits = await giAdapter().search({
      q: "unfair deceptive",
      kinds: ["statute"],
    });
    expect(JSON.parse(String(gi.calls[0].init.body)).query).toBe(
      "collection:(USCODE) AND (unfair deceptive)",
    );
    expect(hits[0].authority.id).toBe(
      "govinfo:USCODE-2023-title15/USCODE-2023-title15-chap2-subchapI-sec45",
    );
    const t = await giAdapter().fetchFullText(
      hits[0].authority.provenance.providerRecordId,
    );
    expect(t.passages.map((p) => p.text).join(" ")).toContain(
      "unfair or deceptive acts or practices",
    );
    expect(
      gi.calls.every((c) => c.url.searchParams.get("api_key") === "g"),
    ).toBe(true);
    expect(t.authority.provenance.licenseStatus).toBe("public_domain");
  });

  it("skips non-US jurisdictions", async () => {
    expect(
      await giAdapter().search({ q: "x", jurisdictionIds: ["NY"] }),
    ).toEqual([]);
  });
});
