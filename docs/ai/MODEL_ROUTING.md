# AI model routing

Every model call in Casevex goes through `lib/ai`. Feature code names an
**AI function** (for example `research.draft`); the routing config picks the
models. Nobody hard-codes a model id outside `lib/ai/models.ts`.

Numbers for every function, and the monthly estimate, are in
[COST_ESTIMATE.md](./COST_ESTIMATE.md) (generated).

## The four tiers

| Tier | Default models | When to use it |
| --- | --- | --- |
| `frontier` | Claude Opus 5.5, then GPT-6.1 Sol | Final legal reasoning and drafting an attorney reads and relies on: the research answer and motion drafts. Low volume, so the price barely matters next to the cost of a wrong answer. |
| `reasoning` | Claude Sonnet 5.5, then Gemini 3.1 Pro | Bounded legal judgment on short structured inputs: research plans, claim verification, comparisons, deadline extraction, citation treatment, matter impact. |
| `fast` | GPT-6 Luna, then Claude Haiku 5.5 | High-volume short jobs where an error is cheap or caught later: routing, reranking, titles, classification, summaries, digests. |
| `bulk` | DeepSeek V4.1 Flash, then Qwen3.8 Flash | Public-data batch work only (provider feed triage). Never sees client data. |

Agent profiles and other config refer to tiers by these names
(`TIER_NAMES` in `lib/ai/tiers.ts`), never by model id.

## Why the split saves money

A research run is about 12 model calls, but one of them (`research.draft`)
is most of the cost. Keeping plan, rerank and the eight claim checks off the
frontier tier makes a run cost about $0.15 instead of about $0.31 if every
step used Opus. The biggest lever is `research.route`: it costs a hundredth
of a cent and keeps "thanks" and "what's the docket number?" from starting a
full research run.

Deterministic work never goes to a model: `source_exists`, `quote_matches`,
the citation resolver, court-rule date math, ACL checks and keyword/BM25
retrieval stay in code, per handoff 04.

## Rules the router enforces

- **Data classes.** Each function is `public` (opinions, statutes, feed
  events) or `confidential` (anything with client material). Each model has
  a maximum data class; DeepSeek and Qwen are public-only. A config or
  override that sends client data to a public-only model throws.
- **Privacy routing.** Every call sends `provider.data_collection: "deny"`;
  confidential calls also send `zdr: true` and pin upstream hosts with
  `provider.only` from each model's `approvedProviders`. If no compliant host
  is up, the call fails instead of going to another host. In
  `CASEVEX_DEPLOYMENT=pilot`, a confidential function whose chain has an
  unpinned model is refused.
- **Fallbacks stay in the approved chain.** OpenRouter tries the chain in
  order. The result reports `fellBack: true` and the model actually used, so
  a fallback is never silent.
- **Independent verification.** `research.verify_support` must use a
  different vendor than `research.draft` (a unit test checks this).
- **Budgets.** Each tier has a per-call ceiling, and callers pass a
  `RunBudget` (from the agent profile's `budgets.maxUSDPerRun`). The client
  estimates the worst-case cost before sending and refuses a call that could
  exceed either limit.
- **Recorded cost is real cost.** The client asks OpenRouter for usage
  accounting and records its `usage.cost`; catalog prices are only for
  estimates. `toUsageEvent()` maps a call to a `usage_events` row with no
  prompt or reply text.

## Calling it

```ts
import { complete, RunBudget } from "@/lib/ai";

const budget = RunBudget.fromAgentProfile(agentVersion.config);
const { output, modelId, provider, costUsd, usage } = await complete({
  task: "research.plan",
  messages: [
    { role: "system", content: PLAN_PROMPT_V1 },
    { role: "user", content: question },
  ],
  responseSchema: PlanSchema, // anything with parse()
  budgetUsd: budget,
  promptVersion: "plan@1",
  onUsage: (u) => db.usageEvents.insert(toUsageEvent(u, ctx)),
});
```

Server-only: the client throws if imported in the browser, and the API key
is only read from the server environment.

## API keys and gateways

Two keys are supported, and both can be set at once:

| Key | Reaches | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Every catalog model | Privacy routing (`data_collection: deny`, `zdr`, pinned hosts) and real cost from OpenRouter. |
| `ANTHROPIC_API_KEY` | Claude models only, direct to Anthropic | Cost is estimated from catalog prices. Fallback runs across the Claude models in the chain. |

`CASEVEX_AI_GATEWAY` picks between them: `auto` (default) uses OpenRouter
when its key is set and Anthropic otherwise; `openrouter` or `anthropic`
forces one.

With only the Anthropic key, each function runs on the Claude models in its
chain (the `fast` tier, for example, uses its Haiku fallback and reports
`fellBack: true`). Functions with no Claude model in their chain fail with a
"set OPENROUTER_API_KEY" error: `research.verify_support` (it must not be
the same vendor as the drafter) and the `bulk` tier.

## Testing models with OpenRouter

1. Put your key in `.env.local` (git-ignored): `OPENROUTER_API_KEY=sk-or-...`
2. `npm run ai:check` confirms every catalog model id and price against
   OpenRouter's live list (no key needed).
3. `npm run ai:smoke -- research.thread_title` runs one function with a
   synthetic prompt and prints the model, tokens, cost and reply.
4. Try another model for one function:
   `npm run ai:smoke -- research.draft --model openai/gpt-6.1-sol`
5. Swap models app-wide without code changes:

   ```sh
   CASEVEX_AI_OVERRIDES='{"research.draft":"openai/gpt-6.1-sol","tier:fast":["google/gemini-3.5-flash-lite"]}'
   ```

   A function key beats a tier key. Models outside the catalog need
   `CASEVEX_AI_EXPERIMENTS=1`, which is refused in pilot. Use synthetic data
   only for experiments.

## Changing the config

- New AI feature: add an entry to `lib/ai/functions.ts` with its tier, data
  class and token estimates, then `npm run ai:report -- --write`.
- New or repriced model: edit `lib/ai/models.ts`, run `npm run ai:check`.
- Tests in `tests/unit/ai-*.test.ts` check that every function routes to
  allowed models, budgets hold, and verification stays independent.
