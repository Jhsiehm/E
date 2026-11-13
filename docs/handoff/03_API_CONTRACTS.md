# 03 — Application API contract (v1)

All paths prefixed `/api/v1`. JSON over HTTPS except uploads (signed PUT) and SSE. The Next.js BFF owns authentication and permission evaluation; do not expose privileged FastAPI endpoints to the browser. OpenAPI must be generated/validated from actual implementation (Zod + Pydantic or equivalent), and a typed frontend client must match this specification.

## Common wire conventions
- Authentication via secure, httpOnly, SameSite Lax session cookies and CSRF protection on unsafe methods. No browser-held Supabase service key. Workspace selected by request context verified against membership (e.g. `X-Workspace-Id`, never trusted without checking).
- IDs are UUIDv7 or UUIDv4 consistently (UUIDv4 acceptable); timestamps RFC3339 UTC; date-only `YYYY-MM-DD`, time zone IANA; money integer micro-USD internally with formatted display; enumerated status strings are explicit.
- List wrapper: `{"items":[...],"nextCursor":"opaque-or-null","totalEstimate":null}`; default 25 max 100, stable `(created_at,id)` sort. Search only among authorized records; 404 hides inaccessible resources. Cursor invalid => 422.
- Single detail `{"data":{...},"requestId":"..."}` (mutations same wrapper); never return unfiltered global bootstrap state. Mutations set `Idempotency-Key` for run creation, upload completion, invitation, monitored event import. `If-Match: "<version>"` on edits for optimistic concurrency.
- Error `{"error":{"code":"string","message":"safe human explanation","requestId":"uuid","fieldErrors":{"field":["issue"]}}}`. 400 malformed; 401 unauthenticated; 403 authenticated disallowed action without sensitive information; 404 inaccessible resource; 409 conflict/version; 413 oversized; 415 bad format; 422 validation; 429 quota; 502 provider error; 503 degraded. `Retry-After` when appropriate.
- Global `GET /me` returns identity + active workspace memberships and per-workspace capabilities; `GET /dashboard?workspaceId=` only authorized summaries and current coverage state, no private names from inaccessible matters.
- Every returned public authority includes `provenance {provider, canonicalUrl, fetchedAt, versionId, publicationStatus}`; private doc source includes `documentVersionId, pageFrom,pageTo, accessScope` (actual access enforced server side).

## Endpoint matrix (method path => contract)
### Identity/workspaces
`GET /me` -> `{id, displayName,emailVerified,jobTitle,timeZone,defaultPracticeArea,workspaces:[{id,name,role,capabilities}]}`
`PATCH /me` editable `{displayName,jobTitle,timeZone,defaultPracticeArea,theme}`; no writable authorization role.
`POST /workspaces` gated onboarding, `GET /workspaces/:id`, `PATCH /workspaces/:id` admin.
`GET /workspaces/:id/members`; `POST /workspaces/:id/invitations` `{email,role,requestedMatterIds?,expiresInDays}` -> status pending, token never returned in browser; `POST /invitations/:token/accept` identity verified and separately scoped; `PATCH /members/:id` admin workspace role only, per-matter assignment separately; `GET/PATCH /workspaces/:id/preferences` capability filtered.

### Matters
`GET /matters?q=&status=&practiceArea=&cursor=&limit=` -> summaries; `POST /matters` body `{name,courtId?,jurisdictionId,practiceArea,partyRole?,docket?,summary?,agentVersionId?,memberAssignments?:[{userId,capabilities}]}` -> 201; `GET /matters/:id` -> `{id,workspaceId,name,...,version,authorizedMembers,documentCount,monitoringStatus,issues:[...],nextConfirmedDeadline?}`; `PATCH /matters/:id` with If-Match; `POST /matters/:id/archive` -> state archived, monitoring paused unless explicitly re-enabled; `GET/PUT /matters/:id/members` authorized ACL changes; `GET/PATCH /matters/:id/issues` reviewed issue tags.
`GET /matters/:id/activity` -> scoped audit-display history. `GET/POST /matters/:id/strategy`, `PATCH /matters/:id/strategy` with version checks and history.

