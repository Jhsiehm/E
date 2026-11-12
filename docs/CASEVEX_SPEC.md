# Casevex: Prototype Build Spec

Handoff for Codex. Build a clickable, front-end prototype of Casevex, a legal research workspace for small litigation firms (first customer: a consumer fraud and class action practice). Visual reference: the "Casevex Wireframes" canvas (10 screens). This file is the source of truth for routes, layout, components, data and behavior.

All data in this prototype is mock data. `U.S. v. Nexora Tech` is a fictional ruling. Every screen that shows an answer must render the footer line: "Research aid for attorney review. Confirm each authority before filing."

---

## 1. Stack and conventions

- Next.js 14+ (App Router), TypeScript, React Server Components where simple, client components for interactive pieces.
- Tailwind CSS with the tokens in section 3 mapped into `tailwind.config.ts` (no default Tailwind colors in UI code).
- Mock data in `/lib/mock/*.ts`, served through route handlers in `/app/api/*` so swapping to a real backend later only touches the fetch layer.
- State: URL query params for filters and tabs; React state for UI; no global store needed.
- Icons: one local `Icon` component with inline SVG outline icons (24px grid, 1.5px stroke, square caps). No icon fonts, no emoji.
- Accessibility: real `<button>`, `<a>`, `<label>`+`<input>`, `<select>`; `aria-label` on icon-only buttons; `aria-current="page"` on active nav; 44px minimum touch targets; text contrast 4.5:1.
- No em dashes in UI copy. Sentence case for headings and buttons. Only the `label` style is uppercase.

Suggested tree:

```
app/
  layout.tsx                 # AppShell (sidebar + main)
  page.tsx                   # Dashboard
  notices/page.tsx
  matters/page.tsx
  matters/[id]/layout.tsx    # MatterHeader + MatterTabs
  matters/[id]/page.tsx      # Overview
  matters/[id]/chat/page.tsx
  matters/[id]/documents/page.tsx   # stub: reuse DocumentsTable filtered by matter
  matters/[id]/research/page.tsx    # stub
  matters/[id]/deadlines/page.tsx   # stub: reuse DeadlineList
  matters/[id]/strategy/page.tsx    # stub
  matters/[id]/notices/page.tsx     # stub: reuse NoticeList filtered
  agents/page.tsx
  precedents/page.tsx
  precedents/[id]/page.tsx   # stub detail
  documents/page.tsx
  calendar/page.tsx
  settings/[section]/page.tsx  # profile implemented, others stub
  api/...                    # mock route handlers
components/ (see section 4)
lib/mock/ (see section 5)
```

### 1a. One screen, no page scrolling (hard requirement)

Every route must fit in a single viewport on laptops and desktops. The page itself never scrolls.

- `AppShell` root: `height: 100dvh` (fallback `100vh`), `min-height: 600px`, `overflow: hidden`, `display: flex`.
- `Sidebar`: fixed 232px wide, `height: 100%`. The ACTIVE MATTERS list is the only part of the sidebar that scrolls internally.
- `<main>`: `height: 100%; overflow: hidden; display: flex; flex-direction: column; gap: 14px; padding: 20px 32px`.
- Fixed-height parts of a page (header, filters, banners, tabs, composer) get `flex: none`.
- The content area under them is one `PageBody` grid with `flex: 1; min-height: 0`, its rows `minmax(0, 1fr)`.
- Every card in that grid gets `min-height: 0; overflow: hidden`, and its list or table area gets `flex: 1; min-height: 0; overflow: auto`. When data outgrows the space, that panel scrolls, never the page. Table headers are `position: sticky; top: 0`.
- Show a fixed number of items that fit, plus "View all" for the rest: dashboard shows 5 matters, 4 deadlines and 3 activity items.
- Compact sizes for app screens: h1 34px (32px on matter pages), card titles 18px bold, card padding 16px 20px, list rows 8 to 10px vertical padding, controls 44px tall.
- Short viewports (`max-height: 760px`): hide page subtitles, breadcrumbs and secondary helper lines (class `cx-short-hide`).
- Medium widths (`max-width: 1100px`): 3-column bodies become 2 columns, with `grid-auto-rows: minmax(0, 1fr)`.
- Phones (`max-width: 900px`): the one-screen rule is lifted. Sidebar becomes a top bar with horizontal nav, ACTIVE MATTERS and the user block hide, grids stack to one column, and the page scrolls normally.
- Target viewports to test: 1280x720, 1366x768, 1440x900, 1920x1080. No vertical page scrollbar at any of them.

