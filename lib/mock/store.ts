import { seed, type State } from "./data";
const globalStore = globalThis as unknown as {
  casevex?: Map<string, { state: State; lastUsed: number }>;
};
export const sessions: Map<string, { state: State; lastUsed: number }> =
  (globalStore.casevex ??= new Map());
export function getState(id: string) {
  const now = Date.now();
  for (const [key, value] of sessions)
    if (now - value.lastUsed > 86400000) sessions.delete(key);
  if (!sessions.has(id)) sessions.set(id, { state: seed(), lastUsed: now });
  const session = sessions.get(id)!;
  session.lastUsed = now;
  return session.state;
}
