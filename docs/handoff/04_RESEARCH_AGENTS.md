# 04 — Legal research engine and specialized agent contract

## Objective
Source-grounded US legal research in explicitly supported jurisdictions, initially NY state + relevant Second Circuit/federal consumer-fraud/class-action work. A model is not a legal authority; source identification, verification and ACLs must be independently enforced. Do not imply that an unchecked opinion remains good law.

## Runtime graph
1. Input: authenticated user, authorized matter or public-only thread, question, explicit jurisdiction(s), source version selection, agent_profile_version.
2. Guard: verify user/workspace/matter/document ACL and budgets; reject unsupported combinations (e.g., family law agent without corpus).
3. Plan: a limited structured reasoning plan `{issue,subissues,jurisdictions,practice_area,source_classes,search_queries,needs_document_review}`. Store plan for reproducibility, not hidden user-facing chain of thought.
4. Retrieve: query indexed public authority corpus + allowed private matter documents separately; strict source IDs, tenant filters, court hierarchy, effective dates. Keyword/BM25 baseline with trigram citation resolver. Optional semantic vector retrieved subset only after reviewed recall benchmark; rerank with appropriate model. Never cross matters by default.
5. Evidence assembly: top capped relevant passages, original source URL/version, paragraph/page, opposite-side authorities, court level, source freshness/treatment coverage. Enforce quote length and provider display terms. Distinguish statute effective date vs current, appellate jurisdiction vs persuasive, pre/post amendment.
6. Draft structured answer with short answer, reasoning, citations per material assertion, counterarguments, uncertainty, next steps. No citations created from freeform model strings: model chooses server-issued source IDs and spans only.
7. Verify: `source_exists` via provider/version ID; `quote_matches` via normalized span exact/fuzzy threshold with provenance; `supports_claim` via independent model/classifier with deterministic relevance checks and explicit inconclusive state; `treatment_checked` only against actual licensed/provider-covered treatment source; `attorney_reviewed` only by authenticated attorney. Failed checks remove or clearly mark unsupported propositions and make response abstain on core unsupported conclusions.
8. Persist run snapshot, answer claims, source links, check artifacts, cost, warnings, corpus sync state before sending completed. Stream monotonically sequenced events.
9. Optionally save to matter research, not automatic strategy mutation. Allow explicit opt-in to monitor an authority/issue; don't silently enroll.

## Agents: configuration not standalone actors
`agent_definitions` are immutable built-in templates with versioned workflow configuration. `agent_versions.config_json` schema:
```json
{
  "key":"ny_consumer_class",
  "displayName":"Consumer protection and class actions",
  "practiceArea":"consumer_class_action",
  "supportedJurisdictions":["NY","2d-cir","sdny","edny"],
  "sourceCollectionAllowlist":["ny_official_reports","federal_opinions_licensed","ny_legislation"],
  "workflows":["legal_issue_research","precedent_comparison","motion_research","document_question_answer","monitoring_suggestion"],
  "retrieval":{"maxCandidates":60,"maxReranked":12,"maxPrivateDocumentVersions":15,"publicPrivateMix":"query_dependent"},
  "output":{"sections":["short_answer","reasoning","contrary_authorities","risks","next_steps","sources"],"pinpointRequired":true},
  "verification":{"sourceExists":true,"quoteMatches":true,"claimSupport":true,"treatmentStatus":"coverage_dependent","humanReviewRequired":true},
  "budgets":{"maxUSDPerRun":1.5,"maxSourceTokens":18000,"maxOutputTokens":2500},
  "monitoring":{"suggestWatches":true,"autostartWatches":false}
}
```
These are **illustrative launch defaults**; enforce validated hard upper bounds and cost ceilings from administrator settings. Provider catalog entries are configuration names, not proof of licensed access. Profiles can narrow source policy, never widen beyond firm/license access. Change jurisdiction, research issue checklists, templates and allowed source ranking; avoid superficial persona prompts.
Firm custom profiles: admin clones approved template, edits permitted settings in UI, saves draft, runs validation with safe fixtures, publishes immutable numbered version. Historic research references old version. Matter assignment chooses published allowed version, run can override among approved profiles with explicit record. Source ACL never inherited from agent. No freeform scripting, arbitrary network tools or unreviewed autonomous actions.

## Minimum concrete specialist workflows
**Consumer fraud/class action (first pilot):** identify governing statute (e.g. relevant state consumer protection), jurisdiction, elements, pleading standards, class certification considerations, arbitration clauses, causation, materiality, damages, and available contrary precedents. No claim that rule applies without case facts and current sources.
**Civil litigation:** motions/pleadings, procedural timing (advisory only), burden, standard of review, relevant court hierarchy, distinguishing facts, cited-record links.
**Employment (later coverage gate):** statutory/admin requirements, federal/state conflicts, discrimination/wage/retaliation issues; agency materials separated from judicial opinions and labeled legal weight.
**Contracts/corporate/trust/estate/regulatory/real estate:** UI templates may exist but must remain `limited`/disabled until datasets, domain-specific test questions and reviewer approval are established. Avoid a misleading universal law agent.

