import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE } from "@/lib/account/auth-mode";
import { encodeDemo } from "@/lib/account/server";
import { prototypeProfile } from "@/lib/account/prototype-profile";
import { allowPrototype, PROTOTYPE_COOKIE } from "@/lib/runtime/prototype";

/** A shareable link: fresh, populated sample workspace, without signing up. */
export async function GET(request: NextRequest) {
  if (!allowPrototype()) return new NextResponse("Not found", { status: 404 });
  // Stay on the incoming browser origin, including custom domains and local
  // aliases: the server's internal request URL can use a different hostname.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/", "Cache-Control": "no-store" },
  });
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 86400,
  };
  response.cookies.set(PROTOTYPE_COOKIE, "on", options);
  response.cookies.set(DEMO_COOKIE, encodeDemo(prototypeProfile()), options);
  // Never reuse a real/demo visitor's state. Reopening /demo starts over.
  response.cookies.set("casevex-demo", crypto.randomUUID(), options);
  response.cookies.set("casevex-samples", "on", options);
  return response;
}
