/**
 * Checks lib/ai/models.ts against OpenRouter's live model list: every id
 * exists, and list prices still match. No API key needed.
 *   npm run ai:check
 * Exits 1 if a model is missing or a price moved by more than 1%.
 */
import { MODELS, PRICES_AS_OF } from "../lib/ai";

interface OrModel {
  id: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
}

async function main() {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) {
    console.error(`OpenRouter /models returned ${res.status}`);
    process.exit(2);
  }
  const live = new Map(
    ((await res.json()) as { data: OrModel[] }).data.map((m) => [m.id, m]),
  );

  let problems = 0;
  const near = (a: number, b: number) =>
    Math.abs(a - b) <= Math.max(a, b) * 0.01;
  console.log(`Catalog prices as of ${PRICES_AS_OF}\n`);
  for (const m of Object.values(MODELS)) {
    const l = live.get(m.id);
    if (!l) {
      problems++;
      const vendor = m.id.split("/")[0] + "/";
      const similar = [...live.keys()]
        .filter((id) => id.startsWith(vendor))
        .slice(0, 10);
      console.log(
        `MISSING  ${m.id}\n         live ${vendor} models: ${similar.join(", ")}`,
      );
      continue;
    }
    const inp = Number(l.pricing?.prompt ?? NaN) * 1e6;
    const out = Number(l.pricing?.completion ?? NaN) * 1e6;
    const ok = near(inp, m.inputUsdPerMTok) && near(out, m.outputUsdPerMTok);
    if (!ok) problems++;
    console.log(
      `${ok ? "OK      " : "PRICE   "} ${m.id}  catalog $${m.inputUsdPerMTok}/$${m.outputUsdPerMTok}  live $${inp.toFixed(3)}/$${out.toFixed(3)}  context ${l.context_length ?? "?"}`,
    );
  }
  console.log(
    problems
      ? `\n${problems} model(s) need updating in lib/ai/models.ts.`
      : "\nAll catalog models match OpenRouter.",
  );
  process.exit(problems ? 1 : 0);
}

void main();
