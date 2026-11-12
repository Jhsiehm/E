import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./server.mjs";

// A production server with no explicit opt-in must never serve fixtures.
let live;
before(async () => {
  live = await startServer({
    CASEVEX_DATA_MODE: undefined,
    CASEVEX_DEPLOYMENT: undefined,
  });
});
after(() => live?.stop());

test("production server without CASEVEX_DATA_MODE refuses sample data", async () => {
  for (const [path, method] of [
    ["bootstrap", "GET"],
    ["matters", "GET"],
    ["matters", "POST"],
    ["matters/anderson/chat", "POST"],
  ]) {
    const res = await fetch(`${live.url}/api/${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body:
        method === "POST"
          ? JSON.stringify({ name: "x", text: "y" })
          : undefined,
    });
    assert.equal(res.status, 503, path);
    assert.equal(res.headers.get("x-casevex-data-mode"), "live");
    assert.equal(res.headers.get("set-cookie"), null);
    const body = await res.json();
    assert.equal(body.error.code, "service_not_configured");
    assert.match(body.error.requestId, /^[0-9a-f-]{36}$/);
    assert.doesNotMatch(JSON.stringify(body), /Anderson|Meridian|Nexora/);
  }
});

test("pilot deployment with fixture opt-in fails closed", async () => {
  const pilot = await startServer({
    CASEVEX_DATA_MODE: "fixture",
    CASEVEX_DEPLOYMENT: "pilot",
  });
  try {
    const res = await fetch(`${pilot.url}/api/bootstrap`);
    assert.equal(res.status, 500);
    assert.doesNotMatch(await res.text(), /Anderson|Meridian|Nexora/);
  } finally {
    await pilot.stop();
  }
});
