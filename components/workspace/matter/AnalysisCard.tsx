"use client";
import Link from "next/link";
import { Card, Foot } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";
import { useMatterScope } from "./useMatterScope";

const SECTIONS = [
  ["approach", "Recommended approach"],
  ["authorities", "Key authorities"],
  ["risks", "Risks"],
  ["next-steps", "Next steps"],
] as const;

/** URL-bound sections work in either size and survive refresh/back navigation. */
export default function AnalysisCard({ expandHref }: { expandHref?: string }) {
  const { params, query } = useWorkspace();
  const { matter } = useMatterScope();
  const selected =
    SECTIONS.find(([key]) => key === params.get("analysis"))?.[0] || "approach";
  const base = `/matters/${matter.id}`;
  return (
    <Card
      title="Casevex analysis"
      className="grow"
      action={
        expandHref && (
          <Link href={expandHref} aria-label="Expand Casevex analysis">
            Expand ↗
          </Link>
        )
      }
    >
      <div
        className="tabs analysis-tabs"
        role="group"
        aria-label="Analysis sections"
      >
        {SECTIONS.map(([key, title]) => (
          <button
            key={key}
            className={selected === key ? "active" : ""}
            aria-pressed={selected === key}
            onClick={() => query("analysis", key)}
          >
            {title}
          </button>
        ))}
      </div>
      <div
        className="analysis-panel scroll"
        tabIndex={0}
        aria-label="Analysis text"
      >
        {selected === "approach" ? (
          <>
            <p>
              Begin with the disputed facts and the current procedural posture.
              Review the matter record and identify the evidence supporting each
              claim.
            </p>
            <p>
              {matter.id === "anderson"
                ? "The fictional Nexora ruling may inform the trade secret argument. Compare the sample declaration against the proposed standard."
                : "No matter-specific research has been verified. Add primary authority and supporting documents before drafting."}
            </p>
            <p>
              <Link href={`${base}/documents`}>Review case documents →</Link>
            </p>
          </>
        ) : selected === "authorities" ? (
          <>
            <p>
              Review the saved authorities and confirm their relevance to this
              matter before relying on them.
            </p>
            <Link href="/precedents">Review saved authorities →</Link>
          </>
        ) : selected === "risks" ? (
          <>
            <ul>
              <li>
                Sample citations and factual assumptions require attorney
                review.
              </li>
              <li>
                Jurisdiction, procedural posture, and negative treatment have
                not been checked.
              </li>
            </ul>
            <p>
              <Link href={`${base}/notices`}>Review case notices →</Link>
            </p>
          </>
        ) : (
          <ol>
            <li>
              <Link href={`${base}/documents`}>Confirm the matter record</Link>{" "}
              and <Link href={`${base}/deadlines`}>key dates</Link>.
            </li>
            <li>
              <Link href="/precedents">Review controlling authority</Link> with
              the assigned attorney.
            </li>
            <li>
              <Link href={`${base}/strategy`}>Update the case strategy</Link>{" "}
              and prepare the next filing.
            </li>
          </ol>
        )}
      </div>
      <Foot />
    </Card>
  );
}
