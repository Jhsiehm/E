# 0006. Legal data layer: provider adapters, retrieval and verification in TypeScript

Date: 2026-11-12 · Status: proposed (P3 slice). Runtime choice awaiting Joshua's decision.

## Context
04 and 05 specify source-grounded research over a source-limited corpus:
provider adapters with provenance, a citation resolver, keyword (BM25)
retrieval, evidence passages with pinpoints, and separate verification checks.
02 places research in a private Python FastAPI service plus durable workers.
P1 (auth, database) and P2 (documents) are not merged yet.

## Decision
- `lib/legal/` holds the legal data layer as framework-free TypeScript:
  `types.ts` (adapter contract from 05), `http.ts` (host allowlist, timeouts,
  bounded retry with jitter), `citations.ts`, `text.ts` (HTML -> passages with
  star-page pinpoints), `bm25.ts`, `retrieve.ts`, `verify.ts`, `research.ts`.
- Providers: CourtListener (opinions, citation lookup), NY Senate Open
  Legislation (NY consolidated laws), GovInfo (U.S. Code, CFR), and a synthetic
  fixture provider under `example.invalid`. NY Official Reports has no API and
  is not implemented; it needs a rights review first.
- A real provider is enabled only when it is listed in
  `CASEVEX_LEGAL_PROVIDERS` and its credential is set. Fixture data mode uses
  only the synthetic provider, so the demo never mixes sample matters with
  real law.
- The model is a dependency (`Complete`, `lib/legal/model.ts`) with the same
  signature as `complete` in `@/lib/ai` (OpenRouter routing). Tasks:
  `research.draft`, `research.verify_support` (and `research.plan`,
  `research.rerank` reserved). The model sees only `S1..Sn` labels; the server
  maps them to passage IDs, drops unknown labels, checks quotes, and runs an
  independent support check. No model -> extractive answer, never "supported".
- Storage is an `AuthorityStore` interface with an in-memory LRU. The Postgres
  store (authorities, authority_versions, authority_passages, citation_edges in
  `supabase/migrations/`) follows once the P1 migrations are on main.
- `/api/v1/legal-data/coverage`, `/api/v1/authorities[/:id[/passages]]`,
  `/api/v1/authority-resolutions` and `/api/v1/legal-research/preview` are thin
  wrappers over `lib/legal/api.ts`. The preview endpoint is synchronous; durable
  research-runs with SSE replace it on top of the P1 database.

## Deviation to approve
Writing this in TypeScript rather than Python FastAPI. Rationale: one language
for the BFF and workers (Trigger.dev, named in 02, is TypeScript-native), one
set of contract types, and the code is pure library code with no long-lived
process. If Python is chosen, the module boundaries and tests here port 1:1.

## Consequences
- Routes are public-source only and not yet behind sign-in; P1 auth must wrap
  them (research.run / research.view) before any pilot.
- Provider payload parsing is tested against documented response shapes, not
  yet against recorded live responses (the build sandbox cannot reach the
  provider hosts). A live smoke run with real keys is required before enabling.
- Subsequent treatment is never claimed: every result says `not_checked`.
