// Synthetic tenancy used by every cross-module access test.
// Mirrors the fixture set in docs/handoff/06 ("Fixture workspaces A and B").
// All identities are fictional; emails use the reserved example.invalid domain.

export type Role = "owner" | "admin" | "attorney" | "paralegal" | "viewer";

export interface Actor {
  id: string;
  label: string;
  email: string;
  workspaceId: string | null;
  role: Role | null;
  /** Matter ids this actor has been explicitly added to (matter ACL). */
  matters: string[];
  status: "active" | "revoked" | "anonymous";
}

export const WORKSPACE_A = "ws_a";
export const WORKSPACE_B = "ws_b";

export const MATTER_M1 = "matter_m1"; // A, restricted: A1 only
export const MATTER_M_OPEN = "matter_a_open"; // A, open to every A member
export const MATTER_M2 = "matter_m2"; // B

export const actors = {
  ownerA: {
    id: "u_owner_a",
    label: "owner of workspace A",
    email: "owner.a@example.invalid",
    workspaceId: WORKSPACE_A,
    role: "owner",
    matters: [MATTER_M_OPEN],
    status: "active",
  },
  attorneyA1: {
    id: "u_a1",
    label: "attorney A1 (on restricted matter M1)",
    email: "a1@example.invalid",
    workspaceId: WORKSPACE_A,
    role: "attorney",
    matters: [MATTER_M1, MATTER_M_OPEN],
    status: "active",
  },
  paralegalA2: {
    id: "u_a2",
    label: "paralegal A2 (walled off from M1)",
    email: "a2@example.invalid",
    workspaceId: WORKSPACE_A,
    role: "paralegal",
    matters: [MATTER_M_OPEN],
    status: "active",
  },
  viewerA3: {
    id: "u_a3",
    label: "viewer A3",
    email: "a3@example.invalid",
    workspaceId: WORKSPACE_A,
    role: "viewer",
    matters: [MATTER_M_OPEN],
    status: "active",
  },
  revokedA4: {
    id: "u_a4",
    label: "former member A4 (membership revoked)",
    email: "a4@example.invalid",
    workspaceId: WORKSPACE_A,
    role: "attorney",
    matters: [MATTER_M1, MATTER_M_OPEN],
    status: "revoked",
  },
  attorneyB1: {
    id: "u_b1",
    label: "attorney B1 (other firm)",
    email: "b1@example.invalid",
    workspaceId: WORKSPACE_B,
    role: "attorney",
    matters: [MATTER_M2],
    status: "active",
  },
  anonymous: {
    id: "anon",
    label: "signed-out visitor",
    email: "",
    workspaceId: null,
    role: null,
    matters: [],
    status: "anonymous",
  },
} as const satisfies Record<string, Actor>;

export type ActorKey = keyof typeof actors;

export type Action = "read" | "write" | "delete" | "export" | "invite";

export interface Resource {
  kind: "workspace" | "matter" | "document" | "research_run" | "member";
  id: string;
  workspaceId: string;
  matterId?: string;
}

export const resources = {
  workspaceA: { kind: "workspace", id: WORKSPACE_A, workspaceId: WORKSPACE_A },
  matterM1: {
    kind: "matter",
    id: MATTER_M1,
    workspaceId: WORKSPACE_A,
    matterId: MATTER_M1,
  },
  matterOpen: {
    kind: "matter",
    id: MATTER_M_OPEN,
    workspaceId: WORKSPACE_A,
    matterId: MATTER_M_OPEN,
  },
  docInM1: {
    kind: "document",
    id: "doc_m1_complaint",
    workspaceId: WORKSPACE_A,
    matterId: MATTER_M1,
  },
  researchInM1: {
    kind: "research_run",
    id: "run_m1_1",
    workspaceId: WORKSPACE_A,
    matterId: MATTER_M1,
  },
  matterM2: {
    kind: "matter",
    id: MATTER_M2,
    workspaceId: WORKSPACE_B,
    matterId: MATTER_M2,
  },
} as const satisfies Record<string, Resource>;

export type ResourceKey = keyof typeof resources;
