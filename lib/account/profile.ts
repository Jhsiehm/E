import { PRACTICE_AREA_KEYS, type PracticeAreaKey } from "@/lib/practice-areas";
/**
 * The signed-in person's profile: identity, practice focus and layout choices.
 * Shared by the server (Supabase row / demo cookie) and the client. Holds no
 * permissions: roles live on workspace memberships only.
 */

export type PracticeArea = PracticeAreaKey;
export const PRACTICE_AREAS = PRACTICE_AREA_KEYS;

export const JURISDICTIONS = [
  "Federal",
  "S.D.N.Y.",
  "E.D.N.Y.",
  "Second Circuit",
  "New York",
  "California",
  "Texas",
  "Florida",
  "Illinois",
  "Delaware",
  "New Jersey",
  "Massachusetts",
] as const;

export const ACCENTS = {
  rose: "#a6445d",
  teal: "#3e6e7a",
  olive: "#5b5c22",
  plum: "#7a4d66",
} as const;
export type Accent = keyof typeof ACCENTS;

export const NAV_KEYS = [
  "dashboard",
  "matters",
  "agents",
  "precedents",
  "notices",
  "calendar",
  "documents",
  "settings",
] as const;
export type NavKey = (typeof NAV_KEYS)[number];
/** Always shown, never reordered: first and last items of the sidebar. */
export const FIXED_NAV: NavKey[] = ["dashboard", "settings"];

export const DASHBOARD_CARDS = [
  "deadlines",
  "matters",
  "activity",
  "notices",
] as const;
export type DashboardCard = (typeof DASHBOARD_CARDS)[number];

/** How much the person has used AI tools; later phases scale features to it. */
export const AI_EXPERIENCE = {
  new: "I'm new to this",
  some: "I've tried it a few times",
  advanced: "I use it most days",
} as const;
export type AiExperience = keyof typeof AI_EXPERIENCE;

/**
 * Who the person is, for tailoring (students get a learning mode). Not a
 * permission: access comes only from workspace memberships.
 */
export const PERSONAS = {
  attorney: "Attorney",
  paralegal: "Paralegal or legal assistant",
  student: "Law student",
  other: "Other legal professional",
} as const;
export type Persona = keyof typeof PERSONAS;

export type LayoutPrefs = {
  /** Sidebar order (without dashboard/settings). Absent = practice preset. */
  navOrder?: NavKey[];
  hiddenNav?: NavKey[];
  /** Dashboard cards in order; absent = practice preset. */
  dashboardCards?: DashboardCard[];
};

export type Profile = {
  email: string;
  fullName: string;
  jobTitle: string;
  firmName: string;
  timeZone: string;
  avatarColor: Accent;
  accent: Accent;
  density: "comfortable" | "compact";
  aiExperience: AiExperience | null;
  persona: Persona | null;
  practiceAreas: PracticeArea[];
  primaryArea: PracticeArea | null;
  niches: string[];
  jurisdictions: string[];
  layout: LayoutPrefs;
  onboardedAt: string | null;
};

export function emptyProfile(email = ""): Profile {
  return {
    email,
    fullName: "",
    jobTitle: "",
    firmName: "",
    timeZone: "America/New_York",
    avatarColor: "rose",
    accent: "rose",
    density: "comfortable",
    aiExperience: null,
    persona: null,
    practiceAreas: [],
    primaryArea: null,
    niches: [],
    jurisdictions: [],
    layout: {},
    onboardedAt: null,
  };
}

const str = (v: unknown, max: number, fallback = "") =>
  typeof v === "string" ? v.trim().slice(0, max) : fallback;
const list = <T extends string>(
  v: unknown,
  max: number,
  allowed?: readonly T[],
): T[] => {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    const s = x.trim().slice(0, 60);
    if (!s || out.includes(s as T)) continue;
    if (allowed && !allowed.includes(s as T)) continue;
    out.push(s as T);
    if (out.length >= max) break;
  }
  return out;
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
  allowed.includes(v as T) ? (v as T) : d;

/**
 * Validates untrusted input (form posts, cookies, DB rows) into a Profile.
 * Unknown fields are dropped and every list is capped to the DB limits.
 */
