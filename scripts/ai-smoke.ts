/**
 * Runs one AI function against OpenRouter with a synthetic prompt and prints
 * the model used, tokens, cost and reply. Never paste client data here.
 *
 *   npm run ai:smoke                                   # list functions
 *   npm run ai:smoke -- research.thread_title
 *   npm run ai:smoke -- research.draft --model openai/gpt-6.1-sol
 *   npm run ai:smoke -- research.route "Does the statute cover B2B sales?"
 *
 * Reads OPENROUTER_API_KEY from the environment or .env.local. --model sets a
 * one-off override for that function (models outside the catalog also need
 * CASEVEX_AI_EXPERIMENTS=1).
 */
import { existsSync, readFileSync } from "node:fs";
import { AI_FUNCTIONS, isAiFunctionKey, runAiFunction } from "../lib/ai";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const key = args[0];
  if (!key || !isAiFunctionKey(key)) {
    console.log(
      "Usage: npm run ai:smoke -- <function> [--model id] [question]\n",
    );
    for (const f of Object.values(AI_FUNCTIONS))
      console.log(`${f.key.padEnd(32)} ${f.tier.padEnd(10)} ${f.label}`);
    process.exit(key ? 1 : 0);
  }
  const mi = args.indexOf("--model");
  if (mi > -1)
    process.env.CASEVEX_AI_OVERRIDES = JSON.stringify({ [key]: args[mi + 1] });
  const question =
    args
      .filter((_, i) => i > 0 && (mi < 0 || (i !== mi && i !== mi + 1)))
      .join(" ") ||
    "Under a fictional state's consumer protection statute, must a plaintiff show reliance to recover statutory damages?";

  const fn = AI_FUNCTIONS[key];
  const system = `You are a test harness for the Casevex function "${fn.label}". ${
    fn.structuredOutput
      ? "Reply with a small JSON object only."
      : "Reply briefly."
  } This is synthetic test data; do not cite real cases.`;

  try {
    const r = await runAiFunction(key, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
      ],
      promptVersion: "smoke@1",
    });
    const u = r.usage;
    console.log(
      [
        `function  ${key} (${u.tier})`,
        `model     ${u.modelUsed}${u.fellBack ? `  (fell back from ${u.requestedModel})` : ""}`,
        `tokens    ${u.promptTokens} in / ${u.completionTokens} out`,
        `cost      $${u.costUsd.toFixed(6)} (${u.costSource})`,
        `latency   ${u.latencyMs} ms, ${u.attempts} attempt(s)`,
        "",
        r.text,
      ].join("\n"),
    );
  } catch (err) {
    console.error(`${(err as Error).name}: ${(err as Error).message}`);
    process.exit(1);
  }
}

void main();