## Research modes
- Public-only general question: no private matter files; explicit selected jurisdiction/corpus.
- Matter research: permitted matter docs + public corpus, no non-member material.
- Document Q&A: cite original uploaded page/paragraph; do not treat client allegations as legal findings.
- Compare authorities: at least 2 verified opinions, table of factual/procedural differences + holding; label unresolved source.
- Motion drafting: produce an editable **draft** with claims/sources and placeholders for uncited facts; never file and never present as finished attorney work.
- Monitoring suggestion: propose explicit subscriptions based on attorney-confirmed matter issues and cited authorities, require user action.

## Extraction and adversarial defense
Treat PDFs, web pages, emails, filings and client uploads as untrusted data, never system instructions. Prompts only from server-controlled versioned templates and validated firm config. Disable tool calls except narrowly scoped legal-provider read/search and internal data retrieval. All internet requests go through allowlisted adapters. PII/privilege considerations: minimize model-sent passages, inspect provider no-training/retention terms, opt out of prompt logging, never feed one firm data to another firm's caches/fine-tuning. Use no confidential client document for general model training.

## Verification detail
Verification is not one boolean. A document may exist and quote exactly while not supporting the proposition, or support a proposition without verified subsequent negative treatment. Claims states: `supported|partially_supported|contradicted|unverified|no_source`. Source states: `exists|unavailable|incorrect_citation|unsupported_quote`. Treatment states: `not_checked|limited_coverage|no_negative_treatment_found_within_scope|potential_negative_treatment|attorney_reviewed`; avoid literal `good_law`. If legal provider lacks full treatment, show coverage limitation and last checked timestamp.
SSE source progress tiles: 4 columns `located,fetched,passage_matched,checked`, row per real source. A row marked complete after all scheduled checks succeeded; failure state explicit, no timer-generated status. The current React `ResearchProgress` is a mock and must be refactored to accept server events. Answer tokens may stream before verification but clearly display **preliminary / verification in progress**, then persist a final validated form; do not reveal unsupported final result as verified.

## Prompt/answer examples in tests
Use synthetic fictional court namespace `example.invalid` and synthetic matters, never invented case names appearing as live law. Provide a curated set of **actually verified** public opinions separately after rights and provenance review. Expected structured example:
```json
{"summary":"The answer depends on the alleged conduct and applicable forum.","analysis":[{"text":"An element requires factual support from the record.","sourceIds":["src-1"],"claimId":"claim-1"}],"contraryAuthorities":[],"limitations":["Subsequent treatment not available from current provider."],"nextSteps":["Review source and discuss jurisdiction with counsel."]}
```

## Quality gates and benchmarks
Create human-reviewed golden evaluation dataset: >=60 real source-grounded queries across pilot issues and >=30 adversarial/negative cases (no authority, changed law, forged citation, fabricated page, outdated opinion, contradictory cases, unauthorized doc, prompt injection). Test citation resolution precision, grounded factual support, answer abstention, contrary authority recall, quote pinpoints, retrieval recall@10, cost, p50/p95 latency, and ACL denial. Initial release target: **zero invented-citation acceptance in release evaluation**, 100% source ID provenance, no unauthorized source exposures, all core claims linked to supported evidence or explicit limitations, >=95% correct source retrieval on curated easy set; target p95 initial research status acknowledgement <3 seconds (answer completion variable). Set final model benchmark thresholds with attorney review; never say a model is certified by this.
Model provider adapters implement timeout, retry with jitter, cost telemetry, allowed models, privacy and fallback policy; do not silently downgrade to unverified model in production. If source provider down: narrow answer with visible coverage gap or fail safely.

## Debuggable evidence and evaluation
Persist prompt template version, agent version, model model/version, seed/settings if supported, source-corpus cutoff, provider snapshot identifiers, source hashes, verification checks and reviewer decisions. Capture only minimal metadata in logs and store confidential traces in access-controlled encrypted audit traces if necessary, with retention controls. Evaluate differential behavior when agent version changes before publication.

## Implementation tests
- query matters A/B: no A evidence in B answers, autocomplete, sources or stream
- invalid freeform source/citation rejected and marked unverified
- fabricated case not resolved
- quote span mismatch marked failed
- positive assertion with only weak/contrary evidence yields caveat/abstention
- opinion cited in later decision does NOT become automatically 'overruled'
- prompt injection in uploaded PDF ignored
- SSE replay deterministic, disconnect safe, terminal events after durable persistence
- no-source response safe, budget cap enforced, cancelled run status retained
- archived matter research access retains ACL and respects archive policy
- profile version pinning, immutable history, firm-only custom profile.
