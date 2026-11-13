import { AiError, providerError } from "./errors";
import { GATEWAY_LABEL, type Gateway } from "./types";

/** 529 is Anthropic's "overloaded". */
const RETRYABLE = [408, 429, 500, 502, 503, 504, 529];
const MAX_RETRIES = 2;

export type Post = (
  url: string,
  headers: Record<string, string>,
  body: unknown,
) => Promise<unknown>;

interface PosterOptions {
  key: string;
  gateway: Gateway;
  timeoutMs: number;
  signal?: AbortSignal;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  /** Incremented once per HTTP attempt, retries included. */
  onAttempt: () => void;
}

/** A POST that times out, retries with jitter on retryable statuses, and returns parsed JSON. */
export function createPoster(o: PosterOptions): Post {
  const label = GATEWAY_LABEL[o.gateway];
  return async (url, headers, body) => {
    for (let attempt = 1; ; attempt++) {
      o.onAttempt();
      const timeout = AbortSignal.timeout(o.timeoutMs);
      const signal = o.signal ? AbortSignal.any([o.signal, timeout]) : timeout;
      let res: Response;
      try {
        res = await o.fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(body),
          signal,
        });
      } catch (err) {
        if (o.signal?.aborted)
          throw new AiError("cancelled", `${o.key} was cancelled.`);
        const isTimeout = timeout.aborted;
        if (attempt <= MAX_RETRIES) {
          await o.sleep(backoff(attempt, o.random));
          continue;
        }
        throw new AiError(
          isTimeout ? "timeout" : "provider_error",
          isTimeout
            ? `${o.key} timed out after ${o.timeoutMs}ms.`
            : `Could not reach ${label}: ${(err as Error).message}`,
        );
      }
      if (!res.ok) {
        if (RETRYABLE.includes(res.status) && attempt <= MAX_RETRIES) {
          const ra = Number(res.headers.get("retry-after"));
          await o.sleep(
            Number.isFinite(ra) && ra > 0
              ? Math.min(ra * 1000, 10_000)
              : backoff(attempt, o.random),
          );
          continue;
        }
        throw await providerError(res, o.gateway);
      }
      try {
        return await res.json();
      } catch {
        if (attempt <= MAX_RETRIES) {
          await o.sleep(backoff(attempt, o.random));
          continue;
        }
        throw new AiError(
          "provider_error",
          `${label} returned a response that is not JSON.`,
          res.status,
        );
      }
    }
  };
}

function backoff(attempt: number, random: () => number) {
  const base = 500 * 2 ** (attempt - 1);
  return base + Math.floor(random() * base);
}
