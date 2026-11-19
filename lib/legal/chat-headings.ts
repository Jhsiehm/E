/**
 * Section labels of a live research answer. lib/legal/chat-message.ts writes
 * them and components/workspace/Answer.tsx renders them as headings; kept
 * apart so the client bundle does not import research code.
 */
export const CHAT_HEADINGS = {
  more: "More checked points",
  against: "Points against",
  review: "Not confirmed: review before relying",
  excerpts: "Quoted passages (not conclusions)",
  cautions: "Before you rely on this",
  next: "Recommended next step",
} as const;