---

## 2. Routes

| Route | Screen | Canvas board |
| --- | --- | --- |
| `/` | Dashboard | 01 |
| `/notices` | Notices | 02 |
| `/matters` | Matters list | 03 |
| `/matters/[id]` | Matter overview | 04 |
| `/matters/[id]/chat` | Matter agent chat | 05 |
| `/agents` | Legal agents | 06 |
| `/precedents` | Precedents | 07 |
| `/documents` | Documents | 08 |
| `/calendar` | Calendar | 09 |
| `/settings/profile` | Settings, profile | 10 |

Matter sub-tabs not shown on the canvas (documents, research, deadlines, strategy, notices) are stubs that reuse existing components filtered by `matterId`.

---

## 3. Design tokens (Casevex design system)

```ts
export const colors = {
  paper: '#F3F2EE',       // page background
  paperRaised: '#F7F6F2', // cards, inputs
  paperSunk: '#EBE8E1',   // selected rows, chips, table header
  rule: '#D9D6CE',        // 1px dividers and borders
  ruleSoft: '#E0DDD5',    // row separators inside a card
  ink: '#0F2230',         // body text
  navy: '#142F40',        // brand, headings, primary buttons, sidebar, ruling banner
  muted: '#4A5A64',       // secondary text, labels
  rose: '#A6445D',        // urgency, active nav, unread, send button, citation markers
  olive: '#393A10',       // verified, next-deadline panel, Active status
  teal: '#62929E',        // focus rings, progress (never text on paper)
  tealDeep: '#3E6E7A',    // teal text and links on paper
  creme: '#E7DECD',       // secondary text on navy/olive
  onDark: '#F3F1EC',      // primary text on navy/olive/rose
  tealLight: '#9FC1C9',   // kicker labels on navy banner
  disabled: '#C9C5BC',
};
export const font = `"Times New Roman", Times, Tinos, serif`; // load Tinos from Google Fonts as fallback
export const type = {
  display: '72/1 400', numeral: '60/0.8 400', h1: '40/1.05 400 -0.01em', h2: '28/1.15 400',
  h3: '20/1.25 700', lead: '19/1.5', body: '16/1.5', case: '16/1.3 italic', small: '14/1.4',
  fine: '12/1.4', label: '11/1.3 0.2em uppercase',
};
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 18: 72, 24: 96 };
export const radius = { sm: 3, md: 6, lg: 10 }; // never pill-shaped, never round avatars
export const shadowBanner = '0 12px 30px rgba(15,34,48,0.28)'; // ruling banner and toasts only
export const duration = { quick: 250, enter: 450 };
```

Rules: structure comes from 1px rules, not shadows. Numbers use `font-variant-numeric: lining-nums tabular-nums`. Status is never color alone: always a word or number next to it. Respect `prefers-reduced-motion`.

---

## 4. Components

