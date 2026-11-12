import type { AgentConfig } from "./types";
import { FORBIDDEN_CAPABILITIES, TOOLS } from "./tools";

/**
 * Hard limits for any agent version, built-in or firm-made (spec 04:
 * "enforce validated hard upper bounds and cost ceilings").
 */
export const HARD_LIMITS = {
  maxUSDPerRun: 1.5,
  maxSourceTokens: 24_000,
  maxOutputTokens: 4_000,
  maxCandidates: 100,
  maxReranked: 20,
  maxPrivateDocumentVersions: 25,
} as const;

const TIER_ORDER = ["bulk", "fast", "reasoning", "frontier"] as const;

export interface ValidationIssue {
  path: string;
  message: string;
}

/** Checks one agent version on its own. Empty array = valid. */
export function validateAgentConfig(a: AgentConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  if (!/^[a-z][a-z0-9_]{1,63}$/.test(a.key))
    add("key", "Use lowercase letters, digits and _.");
  if (!Number.isInteger(a.version) || a.version < 1)
    add("version", "Must be a positive integer.");

  for (const t of a.tools) {
    if (!(t in TOOLS)) add("tools", `Unknown tool "${t}".`);
    if ((FORBIDDEN_CAPABILITIES as readonly string[]).includes(t))
      add("tools", `"${t}" is never allowed for agents.`);
  }

  const v = a.verification as Record<string, unknown>;
  for (const k of [
    "sourceExists",
    "quoteMatches",
    "claimSupport",
    "humanReviewRequired",
  ])
    if (v[k] !== true)
      add(`verification.${k}`, "Verification checks cannot be turned off.");
  if (
    (a.monitoring as { autostartWatches: unknown }).autostartWatches !== false
  )
    add(
      "monitoring.autostartWatches",
      "Watches are never started without the user.",
    );

  const b = a.budgets;
  if (!(b.maxUSDPerRun > 0 && b.maxUSDPerRun <= HARD_LIMITS.maxUSDPerRun))
    add(
      "budgets.maxUSDPerRun",
      `Must be above 0 and at most $${HARD_LIMITS.maxUSDPerRun}.`,
    );
  if (b.maxSourceTokens > HARD_LIMITS.maxSourceTokens)
    add("budgets.maxSourceTokens", `At most ${HARD_LIMITS.maxSourceTokens}.`);
  if (b.maxOutputTokens > HARD_LIMITS.maxOutputTokens)
    add("budgets.maxOutputTokens", `At most ${HARD_LIMITS.maxOutputTokens}.`);

  const r = a.retrieval;
  if (r.maxCandidates > HARD_LIMITS.maxCandidates)
    add("retrieval.maxCandidates", "Too high.");
  if (r.maxReranked > HARD_LIMITS.maxReranked)
    add("retrieval.maxReranked", "Too high.");
  if (r.maxReranked > r.maxCandidates)
    add("retrieval.maxReranked", "Cannot exceed maxCandidates.");
  if (r.maxPrivateDocumentVersions > HARD_LIMITS.maxPrivateDocumentVersions)
    add("retrieval.maxPrivateDocumentVersions", "Too high.");

  if (TIER_ORDER.indexOf(a.tiers.draft) < TIER_ORDER.indexOf("frontier"))
    add(
      "tiers.draft",
      "The final answer is always drafted on the frontier tier.",
    );
  if (a.tiers.verify === "bulk" || a.tiers.verify === "fast")
    add("tiers.verify", "Claim checks need at least the reasoning tier.");

  if (a.requestedStatus !== "coming_later") {
    if (!a.supportedJurisdictions.length)
      add("supportedJurisdictions", "Name at least one.");
    if (!a.sourceCollectionAllowlist.length)
      add("sourceCollectionAllowlist", "Name at least one.");
    if (!a.workflows.length) add("workflows", "Name at least one.");
    if (!a.output.pinpointRequired)
      add("output.pinpointRequired", "Pinpoints are required.");
  } else if (a.tools.length || a.workflows.length) {
    add(
      "requestedStatus",
      "A coming-later agent cannot have tools or workflows.",
    );
  }

  for (const p of a.playbooks)
    for (const s of p.preferredSources)
      if (!a.sourceCollectionAllowlist.includes(s))
        add(
          `playbooks.${p.key}`,
          `Source "${s}" is not in the agent's allowlist.`,
        );

  return issues;
}

const subset = (xs: readonly string[], of: readonly string[]) =>
  xs.every((x) => of.includes(x));

/**
 * A firm version cloned from a template may only narrow it: fewer sources,
 * jurisdictions, workflows and tools, lower budgets. Source access is never
 * inherited from the agent, and can never widen past the template.
 */
export function validateFirmVersion(
  template: AgentConfig,
  firm: AgentConfig,
): ValidationIssue[] {
  const issues = validateAgentConfig(firm);
  const add = (path: string, message: string) => issues.push({ path, message });

  if (firm.practiceArea !== template.practiceArea)
    add("practiceArea", "A firm version keeps its template's practice area.");
  if (
    !subset(firm.sourceCollectionAllowlist, template.sourceCollectionAllowlist)
  )
    add("sourceCollectionAllowlist", "Firm versions can only remove sources.");
  if (!subset(firm.supportedJurisdictions, template.supportedJurisdictions))
    add(
      "supportedJurisdictions",
      "Firm versions can only remove jurisdictions.",
    );
  if (!subset(firm.workflows, template.workflows))
    add("workflows", "Firm versions can only remove workflows.");
  if (!subset(firm.tools, template.tools))
    add("tools", "Firm versions can only remove tools.");
  if (firm.budgets.maxUSDPerRun > template.budgets.maxUSDPerRun)
    add("budgets.maxUSDPerRun", "Firm versions can only lower the budget.");
  if (
    firm.requestedStatus === "available" &&
    template.requestedStatus !== "available"
  )
    add(
      "requestedStatus",
      "A firm version cannot be more ready than its template.",
    );
  if (firm.version <= template.version && firm.key === template.key)
    add("version", "Publish a new version number; versions are immutable.");
  return issues;
}
