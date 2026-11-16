"use client";
import Link from "next/link";
import { date, label } from "@/components/workspace/format";
import { Card, Chip } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";
import { useMatterScope } from "./useMatterScope";

/** The same editable summary in the overview and expanded reading view. */
export default function CaseSummaryCard({
  expandHref,
}: {
  expandHref?: string;
}) {
  const { busy, editing, setEditing, summary, setSummary, mutate } =
    useWorkspace();
  const { matter, deadlines } = useMatterScope();
  return (
    <Card
      title="Case summary"
      className="case-summary-card"
      action={
        <div className="actions">
          {!editing && (
            <button
              className="text-button"
              onClick={() => {
                setSummary(matter.summary);
                setEditing(true);
              }}
            >
              Edit
            </button>
          )}
          {expandHref && (
            <Link href={expandHref} aria-label="Expand case summary">
              Expand ↗
            </Link>
          )}
        </div>
      }
    >
      {editing ? (
        <>
          <textarea
            className="case-summary-editor"
            aria-label="Case summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <div className="actions">
            <button disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                if (await mutate("matters/" + matter.id, { summary }, "PATCH"))
                  setEditing(false);
              }}
            >
              Save summary
            </button>
          </div>
        </>
      ) : (
        <div
          className="case-summary-copy scroll"
          tabIndex={0}
          aria-label="Case summary text"
        >
          <p>{matter.summary}</p>
        </div>
      )}
      <div className="facts">
        <div>
          <span className="eyebrow">Role</span>
          <p>{matter.role}</p>
        </div>
        <div>
          <span className="eyebrow">Next deadline</span>
          <p>{deadlines[0] ? date(deadlines[0].dueAt) : "Not scheduled"}</p>
        </div>
        <div>
          <span className="eyebrow">Status</span>
          <p>
            <Chip tone="olive">{label(matter.status)}</Chip>
          </p>
        </div>
      </div>
    </Card>
  );
}
