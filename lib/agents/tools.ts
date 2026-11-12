import type { AiFunctionKey } from "@/lib/ai/functions";
import type { ToolKey } from "./types";

/**
 * Tools an agent may call inside Casevex.
 *
 * Spec 04 limits agents to legal-provider read/search and scoped internal
 * retrieval: no open web, no scripting, no sending, no filing, no
 * autonomous actions. Every tool below stays inside that. "read" tools only
 * read what the user may already see. "draft" tools only create a draft
 * that a person must keep; nothing leaves Casevex.
 *
 * Joshua approved chronology and client-letter drafting on 2026-11-12.
 * Deadline suggestions are deferred until after the pilot (spec 01/04 rule
 * out automatic deadlines, and a wrong deadline is a malpractice risk), so
 * there is deliberately no deadline tool here.
 */
export type ToolKind = "read" | "draft";

export interface ToolSpec {
  key: ToolKey;
  label: string;
  /** Plain-language description shown to lawyers. */
  description: string;
  kind: ToolKind;
  /** True when the result is discarded unless a person keeps it. */
  requiresConfirmation: boolean;
  /** Matter-scoped tools need an authorized matter; never cross matters. */
  matterScoped: boolean;
  /** AI function keys from the routing registry this tool calls. */
  aiFunctions: readonly AiFunctionKey[];
}

export const TOOLS: Record<ToolKey, ToolSpec> = {
  search_law: {
    key: "search_law",
    label: "Search the law",
    description:
      "Searches the licensed sources for this agent's courts and returns ranked passages with pinpoints.",
    kind: "read",
    requiresConfirmation: false,
    matterScoped: false,
    aiFunctions: ["research.plan", "research.rerank"],
  },
  read_matter_documents: {
    key: "read_matter_documents",
    label: "Read matter documents",
    description:
      "Answers questions about files in this matter only, citing page and paragraph.",
    kind: "read",
    requiresConfirmation: false,
    matterScoped: true,
    aiFunctions: ["research.document_qa"],
  },
  cite_check: {
    key: "cite_check",
    label: "Cite check",
    description:
      "Checks every citation in a brief or draft and lists which are verified, wrong or not found.",
    kind: "read",
    requiresConfirmation: false,
    matterScoped: false,
    aiFunctions: [],
  },
  compare_authorities: {
    key: "compare_authorities",
    label: "Compare cases",
    description:
      "Puts two or more verified opinions side by side: facts, procedure and holding.",
    kind: "draft",
    requiresConfirmation: true,
    matterScoped: false,
    aiFunctions: ["research.compare_authorities"],
  },
  draft_memo: {
    key: "draft_memo",
    label: "Draft a research memo",
    description:
      "Writes a research memo with sources for your review. It stays a draft until you keep it.",
    kind: "draft",
    requiresConfirmation: true,
    matterScoped: false,
    aiFunctions: ["research.draft", "research.verify_support"],
  },
  draft_motion_outline: {
    key: "draft_motion_outline",
    label: "Outline a motion",
    description:
      "Builds an editable motion outline with placeholders for facts that still need citing. Never filed.",
    kind: "draft",
    requiresConfirmation: true,
    matterScoped: true,
    aiFunctions: ["motion.draft", "research.verify_support"],
  },
  draft_client_letter: {
    key: "draft_client_letter",
    label: "Draft a client letter",
    description:
      "Turns saved research into a plain-English letter draft. Casevex never sends it.",
    kind: "draft",
    requiresConfirmation: true,
    matterScoped: true,
    aiFunctions: ["letter.draft"],
  },
  build_chronology: {
    key: "build_chronology",
    label: "Build a chronology",
    description:
      "Pulls dated facts from this matter's documents into a timeline, each linked to its page.",
    kind: "draft",
    requiresConfirmation: true,
    matterScoped: true,
    aiFunctions: ["document.chronology"],
  },
  suggest_watch: {
    key: "suggest_watch",
    label: "Suggest a watch",
    description:
      "Proposes following a case, issue or statute. Nothing is followed until you accept.",
    kind: "draft",
    requiresConfirmation: true,
    matterScoped: false,
    aiFunctions: ["matter.suggest_issue_tags"],
  },
  save_to_matter: {
    key: "save_to_matter",
    label: "Save to matter",
    description: "Files research into the matter's Research tab.",
    kind: "draft",
    requiresConfirmation: true,
    matterScoped: true,
    aiFunctions: [],
  },
};

/** Actions agents must never have, whatever a firm configures. */
export const FORBIDDEN_CAPABILITIES = [
  "send_email",
  "send_message",
  "file_with_court",
  "browse_web",
  "run_code",
  "delete_user_content",
  "create_deadline",
  "cross_matter_read",
] as const;
