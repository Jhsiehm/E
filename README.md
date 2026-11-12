# Casevex

Connected prototype of the ten supplied Casevex wireframes, with the research tile animation and textures adapted from the supplied phone prototype.

## Run

Requires Node.js 20.9+ (tested with Node 24).

```sh
npm install
npm run dev
```

Open http://localhost:3000. For another port: `npm run dev -- --port 3011`.

```sh
npm run typecheck
npm run build
npm start
# With the server running:
npm test
```

## Try the flows

- Dashboard → ask a question → Anderson's agent chat → simulated source-review animation → answer with source links.
- Settings → Profile → Preview research animation → Replay animation.
- Matters → New matter → overview → edit summary → strategy → save notes.
- Notices → View impact → affected matter; marking read updates the sidebar and dashboard.
- Documents → Upload document → select a matter; manage metadata, rename, move, export metadata, or confirm deletion.
- Agents → Add agent → select matters → save assignments.
- Calendar → next/previous month, month/agenda view, event detail, add event.
- Precedents → search/filter → authority detail; add a citation for later verification.
- Settings → edit profile → save/cancel. Workspace settings can reset the demo.

Filters live in URL query parameters. Matter routes include overview, documents, research, notices, deadlines, strategy, and chat. The main ten screens are implemented; integrations/security/notification settings are explicitly planned surfaces.

## Boundaries

All data and answers are mock. The invented Nexora authority is labeled fictional; verification flags are simulated. No real authentication, AI calls, storage, invitations, court deadlines, billing, or external integrations are active. Uploads store metadata only. Export produces text/metadata, never an original file that was not stored. Sharing previews an invitation and sends nothing. Dark preference is stored but dark styling is not implemented.

Demo sessions use a separate HTTP-only cookie and a server-memory map with a 24-hour idle expiry. Data persists while that server process is alive, not across deployments, restarts, or multiple instances. Do not enter actual client information. This is not a production security boundary.

## Structure

- `app/[[...path]]/page.tsx`: route entry for the prototype's screens.
- `components/Workspace.tsx`: connected screen components and interactions.
- `components/ResearchProgress.tsx`: imported motion vocabulary implemented in React.
- `app/api/[...path]/route.ts`: mock HTTP adapter, with 300 ms artificial latency.
- `lib/mock/`: typed seed data and session store.
- `app/globals.css`, `tailwind.config.ts`: supplied tokens, responsive layout, motion.
- `docs/BACKEND_PLAN.md`: architecture, permissions, pipelines, APIs, phases, decisions.
- `docs/schema-draft.sql`: illustrative core schema, not a production migration.
- `docs/DESIGN_NOTES.md`: reference provenance and aesthetic recommendations.
- `docs/CASEVEX_SPEC.md`: original supplied build spec.
- `docs/VERIFICATION.md`: recorded checks and remaining limits.

Repository destination: https://github.com/Jhsiehm/E.git
