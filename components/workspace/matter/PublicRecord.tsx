"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import { Card } from "@/components/workspace/ui";
import type { Doc, Matter } from "@/lib/mock/data";
import {
  courtRecordBySha,
  type CourtRecord,
  type Pinpoint,
} from "@/lib/demo/court-records";
import { LABEL, RESEARCH_QUESTION } from "@/lib/demo/gonzalez-workflow";
import { CONNECTED } from "@/lib/demo/connected-authorities";

/** Marks a matter built from a public court record wherever it is listed. */
export const PublicRecordTag = () => (
  <span
    className="sample-tag public-record-tag"
    title="Built from a public court record for the demo; not a client matter"
  >
    Public court record · Demonstration
  </span>
);

/** Marks a made-up practice case wherever it is listed. */
export const SampleTag = () => (
  <span className="sample-tag" title="Made-up practice case, not a real client">
    Sample
  </span>
);

/** The tag a listed matter carries, if any. */
export const MatterTag = ({ matter }: { matter: Matter }) =>
  matter.publicRecord ? (
    <PublicRecordTag />
  ) : matter.sample ? (
    <SampleTag />
  ) : null;

/** Opens the bundled public original at a page, in a new tab. */
export function OpenRecord({
  record,
  page,
  children,
}: {
  record: CourtRecord;
  page?: number;
  children?: React.ReactNode;
}) {
  return (
    <a
      className="button record-link"
      href={record.publicPath + (page ? `#page=${page}` : "")}
      target="_blank"
      rel="noopener"
    >
      <Icon name="documents" size={16} />
      {children ?? (page ? `Open original, page ${page}` : "Open original")}
    </a>
  );
}

/** Where a quotation sits in the original. */
export const pageLabel = (p: Pinpoint) =>
  `PDF page ${p.page}${p.printedPage ? ` (printed page ${p.printedPage})` : ""}`;

/** Court, date, file and source for one bundled record. */
export function Provenance({ record }: { record: CourtRecord }) {
  return (
    <dl className="provenance">
      <dt>Court</dt>
      <dd>{record.court}</dd>
      <dt>Decided</dt>
      <dd>
        {record.decided} · {record.docket}
      </dd>
      <dt>Citation</dt>
      <dd>{record.citation}</dd>
      <dt>Original file</dt>
      <dd>
        {record.fileName} · {record.pages} pages
      </dd>
      <dt>Source</dt>
      <dd>
        <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer">
          {record.sourceName}
        </a>
      </dd>
      <dt>SHA-256</dt>
      <dd>
        <code>{record.sha256}</code>
      </dd>
      {record.note && (
        <>
          <dt>Note</dt>
          <dd>{record.note}</dd>
        </>
      )}
    </dl>
  );
}

/** Overview card: the bundled originals on this matter. */
export function SourceDocuments({ documents }: { documents: Doc[] }) {
  const records = documents
    .map((d) => courtRecordBySha(d.sha256))
    .filter((r): r is CourtRecord => r !== null);
  return (
    <Card title="Source documents">
      <p className="compare-meta">
        Public court records, bundled unchanged from the source. Not uploaded
        client files.
      </p>
      <div className="scroll">
        {records.map((r) => (
          <div className="list-row record-row" key={r.id}>
            <span className="file-badge pdf">PDF</span>
            <span className="grow">
              <i>{r.caseName}</i>
              <small>
                {r.citation} · {r.pages} pages
              </small>
            </span>
            <OpenRecord record={r}>Open</OpenRecord>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Overview card: entry to the prepared research workflow. */
export function WorkflowAction({ href }: { href: string }) {
  return (
    <Card title="Legal research workflow" className="compare-action-card">
      <p className="compare-label">{LABEL}</p>
      <p className="workflow-question">“{RESEARCH_QUESTION}”</p>
      <p className="compare-meta">
        Six steps from the opinion to a memo for attorney review, with every
        finding linked to its page in the original.
      </p>
      <Link className="button primary" href={href}>
        Open the research workflow
      </Link>
    </Card>
  );
}

/** Overview card: the real authorities this opinion relies on. */
export function ConnectedAuthorities() {
  const items: [string, string, string, string][] = [
    [
      "malmberg",
      "Malmberg v. United States",
      "816 F.3d 185 (2d Cir. 2016)",
      "Distinguished on the adequacy of the explanation",
    ],
    ...Object.values(CONNECTED).map((a): [string, string, string, string] => [
      a.id,
      a.caseName,
      a.citation,
      a.id === "gasperini"
        ? "Source of the “deviates materially” standard"
        : a.id === "henry"
          ? "Rule 52(a) explanation; held inapposite"
          : "Inflation in comparable awards",
    ]),
  ];
  return (
    <Card title="Connected authorities">
      <p className="compare-meta">
        Real cases this opinion relies on, each with exact passages and pinpoint
        pages.
      </p>
      <div className="scroll">
        {items.map(([id, name, cite, why]) => (
          <Link
            className="list-row record-row"
            key={id}
            href={`/precedents/${id}`}
          >
            <Icon name="court" size={18} />
            <span className="grow">
              <i>{name}</i>
              <small>
                {cite} · {why}
              </small>
            </span>
            <Icon name="chevron" size={16} />
          </Link>
        ))}
      </div>
    </Card>
  );
}
