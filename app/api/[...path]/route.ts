import type { NextRequest } from "next/server";
import { handleFixture } from "@/lib/adapters/fixture/prototype-api";
import { handleLive } from "@/lib/adapters/live";
import { resolveDataMode } from "@/lib/runtime/data-mode";
import { isPrototypeSession } from "@/lib/runtime/prototype";

export const dynamic = "force-dynamic";
// Matter chat runs retrieval plus two model calls (a frontier draft that may
// reason for a minute or more, then the support check). See
// lib/adapters/live/chat.ts for the deadline inside this limit.
export const maxDuration = 300;

/** Dispatches the prototype API to the fixture or live adapter. */
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!isPrototypeSession(req.cookies) && resolveDataMode() !== "fixture")
    return handleLive(req, (await params).path);
  return handleFixture(req, (await params).path);
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
