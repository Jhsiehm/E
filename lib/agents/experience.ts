/**
 * AI experience levels, from the onboarding question
 * "How comfortable are you with AI tools?".
 *
 * profiles.ai_experience (P1 onboarding) stores new | some | advanced, or
 * null when skipped. The level only changes how much is on screen.
 * Verification, source links and draft labels are identical at every level,
 * and every feature stays reachable through "More options".
 */
export type AiExperience = "new" | "some" | "advanced";
export type ExperienceLevel = "guided" | "assisted" | "full";

export const ONBOARDING_QUESTION = "How comfortable are you with AI tools?";

export const ONBOARDING_ANSWERS: readonly {
  value: AiExperience;
  label: string;
}[] = [
  { value: "new", label: "I'm new to this" },
  { value: "some", label: "I've tried it a few times" },
  { value: "advanced", label: "I use it most days" },
];

export const LEVEL_FOR: Record<AiExperience, ExperienceLevel> = {
  new: "guided",
  some: "assisted",
  advanced: "full",
};

export const LEVEL_LABEL: Record<ExperienceLevel, string> = {
  guided: "Guided",
  assisted: "Assisted",
  full: "Full",
};

/** Skipped or unknown answers start at Guided. */
export function levelFor(ai: AiExperience | null | undefined): ExperienceLevel {
  return ai && Object.prototype.hasOwnProperty.call(LEVEL_FOR, ai)
    ? LEVEL_FOR[ai]
    : "guided";
}

export type Feature =
  | "ask_box"
  | "suggested_questions"
  | "auto_agent"
  | "first_run_tour"
  | "task_buttons"
  | "agent_switcher"
  | "source_filters"
  | "edit_answers"
  | "research_plan_view"
  | "batch_document_review"
  | "speed_choice"
  | "keyboard_shortcuts"
  | "firm_agent_versions";

const ORDER: readonly ExperienceLevel[] = ["guided", "assisted", "full"];

/** The lowest level at which each feature is shown by default. */
export const FEATURE_LEVEL: Record<Feature, ExperienceLevel> = {
  ask_box: "guided",
  suggested_questions: "guided",
  auto_agent: "guided",
  first_run_tour: "guided",
  task_buttons: "assisted",
  agent_switcher: "assisted",
  source_filters: "assisted",
  edit_answers: "assisted",
  research_plan_view: "full",
  batch_document_review: "full",
  speed_choice: "full",
  keyboard_shortcuts: "full",
  firm_agent_versions: "full",
};

/** Features that also need a role, whatever the level. */
const ADMIN_ONLY: readonly Feature[] = ["firm_agent_versions"];

/** profiles.persona from onboarding; admin rights come from the workspace membership. */
export type Role = "attorney" | "paralegal" | "student" | "other";

export interface ExperienceContext {
  level: ExperienceLevel;
  role: Role;
  isAdmin?: boolean;
}

/** Whether a feature is shown up front. Hidden features stay in "More options". */
export function shows(feature: Feature, ctx: ExperienceContext): boolean {
  if (ADMIN_ONLY.includes(feature) && !ctx.isAdmin) return false;
  return ORDER.indexOf(ctx.level) >= ORDER.indexOf(FEATURE_LEVEL[feature]);
}

export function featuresFor(ctx: ExperienceContext): Feature[] {
  return (Object.keys(FEATURE_LEVEL) as Feature[]).filter((f) => shows(f, ctx));
}

/**
 * Students get Learning mode by default: show the search path, structure
 * answers as Issue, Rule, Application, Conclusion, and ask for the student's
 * own answer first. Students research public law only, no client matters.
 */
export function learningModeDefault(role: Role): boolean {
  return role === "student";
}

/** After this many saved answers, offer the next level once. */
export const LEVEL_UP_AFTER_SAVED_ANSWERS = 10;
/** A dismissed level-up offer is not repeated for this many days. */
export const LEVEL_UP_SNOOZE_DAYS = 30;

export function nextLevel(level: ExperienceLevel): ExperienceLevel | null {
  const i = ORDER.indexOf(level);
  return i < ORDER.length - 1 ? ORDER[i + 1] : null;
}