export function sanitizeProfile(input: unknown, email = ""): Profile {
  const o = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  const accents = Object.keys(ACCENTS) as Accent[];
  const practiceAreas = list(o.practiceAreas, 3, PRACTICE_AREAS);
  const primary = practiceAreas.includes(o.primaryArea as PracticeArea)
    ? (o.primaryArea as PracticeArea)
    : (practiceAreas[0] ?? null);
  const rawLayout = (
    o.layout && typeof o.layout === "object" ? o.layout : {}
  ) as Record<string, unknown>;
  const movable = NAV_KEYS.filter((k) => !FIXED_NAV.includes(k));
  const layout: LayoutPrefs = {};
  if (Array.isArray(rawLayout.navOrder))
    layout.navOrder = list(rawLayout.navOrder, movable.length, movable);
  if (Array.isArray(rawLayout.hiddenNav))
    layout.hiddenNav = list(rawLayout.hiddenNav, movable.length, movable);
  if (Array.isArray(rawLayout.dashboardCards))
    layout.dashboardCards = list(
      rawLayout.dashboardCards,
      DASHBOARD_CARDS.length,
      DASHBOARD_CARDS,
    );
  const tz = str(o.timeZone, 64, "America/New_York");
  return {
    email: str(o.email, 254, email) || email,
    fullName: str(o.fullName, 120),
    jobTitle: str(o.jobTitle, 80),
    firmName: str(o.firmName, 120),
    timeZone: isTimeZone(tz) ? tz : "America/New_York",
    avatarColor: oneOf(o.avatarColor, accents, "rose"),
    accent: oneOf(o.accent, accents, "rose"),
    density: oneOf(
      o.density,
      ["comfortable", "compact"] as const,
      "comfortable",
    ),
    aiExperience: (Object.keys(AI_EXPERIENCE) as AiExperience[]).includes(
      o.aiExperience as AiExperience,
    )
      ? (o.aiExperience as AiExperience)
      : null,
    persona: (Object.keys(PERSONAS) as Persona[]).includes(o.persona as Persona)
      ? (o.persona as Persona)
      : null,
    practiceAreas,
    primaryArea: primary,
    niches: list(o.niches, 24),
    jurisdictions: list(o.jurisdictions, 24),
    layout,
    onboardedAt:
      typeof o.onboardedAt === "string" &&
      !Number.isNaN(Date.parse(o.onboardedAt))
        ? o.onboardedAt
        : null,
  };
}

export function isTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function initials(name: string, email = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length)
    return parts
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  return (email[0] || "?").toUpperCase();
}

/** DB row (snake_case) <-> Profile. */
export type ProfileRow = {
  full_name: string;
  job_title: string;
  firm_name: string;
  time_zone: string;
  avatar_color: string;
  accent: string;
  density: string;
  ai_experience: string | null;
  persona: string | null;
  practice_areas: string[];
  primary_area: string | null;
  niches: string[];
  jurisdictions: string[];
  layout: unknown;
  onboarded_at: string | null;
};
export function fromRow(row: Partial<ProfileRow> | null, email: string) {
  if (!row) return emptyProfile(email);
  return sanitizeProfile(
    {
      email,
      fullName: row.full_name,
      jobTitle: row.job_title,
      firmName: row.firm_name,
      timeZone: row.time_zone,
      avatarColor: row.avatar_color,
      accent: row.accent,
      density: row.density,
      aiExperience: row.ai_experience,
      persona: row.persona,
      practiceAreas: row.practice_areas,
      primaryArea: row.primary_area,
      niches: row.niches,
      jurisdictions: row.jurisdictions,
      layout: row.layout,
      onboardedAt: row.onboarded_at,
    },
    email,
  );
}
export function toRow(p: Profile): ProfileRow {
  return {
    full_name: p.fullName,
    job_title: p.jobTitle,
    firm_name: p.firmName,
    time_zone: p.timeZone,
    avatar_color: p.avatarColor,
    accent: p.accent,
    density: p.density,
    ai_experience: p.aiExperience,
    persona: p.persona,
    practice_areas: p.practiceAreas,
    primary_area: p.primaryArea,
    niches: p.niches,
    jurisdictions: p.jurisdictions,
    layout: p.layout,
    onboarded_at: p.onboardedAt,
  };
}
