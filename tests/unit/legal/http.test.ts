import { describe, expect, it } from "vitest";
import { httpRequest } from "@/lib/legal/http";
import { ProviderError } from "@/lib/legal/types";
import { fakeFetch, noSleep } from "./helpers";

describe("httpRequest", () => {
  it("refuses hosts outside the allowlist and non-https", async () => {
    const { fetch, calls } = fakeFetch([]);
    await expect(
      httpRequest(
        { provider: "courtlistener", url: "https://evil.example.com/x" },
        { fetch },
      ),
    ).rejects.toMatchObject({ code: "blocked_host" });
    await expect(
      httpRequest(
        { provider: "courtlistener", url: "http://www.courtlistener.com/x" },
        { fetch },
      ),
    ).rejects.toMatchObject({ code: "blocked_host" });
    // a provider cannot reach another provider's host
    await expect(
      httpRequest(
        { provider: "govinfo", url: "https://www.courtlistener.com/x" },
        { fetch },
      ),
    ).rejects.toBeInstanceOf(ProviderError);
    expect(calls).toHaveLength(0);
  });

  it("retries 503 and 429 then succeeds, honoring Retry-After", async () => {
    let n = 0;
    const waits: number[] = [];
    const { fetch } = fakeFetch([
      [
        "courtlistener",
        () =>
          ++n === 1
            ? { status: 503 }
            : n === 2
              ? { status: 429, headers: { "retry-after": "2" } }
              : { json: { ok: true } },
      ],
    ]);
    const r = await httpRequest(
      { provider: "courtlistener", url: "https://www.courtlistener.com/api/x" },
      { fetch, sleep: async (ms) => void waits.push(ms), random: () => 0.5 },
    );
    expect(r).toEqual({ ok: true });
    expect(n).toBe(3);
    expect(waits[1]).toBe(2000);
  });

  it("does not retry 404, 400 or a non-idempotent POST", async () => {
    let n = 0;
    const { fetch } = fakeFetch([
      ["/missing", () => (n++, { status: 404 })],
      ["/bad", () => (n++, { status: 400 })],
      ["/post", () => (n++, { status: 503 })],
    ]);
    await expect(
      httpRequest(
        {
          provider: "courtlistener",
          url: "https://www.courtlistener.com/missing",
        },
        { fetch, ...noSleep },
      ),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      httpRequest(
        { provider: "courtlistener", url: "https://www.courtlistener.com/bad" },
        { fetch, ...noSleep },
      ),
    ).rejects.toMatchObject({ code: "upstream_error" });
    await expect(
      httpRequest(
        {
          provider: "courtlistener",
          url: "https://www.courtlistener.com/post",
          method: "POST",
        },
        { fetch, ...noSleep },
      ),
    ).rejects.toMatchObject({ code: "upstream_error" });
    expect(n).toBe(3);
  });

  it("maps 401/403 to not_configured and non-JSON bodies to bad_response", async () => {
    const { fetch } = fakeFetch([
      ["/auth", { status: 401 }],
      ["/html", { text: "<html>login</html>" }],
    ]);
    await expect(
      httpRequest(
        {
          provider: "courtlistener",
          url: "https://www.courtlistener.com/auth",
        },
        { fetch, ...noSleep },
      ),
    ).rejects.toMatchObject({ code: "not_configured" });
    await expect(
      httpRequest(
        {
          provider: "courtlistener",
          url: "https://www.courtlistener.com/html",
        },
        { fetch, ...noSleep },
      ),
    ).rejects.toMatchObject({ code: "bad_response" });
  });

  it("times out and gives up after max attempts", async () => {
    let n = 0;
    const hang = ((_u: unknown, init: RequestInit) => {
      n++;
      return new Promise((_r, reject) =>
        init.signal?.addEventListener("abort", () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        ),
      );
    }) as unknown as typeof fetch;
    await expect(
      httpRequest(
        {
          provider: "courtlistener",
          url: "https://www.courtlistener.com/slow",
        },
        { fetch: hang, timeoutMs: 5, maxAttempts: 2, ...noSleep },
      ),
    ).rejects.toThrow(/timed out/);
    expect(n).toBe(2);
  });
});
