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

const DEMO_ME: State["me"] = {
  name: "Jordan Wells",
  role: "Partner",
  email: "jordan.wells@example.com",
  theme: "light",
  defaultPracticeArea: "Civil litigation",
  timeZone: "America/New_York",
};

/** A brand-new demo workspace: no cases until the person adds some. */
export function emptyState(me: State["me"] = { ...DEMO_ME }): State {
  return {
    me,
    matters: [],
    deadlines: [],
    documents: [],
    notices: [],
    agents: seedAgents(),
    precedents: [],
    chats: {},
    strategies: {},
    samples: "off",
  };
}

/**
 * The practice workspace: five made-up cases with documents, deadlines,
 * notices and precedents, each case marked as a sample.
 */
export function seed(me: State["me"] = { ...DEMO_ME }): State {
  return {
    me,
    matters: seedMatters().map((m) => ({ ...m, sample: true })),
    deadlines: seedDeadlines(),
    documents: seedDocuments(),
    notices: seedNotices(),
    agents: seedAgents(),
    precedents: seedPrecedents(),
    chats: seedChats(),
    strategies: {},
    samples: "on",
  };
}

/** Removes the sample cases and everything attached to them; keeps the person's own work. */
export function withoutSamples(s: State): State {
  const sample = seed();
  const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
  const matters = ids(sample.matters);
  const keep = <T extends { id: string }>(xs: T[], seeded: T[]) =>
    xs.filter((x) => !ids(seeded).has(x.id));
  return {
    ...s,
    matters: s.matters.filter((m) => !m.sample),
    documents: keep(s.documents, sample.documents).filter(
      (d) => !matters.has(d.matterId),
    ),
    deadlines: keep(s.deadlines, sample.deadlines).filter(
      (d) => !matters.has(d.matterId),
    ),
    notices: keep(s.notices, sample.notices),
    precedents: keep(s.precedents, sample.precedents),
    chats: Object.fromEntries(
      Object.entries(s.chats).filter(([k]) => !matters.has(k)),
    ),
    strategies: Object.fromEntries(
      Object.entries(s.strategies).filter(([k]) => !matters.has(k)),
    ),
    samples: "off",
  };
}
