# Cross-module QA suites

Tests that check modules against each other, in both directions: things work
when they should and fail or are denied when they should.

| Suite | Checks | Waits on |
| --- | --- | --- |
| `access.test.ts` | Full role × resource × action matrix: cross-firm, ethical wall (paralegal off restricted matter), owner not bypassing matter ACL, revoked and signed-out users, forged sessions, self-declared role escalation | Supabase sign-in (P1) |
| `citations.test.ts` | Real (synthetic) citations verify; fabricated, malformed, wrong-volume, misquoted, stale-version, withdrawn and prompt-injection citations are rejected. Zero invented-citation acceptance. | Legal data retrieval (P3) |
| `routing.test.ts` | Healthy primary used; fallback on 429/503/network/malformed; loud failure when all fail; budget ceiling; confidential text only to approved models; API key only sent to OpenRouter | AI model routing |
| `fairness.test.ts` | Routing is blind to client identity; safety features equal across AI experience levels; live counterfactual persona audit (weekly, opt-in) | Routing, onboarding |

Shared pieces live in `tests/shared/` (tenancy fixtures, access oracle,
synthetic citation corpus, scripted fetch, counterfactual bias harness) and
are self-tested both ways in `tests/shared/harness.test.ts`.

A suite skips with a `todo` until its module lands. To switch it on, wire the
adapter in `adapters.ts`. If a module's real behaviour disagrees with the
oracle, decide which is right before changing either: the oracle encodes
docs/handoff/02 and 04.

`npm run test:cross` runs these locally; CI runs them on every PR as part of
`test:unit`. `npm run test:bias` runs the live audit (needs
`OPENROUTER_API_KEY`); the `bias-eval` workflow runs it weekly once the repo
variable `CASEVEX_BIAS_EVAL_ENABLED=true` and the secret are set.
