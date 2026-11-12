/** Fake fetch that routes by URL substring; records calls. No network. */
export interface Call {
  url: URL;
  init: RequestInit;
}

type Reply = {
  status?: number;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
};

export function fakeFetch(
  routes: [string | RegExp, Reply | ((url: URL, init: RequestInit) => Reply)][],
) {
  const calls: Call[] = [];
  const fn = (async (input: URL | string, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    const hit = routes.find(([m]) =>
      typeof m === "string"
        ? url.toString().includes(m)
        : m.test(url.toString()),
    );
    if (!hit) return new Response("not found", { status: 404 });
    const r = typeof hit[1] === "function" ? hit[1](url, init) : hit[1];
    if (r.text !== undefined)
      return new Response(r.text, {
        status: r.status ?? 200,
        headers: { "content-type": "text/html", ...r.headers },
      });
    return new Response(JSON.stringify(r.json ?? {}), {
      status: r.status ?? 200,
      headers: { "content-type": "application/json", ...r.headers },
    });
  }) as typeof fetch;
  return { fetch: fn, calls };
}

export const noSleep = { sleep: async () => {}, random: () => 0 };
