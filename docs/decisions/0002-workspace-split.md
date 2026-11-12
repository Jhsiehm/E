# 0002. Split the single Workspace component without changing behaviour

Date: 2026-11-12 · Status: accepted (P0)

## Context
`components/Workspace.tsx` held every screen, dialog and piece of client state
(2,780 lines). P0 asks for shell / routes / reusable components "without
changing appearance", before any backend work.

## Decision
- The split is mechanical: JSX and handlers were moved by line range, verbatim,
  into one file per screen (`components/workspace/pages`), matter tab
  (`matter/`) and dialog (`modals/`), plus `ui.tsx`, `shared.tsx`, `format.ts`.
- All state and actions stay together in `useWorkspaceController()` and are read
  through `useWorkspace()` context. Splitting state per resource is deliberately
  left to P1, when each screen moves onto its own scoped endpoint (the handoff's
  "data hooks"). Doing both at once would make visual regressions hard to
  attribute.
- `components/Workspace.tsx` is now the shell: boot screen, sidebar, route table
  (`routeContent`), toast and the dialog switch.
- Network calls go through `lib/api/client.ts` instead of raw `fetch`.
- Equivalence was checked by screenshotting 31 routes and 7 dialogs at the five
  gate viewports on `main` and on this branch and diffing pixels (see
  docs/VERIFICATION.md).

## Consequences
- Prototype patterns carried over unchanged (state synced from effects, a ref
  written during render) are flagged by the React Compiler lint rules. They are
  set to `warn` in `eslint.config.mjs` so they stay visible, and should go away
  as P1 replaces the bootstrap with per-screen data hooks.
- One user-visible change: a network failure during a mutation now shows
  "Network error. Please try again." instead of the browser's raw message
  (e.g. "Failed to fetch").
