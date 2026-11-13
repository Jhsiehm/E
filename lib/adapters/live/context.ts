import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/account/auth-mode";
import { supabaseServer } from "@/lib/supabase/server";
import { fail, fromDbError, notConfigured } from "./respond";

/** Who is calling and which firm they act in. RLS still checks every row. */
export interface LiveContext {
  db: SupabaseClient;
  userId: string;
  email: string;
  workspaceId: string;
  role: string;
}

/**
 * Builds the request context, or returns the error response to send.
 * The pilot is one firm per person; when someone belongs to several, the
 * oldest active membership is used until a firm switcher exists.
 */
export async function liveContext(): Promise<LiveContext | Response> {
  if (!supabaseConfig()) return notConfigured();
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return fail(401, "unauthenticated", "Sign in to continue.");
  const { data, error } = await db
    .from("memberships")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return fromDbError(error);
  if (!data)
    return fail(
      403,
      "forbidden",
      "Your account is not part of a firm yet. Ask your firm's owner for an invitation.",
    );
  return {
    db,
    userId: user.id,
    email: user.email ?? "",
    workspaceId: data.workspace_id,
    role: data.role,
  };
}
