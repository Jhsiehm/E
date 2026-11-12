# 0006. Supabase Auth, one `profiles` row per person, roles only on memberships

Date: 2026-11-12 · Status: accepted (P1, identity slice)

## Context
The handoff schema (02 §1, §8) names `app_users` plus a key/value
`preferences(user_id, workspace_id, key, value_json)` table. P1 needs sign-in,
onboarding answers (practice areas, niches, courts, AI experience) and a
per-person layout that the workspace can render on the first server response.

## Decision
- **Auth:** Supabase Auth through `@supabase/ssr`; sessions in cookies.
  `proxy.ts` refreshes the session and sends signed-out requests to `/sign-in`
  (API: 401 `unauthenticated`). `lib/account/auth-mode.ts` picks `supabase`
  when its URL and publishable key are set, a cookie-only `demo` account when
  they are not and the app serves fixtures, and refuses demo in pilot.
- **`profiles` instead of `app_users` + `preferences`:** `profiles.id` is the
  `auth.users.id` (the auth subject), so a separate `app_users` mapping adds
  nothing yet. Layout choices live in `profiles.layout jsonb` and the
  onboarding answers in typed columns with CHECK limits, so one indexed read
  returns everything the shell needs. Per-workspace preferences (notification
  rules, digests) will use a `preferences` table when P6 adds them.
- **No permissions on the profile.** Job title is display text. Roles
  (`owner|admin|attorney|paralegal|viewer`) exist only on `memberships`; the
  browser can update only whitelisted profile columns (column-level GRANT) and
  cannot write `workspaces` or `memberships` at all.
- **RLS:** enabled and forced on all three tables, default deny. A person reads
  and updates only their own profile; members read their workspace and its
  memberships through `private.is_active_member()`, kept out of the API schema.
- **Practice areas** are stable keys from `lib/practice-areas.ts`, the one
  catalog shared with agent profiles.
- **Migrations:** `supabase/migrations/` is the only migration folder for the
  whole app (identity, matters, authorities). `.down.sql` files document
  reversal; the Supabase CLI applies up migrations only.

## Consequences
- The workspace layout reads the profile on the server and passes it to the
  client, so personalized navigation adds no client request and tab switches
  never show the boot screen.
- Moving to `app_users` later is a rename plus a view; nothing outside
  `lib/account/` touches the table directly.
