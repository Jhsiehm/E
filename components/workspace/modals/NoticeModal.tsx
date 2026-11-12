"use client";
import Link from "next/link";
import { date } from "@/components/workspace/format";
import { Chip, Foot } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";

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
        {n.matterIds.map((id) => (
          <Link className="impact-card" href={"/matters/" + id} key={id}>
            <b>{nameOf(id)}</b>
            {n.id === "n1" && (
              <>
                <Chip tone={id === "anderson" ? "olive" : "rose"}>
                  {id === "anderson" ? "Strengthens" : "Weakens"} · Sample
                </Chip>
                <p>
                  {id === "anderson"
                    ? "A broader confidential-information standard may support the sample claim."
                    : "A broader standard may create additional exposure under the sample facts."}
                </p>
              </>
            )}
            <span>Open matter →</span>
          </Link>
        ))}
        <Foot />
      </>
    )
  );
}
