import { resolveDataMode, resolveDeployment } from "@/lib/runtime/data-mode";
import { isPrototypeSession, type CookieReader } from "@/lib/runtime/prototype";

/**
 * How people sign in:
 * - "supabase": Supabase Auth, whenever its URL and publishable key are set.
 * - "demo": a fictional account kept in a cookie. The default without Supabase
 *   keys in fixture mode; also selected per request by an explicit /demo session.
 *   A pilot deployment never allows it.
 * - "unconfigured": neither; sign-in is unavailable and says so.
 */
export type AuthMode = "supabase" | "demo" | "unconfigured";

type Env = Partial<
  Record<
    | "NODE_ENV"
    | "CASEVEX_DATA_MODE"
    | "CASEVEX_DEPLOYMENT"
    | "NEXT_PUBLIC_SUPABASE_URL"
    | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    string
  >
>;

export function supabaseConfig(env: Env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

export function resolveAuthMode(env: Env = process.env): AuthMode {
  if (supabaseConfig(env)) return "supabase";
  if (resolveDeployment(env) === "pilot") return "unconfigured";
  return resolveDataMode(env) === "fixture" ? "demo" : "unconfigured";
}

export const DEMO_COOKIE = "cvx_demo";

/** Explicit demo sessions take precedence over any existing real session. */
export function resolveRequestAuthMode(store: CookieReader): AuthMode {
  return isPrototypeSession(store) ? "demo" : resolveAuthMode();
}

/**
 * Pilot workspaces are invite-only (docs/decisions/0007-invite-only-pilot.md):
 * open sign-up and self-serve firm creation exist only outside pilot.
 */
export function allowOpenSignup(env: Env = process.env): boolean {
  return resolveDeployment(env) !== "pilot";
}
