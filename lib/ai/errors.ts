import { GATEWAY_LABEL, type Gateway } from "./types";

export type AiErrorCode =
  | "not_configured"
  | "budget_exceeded"
  | "rate_limited"
  | "insufficient_credits"
  | "unauthorized"
  | "bad_request"
  | "provider_error"
  | "timeout"
  | "cancelled"
  | "invalid_output";

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/** Maps a failed HTTP response from a gateway to an AiError. */
export async function providerError(
  res: Response,
  gateway: Gateway,
): Promise<AiError> {
  const name = GATEWAY_LABEL[gateway];
  let message = `${name} returned ${res.status}.`;
  try {
    const b = (await res.json()) as { error?: { message?: string } };
    if (b.error?.message) message = `${name}: ${b.error.message}`;
  } catch {
    /* body was not JSON */
  }
  const code: AiErrorCode =
    res.status === 401 || res.status === 403
      ? "unauthorized"
      : res.status === 402
        ? "insufficient_credits"
        : res.status === 429
          ? "rate_limited"
          : res.status === 400
            ? "bad_request"
            : res.status === 408
              ? "timeout"
              : "provider_error";
  return new AiError(code, message, res.status);
}
