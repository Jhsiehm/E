"use client";
import Icon from "@/components/Icon";
import { date } from "@/components/workspace/format";
import { Chip, Card, Empty } from "@/components/workspace/ui";
import { Header } from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";

/** Notices inbox with tabs. */
export default function NoticesPage() {
  const {
    params,
    data,
    busy,
    notify,
    mutate,
    query,
    unread,
    nameOf,
    openNotice,
  } = useWorkspace();
  const tab = params.get("tab") || "All";
  const items = data.notices.filter(
    (n) =>
      tab === "All" ||
      (tab === "Unread" && !n.read) ||
      n.kind === tab.toLowerCase().replace(/s$/, ""),
  );
  return (
    <>
      <Header
        title="Notices"
        subtitle="Rulings, deadlines and docket activity for your matters."
        action={
          <button
            disabled={!unread || busy}
            onClick={async () => {
              await mutate("notices/read", { all: true });
              notify("All notices marked read.");
            }}
          >
            Mark all read
          </button>
        }
      />
      <div className="tabs">
        {["All", "Unread", "Rulings", "Deadlines", "Docket"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => query("tab", t)}
          >
            {t}{" "}
            {t === "All"
              ? `(${data.notices.length})`
              : t === "Unread"
                ? `(${unread})`
                : ""}
          </button>
        ))}
      </div>
      <Card className="page-body">
        <div className="scroll notice-list">
          {items.map((n) => (
            <button
              className={"notice-row " + (!n.read ? "unread" : "")}
              key={n.id}
              onClick={() => openNotice(n)}
            >
              <span className={!n.read ? "impact-dot" : "read-dot"} />
              <span className="icon-tile">
                <Icon name={n.kind === "deadline" ? "calendar" : "notices"} />
              </span>
              <span className="grow">
                <span className="eyebrow">{n.kind}</span>
                <strong>{n.title}</strong>
                <small>{n.source}</small>
                <span className="notice-matters">
                  {n.matterIds.map((id) => (
                    <Chip key={id}>{nameOf(id)}</Chip>
                  ))}
                </span>
              </span>
              <span className="notice-time">
                <small>{date(n.createdAt)}</small>
                <span>{n.kind === "ruling" ? "View impact" : "Open"} →</span>
              </span>
            </button>
          ))}
          {!items.length && <Empty text="You're all caught up." />}
        </div>
      </Card>
    </>
  );
}
