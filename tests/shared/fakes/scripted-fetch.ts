// A scripted stand-in for global fetch, for testing model routing (OpenRouter)
// and legal source adapters without network. Each request is matched to a
// route; each route plays a queue of steps (ok, http error, timeout, garbage).
// Every call is recorded so tests can assert fallback order, retries, headers
// and that nothing confidential leaks into a request it should not.

export type Step =
  | {
      kind: "json";
      status?: number;
      body: unknown;
      headers?: Record<string, string>;
    }
  | {
      kind: "http";
      status: number;
      body?: string;
      headers?: Record<string, string>;
    }
  | { kind: "timeout" }
  | { kind: "network" }
  | { kind: "malformed"; status?: number }
  /** Decide the step from the parsed request body (e.g. simulate OpenRouter). */
  | {
      kind: "dynamic";
      respond: (body: unknown, url: URL) => Exclude<Step, { kind: "dynamic" }>;
    };

export interface Route {
  name: string;
  match: (url: URL, init: RequestInit, body: unknown) => boolean;
  /** Steps are consumed in order; the last one repeats forever. */
  steps: Step[];
}

export interface RecordedCall {
  route: string | null;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  step: Exclude<Step["kind"], "dynamic"> | "unmatched";
  at: number;
}

export function scriptedFetch(routes: Route[]) {
  const calls: RecordedCall[] = [];
  const cursors = new Map<string, number>();

  const fetchImpl = async (
    input: string | URL | Request,
    init: RequestInit = {},
  ): Promise<Response> => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => (headers[k] = v));
    let body: unknown = init.body;
    if (typeof init.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const route = routes.find((r) => r.match(url, init, body)) ?? null;
    const record: RecordedCall = {
      route: route?.name ?? null,
      url: url.href,
      method: (init.method ?? "GET").toUpperCase(),
      headers,
      body,
      step: "unmatched",
      at: Date.now(),
    };
    calls.push(record);
    if (!route) throw new TypeError(`scriptedFetch: no route for ${url.href}`);

    const i = cursors.get(route.name) ?? 0;
    let step = route.steps[Math.min(i, route.steps.length - 1)];
    cursors.set(route.name, i + 1);
    if (step.kind === "dynamic") step = step.respond(body, url);
    record.step = step.kind;

    switch (step.kind) {
      case "json":
        return new Response(JSON.stringify(step.body), {
          status: step.status ?? 200,
          headers: { "content-type": "application/json", ...step.headers },
        });
      case "http":
        return new Response(step.body ?? "", {
          status: step.status,
          headers: step.headers,
        });
      case "malformed":
        return new Response("{not json", {
          status: step.status ?? 200,
          headers: { "content-type": "application/json" },
        });
      case "network":
        throw new TypeError("fetch failed (scripted network error)");
      case "timeout":
        return new Promise<Response>((_, reject) => {
          const signal = init.signal;
          const fail = () =>
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            );
          if (signal?.aborted) return fail();
          signal?.addEventListener("abort", fail, { once: true });
          // Without an AbortSignal the caller has no timeout: hang so the test
          // runner's own timeout exposes it.
        });
    }
  };

  return {
    fetch: fetchImpl as typeof fetch,
    calls,
    callsTo: (name: string) => calls.filter((c) => c.route === name),
    reset() {
      calls.length = 0;
      cursors.clear();
    },
  };
}

/** OpenRouter-shaped chat completion body for a given model. */
export function openRouterCompletion(
  model: string,
  content: string,
  usage = { prompt_tokens: 100, completion_tokens: 50 },
) {
  return {
    id: `gen-${model}-${Math.random().toString(36).slice(2, 8)}`,
    model,
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content },
      },
    ],
    usage: {
      ...usage,
      total_tokens: usage.prompt_tokens + usage.completion_tokens,
    },
  };
}

/** Route that matches OpenRouter chat completions for one model id. */
export function openRouterModel(model: string, steps: Step[]): Route {
  return {
    name: model,
    match: (url, _init, body) =>
      url.hostname.endsWith("openrouter.ai") &&
      url.pathname.endsWith("/chat/completions") &&
      typeof body === "object" &&
      body !== null &&
      ((body as { model?: string }).model === model ||
        ((body as { models?: string[] }).models ?? [])[0] === model),
    steps,
  };
}

export type ModelHealth =
  "ok" | Exclude<Step, { kind: "json" } | { kind: "dynamic" }>;

/**
 * Simulates OpenRouter's server-side fallback: the request lists `models`
 * (or one `model`); OpenRouter answers with the first healthy one and
 * reports which model served it. If none is healthy, the primary's failure
 * is returned. `servedAs` lets a test return a dated slug variant.
 */
export function fakeOpenRouter(opts: {
  health: Record<string, ModelHealth>;
  usage?: { prompt_tokens: number; completion_tokens: number; cost?: number };
  content?: string | ((model: string) => string);
  servedAs?: (model: string) => string;
}): Route {
  return {
    name: "openrouter",
    match: (url) => url.hostname.endsWith("openrouter.ai"),
    steps: [
      {
        kind: "dynamic",
        respond: (body) => {
          const b = (body ?? {}) as { model?: string; models?: string[] };
          const chain = b.models ?? (b.model ? [b.model] : []);
          const healthy = chain.find((m) => (opts.health[m] ?? "ok") === "ok");
          if (!healthy) {
            const h = opts.health[chain[0]];
            return h && h !== "ok" ? h : { kind: "http", status: 503 };
          }
          const usage = opts.usage ?? {
            prompt_tokens: 100,
            completion_tokens: 50,
          };
          const content =
            typeof opts.content === "function"
              ? opts.content(healthy)
              : (opts.content ?? `answer from ${healthy}`);
          const served = opts.servedAs ? opts.servedAs(healthy) : healthy;
          return {
            kind: "json",
            body: {
              ...openRouterCompletion(served, content, usage),
              usage: {
                ...usage,
                total_tokens: usage.prompt_tokens + usage.completion_tokens,
              },
            },
          };
        },
      },
    ],
  };
}

/**
 * Simulates the Anthropic Messages API: one model per request, health keyed
 * by the Anthropic model id in the body.
 */
export function fakeAnthropic(opts: {
  health?: Record<string, ModelHealth>;
  content?: string;
  usage?: { input_tokens: number; output_tokens: number };
}): Route {
  return {
    name: "anthropic",
    match: (url) => url.hostname === "api.anthropic.com",
    steps: [
      {
        kind: "dynamic",
        respond: (body) => {
          const model = (body as { model?: string })?.model ?? "";
          const h = opts.health?.[model] ?? "ok";
          if (h !== "ok") return h;
          return {
            kind: "json",
            body: {
              id: `msg_${model}`,
              type: "message",
              model,
              content: [{ type: "text", text: opts.content ?? "answer" }],
              usage: opts.usage ?? { input_tokens: 100, output_tokens: 50 },
            },
          };
        },
      },
    ],
  };
}
