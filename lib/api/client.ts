/**
 * Typed browser/server fetch client for the Casevex API.
 *
 * - Parses both the v1 error envelope `{error:{code,message,requestId}}` and the
 *   prototype's legacy `{error:"message"}` into one ApiError.
 * - Never trusts a non-JSON body (e.g. an HTML sign-in page from a proxy): it
 *   becomes `unexpected_response`, not data.
 * - Retries only when it is safe: GET/HEAD/OPTIONS, or any request carrying an
 *   Idempotency-Key; on network failure, 429, 502 and retryable 503. Honors
 *   Retry-After. `service_not_configured` is never retried.
 * - Follows opaque `nextCursor` pagination (03 list wrapper).
 * - Does not log request or response bodies (they may hold client content).
 */
import {
  SAFE_METHODS,
  STATUS_CODES,
  type ErrorCode,
  type ListResponse,
} from "@/lib/contracts/api";

export type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  /** Sent as Idempotency-Key; also makes an unsafe method retryable. */
  idempotencyKey?: string;
  /** Sent as If-Match: "<version>" for optimistic concurrency. */
  ifMatch?: string | number;
  signal?: AbortSignal;
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Extra attempts after the first one, for retryable failures. */
  retries?: number;
  /** Base for exponential backoff when no Retry-After is given. */
  retryDelayMs?: number;
  /** Upper bound on any single wait, including Retry-After. */
  maxRetryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Called once per 401 before the error is thrown (e.g. redirect to sign-in). */
  onUnauthenticated?: (error: ApiError) => void;
  /** Sent as X-Workspace-Id; the server verifies it against membership. */
  workspaceId?: () => string | undefined;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | string;
  readonly requestId?: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly retryAfterMs?: number;
  constructor(init: {
    status: number;
    code: ErrorCode | string;
    message: string;
    requestId?: string;
    fieldErrors?: Record<string, string[]>;
    retryAfterMs?: number;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.requestId = init.requestId;
    this.fieldErrors = init.fieldErrors;
    this.retryAfterMs = init.retryAfterMs;
  }
  get retryable(): boolean {
    if (this.code === "service_not_configured") return false;
    return (
      this.code === "network_error" ||
      this.status === 429 ||
      this.status === 502 ||
      this.status === 503
    );
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

const FALLBACK_MESSAGE = "Something went wrong";

/** Parses Retry-After (delta-seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

function isJson(res: Response) {
  return /\bapplication\/([\w.+-]*\+)?json\b/i.test(
    res.headers.get("content-type") || "",
  );
}

/** Turns any non-2xx response into an ApiError without trusting its body. */
export async function toApiError(res: Response): Promise<ApiError> {
  const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"));
  const base = {
    status: res.status,
    code:
      STATUS_CODES[res.status] ??
      (res.status >= 500 ? "service_unavailable" : "bad_request"),
    message: FALLBACK_MESSAGE,
    retryAfterMs,
  };
  if (!isJson(res)) return new ApiError({ ...base, code: base.code });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return new ApiError({ ...base, code: "unexpected_response" });
  }
  const err = (body as { error?: unknown } | null)?.error;
  if (typeof err === "string" && err)
    return new ApiError({ ...base, message: err });
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    return new ApiError({
      ...base,
      code: typeof e.code === "string" && e.code ? e.code : base.code,
      message:
        typeof e.message === "string" && e.message
          ? e.message
          : FALLBACK_MESSAGE,
      requestId: typeof e.requestId === "string" ? e.requestId : undefined,
      fieldErrors:
        e.fieldErrors && typeof e.fieldErrors === "object"
          ? (e.fieldErrors as Record<string, string[]>)
          : undefined,
    });
  }
  return new ApiError(base);
}

function buildUrl(baseUrl: string, path: string, query?: Query) {
  const url = baseUrl.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query))
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? url + (url.includes("?") ? "&" : "?") + s : url;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const {
    baseUrl = "/api",
    retries = 2,
    retryDelayMs = 250,
    maxRetryDelayMs = 10_000,
    sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    onUnauthenticated,
    workspaceId,
  } = options;
  const doFetch =
    options.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));

  async function request<T>(
    method: Method,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...opts.headers,
    };
    let body: BodyInit | undefined;
    if (opts.body !== undefined && method !== "GET" && method !== "DELETE") {
      if (opts.body instanceof FormData) body = opts.body;
      else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(opts.body);
      }
    }
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
    if (opts.ifMatch !== undefined) headers["If-Match"] = `"${opts.ifMatch}"`;
    const ws = workspaceId?.();
    if (ws) headers["X-Workspace-Id"] = ws;

    const canRetry =
      (SAFE_METHODS as readonly string[]).includes(method) ||
      !!opts.idempotencyKey;
    const url = buildUrl(baseUrl, path, opts.query);

    for (let attempt = 0; ; attempt++) {
      let error: ApiError;
      try {
        const res = await doFetch(url, {
          method,
          headers,
          body,
          signal: opts.signal,
          credentials: "same-origin",
        });
        if (res.ok) {
          if (res.status === 204) return undefined as T;
          if (!isJson(res))
            throw new ApiError({
              status: res.status,
              code: "unexpected_response",
              message: FALLBACK_MESSAGE,
            });
          try {
            return (await res.json()) as T;
          } catch {
            throw new ApiError({
              status: res.status,
              code: "unexpected_response",
              message: FALLBACK_MESSAGE,
            });
          }
        }
        error = await toApiError(res);
        if (error.status === 401) {
          onUnauthenticated?.(error);
          throw error;
        }
      } catch (e) {
        if (e instanceof ApiError) {
          if (e.code === "unexpected_response" || e.status === 401) throw e;
          error = e;
        } else if ((e as { name?: string })?.name === "AbortError") throw e;
        else
          error = new ApiError({
            status: 0,
            code: "network_error",
            message: "Network error. Please try again.",
          });
      }
      if (!canRetry || !error.retryable || attempt >= retries) throw error;
      const backoff = error.retryAfterMs ?? retryDelayMs * 2 ** attempt;
      await sleep(Math.min(backoff, maxRetryDelayMs));
    }
  }

  /** Iterates every item of a cursor-paginated list endpoint. */
  async function* paginate<T>(
    path: string,
    query: Query = {},
    opts: Omit<RequestOptions, "query" | "body"> = {},
  ): AsyncGenerator<T, void, undefined> {
    let cursor: string | null | undefined;
    const seen = new Set<string>();
    do {
      const page = await request<ListResponse<T>>("GET", path, {
        ...opts,
        query: { ...query, cursor: cursor ?? undefined },
      });
      for (const item of page.items) yield item;
      cursor = page.nextCursor;
      if (cursor) {
        if (seen.has(cursor))
          throw new ApiError({
            status: 0,
            code: "invalid_cursor",
            message: "The server returned a repeated page cursor.",
          });
        seen.add(cursor);
      }
    } while (cursor);
  }

  return {
    request,
    paginate,
    get: <T>(path: string, opts?: RequestOptions) =>
      request<T>("GET", path, opts),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>("POST", path, { ...opts, body }),
    patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>("PATCH", path, { ...opts, body }),
    put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>("PUT", path, { ...opts, body }),
    delete: <T>(path: string, opts?: RequestOptions) =>
      request<T>("DELETE", path, opts),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Default client for the prototype API mounted at /api. */
export const api = createApiClient();
