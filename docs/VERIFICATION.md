# Verification record

Verified November 11, 2026, against the local Casevex prototype.

## Automated checks

- `npm run typecheck`: passed.
- `npm run build`: passed, including Next.js production compilation and TypeScript validation.
- `npm test`: 5 integration tests passed. Covers matter create/edit/strategy/chat; isolated demo sessions; notices and unread filtering; document type rejection, metadata upload, move and delete; calendar events; profile changes; agent assignments; explicit errors for invalid requests.
- Dependency installation audit: 0 reported vulnerabilities at installation time.
- UI detector: identified one 2px event-chip side border; reduced it to a 1px rule in the final CSS.

## Browser checks

All ten principal routes rendered with sample data at 1280×720, 1366×768, 1440×900, 1920×1080, and 390×844: 50 route/viewport combinations.

For each desktop combination, `document.documentElement.scrollHeight <= innerHeight`; no page-level horizontal overflow at any tested size. Phone pages may scroll vertically. These measurements test the page boundary, not whether every inner panel is simultaneously visible.

Observed end-to-end flows:

- A suggested chat prompt adds a user message, shows the imported row-by-row tile sequence, and produces a simulated answer with source links.
- New matter modal creates a matter and navigates to its overview.
- Search filters retain input behavior and update the URL; Parker search returns one table row.
- Mark all read changes the notice count to zero and disables the action.
- Settings research-motion preview reaches 3/3 and Replay restarts the sequence.
- Desktop dashboard, desktop chat, phone chat, and motion-preview visuals were inspected against the supplied references.

Corrections after inspection: preserved search field identity across query changes; extracted nested render components; constrained chat auto-scroll to its own thread; restored compact-width rails; added proper link-button layout; accepted dropped files directly into the upload dialog; removed the development badge from the preview.

## Verification limits

- Lighthouse's numeric accessibility target was not measured; no 95+ score is claimed.
- Reduced-motion behavior is implemented in CSS and the chat/progress logic, but a dedicated OS-level reduced-motion browser run was not performed.
- Real sign-in, legal data, legal verification, AI, storage, email invitations, external calendars, and production multi-instance behavior are out of scope and untested.
- The backend schema is a planning artifact, not an applied or validated production migration.
- The preview is local, not a publicly hosted production deployment.
