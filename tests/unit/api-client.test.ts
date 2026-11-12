import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createApiClient,
  parseRetryAfter,
  toApiError,
} from "@/lib/api/client";

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

function setup(responses: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      const next = responses.shift();
      if (!next) throw new Error("no more responses");
      if (next instanceof Error) throw next;
      return next;
    },
  );
  const sleeps: number[] = [];
  const client = createApiClient({
    baseUrl: "https://app.example.invalid/api",
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep: async (ms) => void sleeps.push(ms),
  });
  return { client, calls, sleeps, fetch };
}

describe("requests", () => {
  it("builds URLs, drops empty query values and sends JSON", async () => {
    const { client, calls } = setup([json({ id: "m1" }, 201)]);
    const res = await client.post<{ id: string }>(
      "/matters",
      { name: "A" },
      {
        query: { q: "x y", empty: "", none: undefined, n: 2 },
        idempotencyKey: "k1",
        ifMatch: 3,
      },
    );
    expect(res).toEqual({ id: "m1" });
    expect(calls[0].url).toBe(
      "https://app.example.invalid/api/matters?q=x+y&n=2",
    );
    const h = calls[0].init.headers as Record<string, string>;
    expect(calls[0].init.method).toBe("POST");
    expect(h["Content-Type"]).toBe("application/json");
    expect(h["Idempotency-Key"]).toBe("k1");
    expect(h["If-Match"]).toBe('"3"');
    expect(calls[0].init.body).toBe(JSON.stringify({ name: "A" }));
  });

  it("passes FormData through without a JSON content type", async () => {
    const { client, calls } = setup([json({ ok: true })]);
    const fd = new FormData();
    fd.set("file", "x");
    await client.post("documents", fd);
    expect(calls[0].init.body).toBe(fd);
    expect(
      (calls[0].init.headers as Record<string, string>)["Content-Type"],
    ).toBeUndefined();
  });

  it("never sends a body with DELETE", async () => {
    const { client, calls } = setup([new Response(null, { status: 204 })]);
    expect(
      await client.request("DELETE", "documents/d1", { body: { x: 1 } }),
    ).toBeUndefined();
    expect(calls[0].init.body).toBeUndefined();
  });

  it("sends the workspace header when one is selected", async () => {
    const fetch = vi.fn(async () => json({}));
    const client = createApiClient({
      fetch: fetch as unknown as typeof globalThis.fetch,
      workspaceId: () => "ws-1",
    });
    await client.get("me");
    const init = (fetch.mock.calls[0] as unknown[])[1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-Workspace-Id"]).toBe(
      "ws-1",
    );
  });
});

