import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { GET } from "@/app/demo/route";
import { proxy } from "@/proxy";
import { DEMO_COOKIE, resolveRequestAuthMode } from "@/lib/account/auth-mode";
import { getAccount, encodeDemo, decodeDemo } from "@/lib/account/server";
import { saveProfile, signOut } from "@/lib/account/actions";
import { prototypeProfile } from "@/lib/account/prototype-profile";
import { PROTOTYPE_COOKIE } from "@/lib/runtime/prototype";
import { supabaseServer } from "@/lib/supabase/server";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));

function session() {
  const jar = new Map([
    [PROTOTYPE_COOKIE, "on"],
    [DEMO_COOKIE, encodeDemo(prototypeProfile())],
    ["casevex-demo", crypto.randomUUID()],
    ["casevex-samples", "on"],
    ["sb-real-auth-token", "existing-real-session"],
  ]);
  const store = {
    get: (key: string) => (jar.has(key) ? { value: jar.get(key)! } : undefined),
    set: (key: string, value: string) => jar.set(key, value),
    delete: (key: string) => jar.delete(key),
  };
  vi.mocked(cookies).mockResolvedValue(store as never);
  const request = (path: string) =>
    new NextRequest(`https://casevex.example${path}`, {
      headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
    });
  return { jar, store, request };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CASEVEX_DATA_MODE", "live");
  vi.stubEnv("CASEVEX_DEPLOYMENT", "demo");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  vi.mocked(createServerClient).mockImplementation(() => {
    throw new Error("Unexpected live database access");
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("explicit public demo alongside real accounts", () => {
  it("starts a complete fictional account, rotating state without changing real cookies", async () => {
    const { request, jar } = session();
    const response = await GET(request("/demo"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.cookies.get("casevex-demo")?.value).not.toBe(
      jar.get("casevex-demo"),
    );
    expect(response.cookies.get("casevex-samples")?.value).toBe("on");
    expect(decodeDemo(response.cookies.get(DEMO_COOKIE)?.value)).toEqual(
      prototypeProfile(),
    );
    expect(response.cookies.getAll()).toHaveLength(4);
    for (const cookie of response.cookies.getAll()) {
      expect(cookie).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 86400,
      });
      expect(cookie.name).not.toMatch(/^sb-/);
    }
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("ignores an existing real login for pages and profile saves", async () => {
    const { store, jar, request } = session();
    expect(resolveRequestAuthMode(store)).toBe("demo");
    expect(
      (await proxy(request("/matters"))).headers.get("x-middleware-next"),
    ).toBe("1");
    expect(await getAccount()).toMatchObject({
      mode: "demo",
      prototype: true,
      profile: prototypeProfile(),
    });
    expect(
      (await saveProfile({ ...prototypeProfile(), fullName: "Demo Reviewer" }))
        .ok,
    ).toBe(true);
    expect(decodeDemo(jar.get(DEMO_COOKIE))?.fullName).toBe("Demo Reviewer");
    expect(jar.get("sb-real-auth-token")).toBe("existing-real-session");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("blocks database clients, live research and auth callbacks in demo mode", async () => {
    const { request } = session();
    await expect(supabaseServer()).rejects.toThrow(
      "cannot access the live database",
    );
    for (const path of [
      "/api/v1/legal-research/preview",
      "/api/v1/authorities",
    ]) {
      const response = await proxy(request(path));
      expect(response.status).toBe(503);
      expect(response.headers.get("x-casevex-data-mode")).toBe("fixture");
      expect((await response.json()).error.message).toMatch(/demo/);
    }
    expect(
      (await proxy(request("/auth/callback?code=test"))).headers.get(
        "location",
      ),
    ).toBe("https://casevex.example/");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("leaves the real session intact when exiting the demo", async () => {
    const { jar, store } = session();
    await expect(signOut()).rejects.toThrow("redirect:/sign-in");
    expect([...jar]).toEqual([["sb-real-auth-token", "existing-real-session"]]);
    expect(resolveRequestAuthMode(store)).toBe("supabase");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("disables the entry point and ignores demo cookies on pilot deployments", async () => {
    vi.stubEnv("CASEVEX_DEPLOYMENT", "pilot");
    const { request, store } = session();
    expect((await GET(request("/demo"))).status).toBe(404);
    expect(resolveRequestAuthMode(store)).toBe("supabase");
  });
});
