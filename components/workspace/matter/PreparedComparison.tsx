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
} from "@/lib/demo/prepared-comparison";

/** Overview entry point: one plain action, shown only on the prepared matter. */
export function CompareAction({
  comparison,
  href,
}: {
  comparison: PreparedComparison;
  href: string;
}) {
  return (
    <Card title="Compare documents" className="compare-action-card">
      <p className="compare-label">{comparison.label}</p>
      <p>
        The {comparison.left.role.toLowerCase()} and the{" "}
        {comparison.right.role.toLowerCase()}, side by side, with a link to each
        original page.
      </p>
      <Link className="button primary" href={href}>
        {comparison.action}
      </Link>
    </Card>
  );
}

/** Opens the pinned original at its page in a new tab, so this view stays put. */
function OpenOriginal({
  excerpt,
  documentId,
  sha256,
  publicUrl,
}: {
  excerpt: PreparedExcerpt;
  documentId: string;
  sha256: string;
  /** Demo: the bundled public court record, opened directly. */
  publicUrl?: string;
}) {
  const { notify } = useWorkspace();
  const [opening, setOpening] = useState(false);
  if (publicUrl)
    return (
      <a
        className="button record-link"
        href={`${publicUrl}#page=${excerpt.page}`}
        target="_blank"
        rel="noopener"
      >
        <Icon name="documents" size={16} />
        Open original, page {excerpt.page}
      </a>
    );
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
            `documents/${documentId}/view`,
            { query: { sha256 } },
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

function ExcerptCard({
  excerpt,
  documentId,
  sha256,
  publicUrl,
}: {
  excerpt: PreparedExcerpt;
  documentId: string;
  sha256: string;
  publicUrl?: string;
}) {
  return (
    <section className="card compare-excerpt" aria-label={excerpt.role}>
      <p className="eyebrow">{excerpt.role}</p>
      <h3>{excerpt.title}</h3>
      <p className="compare-meta">
        {excerpt.date ? <>{excerpt.date} · </> : null}PDF page {excerpt.page}
        {excerpt.printedPage ? ` (printed page ${excerpt.printedPage})` : ""}
      </p>
      <blockquote>{excerpt.quote}</blockquote>
      <OpenOriginal
        excerpt={excerpt}
        documentId={documentId}
        sha256={sha256}
        publicUrl={publicUrl}
      />
    </section>
  );
}

/** Side-by-side view. Its place lives in the URL, so refresh and Back return here. */
export function ComparisonView({
  comparison,
  documentId,
  documentName,
  publicUrl,
  backHref,
}: {
  comparison: PreparedComparison;
  documentId: string;
  documentName: string;
  publicUrl?: string;
  backHref: string;
}) {
  const sha256 = comparison.sha256;
  return (
    <div className="page-body compare-view">
      <nav className="expanded-matter-nav" aria-label="Comparison">
        <span className="compare-label">{comparison.label}</span>
        <Link href={backHref}>Back to overview ↙</Link>
      </nav>
      <h2 className="compare-title">{comparison.action}</h2>
      <p className="compare-meta">From {documentName}</p>
      <Card title="What differs">
        <p className="compare-difference">{comparison.difference}</p>
      </Card>
      <div className="compare-grid">
        <ExcerptCard
          excerpt={comparison.left}
          documentId={documentId}
          sha256={sha256}
          publicUrl={publicUrl}
        />
        <ExcerptCard
          excerpt={comparison.right}
          documentId={documentId}
          sha256={sha256}
          publicUrl={publicUrl}
        />
      </div>
      <p className="compare-note">
        Both excerpts were checked by hand against the original file. This
        example was prepared to show the review workflow; Casevex did not find
        these passages on its own. The majority opinion states the court’s
        holding; the partial dissent is not controlling law.
      </p>
    </div>
  );
}
