"use client";
import Icon from "@/components/Icon";
import { Card } from "@/components/workspace/ui";
import { DocumentTable } from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";
import { useMatterScope } from "@/components/workspace/matter/useMatterScope";

/** Documents filed under this matter. */
export default function DocumentsTab() {
  const { open } = useWorkspace();
  const { documents } = useMatterScope();
  return (
    <Card
      className="page-body"
      title="Matter documents"
      action={
        <button onClick={() => open("upload")}>
          <Icon name="upload" />
          Upload document
        </button>
      }
    >
      <DocumentTable items={documents} />
    </Card>
  );
}