| Component | Props (key) | Notes |
| --- | --- | --- |
| `AppShell` | children | Flex-wrap row: `Sidebar` (basis 240px) + `<main>` (flex 999, padding 40/48). Sidebar stacks above main under ~800px. |
| `Sidebar` | activeRoute, activeMatterId | Navy. Logo (4x4 grid mark + "Casevex"), nav items with icon, Notices badge (unread count, rose square badge), "ACTIVE MATTERS" list (rose 7px square when matter has unread ruling impact), user block (JW avatar square, name, role, account menu button). |
| `PageHeader` | kicker, title, subtitle, actions | Label kicker, h1 navy, lead subtitle muted, actions right; 1px rule under. |
| `IconButton` | icon, label, dot? | 44x44, raised, rule border; optional rose unread dot. |
| `Button` | variant: primary / rose / secondary, icon?, href? | radius 6, min-height 44. |
| `Chip` | tone: neutral / olive / rose / navy / outline | radius 3, 14px. |
| `StatusChip` | status: active / in_review / archived / draft / final | Maps to chip tone + label. |
| `SearchInput` | placeholder, size: md / lg | Visually hidden label, italic placeholder. |
| `FilterSelect` | label, options, value, onChange | Native select; writes to URL query. |
| `Card` | title?, mark?, actionLink? | raised, rule border, radius 10, padding 24. |
| `RulingBanner` | ruling, variant: global / matter | Navy, `shadowBanner`, kicker in tealLight, h2 title, case cite line, impact summary, "View impact" button. |
| `MatterRow` | matter | Folder icon, name, type + court, "New ruling impact" chip, chevron. Whole row is a link. |
| `DeadlineList` | deadlines, limit? | Date (bold, rose if due in 7 days or fewer), title, matter name; "Due in N days" rose chip. |
| `ActivityFeed` | items | Icon, title, subtitle, relative time. |
| `QuickActions` | actions | Grid of linked tiles, auto-fit min 220px. |
| `DataTable` | columns, rows, onRowClick | Sunk header with label-style th, rows with ruleSoft separators, wrapper `overflow-x: auto`, min-width 900px. |
| `MatterHeader` | matter | Breadcrumb, h1, court / type / status, actions (more, Share, Ask Casevex). |
| `MatterTabs` | matterId, active | Links: Overview, Documents (count), Research, Notices (badge), Deadlines, Strategy, Agent chat. Active = rose 2px underline. |
| `AnalysisTabs` | analysis | Recommended approach / Key authorities / Risks / Next steps; panel on paperSunk. |
| `ChatThread` | messages | User bubble right (paperSunk), agent message card left. |
| `AgentAnswer` | answer | Sections in order: SHORT ANSWER (lead size), reasoning paragraphs with `[n]` markers (rose, clickable, scroll to source), RECOMMENDED NEXT STEP, SOURCES (n, "x of n verified"). |
| `SourceChip` | source | Olive verified square, title, meta, external icon. Unverified sources are never rendered. |
| `SuggestedPrompts` | prompts, onPick | Outline buttons; click fills and sends. |
| `Composer` | onSend, disabled | Attach button, text input, rose send button (disabled color when empty). Enter sends, Shift+Enter newline. |
| `NextDeadlinePanel` | deadline | Olive panel, `numeral` days remaining, date and title. |
| `AgentCard` | agent | Icon tile, name, practice area, matters count, availability (olive square + "Available"), full-width "Add agent" button. |
| `PrecedentCard` | precedent | Court icon tile, italic case name + roman cite, court and date, "Verified against the opinion" with olive square, rose topic chips, chevron. |
| `FileTypeBadge` | ext | PDF (rose text) / DOCX (tealDeep text), outlined. |
| `UploadDropzone` | onFiles | Dashed rule border. |
| `MonthCalendar` | month, events, today | 7-col grid, today outlined in navy, event chips with urgency square. |
| `SegmentedControl` | options, value | Month / Agenda, Light / Dark. |
| `SettingsNav` | active | Profile, Workspace, Notifications, Integrations, Security. |
| `ProfileForm` | user | Avatar square (radius 10) with edit button, full name, role select, email, display segmented, default practice area, time zone, Cancel / Save (Save disabled until dirty). |
| `Disclaimer` | none | `fine` text: "Research aid for attorney review. Confirm each authority before filing." |

---

## 5. Data models (TypeScript)

