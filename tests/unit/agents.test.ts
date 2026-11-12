import { describe, expect, it } from "vitest";
import {
  AGENT_CATALOG,
  FORBIDDEN_CAPABILITIES,
  PRACTICE_AREA_KEYS,
  TOOLS,
  agentForPracticeArea,
  effectiveStatus,
  featuresFor,
  levelFor,
  learningModeDefault,
  shows,
  statusForPracticeArea,
  validateAgentConfig,
  validateFirmVersion,
  type AgentConfig,
} from "@/lib/agents";

const consumer = agentForPracticeArea("consumer_class_action")!;

describe("agent catalog", () => {
  it("every built-in agent passes validation", () => {
    for (const a of AGENT_CATALOG)
      expect(validateAgentConfig(a), a.key).toEqual([]);
  });

  it("has one agent per practice area", () => {
    for (const k of PRACTICE_AREA_KEYS)
      expect(agentForPracticeArea(k), k).toBeDefined();
    expect(new Set(AGENT_CATALOG.map((a) => a.key)).size).toBe(
      AGENT_CATALOG.length,
    );
  });

  it("matches the pilot scope", () => {
    expect(consumer.requestedStatus).toBe("available");
    expect(agentForPracticeArea("ny_civil_litigation")!.requestedStatus).toBe(
      "available",
    );
    expect(statusForPracticeArea("employment")).toBe("beta");
    for (const k of [
      "contracts",
      "corporate",
      "trust_estate",
      "regulatory",
      "real_estate",
      "international",
    ] as const)
      expect(statusForPracticeArea(k)).toBe("coming_later");
  });

  it("never shows available without test and attorney evidence", () => {
    for (const a of AGENT_CATALOG)
      expect(effectiveStatus(a)).not.toBe("available");
    const proven: AgentConfig = {
      ...consumer,
      readiness: {
        goldenQuestions: 60,
        adversarialCases: 30,
        lastEvalPassedAt: "2026-12-01T00:00:00Z",
        inventedCitationsAccepted: 0,
        attorneySignoff: { reviewer: "reviewer-1", at: "2026-12-02T00:00:00Z" },
        corpusConfirmed: true,
      },
    };
    expect(effectiveStatus(proven)).toBe("available");
    expect(
      effectiveStatus({
        ...proven,
        readiness: { ...proven.readiness, inventedCitationsAccepted: 1 },
      }),
    ).toBe("beta");
    expect(
      effectiveStatus({
        ...proven,
        readiness: { ...proven.readiness, attorneySignoff: null },
      }),
    ).toBe("beta");
  });

  it("agents name routing tiers, not model ids, and draft on frontier", () => {
    for (const a of AGENT_CATALOG) {
      for (const t of Object.values(a.tiers))
        expect(["frontier", "reasoning", "fast", "bulk"]).toContain(t);
      expect(a.tiers.draft).toBe("frontier");
      expect(a.budgets.maxUSDPerRun).toBeLessThanOrEqual(1.5);
    }
  });
});

describe("tools", () => {
  it("exposes no forbidden capability and no deadline tool", () => {
    for (const f of FORBIDDEN_CAPABILITIES) expect(f in TOOLS).toBe(false);
    expect(Object.keys(TOOLS).some((k) => k.includes("deadline"))).toBe(false);
  });

  it("every draft tool needs a person to keep the result", () => {
    for (const t of Object.values(TOOLS))
      if (t.kind === "draft") expect(t.requiresConfirmation, t.key).toBe(true);
  });
});

describe("validation", () => {
  it("rejects turning off verification or auto-starting watches", () => {
    const bad = {
      ...consumer,
      verification: { ...consumer.verification, claimSupport: false },
      monitoring: { suggestWatches: true, autostartWatches: true },
    } as unknown as AgentConfig;
    const paths = validateAgentConfig(bad).map((i) => i.path);
    expect(paths).toContain("verification.claimSupport");
    expect(paths).toContain("monitoring.autostartWatches");
  });

  it("rejects budgets over the ceiling and a cheap drafter", () => {
    const bad: AgentConfig = {
      ...consumer,
      budgets: { ...consumer.budgets, maxUSDPerRun: 5 },
      tiers: { ...consumer.tiers, draft: "fast", verify: "fast" },
    };
    const paths = validateAgentConfig(bad).map((i) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "budgets.maxUSDPerRun",
        "tiers.draft",
        "tiers.verify",
      ]),
    );
  });

  it("rejects forbidden or unknown tools", () => {
    const bad = {
      ...consumer,
      tools: [...consumer.tools, "send_email"],
    } as unknown as AgentConfig;
    expect(validateAgentConfig(bad).some((i) => i.path === "tools")).toBe(true);
  });

  it("firm versions may narrow but never widen", () => {
    const narrowed: AgentConfig = {
      ...consumer,
      version: 2,
      supportedJurisdictions: ["NY"],
      tools: ["search_law", "draft_memo"],
      playbooks: [],
      budgets: { ...consumer.budgets, maxUSDPerRun: 1 },
    };
    expect(validateFirmVersion(consumer, narrowed)).toEqual([]);

    const widened: AgentConfig = {
      ...narrowed,
      supportedJurisdictions: [...consumer.supportedJurisdictions, "CA"],
      sourceCollectionAllowlist: [
        ...consumer.sourceCollectionAllowlist,
        "westlaw",
      ],
    };
    const paths = validateFirmVersion(consumer, widened).map((i) => i.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "supportedJurisdictions",
        "sourceCollectionAllowlist",
      ]),
    );
    expect(
      validateFirmVersion(consumer, { ...narrowed, version: 1 }).map(
        (i) => i.path,
      ),
    ).toContain("version");
  });
});

describe("AI experience levels", () => {
  it("maps onboarding answers, with skipped answers starting Guided", () => {
    expect(levelFor("new")).toBe("guided");
    expect(levelFor("some")).toBe("assisted");
    expect(levelFor("advanced")).toBe("full");
    expect(levelFor(null)).toBe("guided");
    expect(levelFor(undefined)).toBe("guided");
  });

  it("each level adds to the one before", () => {
    const g = featuresFor({ level: "guided", role: "attorney" });
    const a = featuresFor({ level: "assisted", role: "attorney" });
    const f = featuresFor({ level: "full", role: "attorney" });
    expect(g).toContain("ask_box");
    expect(g).not.toContain("task_buttons");
    for (const x of g) expect(a).toContain(x);
    for (const x of a) expect(f).toContain(x);
    expect(f).toContain("research_plan_view");
  });

  it("firm agent versions are admin-only at any level", () => {
    expect(
      shows("firm_agent_versions", { level: "full", role: "attorney" }),
    ).toBe(false);
    expect(
      shows("firm_agent_versions", {
        level: "full",
        role: "attorney",
        isAdmin: true,
      }),
    ).toBe(true);
  });

  it("students get learning mode by default", () => {
    expect(learningModeDefault("student")).toBe(true);
    expect(learningModeDefault("attorney")).toBe(false);
  });
});
