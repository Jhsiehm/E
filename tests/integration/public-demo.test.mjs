import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./server.mjs";

// Exercise the real proxy, pages and dispatcher with production live defaults.
// No real credentials or network services are needed to enter the walkthrough.
let server;
before(async () => {
  server = await startServer({
    CASEVEX_DATA_MODE: "live",
    CASEVEX_DEPLOYMENT: "demo",
    NEXT_PUBLIC_SUPABASE_URL: "https://demo-test.invalid",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "not-a-real-key",
  });
});
after(() => server?.stop());

function visitor() {
  const jar = new Map();
  return async (path, method = "GET", body) => {
    const response = await fetch(server.url + path, {
      method,
      redirect: "manual",
      headers: {
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [name, value] = cookie.split(";")[0].split(/=(.*)/s);
      jar.set(name, value);
    }
    return response;
  };
}

test("a signed-out visitor enters the complete sample account without onboarding", async () => {
  const visit = visitor();
  const entry = await visit("/demo");
  assert.equal(entry.status, 303);
  assert.equal(entry.headers.get("location"), "/");
  const page = await visit("/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Jordan Wells/);
  const response = await visit("/api/bootstrap");
  assert.equal(response.headers.get("x-casevex-data-mode"), "fixture");
  assert.equal(response.headers.get("cache-control"), "no-store");
  const data = await response.json();
  assert.equal(data.samples, "on");
  assert.equal(data.matters.length, 6);
  for (const key of [
    "documents",
    "notices",
    "deadlines",
    "agents",
    "precedents",
  ]) {
    assert.ok(data[key].length > 0, key);
  }
});

test("demo mutations are isolated between visitors and restart restores samples", async () => {
  const first = visitor(),
    second = visitor();
  await first("/demo");
  await second("/demo");
  assert.equal(
    (await first("/api/matters", "POST", { name: "My sample matter" })).status,
    201,
  );
  assert.equal(
    (await (await first("/api/bootstrap")).json()).matters.length,
    6,
  );
  assert.equal(
    (await (await second("/api/bootstrap")).json()).matters.length,
    5,
  );
  await first("/demo");
  assert.equal(
    (await (await first("/api/bootstrap")).json()).matters.length,
    5,
  );
});

test("research is simulated and live endpoints stay unavailable", async () => {
  const visit = visitor();
  await visit("/demo");
  const answer = await visit("/api/matters/parker/chat", "POST", {
    text: "What next?",
  });
  assert.equal(answer.status, 200);
  assert.match((await answer.json()).text, /simulated research response/);
  const live = await visit("/api/v1/legal-research/preview", "POST", {
    query: "sample",
  });
  assert.equal(live.status, 503);
  assert.equal(live.headers.get("x-casevex-data-mode"), "fixture");
  assert.match((await live.json()).error.message, /unavailable in the demo/);
  assert.equal((await visit("/api/matters/real-workspace-id")).status, 404);
});

test("normal signed-out visitors still require real authentication", async () => {
  assert.equal((await visitor()("/api/bootstrap")).status, 401);
});

test("pilot deployment does not expose a public demo", async () => {
  const pilot = await startServer({
    CASEVEX_DEPLOYMENT: "pilot",
    CASEVEX_DATA_MODE: "live",
  });
  try {
    const response = await fetch(pilot.url + "/demo", { redirect: "manual" });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("set-cookie"), null);
  } finally {
    await pilot.stop();
  }
});
