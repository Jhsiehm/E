import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { resolveAuthMode } from "@/lib/account/auth-mode";
import { safeNext } from "@/lib/account/safe-next";

/** Finishes email links (confirm sign-up, magic link) and OAuth sign-in. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"), url.origin);
  const fail = new URL("/sign-in?error=link", url.origin);
  if (resolveAuthMode() !== "supabase") return NextResponse.redirect(fail);
  const supabase = await supabaseServer();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };
  if (error) return NextResponse.redirect(fail);
  return NextResponse.redirect(new URL(next, url.origin));
}
