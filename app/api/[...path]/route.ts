import type { NextRequest } from "next/server";
import { handleFixture } from "@/lib/adapters/fixture/prototype-api";
import { handleLive } from "@/lib/adapters/live";
import { resolveDataMode } from "@/lib/runtime/data-mode";

export const dynamic = "force-dynamic";

/** Dispatches the prototype API to the fixture or live adapter. */
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (resolveDataMode() !== "fixture")
    return handleLive(req, (await params).path);
  return handleFixture(req, (await params).path);
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