```ts
type ID = string;
type PracticeArea = 'general' | 'civil' | 'corporate' | 'trust_estate' | 'consumer_class_action' | 'employment' | 'civil_rights' | 'regulatory' | 'international' | 'contracts';

interface User { id: ID; name: string; initials: string; role: 'Partner' | 'Associate' | 'Paralegal' | 'Admin'; email: string; theme: 'light' | 'dark'; defaultPracticeArea: PracticeArea; timeZone: string; }

interface Matter {
  id: ID; name: string; docket?: string; court: string; type: string; practiceArea: PracticeArea;
  status: 'active' | 'in_review' | 'archived'; role: 'Plaintiff' | 'Defendant' | 'Other';
  summary: string; assignedAgentId: ID; updatedAt: string; documentCount: number;
  rulingImpactIds: ID[]; // unread rulings that affect this matter
}

interface Deadline { id: ID; matterId: ID; title: string; dueAt: string; kind: 'deadline' | 'hearing' | 'meeting'; }

interface Ruling {
  id: ID; title: string; caseName: string; citation: string; court: string; issuedAt: string; isSample: boolean;
  summary: string;
  impacts: { matterId: ID; direction: 'strengthens' | 'weakens' | 'neutral'; explanation: string }[];
}

interface Notice {
  id: ID; kind: 'ruling' | 'deadline' | 'docket'; title: string; source: string; detail: string;
  createdAt: string; read: boolean; matterIds: ID[]; rulingId?: ID;
}

interface Agent { id: ID; name: string; practiceArea: string; description: string; matterCount: number; availability: 'available' | 'at_capacity'; }

interface Precedent {
  id: ID; caseName: string; citation: string; court: string; decidedAt: string; topics: string[];
  verified: boolean; holding: string; isSample?: boolean;
}

interface LegalDocument {
  id: ID; matterId: ID; name: string; ext: 'pdf' | 'docx'; sizeBytes: number; type: string;
  ownerInitials: string; modifiedAt: string; status: 'draft' | 'in_review' | 'final';
}

interface Source { index: number; kind: 'ruling' | 'document' | 'precedent'; refId: ID; title: string; meta: string; verified: boolean; }

interface ChatMessage {
  id: ID; matterId: ID; role: 'user' | 'agent'; createdAt: string;
  text?: string;                         // user
  answer?: { shortAnswer: string; reasoning: string[]; nextStep?: string; sources: Source[] }; // agent
}

interface Analysis { matterId: ID; recommendedApproach: string; keyAuthorities: Source[]; risks: string[]; nextSteps: string[]; }

interface ActivityItem { id: ID; kind: 'document' | 'ruling' | 'upload'; title: string; subtitle: string; at: string; }
```

### Seed data (use exactly; matches the canvas)

Today = `2026-11-11` (Wednesday). User: Jordan Wells, Partner, initials JW, `jordan.wells@example.com`, Eastern Time.

Matters:
1. `anderson` Anderson v. Meridian Tech, No. 1:26-cv-01428 (S.D.N.Y.), trade secret / civil litigation, active, Plaintiff, ruling impact: yes. Summary: "Breach of contract and misappropriation of confidential information against Meridian Tech." 24 documents.
2. `parker` Parker Estates Trust, File No. 2026-EP-1189, N.Y. Sur. Ct., trust and estate, active.
3. `ridgeway` Ridgeway Holdings LLC, D. Del., corporate, in review, ruling impact: yes (weakens).
4. `diaz` Diaz v. City of Brookfield, No. 3:26-cv-00871 (D. Conn.), civil rights, active.
5. `elmwood` Elmwood Employment Matter, S.D.N.Y., employment, archived.

Deadlines: Nov 18 Response to motion (ridgeway); Nov 24 Document production (parker); Dec 2 Opposition to motion for summary judgment (anderson); Dec 16 Meet and confer (anderson); Jan 8 2027 Pretrial conference (anderson).

Ruling: "Second Circuit narrows trade secret standard", *U.S. v. Nexora Tech*, 138 F.4th 427 (2d Cir. 2026), sample, issued 2h ago. Strengthens anderson, weakens ridgeway.

