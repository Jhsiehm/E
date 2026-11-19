"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import { label } from "@/components/workspace/format";
import { Card, Empty } from "@/components/workspace/ui";
import { DeadlineList, Ruling } from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";
import { useMatterScope } from "@/components/workspace/matter/useMatterScope";

import CaseSummaryCard from "./CaseSummaryCard";
import AnalysisCard from "./AnalysisCard";
import { CompareAction, ComparisonView } from "./PreparedComparison";
import { preparedComparisonFor } from "@/lib/demo/ellis-comparison";

/** Matter overview: summary, issues, deadlines, documents. */
export default function OverviewTab() {
  const { params, open, hasImpact } = useWorkspace();
  const { matter, documents, deadlines } = useMatterScope();
  const view = params.get("view");
  // Only the prepared demo matter has one; every other matter gets null.
  const comparison = preparedComparisonFor(
    matter.id,
    documents.map((d) => d.id),
  );
  const expanded = view === "summary" || view === "analysis";
  const viewHref = (nextView?: string) => {
    const next = new URLSearchParams(params);
    if (nextView) next.set("view", nextView);
    else next.delete("view");
    return `/matters/${matter.id}${next.size ? `?${next}` : ""}`;
  };
  const summaryCard = (
    <CaseSummaryCard expandHref={expanded ? undefined : viewHref("summary")} />
  );
  const analysisCard = (
    <AnalysisCard expandHref={expanded ? undefined : viewHref("analysis")} />
  );
  if (view === "compare" && comparison)
    return <ComparisonView comparison={comparison} backHref={viewHref()} />;
  if (expanded)
    return (
      <div className="page-body expanded-matter-view">
        <nav className="expanded-matter-nav" aria-label="Expanded case views">
          <Link
            href={viewHref("summary")}
            aria-current={view === "summary" ? "page" : undefined}
          >
            Case summary
          </Link>
          <Link
            href={viewHref("analysis")}
            aria-current={view === "analysis" ? "page" : undefined}
          >
            Casevex analysis
          </Link>
          <Link href={viewHref()}>Back to overview ↙</Link>
        </nav>
        <div
          className="expanded-matter-content scroll"
          tabIndex={0}
          aria-label="Expanded case content"
        >
          {view === "summary" ? summaryCard : analysisCard}
        </div>
      </div>
    );
  return (
    <>
      {hasImpact(matter.id) && <Ruling />}
      <div className="page-body matter-grid">
        <div className="stack">
          {summaryCard}
          {analysisCard}
        </div>
        <div className="stack">
          {comparison && (
            <CompareAction
              comparison={comparison}
              href={viewHref("compare")}
            />
          )}
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
