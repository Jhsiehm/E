import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveProfile } from "@/lib/account/actions";
import { emptyProfile } from "@/lib/account/profile";
import { getAccount } from "@/lib/account/server";
import { supabaseServer } from "@/lib/supabase/server";

vi.mock("@/lib/account/server", () => ({ getAccount: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));

const user = { id: "new-user", email: "new@example.invalid" };
const profile = { ...emptyProfile(user.email), fullName: "Ana Ruiz" };

function database() {
  const calls: string[] = [];
  const membership = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const saved = {
    update: vi.fn().mockImplementation(() => {
      calls.push("save-profile");
      return saved;
    }),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: { id: user.id }, error: null }),
  };
  const db = {
    from: vi.fn((table: string) =>
      table === "memberships" ? membership : saved,
    ),
    rpc: vi.fn().mockImplementation(async () => {
      calls.push("create-workspace");
      return { data: "new-private-workspace", error: null };
    }),
  };
  vi.mocked(supabaseServer).mockResolvedValue(db as never);
  return { db, membership, saved, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CASEVEX_DEPLOYMENT", "demo");
  vi.mocked(getAccount).mockResolvedValue({ mode: "supabase", user, profile });
});
afterEach(() => vi.unstubAllEnvs());

describe("public signup workspace setup", () => {
  it("creates a private workspace without a firm name before completing setup", async () => {
    const { db, saved, calls, membership } = database();
    const result = await saveProfile(profile, { finishOnboarding: true });
    expect(result.ok).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith("create_workspace", {
      ws_name: "Ana Ruiz's workspace",
    });
    expect(membership.eq).toHaveBeenCalledWith("user_id", user.id);
    expect(membership.eq).toHaveBeenCalledWith("status", "active");
    expect(saved.eq).toHaveBeenCalledWith("id", user.id);
    expect(calls).toEqual(["create-workspace", "save-profile"]);
    expect(saved.update.mock.calls[0][0].onboarded_at).toBeTruthy();
  });

  it("uses a supplied firm name only to name a NEW workspace", async () => {
    const { db } = database();
    await saveProfile(
      { ...profile, firmName: "Someone else's firm" },
      {
        finishOnboarding: true,
      },
    );
    expect(db.rpc).toHaveBeenCalledWith("create_workspace", {
      ws_name: "Someone else's firm",
    });
    expect(db.from.mock.calls.map(([table]) => table)).toEqual([
      "memberships",
      "profiles",
    ]);
  });

  it("reuses an existing active membership", async () => {
    const { db, membership } = database();
    membership.maybeSingle.mockResolvedValue({
      data: { workspace_id: "existing" },
      error: null,
    });
    expect((await saveProfile(profile, { finishOnboarding: true })).ok).toBe(
      true,
    );
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("repairs accounts marked onboarded before a workspace existed", async () => {
    const completed = { ...profile, onboardedAt: "2026-11-12T00:00:00.000Z" };
    vi.mocked(getAccount).mockResolvedValue({
      mode: "supabase",
      user,
      profile: completed,
    });
    const { db } = database();
    const result = await saveProfile(completed, { finishOnboarding: true });
    expect(result).toEqual({ ok: true, profile: completed });
    expect(db.rpc).toHaveBeenCalledOnce();
  });

  it("does not mark setup complete if the membership query fails", async () => {
    const { db, membership, saved } = database();
    membership.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "42501" },
    });
    expect((await saveProfile(profile, { finishOnboarding: true })).ok).toBe(
      false,
    );
    expect(db.rpc).not.toHaveBeenCalled();
    expect(saved.update).not.toHaveBeenCalled();
  });

  it("does not mark setup complete if workspace creation fails", async () => {
    const { db, saved } = database();
    db.rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    expect((await saveProfile(profile, { finishOnboarding: true })).ok).toBe(
      false,
    );
    expect(saved.update).not.toHaveBeenCalled();
  });

  it("can retry after a concurrent request created the workspace", async () => {
    const { db, membership } = database();
    db.rpc.mockResolvedValue({ data: null, error: { code: "23505" } });
    membership.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { workspace_id: "created" },
        error: null,
      });
    expect((await saveProfile(profile, { finishOnboarding: true })).ok).toBe(
      true,
    );
  });

  it("does not treat a missing profile row as a successful save", async () => {
    const { saved } = database();
    saved.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await saveProfile(profile, { finishOnboarding: true })).ok).toBe(
      false,
    );
  });

  it("preserves invite-only pilot restrictions", async () => {
    vi.stubEnv("CASEVEX_DEPLOYMENT", "pilot");
    const { db, saved } = database();
    const result = await saveProfile(profile, { finishOnboarding: true });
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining("invitation"),
    });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(saved.update).not.toHaveBeenCalled();
  });

  it("does not let a profile edit forge completion or create a workspace", async () => {
    const { db, saved } = database();
    await saveProfile({
      ...profile,
      onboardedAt: "2020-01-01",
      email: "other@example.invalid",
    });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(saved.update.mock.calls[0][0].onboarded_at).toBeNull();
    expect(saved.eq).toHaveBeenCalledWith("id", user.id);
  });

  it("rejects signed-out setup before touching the database", async () => {
    vi.mocked(getAccount).mockResolvedValue({
      mode: "supabase",
      user: null,
      profile: null,
    });
    expect((await saveProfile(profile, { finishOnboarding: true })).ok).toBe(
      false,
    );
    expect(supabaseServer).not.toHaveBeenCalled();
  });
});
