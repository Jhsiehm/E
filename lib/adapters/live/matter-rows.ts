import type { Matter } from "@/lib/mock/types";

/** Columns read for a matter card; never select("*") so new columns stay opt-in. */
export const MATTER_COLUMNS =
  "id, name, docket, court, practice_area, party_role, summary, status, assigned_agent_key, version, updated_at";

export interface MatterRow {
  id: string;
  name: string;
  docket: string;
  court: string;
  practice_area: string;
  party_role: string;
  summary: string;
  status: string;
  assigned_agent_key: string | null;
  version: number;
  updated_at: string;
}

export type LiveMatter = Matter & { version: number };

export function toMatter(r: MatterRow, documentCount = 0): LiveMatter {
  return {
    id: r.id,
    name: r.name,
    docket: r.docket,
    court: r.court || "Not specified",
    type: r.practice_area,
    status: r.status,
    role: r.party_role,
    summary: r.summary,
    assignedAgentId: r.assigned_agent_key ?? "",
    documentCount,
    updatedAt: r.updated_at.slice(0, 10),
    version: r.version,
  };
}

const LIMITS = {
  name: 200,
  docket: 120,
  court: 120,
  type: 80,
  role: 40,
  summary: 4000,
} as const;
const STATUSES = ["active", "pending", "closed", "archived"];
const AGENT_KEY = /^[a-z0-9_-]{1,64}$/;

type Input = Record<string, unknown>;
export type FieldErrors = Record<string, string[]>;

/** Validates create/edit input from the screens. Unknown fields are ignored. */
export function readMatterInput(body: Input, creating: boolean) {
  const errors: FieldErrors = {};
  const out: Record<string, string | null> = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    const v = body[key];
    if (v === undefined) continue;
    if (typeof v !== "string") errors[key] = ["Must be text."];
    else if (v.length > max)
      errors[key] = [`Keep this under ${max} characters.`];
    else out[key] = v.trim();
  }
  if (creating && !out.name) errors.name = ["Matter name is required."];
  if (!creating && out.name === "") errors.name = ["Matter name is required."];
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUSES.includes(body.status))
      errors.status = [`Choose one of: ${STATUSES.join(", ")}.`];
    else out.status = body.status;
  }
  if (body.assignedAgentId !== undefined) {
    const v = body.assignedAgentId;
    if (v === "" || v === null) out.assignedAgentId = null;
    else if (typeof v !== "string" || !AGENT_KEY.test(v))
      errors.assignedAgentId = ["Choose an agent from the list."];
    else out.assignedAgentId = v;
  }
  return { values: out, errors };
}

/** Screen field names -> database columns. */
export function toColumns(v: Record<string, string | null>) {
  const map: Record<string, string> = {
    name: "name",
    docket: "docket",
    court: "court",
    type: "practice_area",
    role: "party_role",
    summary: "summary",
    status: "status",
    assignedAgentId: "assigned_agent_key",
  };
  return Object.fromEntries(
    Object.entries(v)
      .filter(([k]) => k in map)
      .map(([k, val]) => [map[k], val]),
  );
}
