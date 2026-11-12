# 0007. Pilot workspaces are invite-only

Date: 2026-11-12 · Status: accepted (Joshua, 2026-11-12)

## Context
The handoff (01, Onboarding) is invite-first: an invited firm admin creates the
workspace and invites members. P1's first slice lets anyone sign up and create
a firm, which is right for the demo but not for a pilot with client data.

## Decision
- `allowOpenSignup()` in `lib/account/auth-mode.ts` is false when
  `CASEVEX_DEPLOYMENT=pilot`. Then `/sign-up` explains that Casevex is
  invite-only, the sign-in page drops the "Create an account" link, and
  finishing onboarding never calls `create_workspace()`.
- Outside pilot (demo, fixture, previews), open sign-up and self-serve firm
  creation stay on so the flow can be tried.
- The pilot Supabase project must also turn off "Allow new users to sign up"
  in Authentication settings, so the rule holds even against direct API calls.

## Follow-up (next P1 PR)
`invitations(workspace_id, email_hash, token_hash, role, expires_at, status)`
and approved email domains per workspace; accepting a valid invite (or signing
up from an approved domain) creates the membership with the invited role.
`create_workspace()` will then be restricted to provisioned firm admins.
