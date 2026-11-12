import { describe, expect, it } from "vitest";
import {
  getAuthority,
  getCoverage,
  getPassages,
  researchPreview,
  resolveAuthority,
  searchAuthorities,
} from "@/lib/legal/api";
import { buildRegistry } from "@/lib/legal/registry";

const fixture = () => buildRegistry({ NODE_ENV: "test" });
const live = (extra: Record<string, string> = {}) =>
  buildRegistry({ NODE_ENV: "production", ...extra });
const get = (path: string) => new Request(`http://localhost${path}`);
const post = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("legal data API", () => {
  it("live mode with no providers configured: coverage explains, data endpoints 503", async () => {
    const reg = live();
    const cov = await getCoverage(reg).json();
    expect(
      cov.items.map((c: { provider: string; enabled: boolean }) => [
        c.provider,
        c.enabled,
      ]),
    ).toEqual([
      ["courtlistener", false],
      ["ny_legislation", false],
      ["govinfo", false],
    ]);
    const res = await searchAuthorities(
      reg,
      get("/api/v1/authorities?q=fraud"),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get("X-Casevex-Data-Mode")).toBe("live");
    expect((await res.json()).error.code).toBe("service_not_configured");
  });

  it("a provider needs both the allowlist entry and its credential", () => {
    expect(live({ COURTLISTENER_API_TOKEN: "x" }).enabled).toHaveLength(0);
    expect(
      live({ CASEVEX_LEGAL_PROVIDERS: "courtlistener" }).enabled,
    ).toHaveLength(0);
    expect(
      live({
        CASEVEX_LEGAL_PROVIDERS: "courtlistener",
        COURTLISTENER_API_TOKEN: "x",
      }).enabled.map((p) => p.id),
    ).toEqual(["courtlistener"]);
  });

  it("fixture mode never enables real providers", () => {
    const reg = buildRegistry({
      NODE_ENV: "test",
      CASEVEX_LEGAL_PROVIDERS: "courtlistener",
      COURTLISTENER_API_TOKEN: "x",
    });
    expect(reg.enabled.map((p) => p.id)).toEqual(["fixture"]);
  });

  it("validates search input", async () => {
    const res = await searchAuthorities(
      fixture(),
      get("/api/v1/authorities?q=&kind=novel&decisionFrom=2020"),
    );
    expect(res.status).toBe(422);
    expect(Object.keys((await res.json()).error.fieldErrors).sort()).toEqual([
      "decisionFrom",
      "kind",
      "q",
    ]);
  });

  it("searches, reads an authority and its passages", async () => {
    const reg = fixture();
    const s = await (
      await searchAuthorities(
        reg,
        get("/api/v1/authorities?q=class%20certification"),
      )
    ).json();
    const id = s.items[0].authority.id;
    expect(id).toBe("fixture:op-2");
    const a = await (await getAuthority(reg, encodeURIComponent(id))).json();
    expect(a.data).toMatchObject({ id, treatmentStatus: "not_checked" });
    const p = await (await getPassages(reg, encodeURIComponent(id))).json();
    expect(p.items[0].id).toBe(`${id}#p1`);
    expect((await getAuthority(reg, "nope:1")).status).toBe(404);
    expect(
      (await getAuthority(reg, encodeURIComponent("fixture:missing"))).status,
    ).toBe(404);
  });

  it("resolves citations without inventing", async () => {
    const reg = fixture();
    const ok = await (
      await resolveAuthority(
        reg,
        post("/api/v1/authority-resolutions", { citation: "2 Synth. 200" }),
      )
    ).json();
    expect(ok.data).toMatchObject({
      status: "resolved",
      candidates: [{ id: "fixture:op-2" }],
    });
    const no = await (
      await resolveAuthority(
        reg,
        post("/api/v1/authority-resolutions", { citation: "9 Synth. 900" }),
      )
    ).json();
    expect(no.data).toMatchObject({ status: "unresolved", candidates: [] });
    expect((await resolveAuthority(reg, post("/x", {}))).status).toBe(422);
  });

  it("research preview returns evidence-backed extractive answer and progress events", async () => {
    const res = await researchPreview(
      fixture(),
      post("/api/v1/legal-research/preview", {
        question:
          "Can a class be certified when some leases have arbitration clauses?",
      }),
    );
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.mode).toBe("extractive");
    expect(data.sources[0].authorityId).toBe("fixture:op-2");
    expect(
      data.events.some((e: { stage?: string }) => e.stage === "checked"),
    ).toBe(true);
  });
});