### Documents
`GET /documents?matterId=&q=&type=&status=&cursor=`; `GET /documents/:id` metadata, versions, processing progress; `GET /documents/:id/pages?page=&query=` accessible extracted text; `POST /documents/upload-intents` body `{matterId,filename,sizeBytes,mime,sha256}` -> `{intentId,uploadUrl,expiresAt,requiredHeaders,maxBytes}` 201; upload bytes to URL outside BFF, private; `POST /documents/:intentId/complete` -> `{documentId,versionId,status:"uploaded"}` 202, idempotent; `GET /documents/:id/processing-events` SSE; `GET /documents/:id/download-url?versionId=` signed < 120s; `PATCH /documents/:id` name/classification/matter reassignment with If-Match and permissions; `POST /documents/:id/versions` creates intent for new original; `DELETE /documents/:id` soft-delete checked for hold. No metadata-only uploads in production.
Document processing events: `document.uploaded|scanning|extracting|indexing|ready|failed|quarantined`; `{documentId,versionId,seq,stage,percentage?,errorCode?,message?}`.

### Research
`GET /research-threads?matterId?&cursor=`, `POST /research-threads` `{matterId?:UUID,practiceArea,jurisdictionIds,agentVersionId?}` -> thread; general thread uses `matterId:null`, `scope:"public_only"`.
`GET /research-threads/:id/messages`, `GET /research-runs/:id`, `GET /research-runs/:id/sources`.
`POST /research-runs` body:
```json
{"threadId":"uuid","matterId":"uuid-or-null","question":"What controls?","agentVersionId":"uuid","documentVersionIds":[],"requestedJurisdictionIds":["NY","2d-cir"],"mode":"research"}
```
-> 202 `{"data":{"runId":"uuid","status":"queued","eventsUrl":"/api/v1/research-runs/uuid/events"}}`. Verify thread/matter match; no arbitrary cross-matter version IDs; idempotent request repeated returns original run.
`GET /research-runs/:id/events` SSE with `id: seq`, `event: type`, `data: JSON`, `Last-Event-ID` replay; heartbeat 15s; auth on connect and periodic permission recheck; disconnect does not cancel. Event types: `run.started`, `source.progress` {sourceId,stage:located|fetched|passage_matched|checked}, `source.failed` {sourceId,reason}, `answer.delta` {text}, `verification.result` {claimId,check,status}, `run.completed` {answerId}, `run.failed` {code,retryable}, `run.cancelled`. Every message has `sequence,runId,at`. Persist event **before** delivery. `POST /research-runs/:id/cancel` idempotent; `POST /research-runs/:id/retry` creates new run with `parentRunId` (not mutating old answer). Chat send is a run creation; preserve legacy `POST /api/matters/:id/chat` temporarily as compatibility adapter only.
Research detail `{runId,status,answer:{summary,analysis:[{text,claimIds}],contraryAuthorities,limitations,nextSteps},claims:[{id,text,verificationStatus,sourceIds}],sourceIds:[...],modelId,agentVersionId,finishedAt,coverageSnapshot}`. No full legal claim without claim/source linking.

### Precedents and public sources
`GET /authorities?q=&courtId=&jurisdictionId=&topic=&decisionFrom=&decisionTo=&cursor=` -> coverage-aware results; `GET /authorities/:id` metadata, versions, citation edges, provenance + treatmentScopeStatus; `GET /authorities/:id/passages?versionId=&cursor=`; `POST /matters/:id/authorities` `{authorityId,note?}`; `DELETE /matters/:id/authorities/:authorityId`; `POST /authority-resolutions` `{citation,caseName?,courtHint?}` -> 202 `pending` then resolved/ambiguous/unresolved, never invented.
`GET /legal-data/coverage` -> provider, court coverage, update latency, lastSucceededAt, stale flag, license scope; `GET /authorities/:id/updates` -> legal event list, not blanket good-law status.

