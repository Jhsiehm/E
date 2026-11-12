# 0005. Test layers and CI

Date: 2026-11-12 · Status: accepted (P0)

## Decision
| Layer | Tool | Location | Needs |
| --- | --- | --- | --- |
| Lint / format / types | ESLint 9 (next core-web-vitals + typescript), Prettier, tsc | — | — |
| Unit | Vitest | `tests/unit` | — |
| API contract | Vitest, calling the route handler directly | `tests/contract` | — |
| Integration | node:test against `next start` | `tests/integration` | `npm run build` |
| Browser | Playwright (Chromium), 1280×720, 1366×768, 1440×900, 1920×1080, 390×844 | `tests/e2e` | `npm run build` |

- Integration and browser tests start their own server, so `npm test` no longer
  needs one running. Integration also boots a production server *without* the
  fixture opt-in to prove live mode refuses sample data.
- Browser tests cover every route and matter tab, no page-level overflow on
  desktop, no horizontal overflow on phone, primary and matter navigation,
  keyboard (skip link, nav, dialog open/Escape, Enter-submit) and key flows.
- `.github/workflows/ci.yml` runs three jobs on every PR: static, integration,
  e2e (uploads the Playwright report on failure).
- Pixel-level visual comparison against `main` was run once for P0 and recorded
  in docs/VERIFICATION.md rather than committed as baselines, because committed
  screenshots are font/OS dependent. Python `pytest`, DB/RLS and chaos suites
  arrive with the services they test (P1+).
