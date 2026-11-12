/**
 * The only way the legal data layer reaches the internet.
 *
 * - Host allowlist: a request to any host not listed here is refused before
 *   it leaves the process (05: "All internet requests go through allowlisted
 *   adapters").
 * - Timeout per attempt, at most 5 attempts, exponential backoff with full
 *   jitter, honors Retry-After. Retries only idempotent reads and only on
 *   network errors, 429 and 5xx.
 * - Never logs URLs with credentials, request bodies or response bodies.
 */
import { ProviderError, type ProviderId } from "./types";

export const ALLOWED_HOSTS: Readonly<Record<string, ProviderId>> = {
  "www.courtlistener.com": "courtlistener",
  "legislation.nysenate.gov": "ny_legislation",
  "api.govinfo.gov": "govinfo",
  "www.govinfo.gov": "govinfo",
};

export const USER_AGENT = "Casevex-LegalData/0.1 (+legal research client)";

export interface HttpOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Total attempts including the first. Capped at 5. */
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export interface HttpRequest {
  provider: ProviderId;
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  /** Form or JSON body. POST is retried only when `idempotent` is true. */
  body?: string;
  idempotent?: boolean;
  accept?: "json" | "text";
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

export function assertAllowed(provider: ProviderId, rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || ALLOWED_HOSTS[url.hostname] !== provider)
    throw new ProviderError(
      provider,
      "blocked_host",
      `Host ${url.hostname} is not an allowlisted ${provider} host.`,
    );
  return url;
}

export async function httpRequest<T = unknown>(
  req: HttpRequest,
  opts: HttpOptions = {},
): Promise<T> {
  const url = assertAllowed(req.provider, req.url);
  const doFetch = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const random = opts.random ?? Math.random;
  const attempts = Math.min(Math.max(opts.maxAttempts ?? 4, 1), 5);
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const base = opts.baseDelayMs ?? 400;
  const cap = opts.maxDelayMs ?? 8_000;
  const method = req.method ?? "GET";
  const retryable = method === "GET" || req.idempotent === true;
  const label = `${req.provider} ${method} ${url.pathname}`;

  let lastError: ProviderError | undefined;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let wait: number | undefined;
    let fatal = false;
    try {
      const res = await doFetch(url, {
        method,
        body: req.body,
        signal: ctl.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept:
            req.accept === "text" ? "text/html,text/plain" : "application/json",
          ...req.headers,
        },
      });
      if (res.ok) {
        if (req.accept === "text") return (await res.text()) as T;
        const type = res.headers.get("content-type") ?? "";
        if (!type.includes("json"))
          throw new ProviderError(
            req.provider,
            "bad_response",
            `${label} returned ${type || "no content type"}, expected JSON.`,
          );
        return (await res.json()) as T;
      }
      if (res.status === 404)
        throw new ProviderError(req.provider, "not_found", `${label}: 404`);
      if (res.status === 401 || res.status === 403)
        throw new ProviderError(
          req.provider,
          "not_configured",
          `${label}: ${res.status} (credentials missing or not permitted)`,
        );
      const ra = retryAfterMs(res.headers.get("retry-after"));
      lastError =
        res.status === 429
          ? new ProviderError(req.provider, "rate_limited", `${label}: 429`, ra)
          : new ProviderError(
              req.provider,
              "upstream_error",
              `${label}: ${res.status}`,
              ra,
            );
      if (res.status !== 429 && res.status < 500) fatal = true;
      wait = ra;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (ctl.signal.aborted || err instanceof TypeError || isAbort(err))
        lastError = new ProviderError(
          req.provider,
          "upstream_error",
          `${label}: ${ctl.signal.aborted ? `timed out after ${timeoutMs}ms` : "network error"}`,
        );
      else
        throw new ProviderError(
          req.provider,
          "bad_response",
          `${label}: response could not be parsed.`,
        );
    } finally {
      clearTimeout(timer);
    }
    if (fatal || !retryable || attempt === attempts) break;
    const backoff = random() * Math.min(cap, base * 2 ** (attempt - 1));
    await sleep(Math.min(cap, wait ?? backoff));
  }
  throw lastError!;
}

export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
