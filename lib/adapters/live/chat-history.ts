import type { Message, Source } from "@/lib/mock/types";
import type { Turn } from "@/lib/legal/case-plan";
import type { LiveContext } from "./context";

/** Older turns than this are not sent to the model (cost and focus). */
const CONTEXT_TURNS = 8;

interface Row {
  id: string;
  matter_id: string;
  role: "user" | "agent";
  body: string;
  sources: Source[];
  mode: "model" | "extractive" | null;
  created_at: string;
}

const COLUMNS = "id, matter_id, role, body, sources, mode, created_at";

/** True when the chat table is not in the database yet (SQL not run). */
export const missingTable = (e: { code?: string } | null) =>
  e?.code === "42P01" || e?.code === "PGRST205";

const toMessage = (r: Row): Message => ({
  id: r.id,
  role: r.role,
  text: r.body,
  ...(r.sources?.length ? { sources: r.sources } : {}),
  ...(r.mode ? { mode: r.mode } : {}),
});

/** The person's own conversation on a matter, oldest first. */
export async function loadConversation(
  ctx: LiveContext,
  matterId: string,
  limit = 100,
): Promise<Message[]> {
  const { data, error } = await ctx.db
    .from("matter_chat_messages")
    .select(COLUMNS)
    .eq("matter_id", matterId)
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (!missingTable(error))
      console.error("chat history failed", { code: error.code });
    return [];
  }
  return (data as Row[]).reverse().map(toMessage);
}

/** Every matter's recent conversation for the screens, by matter id. */
export async function loadAllConversations(
  ctx: LiveContext,
): Promise<Record<string, Message[]>> {
  const { data, error } = await ctx.db
    .from("matter_chat_messages")
    .select(COLUMNS)
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) {
    if (!missingTable(error))
      console.error("chat history failed", { code: error.code });
    return {};
  }
  const out: Record<string, Message[]> = {};
  for (const r of (data as Row[]).reverse())
    (out[r.matter_id] ??= []).push(toMessage(r));
  return out;
}

/** The last turns, as the model sees them. */
export function recentTurns(messages: Message[]): Turn[] {
  return messages
    .slice(-CONTEXT_TURNS)
    .map((m) => ({ role: m.role, text: m.text }));
}

/**
 * Stores a question and its answer together, so a failed answer leaves
 * nothing half-saved. Returns the stored answer (with its saved id).
 */
export async function saveExchange(
  ctx: LiveContext,
  matterId: string,
  question: string,
  answer: Message,
): Promise<Message> {
  const base = {
    workspace_id: ctx.workspaceId,
    matter_id: matterId,
    user_id: ctx.userId,
  };
  const now = Date.now();
  const { data, error } = await ctx.db
    .from("matter_chat_messages")
    .insert([
      {
        ...base,
        role: "user",
        body: question,
        created_at: new Date(now).toISOString(),
      },
      {
        ...base,
        role: "agent",
        body: answer.text.slice(0, 20000) || "(No answer.)",
        sources: (answer.sources ?? []).slice(0, 40),
        mode: answer.mode ?? null,
        created_at: new Date(now + 1).toISOString(),
      },
    ])
    .select(COLUMNS);
  if (error) {
    // The answer is still shown; it just will not be remembered.
    console.error("chat save failed", { code: error.code });
    return answer;
  }
  const saved = (data as Row[]).find((r) => r.role === "agent");
  return saved ? toMessage(saved) : answer;
}

/** DELETE /api/matters/:id/chat : start over (only the person's own chat). */
export async function clearConversation(ctx: LiveContext, matterId: string) {
  const { error } = await ctx.db
    .from("matter_chat_messages")
    .delete()
    .eq("matter_id", matterId)
    .eq("user_id", ctx.userId);
  return error && !missingTable(error) ? error : null;
}
