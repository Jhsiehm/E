# Casevex: Codex implementation handoff
Version: 1.0 | November 11, 2026 | Status: approved engineering baseline for implementation, subject to launch gates

## Start here
This directory is the authoritative **planned** product and engineering contract. It is not proof of working production services. Implement it against the existing 10-screen Next.js prototype **without redesigning the visual language or deleting existing user flows**. Read, in order:

1. [01_PRODUCT_FUNCTIONAL_SPEC.md](01_PRODUCT_FUNCTIONAL_SPEC.md) — all screens, workflows, states, edge cases.
2. [02_ARCHITECTURE_DATA_SECURITY.md](02_ARCHITECTURE_DATA_SECURITY.md) — infrastructure, tenancy, migrations, auth, files, workers.
3. [03_API_CONTRACTS.md](03_API_CONTRACTS.md) — exact public app API, pagination, errors, events.
4. [04_RESEARCH_AGENTS.md](04_RESEARCH_AGENTS.md) — model integration, retrieval, claims, citations, specialization.
5. [05_LEGAL_DATA_MONITORING.md](05_LEGAL_DATA_MONITORING.md) — authority ingestion, temporal legal updates, subscriptions, impact reviews.
6. [06_DELIVERY_TESTS_CODEX.md](06_DELIVERY_TESTS_CODEX.md) — repo modifications, ordered tasks, acceptance gates, fixtures, runbook.

Existing references: `docs/CASEVEX_SPEC.md` (original 10-screen prototype specification), `docs/BACKEND_PLAN.md` (initial architectural intentions), `docs/schema-draft.sql` (illustrative/non-executable draft). **When plans conflict, these numbered handoff documents take precedence for new implementation**, but existing visual design constraints remain authoritative unless explicitly changed here.

## Product scope / decisions locked for build
- Market: small US litigation firms; **pilot = one invited firm, focused on NY + relevant federal consumer-protection/class-action research**. No blanket US-wide coverage claim. Structure for multitenancy from day one; launch additional firms only after isolation and security gates.
- Promise: matter-centered legal research, authentic and inspectable legal sources, safe document analysis, configurable practice-area research profiles, attorney-controlled monitoring and legal-update alerts. Casevex assists, **never autonomously files, gives unqualified good-law guarantees, or computes court deadlines as final**.
- UX: retain Dashboard, Matters, matter tabs, Agents, Precedents, Notices, Documents, Calendar, Settings. Add contextually appropriate drawers, tabs and small controls. Preserve paper/navy/rose/olive visual system, source-progress tiles, no desktop page-level scrolling, keyboard and mobile access.
- Backend: Next.js server-side app/BFF, PostgreSQL (Supabase recommended), private object storage, Python 3.12+ FastAPI research/ingestion service, durable worker queue (Trigger.dev or equivalent; choose one and record ADR), provider adapters. Vercel may host Next.js; worker must run on an appropriate always-on/background-capable platform. pg full-text first, pgvector behind evaluation gate. One modular app plus separate asynchronous research service; avoid microservice sprawl.
- External dependencies: Supabase, identity, LLM(s), email, authoritative corpus, billing and e-filing/docket provider access are **not** configured. Sandbox/development mode must work using synthetic, unmistakably labeled fixtures without real customer information. Make integration interfaces replaceable; never invent valid legal authorities.
- Initial review: launch-blocking items include provider commercial rights, data-processing arrangements, confidentiality threat modeling, jurisdiction coverage disclosure, attorney evaluation, negative access tests, audit logging and restore testing.
- Never merge the implementation by default; open pull requests for review. Never put secrets or client content in committed source.

## Canonical concepts and identity
`workspace` = firm/tenant; `user` = authenticated person; `membership` = tenant role; `matter` = authorized client case; `agent_profile` = versioned practice-workflow configuration; `agent_assignment` = chosen profile/version for a matter; `authority` = distinct public legal source with provenance; `matter_authority` = saved association; `research_run` = persisted asynchronous answer attempt; `monitoring_subscription` = explicit watch; `legal_event` = normalized provider change; `impact_assessment` = proposed relevance with reviewer outcome; `notice` = per-user routed communication.

## Scope policy
**MVP** = secure firm setup, matters, real documents, grounded research with inspectable source spans, selected agent assignment, saved authorities, non-autonomous calendar, source/alert scaffolding.
**Pilot+** = actual monitoring provider ingestion with attorney-reviewed impacts, personalized watch subscriptions, invitation/email digests, specialist profiles, document intelligence.
**Later** = cross-matter knowledge (opt-in with explicit ACL), comprehensive citator agreements, multi-state legal datasets, automated deadline suggestions, e-filing, DMS/calendar integrations, custom firm-built workflows, billing. Do not secretly implement later features as unreliable heuristics.

## Contract-driven implementation
All mutation endpoints need validation, authenticated permissions, audit events, stable IDs and idempotency where specified. Document legal claims must include stable canonical source IDs and checked quoted spans. UI must display pending/uncertain/failed status without equating AI confidence with legal authority. Live services **must not** fall back to fabricated/demo answers. In dev fixture mode, label mock outputs as synthetic; production denies fixture mode.

## Authority & product copy
- AI output: `Research aid for attorney review. Confirm each authority before filing.`
- Impact: `Potentially relevant; not an attorney-verified change to the law.` until reviewed.
- Coverage: `Last checked [timestamp]; [provider/jurisdiction scope]; [status]`. Never promise no changes occurred when coverage is missing.
- Verification: distinguish `source_exists`, `quote_matches`, `supports_claim`, `treatment_checked`, and `attorney_reviewed`. One green dot is not an unconditional legal conclusion.

## Engineering decision defaults
If a minor detail is unspecified, select the simpler reversible implementation, log a short ADR in `docs/decisions/`, add tests, and proceed. **Do not invent contracts, legal-rights clearance, security certification or real source coverage**. Stop and flag a true external gate only when it prevents a lawful/safe production launch; use fixture-backed integration tests in the meantime.

## Handoff completion checklist
Implementation is done only when each numbered document's acceptance gates pass, real credentials/configuration have been separately provisioned, production mode uses no mocks or fictional decisions, and attorney reviewers explicitly sign off on source accuracy and monitoring limitations.
