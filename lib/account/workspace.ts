import type { SupabaseClient } from "@supabase/supabase-js";
import { allowOpenSignup } from "./auth-mode";
import type { Profile } from "./profile";

/** Called only after authenticating the person finishing onboarding. */
export async function ensureOnboardingWorkspace(
  db: SupabaseClient,
  userId: string,
  profile: Profile,
): Promise<string | null> {
  const membership = () =>
    db
      .from("memberships")
      .select("workspace_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
  const { data, error } = await membership();
  if (error) return "We couldn't check your workspace. Please try again.";
  if (data) return null;
  if (!allowOpenSignup())
    return "Your account needs a workspace invitation. Contact your firm administrator.";

  // A firm name is optional, including for students and independent users.
  // The RPC creates a NEW workspace owned by auth.uid(); it never joins a firm
  // by its name or by a client-supplied user/workspace id.
  const name =
    profile.firmName ||
    (profile.fullName ? `${profile.fullName}'s workspace` : "My workspace");
  const { error: createError } = await db.rpc("create_workspace", {
    ws_name: name.slice(0, 120),
  });
  if (createError) {
    // Another onboarding submission may already have finished for this user.
    const existing = await membership();
    if (!existing.error && existing.data) return null;
    return "We couldn't create your workspace. Please try again.";
  }
  return null;
}
