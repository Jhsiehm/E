"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, resolveRequestAuthMode } from "./auth-mode";
import { PROTOTYPE_COOKIE } from "@/lib/runtime/prototype";
import { emptyProfile, sanitizeProfile, toRow, type Profile } from "./profile";
import { DEMO_USER, decodeDemo, encodeDemo, getAccount } from "./server";
import { supabaseServer } from "@/lib/supabase/server";
import { ensureOnboardingWorkspace } from "./workspace";

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
  const store = await cookies();
  if (resolveRequestAuthMode(store) !== "demo")
    throw new Error("Demo sign-in is disabled");
  const existing = decodeDemo(store.get(DEMO_COOKIE)?.value);
  const profile = existing ?? emptyProfile(DEMO_USER.email);
  store.set(DEMO_COOKIE, encodeDemo(profile), demoCookie);
  redirect(profile.onboardedAt ? "/" : "/onboarding");
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const mode = resolveRequestAuthMode(store);
  if (mode === "demo") {
    for (const name of [
      DEMO_COOKIE,
      PROTOTYPE_COOKIE,
      "casevex-demo",
      "casevex-samples",
    ])
      store.delete(name);
  }
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
  // Completion is server-owned; a normal profile edit cannot skip setup.
  profile.onboardedAt = account.profile?.onboardedAt ?? null;
  if (opts.finishOnboarding) {
    if (!profile.fullName)
      return { ok: false, error: "Enter your full name to finish setup." };
    profile.onboardedAt ??= new Date().toISOString();
  }

  if (account.mode === "demo") {
    (await cookies()).set(DEMO_COOKIE, encodeDemo(profile), demoCookie);
    return { ok: true, profile };
  }
  const supabase = await supabaseServer();
  if (opts.finishOnboarding) {
    const error = await ensureOnboardingWorkspace(
      supabase,
      account.user.id,
      profile,
    );
    if (error) return { ok: false, error };
  }
  // Only persist completion after workspace creation succeeds. A failed save
  // can be retried safely: the membership check reuses the existing workspace.
  const { data, error } = await supabase
    .from("profiles")
    .update(toRow(profile))
    .eq("id", account.user.id)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return { ok: false, error: "We couldn't save your profile. Try again." };
  return { ok: true, profile };
}
