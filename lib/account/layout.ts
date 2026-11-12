import { practiceArea, type LayoutPreset } from "@/lib/practice-areas";
import {
  DASHBOARD_CARDS,
  FIXED_NAV,
  NAV_KEYS,
  type DashboardCard,
  type NavKey,
  type PracticeArea,
  type Profile,
} from "./profile";

/**
 * Turns a profile into the workspace layout: sidebar order, dashboard cards,
 * quick actions and research prompts. Pure, so it is unit tested and runs the
 * same on the server and in the onboarding preview.
 */

export type { LayoutPreset } from "@/lib/practice-areas";
export type QuickAction = "precedents" | "strategy" | "agent" | "documents";

export const PRESETS: Record<
  LayoutPreset,
  {
    label: string;
    nav: NavKey[];
    cards: DashboardCard[];
    quick: QuickAction[];
  }
> = {
  litigation: {
    label: "Litigation",
    nav: [
      "matters",
      "calendar",
      "precedents",
      "documents",
      "notices",
      "agents",
    ],
    cards: ["deadlines", "matters", "activity"],
    quick: ["precedents", "strategy", "agent", "documents"],
  },
  transactional: {
    label: "Transactional",
    nav: [
      "matters",
      "documents",
      "precedents",
      "agents",
      "calendar",
      "notices",
    ],
    cards: ["matters", "activity", "deadlines"],
    quick: ["documents", "agent", "precedents", "strategy"],
  },
  regulatory: {
    label: "Regulatory",
    nav: [
      "notices",
      "matters",
      "precedents",
      "documents",
      "calendar",
      "agents",
    ],
    cards: ["notices", "matters", "deadlines"],
    quick: ["precedents", "documents", "agent", "strategy"],
  },
};

export const NAV_LABELS: Record<NavKey, string> = {
  dashboard: "Dashboard",
  matters: "Matters",
  agents: "Agents",
  precedents: "Precedents",
  notices: "Notices",
  calendar: "Calendar",
  documents: "Documents",
  settings: "Settings",
};
export const NAV_HREF: Record<NavKey, string> = {
  dashboard: "",
  matters: "matters",
  agents: "agents",
  precedents: "precedents",
  notices: "notices",
  calendar: "calendar",
  documents: "documents",
  settings: "settings/profile",
};
export const CARD_LABELS: Record<DashboardCard, string> = {
  deadlines: "Upcoming deadlines",
  matters: "Active matters",
  activity: "Recent activity",
  notices: "Latest notices",
};

export type WorkspaceLayout = {
  preset: LayoutPreset;
  nav: NavKey[];
  hiddenNav: NavKey[];
  cards: DashboardCard[];
  quick: QuickAction[];
  defaultPractice: string;
  focusLine: string;
  prompts: string[];
};

export function presetFor(area: PracticeArea | null): LayoutPreset {
  return area ? practiceArea(area).preset : "litigation";
}

/** Keeps `order` items that are allowed, then appends missing ones from `fallback`. */
function complete<T>(order: T[] | undefined, fallback: T[]): T[] {
  const out = (order ?? []).filter((x) => fallback.includes(x));
  for (const x of fallback) if (!out.includes(x)) out.push(x);
  return out;
}

export function buildLayout(p: Profile): WorkspaceLayout {
  const preset = presetFor(p.primaryArea);
  const base = PRESETS[preset];
  const movable = NAV_KEYS.filter((k) => !FIXED_NAV.includes(k));
  const middle = complete(p.layout.navOrder, base.nav).filter((k) =>
    movable.includes(k),
  );
  const hiddenNav = (p.layout.hiddenNav ?? []).filter((k) =>
    movable.includes(k),
  );
  const cards = p.layout.dashboardCards
    ? p.layout.dashboardCards.filter((c) => DASHBOARD_CARDS.includes(c))
    : base.cards;
  const focus = [
    p.primaryArea && practiceArea(p.primaryArea).label,
    p.niches.slice(0, 3).join(", "),
    p.jurisdictions.slice(0, 2).join(", "),
  ].filter(Boolean);
  return {
    preset,
    nav: ["dashboard", ...middle, "settings"],
    hiddenNav,
    cards,
    quick: base.quick,
    defaultPractice: p.primaryArea
      ? practiceArea(p.primaryArea).label
      : "General research",
    focusLine: focus.length
      ? focus.join(" · ")
      : "Legal intelligence, updated for your matters.",
    prompts: promptsFor(p),
  };
}

const PROMPT_TEMPLATES: Record<LayoutPreset, string[]> = {
  litigation: [
    "Recent {niche} rulings in {court}",
    "Strongest arguments against a motion to dismiss in a {niche} case",
    "How have courts in {court} treated class certification for {niche} claims?",
  ],
  transactional: [
    "Market-standard {niche} terms to watch in {court}",
    "Recent {court} decisions interpreting {niche} provisions",
    "Checklist of risks when negotiating {niche}",
  ],
  regulatory: [
    "New {niche} guidance or enforcement actions this quarter",
    "How {court} courts have reviewed agency action on {niche}",
    "Compliance gaps clients most often miss in {niche}",
  ],
};

/** Three research prompts written for the person's niches and courts. */
export function promptsFor(p: Profile): string[] {
  const preset = presetFor(p.primaryArea);
  const niches = p.niches.length
    ? p.niches
    : [
        p.primaryArea
          ? practiceArea(p.primaryArea).label.toLowerCase()
          : "your practice area",
      ];
  const court = p.jurisdictions[0] ?? "federal court";
  return PROMPT_TEMPLATES[preset].map((t, i) =>
    t.replace("{niche}", niches[i % niches.length]).replace("{court}", court),
  );
}

/** True when a notice's text mentions one of the person's niches. */
export function matchesNiche(text: string, niches: string[]) {
  const t = text.toLowerCase();
  return niches.some((n) => n.length > 2 && t.includes(n.toLowerCase()));
}
