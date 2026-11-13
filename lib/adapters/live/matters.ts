import type { LiveContext } from "./context";
import {
  MATTER_COLUMNS,
  readMatterInput,
  toColumns,
  toMatter,
  type MatterRow,
} from "./matter-rows";
import { fail, fromDbError, ok } from "./respond";

type Body = Record<string, unknown>;
const DEADLINE_COLUMNS = "id, matter_id, title, due_on, kind";

/** GET /api/matters?q=&status=&type= : matters this person is on. */
export async function listMatters(ctx: LiveContext, params: URLSearchParams) {
  let query = ctx.db
    .from("matters")
    .select(MATTER_COLUMNS)
    .eq("workspace_id", ctx.workspaceId)
    .order("updated_at", { ascending: false })
    .limit(200);
  const status = params.get("status");
  const type = params.get("type");
  if (status) query = query.eq("status", status);
  if (type) query = query.eq("practice_area", type);
  const { data, error } = await query;
  if (error) return fromDbError(error);
  const q = params.get("q")?.toLowerCase();
  const rows = (data as MatterRow[]).filter(
    (m) => !q || `${m.name} ${m.docket}`.toLowerCase().includes(q),
  );
  return ok(rows.map((r) => toMatter(r)));
}

/** POST /api/matters : create through the create_matter function. */
export async function createMatter(ctx: LiveContext, body: Body) {
  const { values, errors } = readMatterInput(body, true);
  if (Object.keys(errors).length)
    return fail(
      422,
      "validation_failed",
      "Check the highlighted fields.",
      errors,
    );
  const { data: id, error } = await ctx.db.rpc("create_matter", {
    ws: ctx.workspaceId,
    matter_name: values.name,
    docket: values.docket ?? "",
    court: values.court ?? "",
    practice_area: values.type ?? "",
    party_role: values.role ?? "",
    summary: values.summary ?? "",
    assigned_agent_key: values.assignedAgentId ?? null,
  });
  if (error) return fromDbError(error);
  const { data, error: readErr } = await ctx.db
    .from("matters")
    .select(MATTER_COLUMNS)
    .eq("id", id)
    .single();
  if (readErr) return fromDbError(readErr);
  return ok(toMatter(data as MatterRow), 201);
}

/** GET /api/matters/:id : the matter with its deadlines. */
export async function getMatter(ctx: LiveContext, id: string) {
  const { data, error } = await ctx.db
    .from("matters")
    .select(MATTER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) return fromDbError(error);
  // A matter you are not on looks exactly like one that does not exist.
  if (!data) return fail(404, "not_found", "Matter not found.");
  const deadlines = await ctx.db
    .from("matter_deadlines")
    .select(DEADLINE_COLUMNS)
    .eq("matter_id", id)
    .order("due_on");
  if (deadlines.error) return fromDbError(deadlines.error);
  return ok({
    ...toMatter(data as MatterRow),
    deadlines: deadlines.data.map((d) => ({
      id: d.id,
      matterId: d.matter_id,
      title: d.title,
      dueAt: d.due_on,
      kind: d.kind,
    })),
    documents: [],
  });
}

/**
 * PATCH /api/matters/:id. Send `version` (from the last read) to refuse
 * overwriting someone else's newer edit; the reply is 409 in that case.
 */
export async function updateMatter(ctx: LiveContext, id: string, body: Body) {
  const { values, errors } = readMatterInput(body, false);
  if (Object.keys(errors).length)
    return fail(
      422,
      "validation_failed",
      "Check the highlighted fields.",
      errors,
    );
  let query = ctx.db.from("matters").update(toColumns(values)).eq("id", id);
  const expected = Number(body.version);
  if (body.version !== undefined && Number.isInteger(expected))
    query = query.eq("version", expected);
  const { data, error } = await query.select(MATTER_COLUMNS).maybeSingle();
  if (error) return fromDbError(error);
  if (!data) {
    const exists = await ctx.db
      .from("matters")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    return exists.data
      ? fail(
          409,
          "conflict",
          "Someone else changed this matter. Reload and try again.",
        )
      : fail(404, "not_found", "Matter not found.");
  }
  return ok(toMatter(data as MatterRow));
}

/** GET or PATCH /api/matters/:id/strategy */
export async function matterStrategy(
  ctx: LiveContext,
  id: string,
  method: string,
  body: Body,
) {
  if (method === "PATCH") {
    const text = typeof body.text === "string" ? body.text : "";
    if (text.length > 50_000)
      return fail(422, "validation_failed", "Strategy notes are too long.");
    // Update first, insert if there is no row yet. (An upsert would also try
    // to rewrite matter_id and workspace_id, which nobody may change.)
    const updated = await ctx.db
      .from("matter_strategy")
      .update({ body: text })
      .eq("matter_id", id)
      .select("matter_id");
    if (updated.error) return fromDbError(updated.error);
    if (!updated.data.length) {
      const { error } = await ctx.db
        .from("matter_strategy")
        .insert({ matter_id: id, workspace_id: ctx.workspaceId, body: text });
      if (error) return fromDbError(error);
    }
    return ok({ text });
  }
  const { data, error } = await ctx.db
    .from("matter_strategy")
    .select("body")
    .eq("matter_id", id)
    .maybeSingle();
  if (error) return fromDbError(error);
  return ok({ text: data?.body ?? "" });
}
