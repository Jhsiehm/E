import { fromRow } from "@/lib/account/profile";
import { seedAgents } from "@/lib/mock/seed-feed";
import type { State } from "@/lib/mock/types";
import type { LiveContext } from "./context";
import { DOCUMENT_COLUMNS, toDocument } from "./documents";
import { MATTER_COLUMNS, toMatter, type MatterRow } from "./matter-rows";
import { fromDbError, ok } from "./respond";

const PROFILE_COLUMNS =
  "full_name,job_title,time_zone,primary_area,practice_areas";

/**
 * GET /api/bootstrap in live mode: the same shape the screens already use,
 * filled from the database. Parts not connected yet (notices,
 * precedents, chat) are empty rather than sample data.
 */
export async function liveBootstrap(ctx: LiveContext) {
  const [profile, matters, deadlines, strategies, documents] =
    await Promise.all([
      ctx.db
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", ctx.userId)
        .maybeSingle(),
      ctx.db
        .from("matters")
        .select(MATTER_COLUMNS)
        .eq("workspace_id", ctx.workspaceId)
        .order("updated_at", { ascending: false })
        .limit(200),
      ctx.db
        .from("matter_deadlines")
        .select("id, matter_id, title, due_on, kind")
        .eq("workspace_id", ctx.workspaceId)
        .order("due_on")
        .limit(500),
      ctx.db
        .from("matter_strategy")
        .select("matter_id, body")
        .eq("workspace_id", ctx.workspaceId),
      ctx.db
        .from("documents")
        .select(DOCUMENT_COLUMNS)
        .eq("workspace_id", ctx.workspaceId)
        .order("updated_at", { ascending: false })
        .limit(500),
    ]);
  const failed = [profile, matters, deadlines, strategies, documents].find(
    (r) => r.error,
  );
  if (failed) return fromDbError(failed.error);

  const p = fromRow(profile.data, ctx.email);
  const rows = (matters.data ?? []) as MatterRow[];
  const counts = new Map<string, number>();
  for (const r of rows)
    if (r.assigned_agent_key)
      counts.set(
        r.assigned_agent_key,
        (counts.get(r.assigned_agent_key) ?? 0) + 1,
      );

  const docs = (documents.data ?? []).map((d) =>
    toDocument(d as Parameters<typeof toDocument>[0]),
  );
  const docCounts = new Map<string, number>();
  for (const d of docs)
    docCounts.set(d.matterId, (docCounts.get(d.matterId) ?? 0) + 1);

  const state: State = {
    me: {
      name: p.fullName || ctx.email,
      role: p.jobTitle,
      email: ctx.email,
      theme: "light",
      defaultPracticeArea: p.primaryArea ?? "",
      timeZone: p.timeZone,
    },
    matters: rows.map((r) => toMatter(r, docCounts.get(r.id) ?? 0)),
    deadlines: (deadlines.data ?? []).map((d) => ({
      id: d.id,
      matterId: d.matter_id,
      title: d.title,
      dueAt: d.due_on,
      kind: d.kind,
    })),
    documents: docs,
    notices: [],
    agents: seedAgents().map((a) => ({
      ...a,
      matterCount: counts.get(a.id) ?? 0,
    })),
    precedents: [],
    chats: {},
    strategies: Object.fromEntries(
      (strategies.data ?? []).map((s) => [s.matter_id, s.body]),
    ),
  };
  return ok(state);
}
