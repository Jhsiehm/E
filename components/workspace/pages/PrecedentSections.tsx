"use client";
import Link from "next/link";
import { COURT_RECORDS, type CourtRecordId } from "@/lib/demo/court-records";
import {
  OPINION_DETAILS,
  PASSAGE_HEADINGS,
  type Passage,
  type PassageKind,
} from "@/lib/demo/opinion-passages";
import {
  CONNECTED,
  REPORTER_HEADINGS,
  type ConnectedId,
  type ReporterPassage,
} from "@/lib/demo/connected-authorities";
import {
  OpenRecord,
  pageLabel,
} from "@/components/workspace/matter/PublicRecord";

const ORDER: PassageKind[] = [
  "facts",
  "question",
  "standard",
  "holding",
  "reasoning",
  "disposition",
  "separate",
];

/** How each bundled authority connects to the Gonzalez demo matter. */
const RECORD_CONNECTION: Partial<
  Record<CourtRecordId, { text: string; page: number; quote: string }>
> = {
  malmberg: {
    text: "Gonzalez adopts the Malmberg framing for FTCA damages under New York law, then distinguishes Malmberg on the adequacy of the district court’s explanation. The partial dissent relies on it.",
    page: 32,
    quote: "Therefore, Gonzalez’s reliance on Malmberg is misplaced.",
  },
};

function Quote({
  speaker,
  where,
  quote,
  children,
}: {
  speaker: string;
  where: string;
  quote: string;
  children?: React.ReactNode;
}) {
  return (
    <figure className="workflow-citation">
      <figcaption>
        <b>{speaker}</b> · {where}
      </figcaption>
      <blockquote>{quote}</blockquote>
      {children}
    </figure>
  );
}

/** Where Gonzalez itself cites an authority, opened at that page. */
function InGonzalez({
  text,
  page,
  quote,
}: {
  text: string;
  page: number;
  quote: string;
}) {
  return (
    <section className="precedent-section">
      <h3>How Gonzalez v. United States uses it</h3>
      <p>{text}</p>
      <Quote
        speaker="Gonzalez v. United States, majority"
        where={`PDF page ${page}`}
        quote={quote}
      >
        <OpenRecord record={COURT_RECORDS.gonzalez} page={page} />
      </Quote>
      <p>
        <Link href="/matters/gonzalez">Open the Gonzalez matter →</Link>
      </p>
    </section>
  );
}

/** Facts, question, holding, reasoning, disposition and separate opinions. */
export function RecordSections({ id }: { id: CourtRecordId }) {
  const record = COURT_RECORDS[id];
  const detail = OPINION_DETAILS[id];
  const link = RECORD_CONNECTION[id];
  return (
    <>
      <p className="compare-meta">
        <b>Opinion:</b> {detail.author} · <b>Panel:</b> {detail.panel}
      </p>
      {ORDER.map((kind) => {
        const items = detail.passages.filter((p) => p.kind === kind);
        if (!items.length) return null;
        return (
          <section className="precedent-section" key={kind}>
            <h3>{PASSAGE_HEADINGS[kind]}</h3>
            {items.map((p: Passage) => (
              <Quote
                key={p.quote}
                speaker={p.speaker}
                where={pageLabel(p)}
                quote={p.quote}
              >
                <OpenRecord record={record} page={p.page} />
              </Quote>
            ))}
          </section>
        );
      })}
      {link && <InGonzalez {...link} />}
    </>
  );
}

/** "518 U.S. 415 (1996)" and page "425" → "518 U.S. at 425". */
const pin = (citation: string, page: string) =>
  `${citation.replace(/\s+\d+\s*\(.*$/, "")} at ${page}`;

/** An authority Gonzalez relies on, quoted from the CourtListener text. */
export function ConnectedSections({ id }: { id: ConnectedId }) {
  const a = CONNECTED[id];
  const kinds = Object.keys(REPORTER_HEADINGS) as ReporterPassage["kind"][];
  return (
    <>
      <p className="compare-meta">
        <b>Opinion:</b> {a.author} · <b>Text:</b>{" "}
        <a href={a.url} target="_blank" rel="noopener noreferrer">
          CourtListener opinion page ↗
        </a>{" "}
        · Quotations cited by reporter page; no court PDF is bundled.
      </p>
      {kinds.map((kind) => {
        const items = a.passages.filter((p) => p.kind === kind);
        if (!items.length) return null;
        return (
          <section className="precedent-section" key={kind}>
            <h3>{REPORTER_HEADINGS[kind]}</h3>
            {items.map((p) => (
              <Quote
                key={p.quote}
                speaker={p.speaker}
                where={pin(a.citation, p.reporterPage)}
                quote={p.quote}
              />
            ))}
          </section>
        );
      })}
      <InGonzalez text={a.connection} {...a.gonzalez} />
    </>
  );
}
