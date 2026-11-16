import type { Message, State } from "@/lib/mock/data";

/** Adds one message to a matter's conversation. */
export function appendChat(d: State | null, matterId: string, msg: Message) {
  return d
    ? {
        ...d,
        chats: { ...d.chats, [matterId]: [...(d.chats[matterId] || []), msg] },
      }
    : d;
}

/** The conversations that have at least one message. */
export function nonEmpty(chats: State["chats"]) {
  return Object.fromEntries(
    Object.entries(chats).filter(([, list]) => list.length),
  );
}
