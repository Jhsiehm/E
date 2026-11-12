// Starts `next start` (requires `npm run build`) on a free port for a test file.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

/** @param {Record<string,string|undefined>} env */
export async function startServer(env = {}) {
  const port = await freePort();
  const childEnv = { ...process.env, ...env, PORT: String(port) };
  for (const [k, v] of Object.entries(env))
    if (v === undefined) delete childEnv[k];
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL("../../node_modules/next/dist/bin/next", import.meta.url),
      ),
      "start",
      "-p",
      String(port),
      "--hostname",
      "127.0.0.1",
    ],
    { cwd: root, env: childEnv, stdio: ["ignore", "pipe", "pipe"] },
  );
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error("next start exited:\n" + log);
    try {
      await fetch(url + "/api/health-probe");
      break;
    } catch {
      if (Date.now() > deadline) {
        child.kill();
        throw new Error("next start did not become ready:\n" + log);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return {
    url,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", resolve);
        child.kill();
      }),
  };
}

/** Cookie for the fixture-mode demo account, already onboarded. */
export function demoCookie(profile = {}) {
  const value = Buffer.from(
    JSON.stringify({
      fullName: "Test Person",
      practiceAreas: ["ny_civil_litigation"],
      onboardedAt: "2026-11-12T00:00:00.000Z",
      ...profile,
    }),
  ).toString("base64url");
  return `cvx_demo=${value}`;
}
