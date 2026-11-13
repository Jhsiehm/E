// The demo's practice sample cases: opt-in, labelled, and removable without
// touching the person's own work.

import { describe, expect, it } from "vitest";
import { workspaceAction } from "@/lib/adapters/fixture/samples";
import { emptyState } from "@/lib/mock/data";

const own = {
  id: "my-case",
  name: "Garcia v. Lender",
  docket: "",
  court: "",
  type: "Consumer",
  status: "active",
  role: "Plaintiff",
  summary: "",
  assignedAgentId: "",
  documentCount: 0,
  updatedAt: "2026-11-13",
};

describe("demo sample cases", () => {
  it("are added on request, all marked as samples", () => {
    const s = emptyState();
    expect(s.matters).toEqual([]);
    expect(workspaceAction(s, "samples", "POST")).toBe(true);
    expect(s.samples).toBe("on");
    expect(s.matters.length).toBe(5);
    expect(s.matters.every((m) => m.sample)).toBe(true);
    expect(s.notices.length).toBeGreaterThan(0);
  });

  it("are removed with everything attached, keeping the person's own matter", () => {
    const s = emptyState();
    s.matters.push(own);
    s.documents.push({
      id: "my-doc",
      matterId: "my-case",
      name: "Contract",
      ext: "pdf",
      sizeBytes: 1,
      type: "",
      ownerInitials: "",
      modifiedAt: "2026-11-13",
      status: "draft",
    });
    workspaceAction(s, "samples", "POST");
    expect(s.matters.length).toBe(6);
    workspaceAction(s, "samples", "DELETE");
    expect(s.matters).toEqual([own]);
    expect(s.documents.map((d) => d.id)).toEqual(["my-doc"]);
    expect(s.notices).toEqual([]);
    expect(s.precedents).toEqual([]);
    expect(s.deadlines).toEqual([]);
    expect(s.samples).toBe("off");
  });

  it("starting over empties the workspace but keeps the person's name", () => {
    const s = emptyState();
    s.me.name = "Ana Ruiz";
    workspaceAction(s, "samples", "POST");
    workspaceAction(s, "reset", "POST");
    expect(s.me.name).toBe("Ana Ruiz");
    expect(s.matters).toEqual([]);
  });
});
