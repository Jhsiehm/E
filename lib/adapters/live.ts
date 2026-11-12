import { NextResponse } from "next/server";
import type { ErrorBody } from "@/lib/contracts/api";
import { DATA_MODE_HEADER } from "@/lib/runtime/data-mode";

/**
 * LIVE ADAPTER. The production backend (P1+) is not built yet, so every
 * request is answered with an explicit 503 instead of falling back to sample
 * data. Endpoints replace this one by one as they are implemented.
 */
export function handleLive(): NextResponse<ErrorBody> {
  const requestId = crypto.randomUUID();
  const res = NextResponse.json<ErrorBody>(
    {
      error: {
        code: "service_not_configured",
        message:
          "Casevex is not connected to its data service yet. No sample data is shown in live mode.",
        requestId,
      },
    },
    { status: 503 },
  );
  res.headers.set(DATA_MODE_HEADER, "live");
  res.headers.set("Cache-Control", "no-store");
  return res;
}
