import type { AgentStatus, PracticeAreaKey } from "@/lib/agents";

export type Matter = {
  id: string;
  name: string;
  docket: string;
  court: string;
  type: string;
  status: string;
  role: string;
  summary: string;
  assignedAgentId: string;
  documentCount: number;
  updatedAt: string;
  /** Made-up practice case from the demo tutorial, not a real client. */
  sample?: boolean;
};
export type Doc = {
  id: string;
  matterId: string;
  name: string;
  ext: string;
  sizeBytes: number;
  type: string;
  ownerInitials: string;
  modifiedAt: string;
  status: string;
  /** Live mode: how far the worker has read the file (pending ... ready). */
  processing?: string;
  processingError?: string | null;
};
export type Deadline = {
  id: string;
  matterId: string;
  title: string;
  dueAt: string;
  kind: string;
};
export type Notice = {
  id: string;
  kind: string;
  title: string;
  source: string;
  detail: string;
  /** A short, actionable overview for the inbox. */
  summary?: string;
  caseUpdates?: {
    matterId: string;
    impact: string;
    nextStep: string;
    target: "strategy" | "documents" | "deadlines";
  }[];
  read: boolean;
  matterIds: string[];
  createdAt: string;
};
export type Source = {
  index: number;
  title: string;
  meta: string;
  href: string;
  /**
   * Demo: simulated. Live: true only when the quote matched and the
   * independent check found support; see `checks` for each part.
   */
  verified: boolean;
  /** Live answers: each check reported separately (lib/legal/checked-answer.ts). */
  checks?: {
    quote: "exact" | "close" | "mismatch" | "not_quoted";
    support: "supports" | "partial" | "does_not_support" | "not_checked";
    treatment: "not_checked";
  };
};
export type Message = {
  id: string;
  role: "user" | "agent";
  text: string;
  sources?: Source[];
  /**
   * How an agent answer was made. Absent = a simulated demo answer;
   * "model" = written by AI and checked against its sources;
   * "extractive" = quoted passages only, no AI analysis.
   */
  mode?: "model" | "extractive";
  /** Live answers: whether any checked conclusion was given. */
  outcome?: "answered" | "insufficient";
};
export type Agent = {
  id: string;
  name: string;
  practiceArea: string;
  description: string;
  matterCount: number;
  /** available | beta | coming_later, from lib/agents. */
  availability: AgentStatus;
  practiceAreaKey: PracticeAreaKey;
};
export type Precedent = {
  id: string;
  caseName: string;
  citation: string;
  court: string;
  decidedAt: string;
  topics: string[];
  holding: string;
  verified: boolean;
  isSample?: boolean;
};
export type State = {
  me: {
    name: string;
    role: string;
    email: string;
    theme: string;
    defaultPracticeArea: string;
    timeZone: string;
  };
  matters: Matter[];
  documents: Doc[];
  deadlines: Deadline[];
  notices: Notice[];
  agents: Agent[];
  precedents: Precedent[];
  chats: Record<string, Message[]>;
  strategies: Record<string, string>;
  /**
   * Demo only: whether the practice sample cases are loaded. Absent in live
   * mode, where sample cases are never offered.
   */
  samples?: "on" | "off";
  /** True when the screens are backed by real data (and real research). */
  live?: boolean;
};
