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
  read: boolean;
  matterIds: string[];
  createdAt: string;
};
export type Source = {
  index: number;
  title: string;
  meta: string;
  href: string;
  verified: boolean;
};
export type Message = {
  id: string;
  role: "user" | "agent";
  text: string;
  sources?: Source[];
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
};
