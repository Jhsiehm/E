"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import { areas, date, label } from "@/components/workspace/format";
import { Chip, Card, Empty, Filter, Search } from "@/components/workspace/ui";
import { Header } from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";

/** Matters list with search and filters. */
export default function MattersPage() {
  const { params, data, clear, q, open, hasImpact } = useWorkspace();
  const filtered = data.matters.filter(
    (m) =>
      (m.name + " " + m.docket).toLowerCase().includes(q.toLowerCase()) &&
      (!params.get("status") || m.status === params.get("status")) &&
      (!params.get("type") || m.type === params.get("type")) &&
      (!params.get("scope") || m.role === params.get("scope")),
  );
  return (
    <>
      <Header
        title="Matters"
        subtitle="Your active and archived legal matters."
        action={
          <button className="primary" onClick={() => open("matter")}>
            <Icon name="plus" />
            New matter
          </button>
        }
      />
      <div className="filters">
        <Search placeholder="Search matters…" />
        <Filter
          name="scope"
          title="All matters"
          options={["Plaintiff", "Defendant", "Other"]}
        />
        <Filter
          name="status"
          title="All status"
          options={["active", "in_review", "archived"]}
        />
        <Filter name="type" title="All types" options={areas} />
      </div>
      <Card className="page-body">
        <p className="eyebrow">{filtered.length} matters</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Matter</th>
                <th>Status</th>
                <th>Type</th>
                <th>Assigned agent</th>
                <th>Last updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link className="table-matter" href={"/matters/" + m.id}>
                      <Icon name="matters" />
                      <span>
                        {m.name}
                        <small>
                          {m.docket} | {m.court}
                        </small>
                      </span>
                      {hasImpact(m.id) && <span className="impact-dot" />}
                    </Link>
                  </td>
                  <td>
                    <Chip tone={m.status === "active" ? "olive" : ""}>
                      {label(m.status)}
                    </Chip>
                  </td>
                  <td>{m.type}</td>
                  <td>
                    Casevex{" "}
                    {data.agents.find((a) => a.id === m.assignedAgentId)?.name}
                  </td>
                  <td>{date(m.updatedAt)}</td>
                  <td>
                    <Link
                      className="icon-button flat"
                      aria-label={"Open " + m.name}
                      href={"/matters/" + m.id}
                    >
                      <Icon name="chevron" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <Empty onClear={clear} />}
        </div>
      </Card>
    </>
  );
}
