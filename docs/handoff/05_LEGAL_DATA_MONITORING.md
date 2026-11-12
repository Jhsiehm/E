# 05 — Legal data ingestion, precedent updates, personal monitoring

## Provider strategy, rights and launch status
Product begins with a **source-limited corpus**, not a universal US legal citator. Proposed connectors (each disabled until verified access/rights): NY Official Reports/State Law Reporting Bureau for published NY opinions; New York Senate Open Legislation for legislative metadata/text according to API terms; CourtListener for its available case law, citations, alerts and RECAP docket data within contract/coverage; official federal court/opinion sites and GovInfo for properly licensed public statutes/rules/regulations. Separate primary sources, aggregators, editorial summaries and court filings. **Do not scrape around robots, API limits, authentication, PACER fees, or commercial reuse restrictions.** Provider diligence must record court/date coverage, API limits, redistribution, storage/indexing rights, opinions vs docket limits, attribution, latency, deletion policy, commercial use, availability, cost and negative-treatment/citator rights. No provider assumed to supply comprehensive Shepard's/KeyCite-quality treatment.
Source references for provider due diligence (verify latest docs/terms before implementation):
- NY Official Reports: https://www.nycourts.gov/reporter/
- NY open legislation: https://legislation.nysenate.gov/
- CourtListener API: https://www.courtlistener.com/api/
- GovInfo API: https://www.govinfo.gov/features/api
Legal rights and coverage are launch gates, not solved by these URLs.

## Adapter contract
`LegalProviderAdapter`: `getCoverage()`, `pollChanges(cursor,window)`, `resolveCitation(citation)`, `fetchAuthority(providerId)`, `fetchFullText(providerId)` (only when licensed), `getCitingReferences(authorityId)`, `getDocketEvents(docketId)` (when supported), `getTreatmentEvidence(authorityId)` (only if truly provided). Return normalized IDs, canonical source URL, source timestamp, fetched timestamp, provenance, checksum, source licensing status, text availability and per-record errors. Raw provider snapshot stored encrypted/appropriately licensed separately from normalized metadata. Normalize citation aliases; dedupe by provider primary ID plus court+docket+date+document checksum, with human-review conflicts.

## Incremental ingestion
Every 30-60 min **as a configurable target, not a guaranteed service level**, poll official opinion sources or use signed webhooks if offered; legislation every 6-24h per provider terms; docket feeds only for supported explicit watches. Checkpoint a cursor and last successful update **after durable commit**; overlap windows for late-arriving events; replay idempotently. Use max 5 attempts bounded exponential backoff with jitter, dead letter and manual replay. For each source event: create immutable event with provider ID + version hash; load original record; classify new|modified|corrected|withdrawn|citation_update|legislation_amendment|docket_activity; update authority version/provenance; rebuild only changed searchable segments; process matching jobs. Distinguish legal effective date from publication date and ingestion date, annotate superseded laws without deleting old versions. Editorial/headnote summaries not counted as primary authority.

## Citation / treatment logic
Citation-edge detection extracts potentially cited authorities and their exact passages; resolve case IDs; distinguish bare citation from actual legal treatment. Classification `cited|discussed|distinguished|criticized|limited|overruled|unknown` is **candidate AI labeling** until evidenced and, for strong assertions, attorney reviewed. Never assert that no negative treatment exists without defined complete provider scope. Per authority display: `Subsequent treatment: not checked / limited scope checked through [time] / possible negative treatment [link]`. Store court hierarchy and opinion status; a trial decision in another jurisdiction is not controlling, and a negative treatment term in quoted dicta is not automatically dispositive. Corrected/withdrawn opinion event always flags existing saved uses.

## Monitoring subscription types and owner
- User watch: explicit Follow authority, Follow legal issue, Watch jurisdiction/court, Watch statute/bill; owner user, private notification settings.
- Matter watch: authorized attorney selects a matter, confirms proposed legal issues and authorities; owner matter; only assigned authorized recipients.
- Firm watch: workspace-approved practice area/court collection, opted recipients and source scopes; no implicit access to ethically walled matter links.
- Docket watch: court docket provider must actually support that venue; per-docket authorization and terms.
Defaults: not auto-enrolled. New matter may suggest issues from uploaded docs, but attorney must accept. Subscription has explicit jurisdictions, subject, frequency, channels, paused flag and coverage status.

