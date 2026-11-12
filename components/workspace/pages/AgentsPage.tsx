"use client";
import Icon from "@/components/Icon";
import { Card, Empty, Filter, Search } from "@/components/workspace/ui";
import { Header } from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";
import { STATUS_LABEL } from "@/lib/agents";

/** Agent catalogue and assignment entry point. */
export default function AgentsPage() {
  const { params, data, clear, q, open } = useWorkspace();
  const items = data.agents.filter(
    (a) =>
      a.name.toLowerCase().includes(q.toLowerCase()) &&
      (!params.get("area") || a.practiceArea === params.get("area")) &&
      (!params.get("availability") ||
        a.availability === params.get("availability")),
  );
  return (
    <>
      <Header
        title="Legal agents"
        subtitle="Specialized agents for each practice area."
      />
      <div className="filters">
        <Search placeholder="Search agents…" />
        <Filter
          name="area"
          title="All practice areas"
          options={data.agents.map((a) => a.practiceArea)}
        />
        <Filter
          name="availability"
          title="Availability"
          options={["available", "beta", "coming_later"]}
        />
      </div>
      <p className="eyebrow">
        {items.length} agents · Every answer links to its sources and stays a
        draft until you keep it
      </p>
      <div className="page-body agent-grid">
        {items.map((a) => (
          <Card key={a.id} className="agent-card">
            <div className="icon-tile">
              <Icon name="agents" size={26} />
            </div>
            <h2>Casevex {a.name.toLowerCase()} agent</h2>
            <p className="muted">{a.description}</p>
            <div className="agent-stats">
              <span>{a.matterCount} matters</span>
              <span
                className={
                  "agent-status " +
                  (a.availability === "available" ? "verified" : "muted")
                }
              >
                <i className="square" />
                {STATUS_LABEL[a.availability]}
              </span>
            </div>
            {a.availability === "coming_later" ? (
              <button disabled aria-disabled="true">
                Coming later
              </button>
            ) : (
              <button onClick={() => open("agent", a.id)}>
                Add agent <Icon name="plus" size={16} />
              </button>
            )}
          </Card>
        ))}
        {!items.length && <Empty onClear={clear} />}
      </div>
    </>
  );
}
