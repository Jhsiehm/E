"use client";
import Link from "next/link";
import { Card, Foot } from "@/components/workspace/ui";
import { useMatterScope } from "@/components/workspace/matter/useMatterScope";

/** Research entry point (also the fallback for unknown tabs). */
export default function ResearchTab() {
  const { matter } = useMatterScope();
  return (
    <Card className="page-body" title="Matter research">
      <p>
        Review the authority library or start a research conversation for this
        matter.
      </p>
      <div className="actions">
        <Link className="button primary" href="/precedents">
          Browse precedents
        </Link>
        <Link className="button" href={`/matters/${matter.id}/chat`}>
          Open agent chat
        </Link>
      </div>
      <Foot />
    </Card>
  );
}
