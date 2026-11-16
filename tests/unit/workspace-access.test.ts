import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveContext } from "@/lib/adapters/live/context";
import { supabaseServer } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("CASEVEX_DEPLOYMENT", "demo");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test");
});
afterEach(() => vi.unstubAllEnvs());

function database(
  data: unknown = null,
  error: unknown = null,
  signedIn = true,
) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: async () => ({ data, error }),
  };
  const db = {
    auth: {
      getUser: async () => ({
        data: {
          user: signedIn ? { id: "u1", email: "u@example.invalid" } : null,
        },
      }),
    },
    from: vi.fn(() => query),
  };
  vi.mocked(supabaseServer).mockResolvedValue(db as never);
  return { db, query };
}

describe("workspace access responses", () => {
  it("directs public accounts without membership to finish setup", async () => {
    database();
    const response = (await liveContext()) as Response;
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "workspace_required" },
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps pilot accounts without membership forbidden", async () => {
    vi.stubEnv("CASEVEX_DEPLOYMENT", "pilot");
    database();
    const response = (await liveContext()) as Response;
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "forbidden" },
    });
  });

  it("does not mistake database permission errors for missing setup", async () => {
    database(null, { code: "42501" });
    const response = (await liveContext()) as Response;
    expect(await response.json()).toMatchObject({
      error: { code: "forbidden" },
    });
  });

  it("uses only the authenticated user's active membership", async () => {
    const { query } = database({ workspace_id: "own", role: "viewer" });
    expect(await liveContext()).toMatchObject({
      userId: "u1",
      workspaceId: "own",
      role: "viewer",
    });
    expect(query.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(query.eq).toHaveBeenCalledWith("status", "active");
  });

  it("requires login before checking memberships", async () => {
    const { db } = database(null, null, false);
    expect(((await liveContext()) as Response).status).toBe(401);
    expect(db.from).not.toHaveBeenCalled();
  });
});
