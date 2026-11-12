# 0008. Agents are tested configuration; AI experience sets how much is on screen

Date: 2026-11-12 · Status: proposed (P4 groundwork)

Plan: [Casevex Specialist Agents Plan](https://claude.ai/artifact/FA6A5xSKzq7pAxpWEm3Hj4)

## Context
The Agents screen showed six agents as "Available" with no data behind them.
Spec 04 says agents are versioned configuration, not standalone actors, and
must not imply support we can't back. Onboarding (P1) now asks users how
comfortable they are with AI, and the product has to stay simple for lawyers
who have never used it.

## Decision
- `lib/agents/catalog.ts` holds one built-in agent per practice area, in spec
  04's `config_json` shape plus niche playbooks, a tool allowlist, routing
  tier names and readiness evidence.
- Agents specialize through sources, jurisdictions, issue checklists and
  tests, not fine-tuning. Freshness comes from P3 retrieval and P5 monitoring.
- `effectiveStatus()` never trusts a requested "available": it needs
  60+ golden and 30+ adversarial cases passed, zero invented citations,
  a confirmed corpus and attorney sign-off. Until reviewers exist, nothing is
  available (consumer class action and NY civil show Beta; employment Beta;
  the rest Coming later). The fixture API refuses assignments to Coming later
  agents with 409.
- `lib/agents/tools.ts` lists the only tools agents get. All read within the
  user's access or create drafts a person must keep. Chronology and client
  letters were approved on 2026-11-12; deadline suggestions are deferred
  until after the pilot.
- `validateAgentConfig` / `validateFirmVersion` enforce hard limits: checks
  can't be turned off, watches never auto-start, the drafter is the frontier
  tier, budgets stay at or under $1.50 a run, and firm versions only narrow.
- `lib/agents/experience.ts` maps `profiles.ai_experience` (new, some,
  advanced; null = new) to Guided, Assisted and Full. Levels only change
  what is shown up front; verification is identical at every level.

## Consequences
- `PracticeAreaKey` and `TierName` mirror `lib/practice-areas.ts` (P1) and
  `lib/ai/tiers.ts` (routing). Swap them for imports once those merge.
- The shared practice-area list should take its `agentStatus` from
  `statusForPracticeArea()` so the two never disagree.
- UI gating by level is a library today; screens adopt it once P1 exposes the
  profile to the workspace.
