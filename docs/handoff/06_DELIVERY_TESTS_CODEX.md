# 06 — Codex execution guide, UI mapping, tests and release gates

## Codex mission
Implement the full Casevex **pilot** functionality in the existing repository on feature branches, not just scaffold services. Preserve the existing 10 wireframes, visual identity and animations as *truthful representations of backend state*. The complete product specification is in docs/handoff/01–05. Build in the strict dependency order below, with demonstrable vertical slices and tests. Do not ship mock legal analysis under production feature flags. Do not merge PRs without review.

## Current repository audit baseline (2026-11-11, main)
- Next 16.4.6, React 19.3.1, TS, Tailwind 3, no auth/db/LLM/storage dependencies. `components/Workspace.tsx` 2,780 lines, single client UI; `app/[[...path]]/page.tsx` catchall routes; `app/api/[...path]/route.ts` ~10KB mock adapter; `lib/mock/data.ts` synthetic data; `lib/mock/store.ts` cookie-keyed in-memory state.
- Mock `GET /api/bootstrap` returns entire state. No real ACL, uploads only metadata, `POST /api/matters/:id/chat` returns canned string, client simulates streaming with timers. `ResearchProgress.tsx` animates fixed 4x4 grid on timer; must consume real progress statuses. `/agents` assigns agent ID but cannot edit versioned specialty settings; `/precedents` searches local sample only. Notices have hardcoded impact text for `n1`. Settings notifications/integrations/security are placeholders. Dashboard Ask practice sends to `/matters/anderson/chat` regardless of practice; general research says coming soon. `TODAY` anchored to Nov 11, 2026. `Profile.Role` is editable; production must separate job title from membership role. No unlicensed novel legal data.
- Current `docs/VERIFICATION.md` records prototype typecheck/build/five tests but **is not proof of production testing**.
- Screen compatibility: preserve `/`, `/notices`, `/matters`, `/matters/[id]`, matter tabs `documents,research,notices,deadlines,strategy,chat`, `/agents`, `/precedents`, `/documents`, `/calendar`, `/settings/[section]`. Keep existing navigation and tight desktop viewport with internally scrolling panels, responsive mobile design and reduced-motion accessibility.

## Work package order; one PR per package, independent migrations and tests
### P0 — repo split / contracts / CI
- Create `lib/api/client.ts` with typed fetch, errors, cursor/retry, auth-safe parsing; `packages/contracts` or `lib/contracts` with generated types derived from OpenAPI.
- Extract `components/Workspace.tsx` into shell, routes, reusable list/card/drawer/chat/progress components without changing appearance. Introduce data hooks, no full-state bootstrap for production.
- Keep separate `fixture` dev adapter (marked everywhere) and production adapter; test no fixture fallback when `NODE_ENV=production`. Add lint, typecheck, unit, API contract, integration and browser CI. Establish architecture decisions `docs/decisions/`.
- Gate: baseline 10 screens visually equivalent at 1280x720, 1366x768, 1440x900, 1920x1080, 390x844; nav works, keyboard tests, no page-level desktop overflow. Existing tests pass.

### P1 — identity, workspace permissions, database
- Provision env-aware DB/auth config, create migrations from 02 (do not directly apply schema draft), policies and seed only in dev. Implement invite-first workspace and membership/matter ACL and matter CRUD, issues, strategies, audit. Role/job title separated.
- Gate: negative access tests for across workspaces, matter ethical walls, direct URL, empty search counts, exports, access revocation, worker retrieval; real non-owner RLS tests; session expiration/revocation, CSRF, job title role escalation blocked. Matter creation/edit/archive/strategy persists after service restart.

### P2 — private documents and processing
- Private storage upload intent, upload complete, virus/MIME checks, PDF/DOCX extraction sandbox, OCR optional gated, document pages/version/chunks and indexes; UI progress/retry/preview/download/version/move/delete.
- Gate: exact file bytes persist and private authorized download returns same SHA; 20MiB cap, MIME spoof/zip bomb/malware simulation, storage ACL, revoked member denied, failed parser recoverable; documents appear correctly across matter/global UI.

