"use client";
import Link from "next/link";
import { useState } from "react";
import Icon from "@/components/Icon";
import { Card } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";
import { api } from "@/lib/api/client";
import type {
  PreparedComparison,
  PreparedExcerpt,
} from "@/lib/demo/ellis-comparison";

/** Overview entry point: one plain action, shown only on the prepared matter. */
export function CompareAction({
  comparison,
  href,
}: {
  comparison: PreparedComparison;
  href: string;
}) {
  return (
    <Card title={comparison.title} className="compare-action-card">
      <p className="compare-label">{comparison.label}</p>
      <p>
        {comparison.left.role} and {comparison.right.role.toLowerCase()}, side
        by side, with a link to each original page.
      </p>
      <Link className="button primary" href={href}>
        Compare follow-up recommendations
      </Link>
    </Card>
  );
}

/** Opens the pinned original at its page in a new tab, so this view stays put. */
function OpenOriginal({ excerpt }: { excerpt: PreparedExcerpt }) {
  const { notify } = useWorkspace();
  const [opening, setOpening] = useState(false);
  return (
    <button
      type="button"
      disabled={opening}
      onClick={async () => {
        // Open the tab during the click so the browser does not block it,
        // then point it at the authorized link once the server returns it.
        const tab = window.open("", "_blank");
        setOpening(true);
        try {
          const { url } = await api.get<{ url: string }>(
            `documents/${excerpt.documentId}/view`,
            { query: { version: excerpt.versionId } },
          );
          const target = `${url}#page=${excerpt.page}`;
          if (tab) tab.location.href = target;
          else window.location.assign(target);
        } catch (err) {
          tab?.close();
          notify(
            err instanceof Error
              ? err.message
              : "The original could not be opened. Please try again.",
          );
        } finally {
          setOpening(false);
        }
      }}
    >
      <Icon name="documents" size={16} />
      {opening ? "Opening…" : `Open original, page ${excerpt.page}`}
    </button>
  );
}

function ExcerptCard({ excerpt }: { excerpt: PreparedExcerpt }) {
  return (
    <section className="card compare-excerpt" aria-label={excerpt.role}>
      <p className="eyebrow">{excerpt.role}</p>
      <h3>{excerpt.title}</h3>
      <p className="compare-meta">
        {excerpt.date ? <>{excerpt.date} · </> : null}PDF page {excerpt.page}
      </p>
      <blockquote>{excerpt.quote}</blockquote>
      <OpenOriginal excerpt={excerpt} />
    </section>
  );
}

/** Side-by-side view. Its place lives in the URL, so refresh and Back return here. */
export function ComparisonView({
  comparison,
  backHref,
}: {
  comparison: PreparedComparison;
  backHref: string;
}) {
  return (
    <div className="page-body compare-view">
      <nav className="expanded-matter-nav" aria-label="Comparison">
        <span className="compare-label">{comparison.label}</span>
        <Link href={backHref}>Back to overview ↙</Link>
      </nav>
      <h2 className="compare-title">{comparison.title}</h2>
      <div className="compare-grid">
        <ExcerptCard excerpt={comparison.left} />
        <ExcerptCard excerpt={comparison.right} />
      </div>
      <Card title="What differs">
        <p>{comparison.difference}</p>
        <p className="compare-note">
          Excerpts were checked by hand against the original files. Timing,
          breach and causation are not addressed here and need their own
          evidence and attorney review.
        </p>
      </Card>
    </div>
  );
}
