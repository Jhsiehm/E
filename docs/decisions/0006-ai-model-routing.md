# 0006. AI model routing by function and tier, through OpenRouter

Date: 2026-11-12 · Status: proposed

## Context
Casevex needs model calls for research, verification, document processing,
monitoring and drafting (handoff 01, 04, 05). Their stakes and volumes differ
by orders of magnitude: one research answer is worth more care than a
thousand feed-event classifications. Handoffs 02 and 04 also require cost
telemetry, per-run budgets, approved-provider fallback only, no silent
downgrade, no-training and minimal retention for client data, and an
independent verifier.

## Decision
- One server-only module, `lib/ai`, owns every model call. Callers name an
  AI function; `functions.ts` maps it to a tier (`frontier`, `reasoning`,
  `fast`, `bulk`) and `tiers.ts` maps tiers to model chains.
- OpenRouter is the single gateway, so models can be compared and swapped by
  config (`CASEVEX_AI_OVERRIDES`) without new provider SDKs.
- Each function has a data class; each model a maximum data class and pinned
  upstream providers. Confidential calls use `data_collection: deny`, `zdr`
  and `provider.only`; they fail rather than reach an unvetted host.
- Pre-call worst-case cost checks against tier ceilings and the run budget;
  recorded cost comes from OpenRouter usage accounting into `usage_events`.

## Consequences
- Adding an AI feature means adding a registry entry and regenerating
  docs/ai/COST_ESTIMATE.md; tests catch routing that breaks the rules above.
- OpenRouter becomes a data processor for client material. Its terms, and
  each pinned upstream provider's, are a launch gate (handoff 06, human
  gates) along with the firm's approval.
- Catalog prices drift; `npm run ai:check` must be run before relying on
  estimates. Embeddings are out of scope until retrieval benchmarks justify
  vectors (handoff 04).
