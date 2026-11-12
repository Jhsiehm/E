# 0003. Fixture and live adapters; production never falls back to fixtures

Date: 2026-11-12 · Status: accepted (P0)

## Context
The handoff requires a separate, clearly marked fixture adapter for development
and a test that there is no fixture fallback when `NODE_ENV=production`. The
public demo (casevex.vercel.app) is itself a production build and must keep
showing labelled sample data.

## Decision
`lib/runtime/data-mode.ts` resolves the mode from the environment:

| NODE_ENV | CASEVEX_DATA_MODE | CASEVEX_DEPLOYMENT | Mode |
| --- | --- | --- | --- |
| development / test | unset | unset / demo | fixture |
| production | unset | unset / demo | **live** |
| production | `fixture` | unset / demo | fixture (explicit opt-in) |
| any | `live` | any | live |
| any | `fixture` | `pilot` | **error, request fails closed** |
| any | other value | any | error |

- `app/api/[...path]/route.ts` dispatches to `lib/adapters/fixture/prototype-api.ts`
  (the former mock route, unchanged) or `lib/adapters/live.ts`.
- Live mode answers every call with `503 {error:{code:"service_not_configured"}}`
  until P1 implements real endpoints. It never returns sample data and sets no
  demo cookie.
- Every response carries `X-Casevex-Data-Mode: fixture|live`; the UI keeps its
  "Sample data shown" and "Simulated" labels in fixture mode.
- The demo deployment sets `CASEVEX_DATA_MODE=fixture` in its hosting
  environment. A customer/pilot deployment sets `CASEVEX_DEPLOYMENT=pilot`.

## Consequences
- Any production build without the opt-in shows the boot screen's load error,
  which is the honest state until P1.
- Tests: `tests/unit/data-mode.test.ts`, `tests/contract/api-route.test.ts`,
  `tests/integration/data-mode.test.mjs` (real `next start` without opt-in).
