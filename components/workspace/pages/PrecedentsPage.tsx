"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import { date } from "@/components/workspace/format";
import {
  Chip,
  Card,
  Foot,
  Empty,
  Filter,
  Search,
} from "@/components/workspace/ui";
import { Header } from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";

/** Precedent library and detail view. */
export default function PrecedentsPage() {
  const { params, parts, data, clear, q, open } = useWorkspace();
  const precedent = data.precedents.find((p) => p.id === parts[1]);
  const items = data.precedents.filter(
    (p) =>
      (p.caseName + " " + p.citation + " " + p.topics.join(" "))
        .toLowerCase()
        .includes(q.toLowerCase()) &&
      (!params.get("court") || p.court === params.get("court")) &&
      (!params.get("topic") || p.topics.includes(params.get("topic")!)) &&
      (!params.get("jurisdiction") ||
        params.get("jurisdiction") === "Federal") &&
      (!params.get("date") || p.decidedAt.slice(0, 4) === params.get("date")),
  );
  return (
    <>
      <Header
        title={precedent ? precedent.caseName : "Precedents"}
        subtitle={
          precedent
            ? precedent.citation
            : "Search, analyze, and save controlling and persuasive authority."
        }
        action={
          <button className="primary" onClick={() => open("precedent")}>
            <Icon name="plus" />
            Add precedent
          </button>
        }
      />
      {precedent ? (
        <Card className="page-body">
          <Link href="/precedents">← All precedents</Link>
          <p>
            {precedent.court} ·{" "}
            {precedent.decidedAt ? date(precedent.decidedAt) : "Date pending"}
          </p>
          <Chip tone="rose">
            {precedent.isSample
              ? "Fictional sample authority"
              : "Verification is simulated"}
          </Chip>
          <h2>Research note</h2>
          <p>{precedent.holding}</p>
          <div className="actions">
            {precedent.topics.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
          <h3>Used in</h3>
          <Link href="/matters/anderson">
            Anderson v. Meridian Tech · Sample association
          </Link>
          <Foot />
        </Card>
      ) : (
        <>
          <div className="filters">
            <Search placeholder="Search cases, citations, legal issues, or holdings…" />
          </div>
          <div className="filters">
            <Filter
              name="jurisdiction"
              title="Jurisdiction"
              options={["Federal", "State"]}
            />
            <Filter
              name="topic"
              title="Topic"
              options={[...new Set(data.precedents.flatMap((p) => p.topics))]}
            />
            <Filter
              name="court"
              title="Court"
              options={["U.S. Supreme Court", "Second Circuit"]}
            />
            <Filter
              name="date"
              title="Date"
              options={["2026", "2018", "2017"]}
            />
            <button className="text-button" onClick={clear}>
              Clear filters
            </button>
          </div>
          <Card className="page-body">
            <p className="eyebrow">Saved authority · {items.length} results</p>
            <div className="scroll">
              {items.map((p) => (
                <Link
                  key={p.id}
                  className="precedent-row"
                  href={"/precedents/" + p.id}
                >
                  <span className="icon-tile">
                    <Icon name="court" size={26} />
                  </span>
                  <span className="grow">
                    <h2>
                      <i>{p.caseName}</i>
                      <span className="citation-text">, {p.citation}</span>
                    </h2>
                    <p className="muted">
                      {p.court} ·{" "}
                      {p.decidedAt ? date(p.decidedAt) : "Date pending"}
                      {p.isSample ? " · Fictional sample" : ""}
                    </p>
                    <small className="verified">
                      <i className="square" />
                      {p.verified
                        ? "Verified against the opinion (simulated)"
                        : "Awaiting verification"}
                    </small>
                    <span className="topic-list">
                      {p.topics.map((t) => (
                        <Chip tone="rose" key={t}>
                          {t}
                        </Chip>
                      ))}
                    </span>
                  </span>
                  <Icon name="chevron" />
                </Link>
              ))}
              {!items.length && <Empty onClear={clear} />}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
