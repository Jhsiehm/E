"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, allowOpenSignup, resolveAuthMode } from "./auth-mode";
import { emptyProfile, sanitizeProfile, toRow, type Profile } from "./profile";
import { DEMO_USER, decodeDemo, encodeDemo, getAccount } from "./server";
import { supabaseServer } from "@/lib/supabase/server";

type Result = { ok: true; profile: Profile } | { ok: false; error: string };

const demoCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

/** Demo mode only: signs in as the demo account (keeps an existing profile). */
export async function demoSignIn(): Promise<void> {
  if (resolveAuthMode() !== "demo") throw new Error("Demo sign-in is disabled");
  const store = await cookies();
  const existing = decodeDemo(store.get(DEMO_COOKIE)?.value);
  const profile = existing ?? emptyProfile(DEMO_USER.email);
  store.set(DEMO_COOKIE, encodeDemo(profile), demoCookie);
  redirect(profile.onboardedAt ? "/" : "/onboarding");
}

export async function signOut(): Promise<void> {
  const mode = resolveAuthMode();
  if (mode === "demo") (await cookies()).delete(DEMO_COOKIE);
  if (mode === "supabase") await (await supabaseServer()).auth.signOut();
  redirect("/sign-in");
}

/**
 * Saves the signed-in person's profile. `finishOnboarding` stamps
 * onboarded_at and, in Supabase mode, creates their firm workspace (as owner)
 * if they don't belong to one yet.
 */
export async function saveProfile(
  input: unknown,
  opts: { finishOnboarding?: boolean } = {},
): Promise<Result> {
  const account = await getAccount();
  if (!account.user)
    return { ok: false, error: "Your session ended. Sign in again." };
  const profile = sanitizeProfile(input, account.user.email);
  profile.email = account.user.email;
  if (opts.finishOnboarding && !profile.onboardedAt)
    profile.onboardedAt = new Date().toISOString();
  if (!opts.finishOnboarding)
    profile.onboardedAt = account.profile?.onboardedAt ?? profile.onboardedAt;

  if (account.mode === "demo") {
    (await cookies()).set(DEMO_COOKIE, encodeDemo(profile), demoCookie);
    return { ok: true, profile };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("profiles")
    .update(toRow(profile))
    .eq("id", account.user.id);
  if (error)
    return { ok: false, error: "We couldn't save your profile. Try again." };
  if (opts.finishOnboarding && profile.firmName && allowOpenSignup()) {
    const { count } = await supabase
      .from("memberships")
      .select("workspace_id", { count: "exact", head: true })
      .eq("user_id", account.user.id);
    if (!count) {
      const { error: wsError } = await supabase.rpc("create_workspace", {
        ws_name: profile.firmName,
      });
      if (wsError)
        return {
          ok: false,
          error:
            "Profile saved, but we couldn't create your firm workspace. Try again.",
        };
    }
  }
  return { ok: true, profile };
}
