# 0010. Matters in the database, with access enforced by Postgres

Date: 2026-11-13 · Status: proposed (bedrock 1 of the backend foundation plan)

## Context
Every matter, deadline and strategy note came from in-memory sample data.
Lawyers need ethical walls: being in the firm is not enough to see a matter.

## Decision
- Tables: `matters`, `matter_members` (the access list), `matter_deadlines`,
  `matter_strategy`. Every row carries `workspace_id`; composite foreign keys
  stop a child row pointing at another firm's matter. `workspace_id`,
  `created_by` and `version` are not writable by users (column grants).
- One permission function, `private.can(workspace, matter, action)`, holds
  the rules; every row-level-security policy calls it. Firm-level actions use
  `private.can_workspace`. Rules: active firm member AND on the matter's list;
  owners and admins are not an exception. Role then decides write (owner,
  admin, attorney, paralegal), and delete, export, confirm a deadline and
  share (owner, admin, attorney).
- Matters are created only through `create_matter()`, which puts the creator
  on the list. People are added or removed only through
  `add_matter_member()` / `remove_matter_member()`, same firm only, and a
  matter always keeps one person.
- Edits bump `version`; the API refuses a stale edit with 409.
- The live API (`lib/adapters/live/`) serves bootstrap, matters and strategy
  from Supabase as the signed-in user, so the database decides access, not
  app code. Other screens stay 503 in live mode until their step lands.
- Tests run every migration on a plain Postgres with a small Supabase shim
  (`tests/db/`), including Supabase's default grants, then run the shared
  access matrix (both directions) plus targeted cases. CI runs them in a
  Postgres service container.

## Sharing
The spec let only owners and admins share a matter, so an attorney who
opened a matter could not add their own paralegal, and the owner could not
either unless they were on it. On 2026-11-13 Joshua decided attorneys on a
matter may share it. Inviting people into the firm stays owner/admin.
