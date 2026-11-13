# 0009. Keep source files under 300 lines

Date: 2026-11-13 · Status: accepted (Joshua, project thread)

## Context
Several modules had grown past 400 lines (the AI client, the CourtListener
adapter, the research assembler, the sample data). Long files mix several
jobs, are hard to review in one sitting, and make security review harder:
a reviewer checking "where do API keys go" or "what reaches a model" has to
read unrelated code to answer it.

## Decision
- ESLint `max-lines` fails CI when a `.ts`, `.tsx`, `.js` or `.mjs` file has
  more than 300 lines of code (blank lines and comments do not count).
  Test files may reach 400.
- When a file nears the limit, split it by job, not by line count. The
  public import path stays the same: the original file re-exports the parts.
- Splits made with this change:
  - `lib/ai/client.ts` -> `types`, `errors`, `budget`, `gateway`,
    `transport` (HTTP retries), `providers` (OpenRouter and Anthropic
    request shapes), `usage-events`.
  - `lib/ai/functions.ts` -> `functions/research`, `functions/documents`,
    `functions/monitoring`, `function-spec`.
  - `lib/legal/research.ts` -> `research-types`, `research-parse`,
    `research-prompts`.
  - `lib/legal/api.ts` -> `api-responses`.
  - `lib/legal/providers/courtlistener.ts` -> `courtlistener-wire`.
  - `lib/mock/data.ts` -> `types`, `samples`, `seed-workspace`, `seed-feed`.
  - `lib/agents/catalog.ts` -> `catalog-defaults`.
  - `components/account/ProfileFields.tsx` -> `profile-fields/*`.
  - `tests/cross-module/adapters.ts` -> `citation-adapter`.

## Consequences
No behavior change; every existing import path still works. Secrets and
network calls in the AI client now sit in two small files (`gateway.ts`,
`transport.ts`, `providers.ts`) that can be reviewed on their own.