### P3 — legal authority corpus and research
- Implement at least one rights-approved opinion source with source provenance/coverage, official/court links and title/citation resolver. Add public-only research threads; private matter research with approved provider model, background durable jobs, SSE/replay, structured answers, evidence inspector and distinct verification checks. Prompt injection protection and run budgets.
- Gate: no invented authority accepted in evaluation, all citations link to resolvable server-owned records, invalid citation marked, missing evidence abstains, ACL and model-privacy gates pass, source progress events true; general research never routed to Anderson. Run status persists after browser reload, disconnect and service restart; cancel/retry works.

### P4 — agent customization and specialization
- Versioned built-in profile, firm admin clone/draft/publish (allowed knobs only), strict source/jurisdiction entitlement validation, assignment and per-run override, profile preview, governance. Enabled pilot profile only; other specialties limited until sources/evaluations ready.
- Gate: published profiles immutable, assignment version pinned, cannot raise permissions or access unlicensed sources, different profile produces demonstrably different research plan/source selection; UI card/drawer/assignment works.

### P5 — monitored precedent and reviewed notices
- Legal provider feed with cursor/version/dedup/health; explicitly followed authorities/issues, per-matter reviewed issue tags, matching, assessment, attorney approval, notices and digest preference; update Precedents and Notices UI.
- Gate: same provider event+matter+recipient yields one notice; no unauthorized matter names in alerts; proposed impact clearly labeled, read != approve, provider outage visible, edited/withdrawn opinions produce correction, archived watch pauses; baseline shadow-run and human evaluation documented.

### P6 — calendar, settings, collaboration and pilot hardening
- Persistent confirmed events/reminders, timezone, version checks, firm invitations, audit exports, notification preferences, integrations/health and backed-up restore. Privacy/retention and legal hold controls, usage/cost limits, monitoring, backup/restore drills and security review.
- Gate: cross-timezone/date-only tests; no unconfirmed auto-calculated deadlines; email opt-in/quiet hours respected; old member removed cannot access cached source/results or signed URLs beyond short expiry; restore succeeds; documented external source rights and attorney acceptance.

## UI to backend binding: traceability matrix
| Existing UI element | Files/line pointers | Target | Verify |
| --- | --- | --- | --- |
| Global dashboard ask | Workspace.tsx ~755-792 | POST research-threads; POST research-runs; practice/jurisdiction/matter selection | never hardcode `anderson` |
| Matter header/tabs | Workspace.tsx ~1397-1450 | matters, matter_members, strategy, issues, scoped tabs | same matter ID and ACL throughout |
| Chat composer | Workspace.tsx ~646-699, ~1137-1215 | research-runs + SSE, persisted messages, source inspector | no setTimeout fake answers |
| Research tiles | ResearchProgress.tsx | run_events source.progress / verification.result | per-source true check states |
| Documents / upload | Workspace.tsx ~1293-1306, ~1718-1779, ~2329 | upload-intents, complete, processing-events, signed originals | metadata-only upload removed |
| Precedents | Workspace.tsx ~1584-1715 | authority search/detail, save/follow, updates | no fake verified case |
| Agents | Workspace.tsx ~1530-1582, ~2533-2575 | agent-profiles/version drafts, matter-agent assignments | config validated and pinned |
| Notices / impact | Workspace.tsx ~1456-1529, ~2460-2500 | notices, impact_assessments, reviews | no hardcoded `n1` impact |
| Calendar | Workspace.tsx ~1781-1907 | calendar-events, confirmations, reminders | real clock/timezone |
| Settings | Workspace.tsx ~1909-2115 | me, membership, preferences, integrations, audit | profile role cannot grant ACL |
| Initial global data | Workspace.tsx ~555-565; mock route | scoped dashboard/resource endpoints | no full unrestricted bootstrap |
Paths/line numbers reflect inspected main and will shift after refactoring.