describe("error parsing", () => {
  it("reads the v1 error envelope", async () => {
    const e = await toApiError(
      json(
        {
          error: {
            code: "validation_failed",
            message: "Name is required",
            requestId: "r1",
            fieldErrors: { name: ["required"] },
          },
        },
        422,
      ),
    );
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({
      status: 422,
      code: "validation_failed",
      message: "Name is required",
      requestId: "r1",
      fieldErrors: { name: ["required"] },
    });
  });

  it("reads the prototype's legacy string error", async () => {
    const e = await toApiError(json({ error: "Matter not found" }, 404));
    expect(e).toMatchObject({ code: "not_found", message: "Matter not found" });
  });

  it("does not trust HTML or malformed bodies", async () => {
    const html = await toApiError(
      new Response("<html>sign in</html>", {
        status: 403,
        headers: { "content-type": "text/html" },
      }),
    );
    expect(html).toMatchObject({
      code: "forbidden",
      message: "Something went wrong",
    });
    const broken = await toApiError(
      new Response("{nope", {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    expect(broken.code).toBe("unexpected_response");
  });

  it("rejects a 200 that is not JSON (e.g. a proxy login page)", async () => {
    const { client } = setup([
      new Response("<html/>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    ]);
    await expect(client.get("bootstrap")).rejects.toMatchObject({
      code: "unexpected_response",
    });
  });

  it("parses Retry-After seconds and dates", () => {
    expect(parseRetryAfter("3")).toBe(3000);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("soon")).toBeUndefined();
    const now = Date.parse("2026-11-11T00:00:00Z");
    expect(parseRetryAfter("Wed, 11 Nov 2026 00:00:05 GMT", now)).toBe(5000);
  });
});

describe("retries", () => {
  it("retries safe requests on 503 and network errors with backoff", async () => {
    const { client, calls, sleeps } = setup([
      json(
        {
          error: { code: "service_unavailable", message: "x", requestId: "r" },
        },
        503,
      ),
      new TypeError("Failed to fetch"),
      json({ ok: 1 }),
    ]);
    expect(await client.get("bootstrap")).toEqual({ ok: 1 });
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([250, 500]);
  });

  it("honors Retry-After, capped", async () => {
    const { client, sleeps } = setup([
      json({ error: "slow down" }, 429, { "retry-after": "2" }),
      json({ error: "slow down" }, 429, { "retry-after": "999" }),
      json({ ok: 1 }),
    ]);
    await client.get("x");
    expect(sleeps).toEqual([2000, 10_000]);
  });

  it("does not retry an unsafe request without an Idempotency-Key", async () => {
    const { client, calls } = setup([json({ error: "busy" }, 503)]);
    await expect(client.post("matters", { a: 1 })).rejects.toMatchObject({
      status: 503,
      message: "busy",
    });
    expect(calls).toHaveLength(1);
  });

  it("retries an unsafe request that carries an Idempotency-Key", async () => {
    const { client, calls } = setup([
      json({ error: "busy" }, 502),
      json({ runId: "r" }, 202),
    ]);
    expect(
      await client.post("research-runs", {}, { idempotencyKey: "k" }),
    ).toEqual({ runId: "r" });
    expect(calls).toHaveLength(2);
  });

  it("never retries service_not_configured, client errors or 401", async () => {
    const onUnauthenticated = vi.fn();
    for (const res of [
      json(
        {
          error: {
            code: "service_not_configured",
            message: "m",
            requestId: "r",
          },
        },
        503,
      ),
      json({ error: "bad" }, 400),
      json(
        {
          error: {
            code: "unauthenticated",
            message: "Sign in",
            requestId: "r",
          },
        },
        401,
      ),
    ]) {
      const fetch = vi.fn(async () => res);
      const client = createApiClient({
        fetch: fetch as unknown as typeof globalThis.fetch,
        sleep: async () => {},
        onUnauthenticated,
      });
      await expect(client.get("me")).rejects.toBeInstanceOf(ApiError);
      expect(fetch).toHaveBeenCalledTimes(1);
    }
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("gives up after the configured attempts with a safe network message", async () => {
    const { client, calls } = setup([
      new TypeError("x"),
      new TypeError("x"),
      new TypeError("x"),
    ]);
    await expect(client.get("me")).rejects.toMatchObject({
      code: "network_error",
      message: "Network error. Please try again.",
    });
    expect(calls).toHaveLength(3);
  });

  it("does not retry an aborted request", async () => {
    const abort = new DOMException("aborted", "AbortError");
    const { client, calls } = setup([abort]);
    await expect(client.get("me")).rejects.toBe(abort);
    expect(calls).toHaveLength(1);
  });
});

describe("pagination", () => {
  it("follows nextCursor until it is null", async () => {
    const { client, calls } = setup([
      json({ items: [1, 2], nextCursor: "c1", totalEstimate: null }),
      json({ items: [3], nextCursor: null, totalEstimate: null }),
    ]);
    const out: number[] = [];
    for await (const n of client.paginate<number>("matters", { limit: 2 }))
      out.push(n);
    expect(out).toEqual([1, 2, 3]);
    expect(calls[0].url).toMatch(/matters\?limit=2$/);
    expect(calls[1].url).toMatch(/matters\?limit=2&cursor=c1$/);
  });

  it("stops on a repeated cursor instead of looping forever", async () => {
    const { client } = setup([
      json({ items: [1], nextCursor: "c1", totalEstimate: null }),
      json({ items: [2], nextCursor: "c1", totalEstimate: null }),
    ]);
    const out: number[] = [];
    await expect(async () => {
      for await (const n of client.paginate<number>("x")) out.push(n);
    }).rejects.toMatchObject({ code: "invalid_cursor" });
    expect(out).toEqual([1, 2]);
  });
});