## Matching and relevance pipeline
One new authority is processed **once globally** for lawful shared public corpus processing, then matched to compatible indexed subscriptions; don't re-fetch full text for each lawyer. Stage 1 deterministic: jurisdiction/court, source type, cited authority, version changed, keywords and issue tags; stage 2 semantic similarity/rerank on explicitly opted subscriptions; stage 3 matter-context impact hypothesis using ONLY authorized matter information and minimum necessary details. Dedup event+subscription+matter+recipient. Each assessment saves: legal event, matched issue, affected allowed matter, exact court/version/source spans, reason, impact `strengthens|weakens|mixed|unknown`, uncertainty, jurisdiction weight, review status, reviewer and time, provider coverage. High-consequence impact claims go to attorney review queue before being stated as validated. A proposed alert may say **potentially relevant**; approved impact may identify reviewer. The alert link must not leak restricted matter details to other recipients. No matter content sent to external provider watchlists.

## Scoring and alert routing
Compute candidate relevance based on source/citation overlap, jurisdiction fit and issue overlap; start with transparent configurable ranking; LLM performs structured interpretation only when source and subscription survive deterministic filters. Do not label a probabilistic score as legal significance. Initially show `High relevance for review`, `Review when convenient`, `Low-confidence match` with reasons; no numeric certainty to attorneys. Proposed impacts visible to authorized reviewers via Notices/Review queue. Approved/dismissed assessments audited. After approval dispatch in-app and opted email; email default only case name + generic event indicator where policy permits, otherwise generic link. User receives max one alert per matter/event and concise daily summary; same public event may affect multiple matters but display linked results with ACLs.

## Interface placement
- Dashboard top banner: newest authorized high-relevance update; clear `proposed` vs `reviewed`, affected count, freshness and coverage.
- Notices: existing drawer extended with source version, 'Why matched', passages, matter issue, proposed impact, `Approve/Dismiss/Needs changes` only for authorized attorneys; mark-read separate.
- Precedents: add Search/Saved/Following/Updates tabs and Follow action; detail shows citing updates, source provenance, last checked and treatment limitations.
- Matter > Research: saved research, followed authorities, track issue toggle after confirmation; Matter > Notices: relevant per-matter updates.
- Settings > Notifications: frequency/digest/quiet hours/scope; Integrations: provider coverage and status.
- Agent detail: whether source/monitoring supports practice area/jurisdiction; disabled profiles cannot imply ready support.

## Failure and stale-data behavior
Poll fails => `coverage_degraded`, last successful checked time visible. Provider returns zero => 'No new items seen in covered source since [timestamp]', not 'no important new case law'. Citation can't resolve => pending or unresolved, no made-up case. Model impact ambiguous => human review, no automatically strong/weakens statement. Matter archived => pause watches (keep history); user removed from matter => revoke access immediately and cease dispatch; deleted watch => stop future alerts while retaining reviewed historical records according to retention. Notification provider failure => retry, preserve in-app and failed-delivery state; quota => backpressure and digest. Provider retraction => issue correction and link prior alerts, do not silently overwrite.

## Critical safety and rights cases
Copyright/contract limitations govern stored opinion text, snippets and rehosting. Original opinions or private source text cannot be republished merely because search result exists. Avoid serving copied treatise/headnotes from commercial citators without rights. Verify service of process, e-filing and deadline jurisdictions separately; monitoring is **not** official notice from a court. Prompt injection, forged legal documents, stale judicial opinions and unauthorized docket content are explicit negative test cases. Store original URL and checksum to support audits.

## Pilot provider milestone & acceptance
- Contract/terms checklist signed for every enabled provider, with attribution and coverage.
- 14-day shadow run against a curated independently confirmed sample of opinions/legislation; no invented events, duplicates suppressed and accurate correction handling.
- 20+ matter-issue watch cases with attorney feedback: measure precision@alert and important-change recall on deliberately sampled examples; tune thresholds with reviewer signoff. Zero unauthorized disclosure. Test loss of polling, backfill, duplicate webhook and 72h stale coverage.
- Docket tracking only when supported; show unavailable rather than fake coverage.
- Distinguish provider freshness, opinion publication date, legal effective date, and internal processing time everywhere.
