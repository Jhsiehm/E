"use client";
import Link from "next/link";
import { date } from "@/components/workspace/format";
import { Chip, Card, Foot } from "@/components/workspace/ui";
import type { Precedent } from "@/lib/mock/data";
import { COURT_RECORDS } from "@/lib/demo/court-records";
import {
  OpenRecord,
  Provenance,
} from "@/components/workspace/matter/PublicRecord";
import { ConnectedSections, RecordSections } from "./PrecedentSections";

/**
 * One authority. Real cases show exact passages (facts, question, holding,
 * reasoning, disposition, separate opinions), each with its page; the
 * fictional sample keeps its labelled research note.
 */
export default function PrecedentDetail({
  precedent,
}: {
  precedent: Precedent;
}) {
  const record = precedent.record ? COURT_RECORDS[precedent.record] : null;
  const real = record || precedent.authority;
  return (
    <Card className="page-body precedent-detail">
      <Link href="/precedents">← All precedents</Link>
      <p>
        {precedent.court} ·{" "}
        {precedent.decidedAt ? date(precedent.decidedAt) : "Date pending"}
      </p>
      <Chip tone="rose">
        {record
          ? "Public court record · Original opinion bundled"
          : precedent.authority
            ? "Public court record · Reporter text from CourtListener"
            : precedent.isSample
              ? "Fictional sample authority"
              : "Verification is simulated"}
      </Chip>
      {real && (
        <p className="workflow-notice">
          Every passage below is quoted exactly from the opinion and was checked
          against the page cited. Casevex did not generate these passages.
          Subsequent treatment and current good-law status have not been
          checked.
        </p>
      )}
      {record ? (
        <>
          <div className="actions">
            <OpenRecord record={record}>Open the full opinion (PDF)</OpenRecord>
          </div>
          <RecordSections id={record.id} />
          <section className="precedent-section">
            <h3>Source</h3>
            <Provenance record={record} />
          </section>
        </>
      ) : precedent.authority ? (
        <ConnectedSections id={precedent.authority} />
      ) : (
        <>
          <h2>Research note</h2>
          <p>{precedent.holding}</p>
          <h3>Used in</h3>
          <Link href="/matters/anderson">
            Anderson v. Meridian Tech · Sample association
          </Link>
        </>
      )}
      <div className="actions">
        {precedent.topics.map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
      </div>
      <Foot />
    </Card>
  );
}
