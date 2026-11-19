/**
 * Runs realistic questions through the same research path as live Agent chat
 * (retrieve -> answerQuestion -> toChatMessage) and prints timings, models,
 * cost and each answer as Markdown. Reads keys from the environment or
 * .env.local and never prints them.
 *
 *   npm run ask:eval > ask-eval-report.md
 *   npm run ask:eval -- "Your own question"
 *
 * Needs OPENROUTER_API_KEY, plus CASEVEX_LEGAL_PROVIDERS=courtlistener and
 * COURTLISTENER_API_TOKEN for real case law (otherwise synthetic fixtures).
 */
import { existsSync, readFileSync } from "node:fs";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const QUESTIONS = [
  "Under New York General Business Law section 349, must a plaintiff prove reliance?",
  "What are the elements of a breach of contract claim in New York?",
  "Can a consumer class action proceed when the arbitration clause has a class action waiver?",
  "What is the statute of limitations for a GBL 349 claim in New York?",
  "When can a court pierce the corporate veil under New York law?",
  "thoughts on the current case",
];

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

async function main() {
  loadEnvLocal();
  const realLaw =
    !!process.env.CASEVEX_LEGAL_PROVIDERS &&
    !!process.env.COURTLISTENER_API_TOKEN;
  process.env.CASEVEX_DATA_MODE = realLaw ? "live" : "fixture";
  const have = (k: string) => (process.env[k] ? "set" : "missing");
  console.log("# Casevex Ask eval\n");
  console.log(
    `OPENROUTER_API_KEY ${have("OPENROUTER_API_KEY")} · COURTLISTENER_API_TOKEN ${have("COURTLISTENER_API_TOKEN")} · CASEVEX_LEGAL_PROVIDERS ${process.env.CASEVEX_LEGAL_PROVIDERS || "missing"}`,
  );

  const { complete } = await import("../lib/ai");
  const { buildRegistry } = await import("../lib/legal/registry");
  const { retrieve } = await import("../lib/legal/retrieve");
  const { answerQuestion } = await import("../lib/legal/research");
  const { toChatMessage } = await import("../lib/legal/chat-message");
  type Complete = NonNullable<Parameters<typeof answerQuestion>[2]>["complete"];

  const registry = buildRegistry();
  console.log(
    `Sources: ${registry.enabled.map((p) => p.id).join(", ") || "none"}${realLaw ? "" : " (synthetic, not real law)"}\n`,
  );
  const args = process.argv.slice(2).filter(Boolean);
  let total = 0;
  for (const q of args.length ? args : QUESTIONS) {
    console.log(`\n---\n\n## ${q}\n`);
    const t0 = Date.now();
    const calls: string[] = [];
    const timed: Complete = async (req) => {
      const t = Date.now();
      try {
        const out = await complete(req);
        calls.push(
          `${req.task}: ${out.modelId} · ${secs(Date.now() - t)} · $${out.costUsd.toFixed(4)}`,
        );
        return out;
      } catch (e) {
        const err = e as Error & { code?: string };
        calls.push(
          `${req.task}: FAILED after ${secs(Date.now() - t)} (${err.code ?? err.name}: ${err.message})`,
        );
        throw e;
      }
    };
    try {
      const r = await retrieve(registry, { question: q });
      const tRetrieve = Date.now() - t0;
      const result = await answerQuestion(q, r, { complete: timed });
      const cost = result.modelRuns.reduce((s, m) => s + m.costUsd, 0);
      total += cost;
      const msg = toChatMessage(result, "eval");
      const errs = r.providerErrors.map((e) => `${e.provider} (${e.reason})`);
      console.log(
        `- Retrieval: ${secs(tRetrieve)}, ${r.evidence.length} passages, source errors: ${errs.join("; ") || "none"}`,
      );
      for (const c of calls) console.log(`- ${c}`);
      console.log(
        `- Total: ${secs(Date.now() - t0)} · $${cost.toFixed(4)} · ${result.mode}${result.abstained ? " · abstained" : ""}`,
      );
      console.log(
        `- Source check: ${result.claims.map((c) => c.verificationStatus).join(", ") || "no claims"}\n`,
      );
      console.log("### Answer as shown in chat\n");
      console.log(msg.text.replace(/^/gm, "> "));
      console.log("\nSources:\n");
      for (const s of msg.sources ?? [])
        console.log(`${s.index}. ${s.title} (${s.meta}) ${s.href}`);
    } catch (e) {
      console.log(
        `- FAILED after ${secs(Date.now() - t0)}: ${(e as Error).name}: ${(e as Error).message}`,
      );
      for (const c of calls) console.log(`- ${c}`);
    }
  }
  console.log(`\n---\n\nTotal model cost: $${total.toFixed(4)}`);
}

void main();