Precedents: *Carpenter v. United States*, 585 U.S. 296 (2018); *Mantikas v. Kellogg Co.*, 910 F.3d 633 (2d Cir. 2018); *Meyer v. Uber Technologies, Inc.*, 868 F.3d 66 (2d Cir. 2017); *U.S. v. Nexora Tech* (sample). Mark real cites "verify before use" in data comments; the UI's verified flag is mock.

Agents: Civil (12 matters), Corporate (8), Trust and estate (5), Regulatory (6), International (4), Contract (11). All available.

Documents: Motion to compel (draft) DOCX 845 KB anderson Draft; Trade secret declaration PDF 2.4 MB anderson Final; Deposition transcript PDF ridgeway Final; Trust amendment (draft) DOCX parker In review; Complaint (filed) PDF 1.2 MB anderson Final.

Notices (3 unread): Nexora ruling (unread); U.S. Sup. Ct. arbitration ruling, sample (unread); Response to motion due in 7 days (unread); Docket update: order on motion to compel (read); Document production reminder (read).

---

## 6. Mock API

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/me` | User |
| PATCH | `/api/me` | User (persist in memory) |
| GET | `/api/matters?q=&status=&type=&scope=` | Matter[] |
| POST | `/api/matters` | Matter |
| GET | `/api/matters/:id` | Matter + Analysis + Deadline[] + LegalDocument[] (latest 3) |
| GET | `/api/matters/:id/chat` | ChatMessage[] |
| POST | `/api/matters/:id/chat` | streams an agent ChatMessage (fake stream: reveal canned answer over ~1.5s) |
| GET | `/api/deadlines?from=&to=&matterId=` | Deadline[] |
| GET | `/api/notices?kind=&unread=` | Notice[] |
| POST | `/api/notices/read` `{ ids \| all }` | 204 |
| GET | `/api/rulings/:id` | Ruling |
| GET | `/api/agents?q=&area=&availability=` | Agent[] |
| GET | `/api/precedents?q=&jurisdiction=&topic=&court=&date=` | Precedent[] |
| GET | `/api/documents?q=&matterId=&type=` | LegalDocument[] |
| POST | `/api/documents` (multipart) | LegalDocument (mock: name, ext, size from file) |
| GET | `/api/activity` | ActivityItem[] |

Add a 300ms artificial latency so loading states are visible.

---

## 7. Screens

ASCII is structure only. Numbers match the teal markers on the canvas.

### Global shell

```
+------------+-----------------------------------------------------+
| [grid] Casevex |  PAGE HEADER: label / h1 / subtitle   [search][bell][CTA]
| ---------- |  ------------------------------------------------- |
| Dashboard  |                                                     |
| Matters    |  page content                                       |
| Agents     |                                                     |
| Precedents |                                                     |
| Notices (3)|                                                     |
| Calendar   |                                                     |
| Documents  |                                                     |
| Settings   |                                                     |
| ---------- |                                                     |
| ACTIVE MATTERS                                                   |
|  Anderson v. Meridian Tech  [rose sq]                            |
|  Parker Estates Trust                                            |
|  Ridgeway Holdings LLC      [rose sq]                            |
|  Diaz v. City of Brookfield                                      |
|  Elmwood Employment Matter                                       |
| ---------- |                                                     |
| [JW] Jordan Wells / Partner  v                                   |
+------------+-----------------------------------------------------+
```

The header bell opens the Notices route (a dropdown is out of scope). Header search focuses a global search that routes to `/precedents?q=` for now.

### 01 Dashboard `/`

```
[1] DASHBOARD / Good afternoon, Jordan. / Legal intelligence, updated for your matters.
[2] [ Ask Casevex a legal question, analyze a case, or draft a document ][Practice area v][Ask]
[3] NEW RULING  Second Circuit narrows trade secret standard | Affects 2 of your matters [View impact ->]
[4] Active matters (5)  | [5] Upcoming deadlines (4) | [6] Recent activity (3)     <- fills remaining height
[7] Run legal agent | Research precedents | Analyze documents | Update case strategy
Disclaimer
```

- Greeting: "Good morning / afternoon / evening" by local hour.
- Ask submit: if a practice chip is a matter-specific area, route to `/matters/anderson/chat` with the question prefilled; otherwise show a toast "Research threads outside a matter are coming soon." (prototype).
- Ruling banner shows newest unread ruling with impacts; hidden when none.
- Layout: three columns (1.25fr / 1fr / 1fr) that fill the remaining height; 2 columns under 1100px, stacked on phones.

### 02 Notices `/notices`

```
[1] NOTICES / Notices / Rulings, deadlines and docket activity...   [Mark all read][gear]
[2] Tabs: All (5) | Unread (3) | Rulings | Deadlines | Docket       (?tab=)
[3] Rows: [unread sq][icon] LABEL / title (bold if unread) / source / affected matters   time [View impact|Open]
```

- "View impact" opens a right-side drawer listing each affected matter with direction (Strengthens / Weakens, as words) and explanation, each linking to the matter overview.
- Opening a notice marks it read and decrements the sidebar badge.

### 03 Matters `/matters`

```
[1] MATTERS / Matters / Your active and archived legal matters.   [search][bell][+ New matter]
[2] [search matters......] [All matters v] [All status v] [All types v]
[3] 5 MATTERS
    | MATTER (name + docket) | STATUS | TYPE | ASSIGNED AGENT | LAST UPDATED | > |
