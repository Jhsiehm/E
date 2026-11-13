/** JSON and error responses shared by the legal data handlers in api.ts. */
import type { ErrorBody } from "../contracts/api";
import { DATA_MODE_HEADER } from "../runtime/data-mode";
import type { LegalRegistry } from "./registry";
import { ProviderError } from "./types";

export function json(
  registry: LegalRegistry,
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      [DATA_MODE_HEADER]: registry.mode,
      ...extra,
    },
  });
}

export function error(
  registry: LegalRegistry,
  status: number,
  code: string,
  message: string,
  extra: Record<string, string> = {},
  fieldErrors?: Record<string, string[]>,
) {
  const body: ErrorBody = {
    error: {
      code,
      message,
      requestId: crypto.randomUUID(),
      ...(fieldErrors ? { fieldErrors } : {}),
    },
  };
  return json(registry, body, status, extra);
}

export function providerFailure(registry: LegalRegistry, err: unknown) {
  if (err instanceof ProviderError) {
    if (err.code === "not_found")
      return error(registry, 404, "not_found", "No such authority.");
    if (err.code === "rate_limited")
      return error(
        registry,
        429,
        "rate_limited",
        "The legal source is rate limiting requests.",
        {
          "Retry-After": String(Math.ceil((err.retryAfterMs ?? 30_000) / 1000)),
        },
      );
    if (err.code === "not_configured" || err.code === "blocked_host")
      return error(
        registry,
        503,
        "service_not_configured",
        "That legal source is not enabled.",
      );
    return error(
      registry,
      502,
      "provider_error",
      `The legal source failed: ${err.provider}.`,
    );
  }
  return error(registry, 500, "internal_error", "Unexpected error.");
}

export function noProviders(registry: LegalRegistry) {
  return registry.enabled.length
    ? null
    : error(
        registry,
        503,
        "service_not_configured",
        "No legal data source is enabled. See GET /api/v1/legal-data/coverage.",
      );
}

export function list(v: string | null): string[] | undefined {
  const items = v
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items?.length ? items : undefined;
}

export async function readJson(
  req: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json();
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
