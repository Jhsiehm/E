"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import { date, label } from "@/components/workspace/format";
import { Chip } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";

/** Calendar event details. */
export default function EventDetailModal() {
  const { data, selected, nameOf } = useWorkspace();
  const d = data.deadlines.find((x) => x.id === selected);
  return (
    d && (
      <>
        <Chip>{label(d.kind)}</Chip>
        <h2>{d.title}</h2>
        <p>{date(d.dueAt)}</p>
        <Link className="button primary" href={"/matters/" + d.matterId}>
          {nameOf(d.matterId)} <Icon name="arrow" />
        </Link>
        <p className="disclaimer">
          Sample date. Verify against the applicable order and docket.
        </p>
      </>
    )
  );
}
