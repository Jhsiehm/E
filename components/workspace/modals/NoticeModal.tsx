"use client";
import Link from "next/link";
import { date } from "@/components/workspace/format";
import { Foot } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";

const UPDATE_LINKS = {
  strategy: "Review case strategy",
  documents: "Review case documents",
  deadlines: "Review case deadlines",
};

/** Notice details drawer. */
export default function NoticeModal() {
  const { data, selected, nameOf } = useWorkspace();
  const n = data.notices.find((x) => x.id === selected);
  return (
    n && (
      <>
        <p className="eyebrow">
          {n.kind} · {date(n.createdAt)}
        </p>
        <h2>{n.title}</h2>
        <p className="muted">{n.source}</p>
        <p>{n.detail}</p>
        <h3>Affected matters</h3>
        {n.matterIds.map((id) => {
          const update = n.caseUpdates?.find((item) => item.matterId === id);
          return (
            <section className="impact-card" aria-label={nameOf(id)} key={id}>
              <h4>{nameOf(id)}</h4>
              {update && (
                <>
                  <p>{update.impact}</p>
                  <p className="eyebrow">Suggested update</p>
                  <p>{update.nextStep}</p>
                </>
              )}
              <Link href={`/matters/${id}${update ? `/${update.target}` : ""}`}>
                {update ? UPDATE_LINKS[update.target] : "Open matter"} →
              </Link>
            </section>
          );
        })}
        {!!n.caseUpdates?.length && (
          <p className="muted">
            Review these suggestions before editing. No case changes have been
            made.
          </p>
        )}
        <Foot />
      </>
    )
  );
}
