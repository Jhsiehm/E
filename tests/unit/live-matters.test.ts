import { describe, expect, it } from "vitest";
import {
  readMatterInput,
  toColumns,
  toMatter,
} from "@/lib/adapters/live/matter-rows";

describe("live matter input", () => {
  it("requires a name when creating and trims text", () => {
    expect(readMatterInput({}, true).errors.name).toBeDefined();
    const { values, errors } = readMatterInput(
      { name: "  Rivera v. Acme ", type: "Consumer", role: "Plaintiff" },
      true,
    );
    expect(errors).toEqual({});
    expect(toColumns(values)).toEqual({
      name: "Rivera v. Acme",
      practice_area: "Consumer",
      party_role: "Plaintiff",
    });
  });

  it("rejects unknown statuses, bad agent keys, oversize text and non-text", () => {
    const { errors } = readMatterInput(
      {
        status: "deleted",
        assignedAgentId: "Robert'); drop table",
        summary: "x".repeat(4001),
        docket: 12,
      },
      false,
    );
    expect(Object.keys(errors).sort()).toEqual([
      "assignedAgentId",
      "docket",
      "status",
      "summary",
    ]);
  });

  it("ignores fields people may not set (firm, creator, version)", () => {
    const { values } = readMatterInput(
      { workspace_id: "other-firm", created_by: "x", version: 9, name: "A" },
      false,
    );
    expect(toColumns(values)).toEqual({ name: "A" });
  });

  it("maps a database row to the card the screens show", () => {
    expect(
      toMatter({
        id: "m1",
        name: "A",
        docket: "",
        court: "",
        practice_area: "Civil litigation",
        party_role: "Plaintiff",
        summary: "",
        status: "active",
        assigned_agent_key: null,
        version: 3,
        updated_at: "2026-11-13T01:02:03Z",
      }),
    ).toMatchObject({
      court: "Not specified",
      type: "Civil litigation",
      assignedAgentId: "",
      updatedAt: "2026-11-13",
      version: 3,
    });
  });
});
