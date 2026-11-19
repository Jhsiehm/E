/**
 * Turns a research result into the matter chat's Message: plain paragraphs
 * with [n] markers the chat already renders, plus the cited sources.
 *
 * Everything substantive comes from the checked answer (checked-answer.ts),
 * recomputed here from the claims, so a result's stored summary, model-written
 * limitations or model-written next steps can never reach the screen. Each
 * source card says separately whether it was resolved, whether the quote
 * matched, whether it supports the point, and that later treatment was not
 * checked.
 */
import type { Message, Source } from "@/lib/mock/types";
import {
  checkAnswer,
  type CheckedAnswer,
  type CheckedSentence,
  type SourceChecks,
} from "./checked-answer";
import { CHAT_HEADINGS } from "./chat-headings";
import type { ResearchResult, SourceCard } from "./research-types";

export { CHAT_HEADINGS };

function meta(s: SourceCard) {
  const year = s.decisionDate?.slice(0, 4);
  // A pinpoint already names the reporter ("1 Synth. at 101").
  return [s.pinpoint ?? s.citation, s.court, year].filter(Boolean).join(" · ");
}

function withheldNote(w: CheckedAnswer["withheld"]): string[] {
  const n = (k: number, one: string, many: string) =>
    k
      ? [
          `${k} drafted point${k === 1 ? " was" : "s were"} left out because ${k === 1 ? one : many}.`,
        ]
      : [];
  return [
    ...n(
      w.contradicted,
      "the source check found the cited source does not support it",
      "the source check found the cited sources do not support them",
    ),
    ...n(
      w.quoteMismatch,
      "a quotation did not match the source text",
      "their quotations did not match the source text",
    ),
    ...n(
      w.noSource,
      "no retrieved source was cited for it",
      "no retrieved source was cited for them",
    ),
    ...n(
      w.unchecked,
      "it could not be checked against its source",
      "they could not be checked against their sources",
    ),
  ];
}

export function toChatMessage(
  r: Omit<ResearchResult, "checked">,
  id: string,
): Message {
  const checked = checkAnswer(r);
  const cards = new Map(r.sources.map((s) => [s.sourceId, s]));
  const checks = new Map<string, SourceChecks>(
    checked.sourceChecks.map((c) => [c.sourceId, c]),
  );
  const numbers = new Map<string, number>();
  const sources: Source[] = [];
  const cite = (sourceIds: string[]) =>
    sourceIds
      .map((sid) => {
        const card = cards.get(sid);
        if (!card) return "";
        if (!numbers.has(sid)) {
          numbers.set(sid, sources.length + 1);
          const c = checks.get(sid);
          sources.push({
            index: sources.length + 1,
            title: card.title,
            meta: meta(card),
            href: card.url,
            // Only true when the quote matched and the check found support.
            verified:
              !!c &&
              c.support === "supports" &&
              (c.quote === "exact" || c.quote === "close"),
            checks: c && {
              quote: c.quote,
              support: c.support,
              treatment: c.treatment,
            },
          });
        }
        return `[${numbers.get(sid)}]`;
      })
      .join("");
  const line = (s: CheckedSentence) =>
    [s.text, cite(s.sourceIds)].filter(Boolean).join(" ");

  const parts: string[] = [];
  if (checked.outcome === "answered") {
    parts.push(checked.summarySentences.map(line).join(" "));
    const more = checked.points.slice(checked.summarySentences.length);
    if (more.length) parts.push(CHAT_HEADINGS.more, ...more.map(line));
  } else {
    parts.push(checked.summary);
  }
  if (checked.contrary.length)
    parts.push(CHAT_HEADINGS.against, ...checked.contrary.map(line));
  if (checked.review.length)
    parts.push(
      CHAT_HEADINGS.review,
      ...checked.review.map((x) =>
        [
          `Drafted: “${x.text}”`,
          cite(x.sourceIds),
          x.quoteMismatch
            ? "Source check: a quotation did not match the source text."
            : x.reason
              ? `Source check: the source supports this only in part (${x.reason}).`
              : "Source check: the source supports this only in part.",
        ]
          .filter(Boolean)
          .join(" "),
      ),
    );
  if (checked.excerpts.length)
    parts.push(
      CHAT_HEADINGS.excerpts,
      ...checked.excerpts.map(
        (e) =>
          `“${e.text}” ${cite([e.sourceId])} (${cards.get(e.sourceId)?.title ?? "source"})`,
      ),
    );

  // Limitations are shown only from a producer that wrote them server-side
  // (withCheckedAnswer); any other producer may have passed model text.
  const limits =
    "checked" in r
      ? r.answer.limitations
      : ["Later treatment of these sources has not been checked."];
  const cautions = [...withheldNote(checked.withheld), ...limits];
  if (cautions.length)
    parts.push(CHAT_HEADINGS.cautions, ...cautions.map((c) => `• ${c}`));
  parts.push(CHAT_HEADINGS.next, ...checked.nextSteps.map((s) => `• ${s}`));

  return {
    id,
    role: "agent",
    text: parts.filter(Boolean).join("\n\n"),
    sources,
    mode: r.mode,
    outcome: checked.outcome,
  };
}
