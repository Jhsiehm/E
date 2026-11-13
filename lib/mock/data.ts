import type { State } from "./types";
import { seedDeadlines, seedDocuments, seedMatters } from "./seed-workspace";
import {
  seedAgents,
  seedChats,
  seedNotices,
  seedPrecedents,
} from "./seed-feed";

export type * from "./types";

export { TODAY, disclaimer, sampleAnswer, sources } from "./samples";

export function seed(): State {
  return {
    me: {
      name: "Jordan Wells",
      role: "Partner",
      email: "jordan.wells@example.com",
      theme: "light",
      defaultPracticeArea: "Civil litigation",
      timeZone: "America/New_York",
    },
    matters: seedMatters(),
    deadlines: seedDeadlines(),
    documents: seedDocuments(),
    notices: seedNotices(),
    agents: seedAgents(),
    precedents: seedPrecedents(),
    chats: seedChats(),
    strategies: {},
  };
}