```

- New matter: modal with name, docket, court, type, role, agent; on save, push to list and navigate to it.
- Empty state: "No matters yet. Create one to start research." plus New matter button. No-results state: "No matters match these filters." plus Clear filters.

### 04 Matter overview `/matters/[id]`

```
Matters > Anderson v. Meridian Tech
[1] Anderson v. Meridian Tech                        [...][Share][Ask Casevex]
    S.D.N.Y. | Civil litigation | (Active)
[2] Overview | Documents (24) | Research | Notices (1) | Deadlines | Strategy | Agent chat
[3] NEW RULING, IMPACT ON THIS MATTER: title, cite | Likely strengthens your position + explanation
[4] Case summary [Edit]                     | [5] Key deadlines   View all ->
    text / ROLE Plaintiff | NEXT DEADLINE   |
    Dec 2, 2026 | STATUS Active              | [7] Key documents (3)  View all ->
[6] Casevex analysis                        |
    (Recommended approach)(Key authorities)(Risks)(Next steps)
    panel text with [n] markers, Disclaimer |
```

- Edit summary toggles inline textarea with Save / Cancel.
- `...` menu: Archive matter, Duplicate, Export summary (all mock).
- Share: modal with email input and role select (mock).

### 05 Matter agent chat `/matters/[id]/chat`

```
(matter header + tabs, Agent chat active)
+------------------------------------------+---------------------------+
| [4] * Casevex civil litigation agent  [lock Secure matter chat] | [9] Assigned agent [Change agent]
|              10:24 AM JW  (user bubble) |  Ruling card (navy)       |
| [5] agent card                           |  Next deadline (olive)    |
|   SHORT ANSWER / reasoning [1][3]        |    21 days, Dec 2, 2026   |
|   RECOMMENDED NEXT STEP [2]              | [10] Quick actions        |
| [6] SOURCES (3), 3 OF 3 VERIFIED          |    Update strategy        |
|   [1] ruling  [2] motion  [3] declaration|    Open cited authority   |
| [7] (Summarize...)(What should...)(Draft)|    Export chat to memo    |
| [8] [clip][ Message your matter agent ][send] |                       |
| Disclaimer                               |                           |
+------------------------------------------+---------------------------+
```

- Chat column spans 2 of 3 grid columns at >= 1100px; rail stacks below on smaller screens.
- Sending: append user message, show agent "Reading sources" state with a 4-tile verification grid animation (tiles fill rose, row turns olive when verified), then stream the canned answer.
- Clicking `[n]` highlights and scrolls to the matching source chip.
- Persist chat per matter in memory for the session.

### 06 Agents `/agents`

```
[1] AGENTS / Legal agents / Specialized agents for each practice area.
[2] [search agents.....] [All practice areas v] [Availability v]
[3] 6 AGENTS   grid of AgentCards (3 / 2 / 1 columns)
```

- Add agent: modal listing matters with checkboxes; save updates assigned agent and matter count.

### 07 Precedents `/precedents`

```
[1] PRECEDENTS / Precedents / Search, analyze, and save controlling and persuasive authority.
[2] [search cases, citations, legal issues, or holdings.........] [+ Add precedent]
[3] [Jurisdiction v][Topic v][Court v][Date v]  Clear filters
[4] SAVED AUTHORITY, 4 RESULTS
    PrecedentCard x4
