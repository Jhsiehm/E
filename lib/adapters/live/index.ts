import type { NextRequest } from "next/server";
import { liveBootstrap } from "./bootstrap";
import { liveContext } from "./context";
import {
  createMatter,
  getMatter,
  listMatters,
  matterStrategy,
  updateMatter,
} from "./matters";
import { fail, notBuilt } from "./respond";

export { notConfigured } from "./respond";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * LIVE ADAPTER. Serves the screens' API from Supabase as the signed-in user,
 * so row-level security decides what they see. Endpoints move here one at a
 * time; anything not connected yet answers 503 instead of sample data.
 */
export async function handleLive(req: NextRequest, path: string[]) {
  const ctx = await liveContext();
  if (ctx instanceof Response) return ctx;
  const method = req.method;
  const [root, id, sub] = path;

  if (root === "bootstrap" && method === "GET") return liveBootstrap(ctx);
  if (root !== "matters") return notBuilt();

  const body =
    method === "POST" || method === "PATCH"
      ? await req.json().catch(() => null)
      : {};
  if (body === null || typeof body !== "object")
    return fail(400, "bad_request", "Send the details as JSON.");

  if (!id) {
    if (method === "GET") return listMatters(ctx, req.nextUrl.searchParams);
    if (method === "POST") return createMatter(ctx, body);
    return fail(405, "bad_request", "Not supported.");
  }
  if (!UUID.test(id)) return fail(404, "not_found", "Matter not found.");
  if (!sub) {
    if (method === "GET") return getMatter(ctx, id);
    if (method === "PATCH") return updateMatter(ctx, id, body);
    return fail(405, "bad_request", "Not supported.");
  }
  if (sub === "strategy" && (method === "GET" || method === "PATCH"))
    return matterStrategy(ctx, id, method, body);
  return notBuilt();
}
