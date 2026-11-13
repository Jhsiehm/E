# 0011. Append-only audit trail and AI usage log

Date: 2026-11-13 · Status: proposed (bedrock 2 of the backend foundation plan)

## Decision
- `audit_events` gets one row for every create, edit and delete of matters,
  matter access lists, deadlines, strategy notes and firm memberships. Rows
  are written by database triggers as the definer, so app code cannot skip
  or forge them. A row names the columns that changed, never their values,
  so the trail itself holds no client content.
- `usage_events` gets one row per AI model call (model, tier, tokens, cost,
  latency; no prompt or reply text), written by the server as the signed-in
  user for their own firm. The research preview route records every call.
- Both tables are append-only: updates are refused for everyone, including
  the database owner; deletes only happen when a whole firm is deleted.
- Firm owners and admins can read both. Members can see one number, the
  firm's AI spend today (`ai_spend_today`), which the server checks against
  `CASEVEX_AI_DAILY_LIMIT_USD` (default $25) before any model call.

## Consequences
"Who changed this, and when" and "why is the AI bill this high" are answered
from the database. A screen for the audit trail is not built yet.
