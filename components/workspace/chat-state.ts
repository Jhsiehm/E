import { ApiError } from "@/lib/api/client";
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

/**
 * What to tell the person when a chat message fails. Our own 4xx and 503
 * messages are written for them; a platform 5xx (for example a function
 * timeout) carries the host's wording, so it gets ours instead.
 */
export function chatErrorText(error: unknown) {
  if (!(error instanceof ApiError))
    return "Message could not be sent. Please retry.";
  if (error.status === 504)
    return "This question took too long to research. Try a narrower question, for example one statute or one legal issue.";
  if (
    (error.status < 500 || error.status === 503) &&
    error.code !== "unexpected_response" &&
    error.code !== "network_error"
  )
    return error.message;
  return "Casevex could not finish this answer. Please try again.";
}