```

- Card links to `/precedents/[id]` stub: case name, cite, holding, topics, "Used in" matters.
- Add precedent: modal with citation input or file upload (mock).

### 08 Documents `/documents`

```
[1] DOCUMENTS / Documents / All legal documents across your matters.  [Upload document]
[2] [search documents....] [All matters v] [All types v]
[3] | NAME (type badge) | MATTER | TYPE | OWNER | MODIFIED v | STATUS | ... |
[4] Drop zone
```

- Sort by modified desc by default; clicking the MODIFIED header toggles.
- Row menu: Open, Rename, Move to matter, Download, Delete (confirm).

### 09 Calendar `/calendar`

```
[1] CALENDAR / Calendar / Deadlines, hearings, and key dates...   [+ Add event]
[2] [<] November 2026 [>] [Today]                 [Month | Agenda]
[3] SUN..SAT month grid, Nov 1 = Sunday, today (11) outlined, chips on 18 and 24
[4] Upcoming deadlines rail (all 5)
```

- Agenda view: grouped list by date.
- Event chip click: popover with title, matter link, date, kind.

### 10 Settings `/settings/profile`

```
[1] SETTINGS / Settings / Manage your account, workspace, and preferences.
[2] Profile | Workspace | Notifications | Integrations | Security
[3] Profile card: avatar [edit] | Full name, Role v | Email
    Display [Light|Dark] / Default practice area v / Time zone v
    [Cancel][Save changes]
```

- Save enabled only when the form is dirty; success toast "Profile saved."
- Dark theme is a stub: store the preference, keep the light theme.

---

## 8. States to implement on every list

Loading (skeleton rows on paperSunk), empty, no results for filters, and error ("We could not load this. Try again." with a retry button).

---

## 9. Acceptance criteria

1. All 10 routes render with the seed data and match the canvas layout at 1440x900.
1a. At 1280x720, 1366x768, 1440x900 and 1920x1080, no route shows a page-level vertical scrollbar (`document.documentElement.scrollHeight <= innerHeight`). Only inner panels scroll.
2. Sidebar nav, matter rows, tabs, View all links and quick actions all navigate.
3. Filters on Matters, Agents, Precedents and Documents filter results and sync to the URL.
4. Notices: marking read updates the sidebar badge and the dashboard banner.
5. Matter chat: sending a message shows the verification state, then streams the answer; `[n]` markers jump to sources.
6. At 390px width, the sidebar becomes a top bar, tables scroll horizontally, grids collapse to one column, and nothing overflows the viewport sideways (vertical page scroll is allowed on phones only).
7. Lighthouse accessibility score of 95 or higher on Dashboard and Matter chat.
8. No em dashes, no emoji, no default Tailwind palette colors in UI.

## 10. Out of scope

Real auth, real LLM calls, real legal data sources, file storage, billing, multi-user collaboration, dark theme styling.

---

## 11. Prompt for Codex

> Build the Casevex prototype described in `CASEVEX_SPEC.md`. Use Next.js (App Router), TypeScript and Tailwind. Every screen must fit one laptop viewport with no page scrolling (section 1a). Implement the tokens in section 3 first, then the AppShell and components in section 4, then the mock data and API in sections 5 and 6, then the 10 screens in section 7 in route order. Meet the acceptance criteria in section 9. Ask before adding any dependency beyond Next, React, Tailwind and clsx.
