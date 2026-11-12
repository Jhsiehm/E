"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import { areas } from "@/components/workspace/format";
import { Card, Foot } from "@/components/workspace/ui";
import {
  Header,
  DeadlineList,
  Ruling,
  MatterList,
} from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";

/** Dashboard: ask bar, ruling banner, matters, deadlines, activity. */
export default function DashboardPage() {
  const { router, data, question, setQuestion, practice, setPractice, notify } =
    useWorkspace();
  return (
    <>
      <Header
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${data.me.name.split(" ")[0]}.`}
        subtitle="Legal intelligence, updated for your matters."
      />
      <form
        className="ask-bar"
        onSubmit={(e) => {
          e.preventDefault();
          if (!question.trim()) return;
          if (practice === "General research")
            notify("Research threads outside a matter are coming soon.");
          else
            router.push(
              "/matters/anderson/chat?question=" + encodeURIComponent(question),
            );
        }}
      >
        <Icon name="agents" />
        <input
          aria-label="Ask Casevex"
          placeholder="Ask Casevex a legal question, analyze a case, or draft a document"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <select
          aria-label="Practice area"
          value={practice}
          onChange={(e) => setPractice(e.target.value)}
        >
          {["General research", ...areas].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <button className="primary" disabled={!question.trim()}>
          Ask <Icon name="arrow" size={16} />
        </button>
      </form>
      {data.notices.some((n) => n.kind === "ruling" && !n.read) && <Ruling />}
      <div className="page-body dashboard-grid">
        <Card
          title={`Active matters (${data.matters.length})`}
          action={<Link href="/matters">View all →</Link>}
        >
          <MatterList items={data.matters.slice(0, 5)} />
        </Card>
        <Card
          title="Upcoming deadlines"
          action={<Link href="/calendar">View all →</Link>}
        >
          <DeadlineList items={data.deadlines.slice(0, 4)} />
        </Card>
        <Card title="Recent activity" className="activity-card">
          <div className="scroll">
            {[
              [
                "Motion to compel, draft updated",
                "Anderson v. Meridian Tech",
                "4h ago",
                "/matters/anderson/documents",
              ],
              [
                "New ruling detected",
                "U.S. v. Nexora Tech · Sample",
                "2h ago",
                "/notices",
              ],
              [
                "Deposition transcript added",
                "Ridgeway Holdings LLC",
                "1d ago",
                "/matters/ridgeway/documents",
              ],
            ].map(([title, detail, time, href]) => (
              <Link className="list-row" href={href} key={title}>
                <Icon name="documents" />
                <span className="grow">
                  <b>{title}</b>
                  <small>{detail}</small>
                </span>
                <small>{time}</small>
              </Link>
            ))}
          </div>
        </Card>
      </div>
      <div className="quick-grid">
        {[
          ["Run legal agent", "agents", "/matters/anderson/chat"],
          ["Research precedents", "precedents", "/precedents"],
          ["Analyze documents", "documents", "/documents"],
          ["Update case strategy", "edit", "/matters/anderson/strategy"],
        ].map(([name, icon, href]) => (
          <Link key={name} href={href}>
            <Icon name={icon} />
            {name}
            <Icon name="arrow" size={16} />
          </Link>
        ))}
      </div>
      <Foot />
    </>
  );
}
