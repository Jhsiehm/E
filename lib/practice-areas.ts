/**
 * The one practice-area catalog for Casevex. Onboarding, layouts, the ask bar
 * and agent profiles all use these stable keys; labels can change freely.
 *
 * agentStatus follows the handoff spec (01, Agents): only the pilot areas
 * have a research agent today; others are labeled honestly until their
 * sources and evaluations are ready. Any area can still shape your layout.
 */
export type AgentStatus = "available" | "beta" | "coming_later";
export type LayoutPreset = "litigation" | "transactional" | "regulatory";

export const PRACTICE_AREA_CATALOG = [
  {
    key: "consumer_class_action",
    label: "Consumer and class action",
    preset: "litigation",
    agentStatus: "available",
    niches: [
      "TCPA",
      "FDCPA",
      "Data privacy",
      "Securities class actions",
      "Product liability",
    ],
  },
  {
    key: "ny_civil_litigation",
    label: "Civil litigation (New York)",
    preset: "litigation",
    agentStatus: "available",
    niches: [
      "Commercial disputes",
      "Trade secrets",
      "Breach of contract",
      "Appeals",
      "Discovery disputes",
    ],
  },
  {
    key: "employment",
    label: "Employment",
    preset: "litigation",
    agentStatus: "beta",
    niches: [
      "Wage and hour",
      "Discrimination",
      "Non-competes",
      "Whistleblower",
      "ERISA",
    ],
  },
  {
    key: "civil_rights",
    label: "Civil rights",
    preset: "litigation",
    agentStatus: "coming_later",
    niches: [
      "Section 1983",
      "Police misconduct",
      "Voting rights",
      "Disability access",
    ],
  },
  {
    key: "criminal_defense",
    label: "Criminal defense",
    preset: "litigation",
    agentStatus: "coming_later",
    niches: [
      "White collar",
      "Fourth Amendment",
      "Sentencing",
      "Post-conviction",
    ],
  },
  {
    key: "personal_injury",
    label: "Personal injury",
    preset: "litigation",
    agentStatus: "coming_later",
    niches: [
      "Medical malpractice",
      "Auto accidents",
      "Premises liability",
      "Mass torts",
    ],
  },
  {
    key: "family",
    label: "Family",
    preset: "litigation",
    agentStatus: "coming_later",
    niches: ["Divorce", "Custody", "Support", "Prenuptial agreements"],
  },
  {
    key: "corporate",
    label: "Corporate",
    preset: "transactional",
    agentStatus: "coming_later",
    niches: ["M&A", "Venture financing", "Governance", "Securities offerings"],
  },
  {
    key: "contracts",
    label: "Contracts",
    preset: "transactional",
    agentStatus: "coming_later",
    niches: ["SaaS agreements", "Supply chain", "Licensing", "Indemnification"],
  },
  {
    key: "real_estate",
    label: "Real estate",
    preset: "transactional",
    agentStatus: "coming_later",
    niches: [
      "Commercial leasing",
      "Land use and zoning",
      "Construction",
      "Landlord-tenant",
    ],
  },
  {
    key: "trust_estate",
    label: "Trust and estate",
    preset: "transactional",
    agentStatus: "coming_later",
    niches: [
      "Estate planning",
      "Probate litigation",
      "Trust administration",
      "Elder law",
    ],
  },
  {
    key: "intellectual_property",
    label: "Intellectual property",
    preset: "transactional",
    agentStatus: "coming_later",
    niches: ["Patent litigation", "Trademarks", "Copyright", "Licensing"],
  },
  {
    key: "regulatory",
    label: "Regulatory",
    preset: "regulatory",
    agentStatus: "coming_later",
    niches: [
      "Financial services",
      "Healthcare compliance",
      "Environmental",
      "FCPA",
    ],
  },
  {
    key: "international",
    label: "International",
    preset: "regulatory",
    agentStatus: "coming_later",
    niches: [
      "Arbitration",
      "Sanctions and export controls",
      "Cross-border disputes",
    ],
  },
  {
    key: "immigration",
    label: "Immigration",
    preset: "regulatory",
    agentStatus: "coming_later",
    niches: ["Business visas", "Asylum", "Removal defense", "Naturalization"],
  },
] as const satisfies readonly {
  key: string;
  label: string;
  preset: LayoutPreset;
  agentStatus: AgentStatus;
  niches: readonly string[];
}[];

export type PracticeAreaKey = (typeof PRACTICE_AREA_CATALOG)[number]["key"];
export type PracticeAreaInfo = (typeof PRACTICE_AREA_CATALOG)[number];

export const PRACTICE_AREA_KEYS = PRACTICE_AREA_CATALOG.map(
  (a) => a.key,
) as PracticeAreaKey[];

export function practiceArea(key: PracticeAreaKey): PracticeAreaInfo {
  return PRACTICE_AREA_CATALOG.find((a) => a.key === key)!;
}

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  available: "Research agent available",
  beta: "Research agent in beta",
  coming_later: "Research agent coming later",
};
