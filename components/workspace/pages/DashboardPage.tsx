"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import { areas } from "@/components/workspace/format";
import { Card, Chip, Foot } from "@/components/workspace/ui";
import {
  Header,
  DeadlineList,
  Ruling,
  MatterList,
} from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";
import WelcomeCard from "@/components/workspace/WelcomeCard";
import { useAccount } from "@/components/account/AccountProvider";
import {
  CARD_LABELS,
  matchesNiche,
  type QuickAction,
} from "@/lib/account/layout";
import type { DashboardCard } from "@/lib/account/profile";
import { practiceArea } from "@/lib/practice-areas";
import type { ReactNode } from "react";

/** Quick links; matter ones open the most recent matter, or the list if none. */
const QUICK: Record<QuickAction, [string, string, (m?: string) => string]> = {
  agent: [
    "Run legal agent",
    "agents",
    (m) => (m ? `/matters/${m}/chat` : "/matters"),
  ],
  precedents: ["Research precedents", "precedents", () => "/precedents"],
  documents: ["Analyze documents", "documents", () => "/documents"],
  strategy: [
    "Update case strategy",
    "edit",
    (m) => (m ? `/matters/${m}/strategy` : "/matters"),
  ],
};

/** Recent activity for the practice sample cases (the demo has no event log). */
const SAMPLE_ACTIVITY = [
  [
    "Motion to compel, draft updated",
    "Anderson v. Meridian Tech · Sample",
    "4h ago",
    "/matters/anderson/documents",
  ],
  ["New ruling detected", "U.S. v. Nexora Tech · Sample", "2h ago", "/notices"],
  [
    "Deposition transcript added",
    "Ridgeway Holdings LLC · Sample",
    "1d ago",
    "/matters/ridgeway/documents",
  ],
];

/** Greeting by the hour in the person's own time zone. */
function greeting(timeZone: string) {
  let h = new Date().getHours();
  try {
    h = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone,
      }).format(new Date()),
    );
  } catch {}
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

/** Dashboard: ask bar, ruling banner, matters, deadlines, activity. */
export default function DashboardPage() {
  const { router, data, question, setQuestion, practice, setPractice, notify } =
    useWorkspace();
  const first = data.matters[0]?.id;
  const { profile, layout } = useAccount();
  const firstName = (profile.fullName || profile.email).split(/[\s@]/)[0];
  const mine: string[] = profile.practiceAreas.map(
    (k) => practiceArea(k).label,
  );
  const practiceOptions = [
    "General research",
    ...mine,
    ...areas.filter((a) => !mine.includes(a)),
  ];
  return (
    <>
      <Header
        title={`Good ${greeting(profile.timeZone)}, ${firstName}.`}
        subtitle={layout.focusLine}
      />
      <form
        className="ask-bar"
        onSubmit={(e) => {
          e.preventDefault();
          if (!question.trim()) return;
          if (practice === "General research")
            notify("Research threads outside a matter are coming soon.");
          else if (!first)
            notify("Add a matter first, then ask Casevex about it.");
          else
            router.push(
              `/matters/${first}/chat?question=` + encodeURIComponent(question),
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
          {practiceOptions.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <button className="primary" disabled={!question.trim()}>
          Ask <Icon name="arrow" size={16} />
        </button>
      </form>
      {layout.prompts.length > 0 && (
        <div className="prompt-row" aria-label="Suggested questions">
          {layout.prompts.map((p) => (
            <button
              key={p}
              type="button"
              className="prompt-chip"
              onClick={() => setQuestion(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <WelcomeCard />
      {data.notices.some((n) => n.kind === "ruling" && !n.read) && <Ruling />}
      <div className="page-body dashboard-grid">
        {layout.cards.map((key) => (
          <DashCard key={key} id={key} />
        ))}
      </div>
      <div className="quick-grid">
        {layout.quick
          .map((q) => QUICK[q])
          .map(([name, icon, href]) => (
            <Link key={name} href={href(first)}>
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

/** One dashboard card, chosen and ordered by the person's layout. */
function DashCard({ id }: { id: DashboardCard }) {
  const { data, nameOf, openNotice } = useWorkspace();
  const { profile } = useAccount();
  const cards: Record<DashboardCard, () => ReactNode> = {
    matters: () => (
      <Card
        title={`${CARD_LABELS.matters} (${data.matters.length})`}
        action={<Link href="/matters">View all →</Link>}
      >
        {data.matters.length ? (
          <MatterList items={data.matters.slice(0, 5)} />
        ) : (
          <p className="empty">No matters yet.</p>
        )}
      </Card>
    ),
    deadlines: () => (
      <Card
        title={CARD_LABELS.deadlines}
        action={<Link href="/calendar">View all →</Link>}
      >
        <DeadlineList items={data.deadlines.slice(0, 4)} />
      </Card>
    ),
    notices: () => (
      <Card
        title={CARD_LABELS.notices}
        action={<Link href="/notices">View all →</Link>}
      >
        <div className="scroll">
          {!data.notices.length && <p className="empty">No notices yet.</p>}
          {data.notices.slice(0, 4).map((n) => (
            <button
              className="list-row"
              key={n.id}
              onClick={() => openNotice(n)}
            >
              <Icon name={n.kind === "deadline" ? "calendar" : "notices"} />
              <span className="grow">
                <b>{n.title}</b>
                <small>{n.matterIds.map(nameOf).join(", ") || n.source}</small>
              </span>
              {matchesNiche(`${n.title} ${n.detail}`, profile.niches) && (
                <Chip tone="rose">Your niche</Chip>
              )}
            </button>
          ))}
        </div>
      </Card>
    ),
    activity: () => (
      <Card title={CARD_LABELS.activity} className="activity-card">
        <div className="scroll">
          {data.samples !== "on" && (
            <p className="empty">No recent activity yet.</p>
          )}
          {(data.samples === "on" ? SAMPLE_ACTIVITY : []).map(
            ([title, detail, time, href]) => (
              <Link className="list-row" href={href} key={title}>
                <Icon name="documents" />
                <span className="grow">
                  <b>{title}</b>
                  <small>{detail}</small>
                </span>
                <small>{time}</small>
              </Link>
            ),
          )}
        </div>
      </Card>
    ),
  };
  return <>{cards[id]()}</>;
}
