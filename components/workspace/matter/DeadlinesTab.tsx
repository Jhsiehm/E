"use client";
import { Card } from "@/components/workspace/ui";
import { DeadlineList } from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";
import { useMatterScope } from "@/components/workspace/matter/useMatterScope";

/** Deadlines for this matter. */
export default function DeadlinesTab() {
  const { open } = useWorkspace();
  const { deadlines } = useMatterScope();
  return (
    <Card
      className="page-body"
      title="Matter deadlines"
      action={<button onClick={() => open("event")}>Add event</button>}
    >
      <DeadlineList items={deadlines} />
    </Card>
  );
}
