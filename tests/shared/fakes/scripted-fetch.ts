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
  | { kind: "malformed"; status?: number };

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
  step: Step["kind"] | "unmatched";
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
    const step = route.steps[Math.min(i, route.steps.length - 1)];
    cursors.set(route.name, i + 1);
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
