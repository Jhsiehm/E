// Expected-access oracle for the synthetic tenancy, derived from
// docs/handoff/02 (roles, "membership never bypasses matter ACL", default deny)
// and docs/handoff/06 (negative access gate).
//
// The point is two-way coverage: every (resource, action) pair is exercised by
// actors who MUST be allowed and actors who MUST be denied, so a check that
// always says "allow" and a check that always says "deny" both fail.

import {
  actors,
  resources,
  type Action,
  type Actor,
  type ActorKey,
  type Resource,
  type ResourceKey,
} from "./tenancy";

export type Decision = "allow" | "deny";

const WRITE_ROLES = new Set(["owner", "admin", "attorney", "paralegal"]);
const DELETE_ROLES = new Set(["owner", "admin", "attorney"]);
const EXPORT_ROLES = new Set(["owner", "admin", "attorney"]);
const INVITE_ROLES = new Set(["owner", "admin"]);

export function expectedDecision(
  actor: Actor,
  action: Action,
  resource: Resource,
): Decision {
  if (actor.status !== "active" || !actor.role || !actor.workspaceId)
    return "deny";
  if (actor.workspaceId !== resource.workspaceId) return "deny";

  if (resource.kind === "workspace") {
    if (action === "read") return "allow";
    if (action === "invite")
      return INVITE_ROLES.has(actor.role) ? "allow" : "deny";
    return actor.role === "owner" ? "allow" : "deny";
  }
  if (resource.kind === "member") {
    return INVITE_ROLES.has(actor.role) ? "allow" : "deny";
  }

  // Matter-scoped: the matter ACL applies to every role, owner included.
  if (!resource.matterId || !actor.matters.includes(resource.matterId))
    return "deny";
  switch (action) {
    case "read":
      return "allow";
    case "write":
      return WRITE_ROLES.has(actor.role) ? "allow" : "deny";
    case "delete":
      return DELETE_ROLES.has(actor.role) ? "allow" : "deny";
    case "export":
      return EXPORT_ROLES.has(actor.role) ? "allow" : "deny";
    case "invite":
      return INVITE_ROLES.has(actor.role) ? "allow" : "deny";
  }
}

export interface AccessCase {
  actor: ActorKey;
  action: Action;
  resource: ResourceKey;
  expected: Decision;
  name: string;
}

const ACTIONS: Action[] = ["read", "write", "delete", "export", "invite"];

export function accessCases(filter?: {
  actions?: Action[];
  resources?: ResourceKey[];
}): AccessCase[] {
  const out: AccessCase[] = [];
  const rKeys = filter?.resources ?? (Object.keys(resources) as ResourceKey[]);
  const aList = filter?.actions ?? ACTIONS;
  for (const r of rKeys)
    for (const a of aList)
      for (const k of Object.keys(actors) as ActorKey[]) {
        const expected = expectedDecision(actors[k], a, resources[r]);
        out.push({
          actor: k,
          action: a,
          resource: r,
          expected,
          name: `${expected.toUpperCase()}: ${actors[k].label} ${a} ${r}`,
        });
      }
  return out;
}

/**
 * Runs a real authorization check over the whole matrix and returns
 * mismatches. `check` should call the module under test (policy function,
 * API route, or RLS-backed query) and report what actually happened.
 */
export async function runAccessMatrix(
  check: (c: AccessCase) => Promise<Decision> | Decision,
  cases: AccessCase[] = accessCases(),
): Promise<
  { case: AccessCase; actual: Decision | "error"; error?: unknown }[]
> {
  const failures = [];
  for (const c of cases) {
    let actual: Decision | "error";
    let error: unknown;
    try {
      actual = await check(c);
    } catch (e) {
      actual = "error";
      error = e;
    }
    // A thrown error counts as a deny only when deny was expected; it must
    // never be how an allowed request behaves.
    const ok =
      actual === c.expected || (actual === "error" && c.expected === "deny");
    if (!ok) failures.push({ case: c, actual, error });
  }
  return failures;
}
