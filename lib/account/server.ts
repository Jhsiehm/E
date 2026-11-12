import { cookies } from "next/headers";
import { DEMO_COOKIE, resolveAuthMode, type AuthMode } from "./auth-mode";
import { fromRow, sanitizeProfile, type Profile } from "./profile";
import { supabaseServer } from "@/lib/supabase/server";

export type Account = {
  mode: AuthMode;
  user: { id: string; email: string } | null;
  profile: Profile | null;
};

export const DEMO_USER = { id: "demo", email: "demo@casevex.example" };

export function encodeDemo(p: Profile) {
  return Buffer.from(JSON.stringify(p), "utf8").toString("base64url");
}
export function decodeDemo(raw: string | undefined): Profile | null {
  if (!raw) return null;
  try {
    return sanitizeProfile(
      JSON.parse(Buffer.from(raw, "base64url").toString("utf8")),
      DEMO_USER.email,
    );
  } catch {
    return null;
  }
}

/** Who is signed in and their profile, read on the server for this request. */
export async function getAccount(): Promise<Account> {
  // Read cookies first so every caller renders per request, never at build time.
  const store = await cookies();
  const mode = resolveAuthMode();
  if (mode === "demo") {
    const profile = decodeDemo(store.get(DEMO_COOKIE)?.value);
    return { mode, user: profile ? DEMO_USER : null, profile };
  }
  if (mode === "supabase") {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { mode, user: null, profile: null };
    const email = user.email ?? "";
    const { data } = await supabase
      .from("profiles")
      .select(
        "full_name,job_title,firm_name,time_zone,avatar_color,accent,density,ai_experience,persona,practice_areas,primary_area,niches,jurisdictions,layout,onboarded_at",
      )
      .eq("id", user.id)
      .maybeSingle();
    return {
      mode,
      user: { id: user.id, email },
      profile: fromRow(data, email),
    };
  }
  return { mode, user: null, profile: null };
}
