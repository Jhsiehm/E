"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import { date, label } from "@/components/workspace/format";
import { Chip, Card, Foot, Empty } from "@/components/workspace/ui";
import { DeadlineList, Ruling } from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";
import { useMatterScope } from "@/components/workspace/matter/useMatterScope";

/** Matter overview: summary, issues, deadlines, documents. */
export default function OverviewTab() {
  const {
    busy,
    analysis,
    setAnalysis,
    editing,
    setEditing,
    summary,
    setSummary,
    mutate,
    open,
    hasImpact,
  } = useWorkspace();
  const { matter, documents, deadlines } = useMatterScope();
  return (
    <>
      {hasImpact(matter.id) && <Ruling />}
      <div className="page-body matter-grid">
        <div className="stack">
          <Card
            title="Case summary"
            action={
              <button
                className="text-button"
                onClick={() => {
                  setSummary(matter.summary);
                  setEditing(true);
                }}
              >
                Edit
              </button>
            }
          >
            {editing ? (
              <>
                <textarea
                  aria-label="Case summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
                <div className="actions">
                  <button onClick={() => setEditing(false)}>Cancel</button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await mutate(
                          "matters/" + matter.id,
                          { summary },
                          "PATCH",
                        )
                      )
                        setEditing(false);
                    }}
                  >
                    Save summary
                  </button>
                </div>
              </>
            ) : (
              <p>{matter.summary}</p>
            )}
            <div className="facts">
              <div>
                <span className="eyebrow">Role</span>
                <p>{matter.role}</p>
              </div>
              <div>
                <span className="eyebrow">Next deadline</span>
                <p>
                  {deadlines[0] ? date(deadlines[0].dueAt) : "Not scheduled"}
                </p>
              </div>
              <div>
                <span className="eyebrow">Status</span>
                <p>
                  <Chip tone="olive">{label(matter.status)}</Chip>
                </p>
              </div>
            </div>
          </Card>
          <Card title="Casevex analysis" className="grow">
            <div className="tabs analysis-tabs">
              {[
                "Recommended approach",
                "Key authorities",
                "Risks",
                "Next steps",
              ].map((t) => (
                <button
                  key={t}
                  className={analysis === t ? "active" : ""}
                  onClick={() => setAnalysis(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="analysis-panel scroll">
              {analysis === "Recommended approach" ? (
                <>
                  <p>
                    Begin with the disputed facts and the current procedural
                    posture. Review the matter record and identify the evidence
                    supporting each claim.
                  </p>
                  <p>
                    {matter.id === "anderson"
                      ? "The fictional Nexora ruling may inform the trade secret argument. Compare the sample declaration against the proposed standard."
                      : "No matter-specific research has been verified. Add primary authority and supporting documents before drafting."}
                  </p>
                </>
              ) : analysis === "Key authorities" ? (
                <Link href="/precedents">
                  Review saved authorities <Icon name="arrow" size={16} />
                </Link>
              ) : analysis === "Risks" ? (
                <ul>
                  <li>
                    Sample citations and factual assumptions require attorney
                    review.
                  </li>
                  <li>
                    Jurisdiction, procedural posture, and negative treatment
                    have not been checked.
                  </li>
                </ul>
              ) : (
                <ol>
                  <li>Confirm the matter record and key dates.</li>
                  <li>
                    Review controlling authority with the assigned attorney.
                  </li>
                  <li>Update the strategy and prepare the next filing.</li>
                </ol>
              )}
            </div>
            <Foot />
          </Card>
        </div>
        <div className="stack">
          <Card
            title="Key deadlines"
            action={
              <Link href={`/matters/${matter.id}/deadlines`}>View all →</Link>
            }
          >
            <DeadlineList items={deadlines} />
          </Card>
          <Card
            title="Key documents"
            action={
              <Link href={`/matters/${matter.id}/documents`}>View all →</Link>
            }
          >
            <div className="scroll">
              {documents.slice(0, 3).map((d) => (
                <button
                  key={d.id}
                  className="list-row"
                  onClick={() => open("document", d.id)}
                >
                  <span className={"file-badge " + d.ext}>
                    {d.ext.toUpperCase()}
                  </span>
                  <span>
                    {d.name}
                    <small>{label(d.status)}</small>
                  </span>
                  <Icon name="chevron" size={16} />
                </button>
              ))}
              {!documents.length && <Empty text="No documents added yet." />}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
