/**
 * Payload shapes follow the CourtListener REST v4 documentation; record IDs
 * and text are invented for the test (example values, not real records).
 */
import { describe, expect, it } from "vitest";
import { CourtListenerAdapter } from "@/lib/legal/providers/courtlistener";
import { fakeFetch, noSleep } from "./helpers";

const cluster = {
  id: 9001,
  absolute_url: "/opinion/9001/example-v-example/",
  case_name: "Example v. Example",
  date_filed: "2007-05-21",
  date_modified: "2024-01-02T00:00:00Z",
  docket_id: 77,
  citations: [
    { volume: 127, reporter: "S. Ct.", page: "1955", type: 3 },
    { volume: 550, reporter: "U.S.", page: "544", type: 1 },
  ],
  sub_opinions: [
    "https://www.courtlistener.com/api/rest/v4/opinions/111/",
    "https://www.courtlistener.com/api/rest/v4/opinions/112/",
  ],
  precedential_status: "Published",
};

const routes = fakeFetch([
  [
    "/search/",
    {
      json: {
        count: 1,
        results: [
          {
            cluster_id: 9001,
            absolute_url: "/opinion/9001/example-v-example/",
            caseName: "Example v. Example",
            citation: ["550 U.S. 544", "127 S. Ct. 1955"],
            court: "Supreme Court of the United States",
            court_id: "scotus",
            dateFiled: "2007-05-21",
            docketNumber: "05-1126",
            status: "Published",
            opinions: [{ id: 111, snippet: "a <mark>plausible</mark> claim" }],
          },
        ],
      },
    },
  ],
  ["/clusters/9001/", { json: cluster }],
  ["/dockets/77/", { json: { court_id: "scotus", docket_number: "05-1126" } }],
  [
    "/opinions/111/",
    {
      json: {
        id: 111,
        type: "020lead",
        author_str: "Souter",
        html_with_citations: `<div><p>Opening paragraph about pleading standards and the complaint at issue in this case, which is long enough to stand on its own as a passage of text.</p><p><span class="star-pagination">*556</span> Asking for plausible grounds does not impose a probability requirement at the pleading stage.</p><script>steal()</script></div>`,
        date_modified: "2024-01-02T00:00:00Z",
      },
    },
  ],
  [
    "/opinions/112/",
    {
      json: {
        id: 112,
        type: "040dissent",
        plain_text:
          "I respectfully dissent from the new standard announced today, because notice pleading is enough.",
        date_modified: null,
      },
    },
  ],
  [
    "/citation-lookup/",
    (_u, init) => {
      const text = new URLSearchParams(String(init.body)).get("text") ?? "";
      return {
        json: [
          {
            citation: "550 U.S. 544",
            normalized_citations: ["550 U.S. 544"],
            status: 200,
            clusters: [cluster],
          },
          ...(text.includes("999")
            ? [
                {
                  citation: "999 U.S. 999",
                  normalized_citations: ["999 U.S. 999"],
                  status: 404,
                  error_message: "Citation not found",
                  clusters: [],
                },
              ]
            : []),
        ],
      };
    },
  ],
]);

const adapter = () =>
  new CourtListenerAdapter({
    token: "t0k",
    enabled: true,
    http: { fetch: routes.fetch, ...noSleep },
  });

describe("CourtListenerAdapter", () => {
  it("is disabled without a token and says why", async () => {
    const a = new CourtListenerAdapter({ enabled: true });
    expect(a.getCoverage()).toMatchObject({
      enabled: false,
      disabledReason: expect.stringContaining("COURTLISTENER_API_TOKEN"),
      treatmentCoverage: "none",
    });
    await expect(a.search({ q: "x" })).rejects.toMatchObject({
      code: "not_configured",
    });
  });

  it("maps search hits and sends court filters and the token", async () => {
    const hits = await adapter().search({
      q: "plausibility pleading",
      jurisdictionIds: ["US"],
    });
    const call = routes.calls.find((c) => c.url.pathname.endsWith("/search/"))!;
    expect(call.url.searchParams.get("court")).toBe("scotus");
    expect(call.url.searchParams.get("type")).toBe("o");
    expect((call.init.headers as Record<string, string>).Authorization).toBe(
      "Token t0k",
    );
    expect(hits[0].authority).toMatchObject({
      id: "courtlistener:9001",
      kind: "opinion",
      jurisdictionId: "US",
      citations: [{ cite: "550 U.S. 544" }, { cite: "127 S. Ct. 1955" }],
      provenance: {
        canonicalUrl:
          "https://www.courtlistener.com/opinion/9001/example-v-example/",
        publicationStatus: "published",
      },
    });
    expect(hits[0].snippet).toBe("a plausible claim");
  });

  it("returns nothing for jurisdictions it does not cover, without a request", async () => {
    const before = routes.calls.length;
    expect(await adapter().search({ q: "x", jurisdictionIds: ["CA"] })).toEqual(
      [],
    );
    expect(routes.calls.length).toBe(before);
  });

  it("fetches every sub-opinion, strips markup and pinpoints to the official reporter", async () => {
    const t = await adapter().fetchFullText("9001");
    expect(t.authority.court).toEqual({
      id: "scotus",
      name: "Supreme Court of the United States",
    });
    expect(t.authority.docketNumber).toBe("05-1126");
    expect(t.authority.provenance.checksum).toMatch(/^[0-9a-f]{64}$/);
    const all = t.passages.map((p) => p.text).join(" ");
    expect(all).not.toContain("steal");
    expect(all).toContain("I respectfully dissent");
    const star = t.passages.find((p) =>
      p.text.includes("probability requirement"),
    )!;
    expect(star.pinpoint).toBe("550 U.S. at 544–556");
    expect(t.passages[0].pinpoint).toMatch(/^550 U.S. at 544/);
  });

  it("resolves citations through the lookup API and never invents unknown ones", async () => {
    const r = await adapter().resolveCitations(
      "Compare 550 U.S. 544 with 999 U.S. 999",
    );
    expect(r[0]).toMatchObject({
      status: "resolved",
      candidates: [{ id: "courtlistener:9001" }],
    });
    expect(r[1]).toMatchObject({ status: "unresolved", candidates: [] });
    const call = routes.calls.find((c) =>
      c.url.pathname.endsWith("/citation-lookup/"),
    )!;
    expect(call.init.method).toBe("POST");
  });

  it("rejects non-numeric record ids before calling out", async () => {
    await expect(adapter().fetchAuthority("../../users")).rejects.toMatchObject(
      { code: "not_found" },
    );
  });
});
