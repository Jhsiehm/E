import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./server.mjs";
// Fixture-mode prototype API. Uses CASEVEX_TEST_URL if given, else starts
// `next start` with CASEVEX_DATA_MODE=fixture (production builds are live by default).
let base = process.env.CASEVEX_TEST_URL;
let server;
before(async () => {
  if (base) return;
  server = await startServer({ CASEVEX_DATA_MODE: "fixture" });
  base = server.url;
});
after(() => server?.stop());
function client() {
  let cookie = "";
  return async (path, method = "GET", body) => {
    const res = await fetch(base + "/api/" + path, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: body
        ? body instanceof FormData
          ? body
          : JSON.stringify(body)
        : undefined,
    });
    if (res.headers.get("set-cookie"))
      cookie = res.headers.get("set-cookie").split(";")[0];
    return { status: res.status, data: await res.json() };
  };
}
test("matter creation, summary, strategy and chat remain in the same demo session", async () => {
  const api = client();
  assert.equal((await api("bootstrap")).data.matters.length, 5);
  const created = await api("matters", "POST", {
    name: "Test matter",
    court: "Test court",
    type: "Civil litigation",
  });
  assert.equal(created.status, 201);
  const id = created.data.id;
  await api("matters/" + id, "PATCH", { summary: "Updated summary" });
  assert.equal((await api("matters/" + id)).data.summary, "Updated summary");
  await api(`matters/${id}/strategy`, "PATCH", { text: "Review evidence" });
  assert.equal(
    (await api(`matters/${id}/strategy`)).data.text,
    "Review evidence",
  );
  const answer = await api(`matters/${id}/chat`, "POST", {
    text: "What next?",
  });
  assert.match(answer.data.text, /simulated/);
  assert.equal((await api(`matters/${id}/chat`)).data.length, 2);
  assert.equal((await client()("bootstrap")).data.matters.length, 5);
});
test("notice read state is session-scoped and filterable", async () => {
  const api = client();
  await api("bootstrap");
  await api("notices/read", "POST", { ids: ["n1"] });
  assert.equal((await api("notices?unread=true")).data.length, 2);
  await api("notices/read", "POST", { all: true });
  assert.equal((await api("notices?unread=true")).data.length, 0);
  assert.equal((await client()("notices?unread=true")).data.length, 3);
});
test("upload metadata validates type and supports move and delete", async () => {
  const api = client();
  await api("bootstrap");
  const bad = new FormData();
  bad.set("file", new File(["x"], "sample.exe"));
  assert.equal((await api("documents", "POST", bad)).status, 400);
  const good = new FormData();
  good.set(
    "file",
    new File(["%PDF-1.4\nDemo"], "sample.pdf", { type: "application/pdf" }),
  );
  good.set("matterId", "parker");
  const upload = await api("documents", "POST", good);
  assert.equal(upload.status, 201);
  const id = upload.data.id;
  assert.equal(upload.data.matterId, "parker");
  await api("documents/" + id, "PATCH", {
    name: "Renamed",
    matterId: "anderson",
  });
  assert.equal((await api("documents?q=Renamed")).data[0].matterId, "anderson");
  await api("documents/" + id, "DELETE");
  assert.equal((await api("documents?q=Renamed")).data.length, 0);
});
test("calendar events, profile and agent assignments update", async () => {
  const api = client();
  await api("bootstrap");
  assert.equal(
    (
      await api("deadlines", "POST", {
        title: "Test hearing",
        dueAt: "2026-12-01",
        matterId: "anderson",
        kind: "hearing",
      })
    ).status,
    200,
  );
  assert.equal(
    (await api("deadlines?from=2026-12-01&to=2026-12-01")).data.length,
    1,
  );
  await api("me", "PATCH", { name: "Demo Reviewer" });
  assert.equal((await api("me")).data.name, "Demo Reviewer");
  await api("agents/corporate", "PATCH", { matterIds: ["anderson"] });
  assert.equal(
    (await api("matters/anderson")).data.assignedAgentId,
    "corporate",
  );
});
test("invalid data and missing matters return explicit errors", async () => {
  const api = client();
  assert.equal((await api("matters", "POST", { name: "" })).status, 400);
  assert.equal((await api("matters/missing")).status, 404);
  assert.equal(
    (await api("deadlines", "POST", { title: "Missing date" })).status,
    400,
  );
  assert.equal((await api("precedents", "POST", { citation: "" })).status, 400);
});
