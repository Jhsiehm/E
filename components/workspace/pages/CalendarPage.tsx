"use client";
import Icon from "@/components/Icon";
import { TODAY } from "@/lib/mock/data";
import { Card } from "@/components/workspace/ui";
import { Header, DeadlineList } from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";

/** Month calendar and deadline list. */
export default function CalendarPage() {
  const { params, data, month, setMonth, query, open } = useWorkspace();
  const [year, mon] = month.split("-").map(Number);
  const first = new Date(year, mon - 1, 1).getDay(),
    days = new Date(year, mon, 0).getDate();
  const title = new Date(year, mon - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const changeMonth = (offset: number) => {
    const d = new Date(year, mon - 1 + offset, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const inMonth = data.deadlines.filter((d) => d.dueAt.startsWith(month));
  return (
    <>
      <Header
        title="Calendar"
        subtitle="Deadlines, hearings, and key dates across your matters."
        action={
          <button className="primary" onClick={() => open("event")}>
            <Icon name="plus" />
            Add event
          </button>
        }
      />
      <div className="calendar-toolbar">
        <div className="actions">
          <button
            className="icon-button"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
          >
            ←
          </button>
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
          >
            →
          </button>
          <button onClick={() => setMonth("2026-11")}>Today</button>
        </div>
        <div className="segmented">
          {["Month", "Agenda"].map((v) => (
            <button
              key={v}
              className={
                (params.get("view") || "Month") === v ? "selected" : ""
              }
              onClick={() => query("view", v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="page-body calendar-layout">
        <Card className="calendar-card">
          {params.get("view") === "Agenda" ? (
            <DeadlineList items={inMonth} />
          ) : (
            <>
              <div className="weekdays">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div
                className="month-grid"
                style={{
                  gridTemplateRows: `repeat(${Math.ceil((first + days) / 7)},minmax(0,1fr))`,
                }}
              >
                {Array.from(
                  { length: Math.ceil((first + days) / 7) * 7 },
                  (_, i) => {
                    const day = i - first + 1,
                      valid = day > 0 && day <= days,
                      ds = `${month}-${String(day).padStart(2, "0")}`;
                    return (
                      <div
                        className={
                          "day " +
                          (!valid ? "outside " : "") +
                          (ds === TODAY ? "today" : "")
                        }
                        key={i}
                      >
                        {valid && (
                          <>
                            <span>{day}</span>
                            {data.deadlines
                              .filter((d) => d.dueAt === ds)
                              .map((d) => (
                                <button
                                  key={d.id}
                                  className="event-chip"
                                  onClick={() => open("event-detail", d.id)}
                                >
                                  {d.title}
                                </button>
                              ))}
                          </>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </>
          )}
        </Card>
        <Card title="Upcoming deadlines">
          <DeadlineList items={data.deadlines} />
        </Card>
      </div>
      <p className="disclaimer">
        Demo calendar anchored to November 11, 2026. Dates are not
        court-calculated.
      </p>
    </>
  );
}
