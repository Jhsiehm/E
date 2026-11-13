import { NextResponse } from "next/server";
import type { ErrorBody, ErrorCode } from "@/lib/contracts/api";
import { DATA_MODE_HEADER } from "@/lib/runtime/data-mode";

/** Every live response is uncached and labelled live. */
function finish<T>(res: NextResponse<T>) {
  res.headers.set(DATA_MODE_HEADER, "live");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function ok<T>(data: T, status = 200) {
  return finish(NextResponse.json(data, { status }));
}

export function fail(
  status: number,
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
) {
  return finish(
    NextResponse.json<ErrorBody>(
      {
        error: {
          code,
          message,
          requestId: crypto.randomUUID(),
          ...(fieldErrors ? { fieldErrors } : {}),
        },
      },
      { status },
    ),
  );
}

export const notConfigured = () =>
  fail(
    503,
    "service_not_configured",
    "Casevex is not connected to its data service yet. No sample data is shown in live mode.",
  );

export const notBuilt = () =>
  fail(
    503,
    "service_not_configured",
    "This part of Casevex is not connected to real data yet.",
  );

/**
 * Maps a database error to an API error without leaking SQL details.
 * Codes: 42501 permission, 23xxx constraint, 22xxx bad value, PGRST116 none.
 */
export function fromDbError(err: { code?: string; message?: string } | null) {
  const code = err?.code ?? "";
  if (code === "42501")
    return fail(403, "forbidden", "You do not have access to do that.");
  if (code === "PGRST116") return fail(404, "not_found", "Not found.");
  // Raised by our own database functions with a message meant for people.
  if (code === "22023" && err?.message)
    return fail(422, "validation_failed", err.message.slice(0, 200));
  if (code.startsWith("23") || code.startsWith("22"))
    return fail(422, "validation_failed", "Some details are not valid.");
  if (code === "28000")
    return fail(401, "unauthenticated", "Sign in to continue.");
  console.error("live adapter db error", code);
  return fail(503, "service_unavailable", "Please try again in a moment.");
}
