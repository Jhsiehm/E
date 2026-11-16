import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  DEMO_COOKIE,
  resolveRequestAuthMode,
  supabaseConfig,
} from "@/lib/account/auth-mode";
import { isPrototypeSession } from "@/lib/runtime/prototype";

/**
 * Runs before every page and API request:
 * - Supabase mode: refreshes the auth session cookie.
 * - Sends signed-out visitors to /sign-in (API requests get a 401 instead).
 * The onboarding check needs the profile row, so it happens in the
 * workspace layout, which loads the profile anyway.
 */
const PUBLIC = ["/sign-in", "/sign-up", "/auth/"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // /demo owns its deployment gate and creates only fictional session data.
  // It must work even if the live authentication provider is unavailable.
  if (pathname === "/demo") return NextResponse.next({ request });
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p));
  const prototype = isPrototypeSession(request.cookies);
  const mode = resolveRequestAuthMode(request.cookies);
  let response = NextResponse.next({ request });
  let signedIn = false;

  // The public walkthrough uses only the fixture adapter. Dedicated v1
  // endpoints can invoke real legal-data/AI providers, so never enter them.
  if (prototype && (pathname === "/api/v1" || pathname.startsWith("/api/v1/")))
    return NextResponse.json(
      {
        error: {
          code: "service_not_configured",
          message:
            "Live research is unavailable in the demo. Explore the sample matters and simulated chat instead.",
          requestId: crypto.randomUUID(),
        },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Casevex-Data-Mode": "fixture",
        },
      },
    );
  if (prototype && pathname.startsWith("/auth/"))
    return NextResponse.redirect(new URL("/", request.url));

  if (mode === "supabase") {
    const cfg = supabaseConfig()!;
    const supabase = createServerClient(cfg.url, cfg.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list)
            response.cookies.set(name, value, options);
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  } else if (mode === "demo") {
    signedIn = Boolean(request.cookies.get(DEMO_COOKIE)?.value);
  }

  if (signedIn || isPublic) return response;
  // With no sign-in configured, API calls reach the live adapter, which
  // answers 503 service_not_configured (or fails closed in a pilot).
  if (mode === "unconfigured" && pathname.startsWith("/api/")) return response;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: {
          code: "unauthenticated",
          message: "Sign in to continue.",
          requestId: crypto.randomUUID(),
        },
      },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search =
    pathname === "/"
      ? ""
      : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
