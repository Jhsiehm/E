import { emptyState, seed, withoutSamples, type State } from "@/lib/mock/data";

/**
 * Demo workspace actions. Returns true when it handled the request.
 * - POST /reset: start over with an empty workspace (keeps name and settings)
 * - POST /samples: add the made-up practice cases (the tutorial)
 * - DELETE /samples: remove them, keeping the person's own work
 */
export function workspaceAction(s: State, root: string, method: string) {
  if (root === "reset" && method === "POST") {
    Object.assign(s, emptyState(s.me));
    return true;
  }
  if (root !== "samples") return false;
  if (method === "POST") {
    const own = withoutSamples(s);
    const sample = seed(s.me);
    Object.assign(s, {
      ...sample,
      matters: [...sample.matters, ...own.matters],
      documents: [...sample.documents, ...own.documents],
      deadlines: [...sample.deadlines, ...own.deadlines],
      notices: [...sample.notices, ...own.notices],
      precedents: [...sample.precedents, ...own.precedents],
      chats: { ...sample.chats, ...own.chats },
      strategies: { ...own.strategies },
    });
    return true;
  }
  if (method === "DELETE") {
    Object.assign(s, withoutSamples(s));
    return true;
  }
  return false;
}
