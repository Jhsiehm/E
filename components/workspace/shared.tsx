"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "@/components/Icon";
import type { Matter, Deadline, Doc, Message } from "@/lib/mock/data";
import { date, label } from "@/components/workspace/format";
import { Chip, Foot, Empty } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";

/* Composite blocks reused across screens (header, lists, rulings, answers). */
export const Header = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) => {
  const { page, open, unread } = useWorkspace();
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{page}</p>
        <h1>{title}</h1>
        <p className="subtitle cx-short-hide">{subtitle}</p>
      </div>
      <div className="actions">
        <button
          className="icon-button"
          aria-label="Search all precedents"
          onClick={() => open("search")}
        >
          <Icon name="search" />
        </button>
        <Link
          className="icon-button"
          href="/notices"
          aria-label={`${unread} unread notices`}
        >
          <Icon name="notices" />
          {unread > 0 && <i className="dot" />}
        </Link>
        {action}
      </div>
    </header>
  );
};

export const DeadlineList = ({ items }: { items: Deadline[] }) => {
  const { open, nameOf } = useWorkspace();
  return (
    <div className="scroll list">
      {[...items]
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .map((d) => (
          <button
            key={d.id}
            className="list-row deadline-row"
            onClick={() => open("event-detail", d.id)}
          >
            <span className={d.dueAt <= "2026-11-18" ? "rose-text" : "date"}>
              {date(d.dueAt)}
            </span>
            <span>
              <span>{d.title}</span>
              <small>{nameOf(d.matterId)}</small>
            </span>
            {d.dueAt === "2026-11-18" && <Chip tone="rose">7 days</Chip>}
          </button>
        ))}
      {!items.length && <Empty text="No deadlines scheduled." />}
    </div>
  );
};

export const Ruling = ({ compact = false }: { compact?: boolean }) => {
  const { matter, openNotice, data } = useWorkspace();
  return (
    <div className={"ruling " + (compact ? "compact" : "")}>
      <div>
        <p className="eyebrow">
          New ruling{matter ? ", impact on this matter" : ""}
        </p>
        <h2>Second Circuit narrows trade secret standard</h2>
        <p>
          <i>U.S. v. Nexora Tech</i>, 138 F.4th 427 (2d Cir. 2026) · Fictional
          sample
        </p>
        {!compact && (
          <small>
            {matter
              ? matter.id === "ridgeway"
                ? "May weaken your position"
                : "May strengthen your position"
              : "Affects 2 of your matters"}
          </small>
        )}
      </div>
      <button onClick={() => openNotice(data.notices[0])}>
        View impact <Icon name="arrow" size={16} />
      </button>
    </div>
  );
};

/** Marks a made-up practice case wherever it is listed. */
export const SampleTag = () => (
  <span className="sample-tag" title="Made-up practice case, not a real client">
    Sample
  </span>
);

export const MatterList = ({ items }: { items: Matter[] }) => {
  const { hasImpact } = useWorkspace();
  return (
    <div className="scroll list">
      {items.map((m) => (
        <Link className="list-row" href={"/matters/" + m.id} key={m.id}>
          <Icon name="matters" />
          <span className="grow">
            <span className="matter-name">
              {m.name}
              {m.sample && <SampleTag />}
            </span>
            <small>
              {m.type} | {m.court}
            </small>
          </span>
          {hasImpact(m.id) && (
            <span className="impact-dot" title="New ruling impact" />
          )}
          <Icon name="chevron" size={16} />
        </Link>
      ))}
    </div>
  );
};

export const DocumentTable = ({ items }: { items: Doc[] }) => {
  const { params, query, open, nameOf, clear } = useWorkspace();
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Matter</th>
            <th>Type</th>
            <th>Owner</th>
            <th>
              <button
                className="table-sort"
                onClick={() =>
                  query("sort", params.get("sort") === "asc" ? "desc" : "asc")
                }
              >
                Modified {params.get("sort") === "asc" ? "↑" : "↓"}
              </button>
            </th>
            <th>Status</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {[...items]
            .sort(
              (a, b) =>
                (params.get("sort") === "asc" ? 1 : -1) *
                a.modifiedAt.localeCompare(b.modifiedAt),
            )
            .map((d) => (
              <tr key={d.id}>
                <td>
                  <button
                    className="text-button doc-title"
                    onClick={() => open("document", d.id)}
                  >
                    <span className={"file-badge " + d.ext}>
                      {d.ext.toUpperCase()}
                    </span>
                    <span>
                      {d.name}
                      <small>{(d.sizeBytes / 1000000).toFixed(2)} MB</small>
                    </span>
                  </button>
                </td>
                <td>
                  <Link href={"/matters/" + d.matterId}>
                    {nameOf(d.matterId)}
                  </Link>
                </td>
                <td>{d.type}</td>
                <td>
                  <span className="avatar small">{d.ownerInitials}</span>
                </td>
                <td>{date(d.modifiedAt)}</td>
                <td>
                  <Chip tone={d.status === "final" ? "olive" : ""}>
                    {label(d.status)}
                  </Chip>
                </td>
                <td>
                  <button
                    className="icon-button flat"
                    aria-label={"Manage " + d.name}
                    onClick={() => open("document", d.id)}
                  >
                    <Icon name="more" />
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {!items.length && <Empty onClear={clear} />}
    </div>
  );
};

export const sourcesFor = (msg: Message) => (
  <>
    {!!msg.sources?.length && (
      <>
        <p className="eyebrow">
          Sources ({msg.sources.length}) · Simulated verification
        </p>
        <div className="sources">
          {msg.sources
            .filter((s) => s.verified)
            .map((s) => (
              <Link
                id={`${msg.id}-source-${s.index}`}
                className="source"
                key={s.index}
                href={s.href}
              >
                <span className="square" />
                <span>
                  [{s.index}] {s.title}
                  <small>{s.meta}</small>
                </span>
                <Icon name="arrow" size={14} />
              </Link>
            ))}
        </div>
      </>
    )}
  </>
);

export const Answer = ({ msg }: { msg: Message }) => {
  const { data, matter } = useWorkspace();
  return (
    <article className="answer">
      <div className="card-head">
        <b>
          Casevex{" "}
          {data.agents
            .find((a) => a.id === matter?.assignedAgentId)
            ?.name.toLowerCase()}{" "}
          agent
        </b>
        <Chip>Simulated answer</Chip>
      </div>
      <p className="eyebrow rose-text">Short answer</p>
      {msg.text.split("\n\n").map((paragraph, i) => (
        <p key={i}>
          {paragraph.split(/(\[\d\])/g).map((t, j) =>
            /^\[\d\]$/.test(t) ? (
              <button
                key={j}
                className="citation"
                aria-label={"Jump to source " + t}
                onClick={() => {
                  const el = document.getElementById(
                    `${msg.id}-source-${t[1]}`,
                  );
                  el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                  el?.focus();
                }}
              >
                {t}
              </button>
            ) : (
              t
            ),
          )}
        </p>
      ))}
      {sourcesFor(msg)}
      <Foot />
    </article>
  );
};
