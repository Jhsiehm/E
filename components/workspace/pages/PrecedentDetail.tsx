"use client";
import Link from "next/link";
import { date } from "@/components/workspace/format";
import { Chip, Card, Foot } from "@/components/workspace/ui";
import type { Precedent } from "@/lib/mock/data";
import { COURT_RECORDS } from "@/lib/demo/court-records";
import {
  OpenRecord,
  Provenance,
  pageLabel,
} from "@/components/workspace/matter/PublicRecord";

/** Matters a real authority is attached to in the demo. */
const USED_IN: Record<string, [string, string]> = {
  gonzalez: [
    "/matters/gonzalez",
    "Gonzalez v. United States · Primary authority",
  ],
  malmberg: [
    "/matters/gonzalez",
    "Gonzalez v. United States · Supporting precedent",
  ],
};

/** One authority: a quoted holding from a bundled opinion, or a sample note. */
export default function PrecedentDetail({
  precedent,
}: {
  precedent: Precedent;
}) {
  const record = precedent.record ? COURT_RECORDS[precedent.record] : null;
  const holding = record?.holding;
  const used = USED_IN[precedent.id];
  return (
    <Card className="page-body precedent-detail">
      <Link href="/precedents">← All precedents</Link>
      <p>
        {precedent.court} ·{" "}
        {precedent.decidedAt ? date(precedent.decidedAt) : "Date pending"}
      </p>
      <Chip tone="rose">
        {record
          ? "Public court record · Opinion bundled"
          : precedent.isSample
            ? "Fictional sample authority"
            : "Verification is simulated"}
      </Chip>
      {record && holding ? (
        <>
          <h2>Holding, quoted from the opinion</h2>
          <blockquote className="record-quote">{holding.quote}</blockquote>
          <p className="compare-meta">
            {pageLabel(holding)} · Quotation checked by hand against the bundled
            file. Subsequent treatment has not been checked.
          </p>
          <div className="actions">
            <OpenRecord record={record} page={holding.page} />
          </div>
          <Provenance record={record} />
        </>
      ) : (
        <>
          <h2>Research note</h2>
          <p>{precedent.holding}</p>
        </>
      )}
      <div className="actions">
        {precedent.topics.map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
      </div>
      <h3>Used in</h3>
      {used ? (
        <Link href={used[0]}>{used[1]}</Link>
      ) : record ? (
        <p className="compare-meta">Not attached to a matter in the demo.</p>
      ) : (
        <Link href="/matters/anderson">
          Anderson v. Meridian Tech · Sample association
        </Link>
      )}
      <Foot />
    </Card>
  );
}