### Monitoring, impact, notices
`GET /monitoring-subscriptions?matterId?&owner=me|matter|firm`; `POST /monitoring-subscriptions` body:
```json
{"ownerType":"user","subjectType":"authority","authorityId":"uuid","matterId":null,"jurisdictionIds":["NY"],"frequency":"daily","channels":["in_app"]}
```
or `subjectType:"issue"`, `query:{terms,practiceArea,legalIssueTags}`; matter ownership requires matter access + monitoring privilege. `PATCH /monitoring-subscriptions/:id` status active/paused, frequency, filters, versioning; `DELETE` stop future matching preserving historical audit.
`GET /legal-updates?matterId?&status=&cursor=` events and proposed impacts. `GET /impacts/:id` includes source evidence and coverage. `POST /impacts/:id/review` `{decision:"approve|dismiss|request_changes",direction?:"strengthens|weakens|mixed|unknown",reason,checkedSourceIds:[]}` attorney-only -> updated state + reviewer audit, never silently auto-approved.
`GET /notices?kind=&unread=&cursor=`, `POST /notices/read` `{ids?:[],all?:boolean}` updates authenticated recipient only; `GET/PATCH /notification-preferences` `{channel,frequency,quietHours,timezone,includeConfidentialDetail:false}`.
Provider webhooks use separate service-only signed endpoint, not general session endpoint; validate HMAC/timestamp/replay and idempotent provider event ID.

### Calendar, agents, settings
`GET /calendar-events?matterId?&from=&to=&cursor=`, `POST /calendar-events` `{matterId,title,kind,dueDate?:YYYY-MM-DD,startsAt?:RFC3339,endsAt?,timeZone,sourceType,sourceRef?,confirmed:false}` -> attorney confirmation step for derived dates; `PATCH /calendar-events/:id` If-Match; `POST /calendar-events/:id/confirm` attorney-only; `DELETE /calendar-events/:id` cancel and revoke reminders. `GET/POST /reminders` scoped.
`GET /agent-profiles?practiceArea?&enabled?`, `GET /agent-profiles/:id` incl source policy, evaluated jurisdictions, current published versions; `POST /agent-profiles/:id/clone` admin, `PATCH /agent-profile-drafts/:id` only permitted overrides; `POST /agent-profile-drafts/:id/publish` creates immutable agent version; `PUT /matters/:id/agent` `{agentVersionId}` authorized. `GET /integrations`, `GET /security/sessions`, `POST /security/sessions/revoke`, `GET /audit-events` capability controlled. Never allow `PATCH /me` to change role.
`GET /health/live` and `/health/ready` server-only/redacted; in-product legal-data health from `/legal-data/coverage`.

## Examples of grounded objects
```json
{
  "authorityId":"uuid",
  "caseName":"Verified provider-supplied title",
  "citation":"provider-supplied citation",
  "courtId":"court-identifier",
  "decisionDate":"2026-11-11",
  "publicationStatus":"published",
  "provenance":{"provider":"provider-key","canonicalUrl":"https://court.example/record","fetchedAt":"2026-11-11T18:00:00Z","versionId":"uuid"},
  "treatment":{"status":"coverage_incomplete","lastCheckedAt":null}
}
```
This is **a JSON schema example, not a claim that the example court URL or opinion exists**; fixtures must use `example.invalid` domains rather than legal-source-looking fabricated records in anything displayed to pilot users.

## Required contract tests
OpenAPI spec/TS client parity; 401/404 permission matrix; pagination scoped across tenant; If-Match conflict; idempotency duplicate POST; disabled provider 503 + coverage degraded; authenticated SSE reconnect/replay with no unauthorized events; documented upload processing; no mock source under production; all UI mutations map to one endpoint and success/failure state.
