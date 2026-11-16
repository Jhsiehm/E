/**
 * Turns a research result into the matter chat's Message: plain paragraphs
 * with [n] markers the chat already renders, plus the cited sources.
 *
 * Every point says how the independent source check came out, in words a
 * lawyer reads at a glance. Points the check says the sources contradict are
 * left out of the answer and counted under "Before you rely on this".
 */
import type { Message, Source } from "@/lib/mock/types";
import type { Claim, ResearchResult, SourceCard } from "./research-types";

const NOTE: Partial<Record<Claim["verificationStatus"], string>> = {
  partially_supported: "(The source supports this only in part.)",
  unverified: "(Not yet confirmed against the source.)",
  no_source: "(No source given for this point.)",
};

function meta(s: SourceCard) {
  const year = s.decisionDate?.slice(0, 4);
  // A pinpoint already names the reporter ("1 Synth. at 101").
  return [s.pinpoint ?? s.citation, s.court, year].filter(Boolean).join(" · ");
}

export function toChatMessage(r: ResearchResult, id: string): Message {
  const claims = new Map(r.claims.map((c) => [c.id, c]));
  const cards = new Map(r.sources.map((s) => [s.sourceId, s]));
  const numbers = new Map<string, number>();
  const sources: Source[] = [];
  const cite = (sourceIds: string[]) =>
    sourceIds
      .map((sid) => {
        const card = cards.get(sid);
        if (!card) return "";
        if (!numbers.has(sid)) {
          numbers.set(sid, sources.length + 1);
          sources.push({
            index: sources.length + 1,
            title: card.title,
            meta: meta(card),
            href: card.url,
            verified: true,
          });
        }
        return `[${numbers.get(sid)}]`;
      })
      .join("");

  let dropped = 0;
  const point = (p: { text: string; claimIds: string[] }) => {
    const cs = p.claimIds.map((c) => claims.get(c)).filter((c) => !!c);
    if (cs.some((c) => c.verificationStatus === "contradicted")) {
      dropped++;
      return null;
    }
    const marks = cite(cs.flatMap((c) => c.sourceIds));
    const note = cs.map((c) => NOTE[c.verificationStatus]).find(Boolean);
    const mismatch = cs.some((c) =>
      c.quotes.some((q) => q.check.status === "mismatch"),
    );
    return [
      p.text.trim(),
      marks,
      mismatch ? "(A quotation here did not match the source text.)" : note,
    ]
      .filter(Boolean)
      .join(" ");
  };

  const parts: string[] = [r.answer.summary.trim()];
  const analysis = r.answer.analysis.map(point).filter((p) => p !== null);
  parts.push(...analysis);
  const contrary = r.answer.contraryAuthorities
    .map(point)
    .filter((p) => p !== null);
  if (contrary.length) parts.push("Points against", ...contrary);

  const cautions = [...r.answer.limitations];
  if (dropped)
    cautions.unshift(
      `${dropped} point${dropped === 1 ? " was" : "s were"} left out because the source check found the cited source does not support ${dropped === 1 ? "it" : "them"}.`,
    );
  if (cautions.length)
    parts.push("Before you rely on this", ...cautions.map((c) => `• ${c}`));
  if (r.answer.nextSteps.length)
    parts.push(
      "Recommended next step",
      ...r.answer.nextSteps.map((s) => `• ${s}`),
    );

  return {
    id,
    role: "agent",
    text: parts.filter(Boolean).join("\n\n"),
    sources,
    mode: r.mode,
  };
}