## Definition of done per feature
1. Exact UI entry point and permissions described.
2. Endpoint schema + generated TS client + request validation.
3. Database migration + RLS + scoped indexes + durability and idempotency.
4. Successful, loading, empty, error, partial, authorization, offline and conflicting-write UI states.
5. Unit and integration tests including negative access, provider failure and cost limits.
6. Browser tests desktop/mobile keyboard; accessibility checks; existing interactions preserved.
7. Audit trail and telemetry with content redaction.
8. Docs and rollback notes; feature flag until launch criteria met.

## Automated suite
- `npm run typecheck`, `npm run build`, `npm test` (current baseline), plus `npm run lint`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e` after configured.
- Python `pytest` for ingestion, public provider adapters, legal-source resolution, access scoped retrieval, verification, profile policy, model budget, monitoring matching and replay.
- DB test role must NOT be privileged: row-level negative access, composite FKs, record versions, index/search ACLs and query explain plans.
- Browser tests all ten routes and routes for nested matter tabs; full create→upload→analyze→cite→follow→ingest synthetic update→review alert→read in-app flow. Use fixture provider and synthetic made-up opinions clearly labeled; source URLs in tests use `example.invalid`, never present as real.
- Chaos tests duplicate jobs, queue retry, storage timeout, provider 429, malformed document, SSE interruption, stale legal-source coverage, corrected authority, permission revocation mid-run, failed email, concurrent writes.
- Observability health metrics with alert thresholds; no raw client input in ordinary application logs.

## Acceptance fixtures / goldens
Fixture workspaces A and B; A has restricted matter M1 accessible to attorney A1 but not paralegal A2, B has matter M2; isolated storage objects and index chunks. Synthetic legal authority L1 with version V1, corrected V2; candidate citing source L2 with distinction language; withdrawn L3; test 'no source' question; crafted malicious PDF prompt; unconfirmed extracted deadline; duplicate event E1; source provider 503; subscription S1 for attorney, S2 for matter. Tests ensure no tenant/matter leaks and no fictional law in production.
- Golden QA must be reviewed by real attorneys for law accuracy, not just LLM scoring. Track false alert rate, missed material precedents, citation reliability, coverage and benchmark versions.
- Targets not blanket guarantees: initial response acknowledgment p95 <3s excluding app start; in-app alert processing during healthy coverage within published service objective; zero cross-tenant exposures or invented sources in test corpus. Final performance and accuracy acceptance requires pilot signoff.

## Human/external launch gates (do not block local implementation)
- Provider licensing/rights/attribution and coverage verified in writing; select accessible providers based on entitlement.
- Cloud accounts, DNS, secrets, email sender identity, LLM/data processing terms, privacy policy/legal counsel/security review, retention policy and attorney evaluation group established.
- Court coverage lists and case-law currency disclosure; no comprehensive citator or guaranteed docket monitoring without proper source.
- Budget/forecast and data-classification limits agreed by firm; production data never used in dev.
- No billing/e-filing/deadline automation unless separately approved.

## Final Codex prompt (copy verbatim or point Codex to this file)
> Work in repository Jhsiehm/E. Read docs/handoff/README.md and each numbered handoff document 01–06 before coding, along with existing docs/CASEVEX_SPEC.md, docs/BACKEND_PLAN.md, current app, API and mock code. This is a functional rebuild behind existing Casevex wireframes. Do not redesign UI, fabricate legal precedents, use demo data in production, or bypass scoped authentication. Implement P0 then P1 through P6 as independent reviewable PRs, adding tests, schema migrations, typed API contracts, real state transitions, provider adapters, and security controls per the specs. Keep unsupported/unlicensed integrations behind disabled flags with honest coverage messaging. Do not silently omit features or claim mock flows are production-ready. At each PR describe changed endpoints/screens, tests executed, risks, unresolved external gates, and next package; refrain from merging without explicit review.
