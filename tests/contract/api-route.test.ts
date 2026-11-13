/**
 * Contract tests for the API dispatcher: fixture vs live adapter, and the
 * error envelope shape from 03_API_CONTRACTS.md.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ERROR_CODES, type ErrorBody } from "@/lib/contracts/api";
import { toApiError } from "@/lib/api/client";

async function call(
  path: string[],
  method = "GET",
  body?: unknown,
  cookie?: string,
) {
  vi.resetModules();
  const route = await import("@/app/api/[...path]/route");
  const req = new NextRequest("http://localhost/api/" + path.join("/"), {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const handler = route[method as "GET" | "POST" | "PATCH" | "DELETE"];
  return handler(req, { params: Promise.resolve({ path }) });
}

function isErrorBody(x: unknown): x is ErrorBody {
  const e = (x as ErrorBody)?.error;
  return (
    !!e &&
    typeof e.code === "string" &&
    typeof e.message === "string" &&
    typeof e.requestId === "string" &&
    /^[0-9a-f-]{36}$/.test(e.requestId)
  );
}

afterEach(() => vi.unstubAllEnvs());

describe("live mode (production build, no opt-in)", () => {
  it.each([
    [["bootstrap"], "GET"],
    [["matters"], "GET"],
    [["matters"], "POST"],
    [["me"], "PATCH"],
    [["matters", "anderson", "chat"], "POST"],
    [["documents", "d1"], "DELETE"],
  ])(
    "%j %s returns 503 service_not_configured, never sample data",
    async (path, method) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CASEVEX_DATA_MODE", "");
      const res = await call(
        path,
        method,
        method === "GET" || method === "DELETE"
          ? undefined
          : { text: "q", name: "n" },
      );
      expect(res.status).toBe(503);
      expect(res.headers.get("x-casevex-data-mode")).toBe("live");
      expect(res.headers.get("set-cookie")).toBeNull();
      const body = await res.json();
      expect(isErrorBody(body)).toBe(true);
      expect(body.error.code).toBe("service_not_configured");
      expect(ERROR_CODES).toContain(body.error.code);
      const text = JSON.stringify(body);
      for (const sample of [
        "Anderson",
        "Meridian",
        "Nexora",
        "matters",
        "notices",
      ])
        expect(text).not.toContain(sample);
    },
  );

  it("is parsed by the client as a non-retryable ApiError", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const err = await toApiError(await call(["bootstrap"]));
    expect(err.code).toBe("service_not_configured");
    expect(err.retryable).toBe(false);
  });

  it("refuses to boot with fixtures on a pilot deployment", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CASEVEX_DATA_MODE", "fixture");
    vi.stubEnv("CASEVEX_DEPLOYMENT", "pilot");
    await expect(call(["bootstrap"])).rejects.toThrow(/forbidden/);
  });
});

describe("fixture mode", () => {
  it("starts a new demo workspace empty", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CASEVEX_DATA_MODE", "");
    const res = await call(["bootstrap"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-casevex-data-mode")).toBe("fixture");
    const body = await res.json();
    expect(body.matters).toHaveLength(0);
    expect(body.documents).toHaveLength(0);
    expect(body.notices).toHaveLength(0);
    expect(body.samples).toBe("off");
  }, 10_000);

  it("serves labelled sample cases only when the person chose them", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CASEVEX_DATA_MODE", "");
    const res = await call(
      ["bootstrap"],
      "GET",
      undefined,
      `casevex-demo=${crypto.randomUUID()}; casevex-samples=on`,
    );
    const body = await res.json();
    expect(body.samples).toBe("on");
    expect(body.matters).toHaveLength(5);
    expect(body.matters.every((m: { sample?: boolean }) => m.sample)).toBe(
      true,
    );
  }, 10_000);

  it("serves sample data in a production build only with explicit opt-in", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CASEVEX_DATA_MODE", "fixture");
    const res = await call(["bootstrap"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-casevex-data-mode")).toBe("fixture");
  }, 10_000);

  it("keeps the legacy string error shape the client understands", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await call(["matters", "does-not-exist"]);
    expect(res.status).toBe(404);
    const err = await toApiError(res);
    expect(err).toMatchObject({
      code: "not_found",
      message: "Matter not found",
    });
  }, 10_000);
});
