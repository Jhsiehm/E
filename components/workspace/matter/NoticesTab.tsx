"use client";
import Icon from "@/components/Icon";
import { Chip, Card } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";
import { useMatterScope } from "@/components/workspace/matter/useMatterScope";

/** Notices affecting this matter. */
export default function NoticesTab() {
  const { data, openNotice } = useWorkspace();
  const { matter } = useMatterScope();
  return (
    <Card className="page-body" title="Matter notices">
      <div className="scroll">
        {data.notices
          .filter((n) => n.matterIds.includes(matter.id))
          .map((n) => (
            <button
              className="list-row"
              key={n.id}
              onClick={() => openNotice(n)}
            >
              <Icon name="notices" />
              <span className="grow">
                {n.title}
                <small>{n.source}</small>
              </span>
              <Chip>{n.read ? "Read" : "Unread"}</Chip>
            </button>
          ))}
      </div>
    </Card>
  );
}
