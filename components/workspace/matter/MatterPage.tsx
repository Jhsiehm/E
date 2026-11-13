"use client";
import OverviewTab from "./OverviewTab";
import ChatTab from "./ChatTab";
import DocumentsTab from "./DocumentsTab";
import DeadlinesTab from "./DeadlinesTab";
import NoticesTab from "./NoticesTab";
import StrategyTab from "./StrategyTab";
import ResearchTab from "./ResearchTab";
import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "@/components/Icon";
import { label } from "@/components/workspace/format";
import { Chip } from "@/components/workspace/ui";
import { SampleTag } from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";
import { useMatterScope } from "@/components/workspace/matter/useMatterScope";

/** Matter detail: header, tabs and the active tab body. */
export default function MatterPage() {
  const { sub, open, hasImpact } = useWorkspace();
  const { matter, documents } = useMatterScope();
  let body: ReactNode;
  if (sub === "overview") body = <OverviewTab />;
  else if (sub === "chat") body = <ChatTab />;
  else if (sub === "documents") body = <DocumentsTab />;
  else if (sub === "deadlines") body = <DeadlinesTab />;
  else if (sub === "notices") body = <NoticesTab />;
  else if (sub === "strategy") body = <StrategyTab />;
  else body = <ResearchTab />;
  return (
    <>
      <header className="page-header matter-header">
        <div>
          <p className="breadcrumbs cx-short-hide">
            <Link href="/matters">Matters</Link> › {matter.name}
          </p>
          <h1>{matter.name}</h1>
          <p className="subtitle">
            {matter.court} <span>|</span> {matter.type} <span>|</span>{" "}
            <Chip tone="olive">{label(matter.status)}</Chip>
            {matter.sample && <SampleTag />}
          </p>
        </div>
        <div className="actions">
          <button
            className="icon-button"
            aria-label="Matter actions"
            onClick={() => open("matter-actions")}
          >
            <Icon name="more" />
          </button>
          <button onClick={() => open("share")}>Share</button>
          <Link className="button primary" href={`/matters/${matter.id}/chat`}>
            <Icon name="agents" />
            Ask Casevex
          </Link>
        </div>
      </header>
      <nav className="tabs matter-tabs" aria-label="Matter sections">
        {[
          "overview",
          "documents",
          "research",
          "notices",
          "deadlines",
          "strategy",
          "chat",
        ].map((t) => (
          <Link
            key={t}
            href={`/matters/${matter.id}${t === "overview" ? "" : "/" + t}`}
            className={sub === t ? "active" : ""}
            aria-current={sub === t ? "page" : undefined}
          >
            {t === "chat" ? "Agent chat" : label(t)}
            {t === "documents" && ` (${documents.length})`}
            {t === "notices" && hasImpact(matter.id) && (
              <Chip tone="rose">1</Chip>
            )}
          </Link>
        ))}
      </nav>
      {body}
    </>
  );
}
