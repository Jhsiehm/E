"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Icon from "./Icon";
import ResearchProgress from "./ResearchProgress";
import {
  disclaimer,
  TODAY,
  sources as sampleSources,
  type State,
  type Matter,
  type Deadline,
  type Doc,
  type Notice,
  type Message,
  type Agent,
} from "@/lib/mock/data";
const nav = [
  ["", "Dashboard", "dashboard"],
  ["matters", "Matters", "matters"],
  ["agents", "Agents", "agents"],
  ["precedents", "Precedents", "precedents"],
  ["notices", "Notices", "notices"],
  ["calendar", "Calendar", "calendar"],
  ["documents", "Documents", "documents"],
  ["settings/profile", "Settings", "settings"],
];
const areas = [
  "Civil litigation",
  "Corporate",
  "Trust and estate",
  "Consumer and class action",
  "Employment",
  "Civil rights",
  "Regulatory",
  "International",
  "Contracts",
];
const date = (s: string) =>
  new Date(s.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const label = (s: string) =>
  s.replaceAll("_", " ").replace(/^./, (x) => x.toUpperCase());
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Chip({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return <span className={"chip " + tone}>{children}</span>;
}
function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"card " + className}>
      {title && (
        <div className="card-head">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
function Foot() {
  return (
    <p className="disclaimer">
      {disclaimer} <span>Sample data shown.</span>
    </p>
  );
}
function Empty({
  text = "No results match these filters.",
  onClear,
}: {
  text?: string;
  onClear?: () => void;
}) {
  return (
    <div className="empty">
      <Icon name="search" size={30} />
      <h3>{text}</h3>
      {onClear && <button onClick={onClear}>Clear filters</button>}
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
  drawer = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={drawer ? "drawer" : ""}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Filter({
  name,
  options,
  title,
}: {
  name: string;
  options: string[];
  title: string;
}) {
  const params = useSearchParams(),
    pathname = usePathname(),
    router = useRouter();
  return (
    <select
      aria-label={title}
      value={params.get(name) || ""}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        if (e.target.value) next.set(name, e.target.value);
        else next.delete(name);
        router.replace(pathname + (next.size ? "?" + next.toString() : ""), {
          scroll: false,
        });
      }}
    >
      <option value="">{title}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {label(o)}
        </option>
      ))}
    </select>
  );
}
function Search({ placeholder }: { placeholder: string }) {
  const params = useSearchParams(),
    pathname = usePathname(),
    router = useRouter();
  const query = params.get("q") || "";
  const [value, setValue] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setValue(query);
  }, [query]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="search-field">
      <Icon name="search" />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (timer.current) clearTimeout(timer.current);
          const text = e.target.value;
          timer.current = setTimeout(() => {
            const next = new URLSearchParams(params);
            if (text) next.set("q", text);
            else next.delete("q");
            router.replace(
              pathname + (next.size ? "?" + next.toString() : ""),
              { scroll: false },
            );
          }, 180);
        }}
      />
    </div>
  );
}

type WorkspaceContextValue = {
  data: State;
  matter: Matter | undefined;
  page: string;
  unread: number;
  open: (name: string, id?: string) => void;
  nameOf: (id: string) => string;
  hasImpact: (id: string) => boolean;
  openNotice: (n: Notice) => Promise<void>;
  params: ReturnType<typeof useSearchParams>;
  query: (key: string, value: string) => void;
  clear: () => void;
};
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const Header = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) => {
  const { page, open, unread } = useContext(WorkspaceContext)!;
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

const DeadlineList = ({ items }: { items: Deadline[] }) => {
  const { open, nameOf } = useContext(WorkspaceContext)!;
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

const Ruling = ({ compact = false }: { compact?: boolean }) => {
  const { matter, openNotice, data } = useContext(WorkspaceContext)!;
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

const MatterList = ({ items }: { items: Matter[] }) => {
  const { hasImpact } = useContext(WorkspaceContext)!;
  return (
    <div className="scroll list">
      {items.map((m) => (
        <Link className="list-row" href={"/matters/" + m.id} key={m.id}>
          <Icon name="matters" />
          <span className="grow">
            <span className="matter-name">{m.name}</span>
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

const DocumentTable = ({ items }: { items: Doc[] }) => {
  const { params, query, open, nameOf, clear } = useContext(WorkspaceContext)!;
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

const sourcesFor = (msg: Message) => (
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

const Answer = ({ msg }: { msg: Message }) => {
  const { data, matter } = useContext(WorkspaceContext)!;
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
export default function Workspace() {
  const pathname = usePathname(),
    router = useRouter(),
    params = useSearchParams();
  const parts = pathname.split("/").filter(Boolean);
  const page = parts[0] || "dashboard",
    sub = parts[2] || "overview";
  const [data, setData] = useState<State | null>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState(""),
    [droppedFile, setDroppedFile] = useState<File | null>(null),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [question, setQuestion] = useState(""),
    [practice, setPractice] = useState("Civil litigation"),
    [analysis, setAnalysis] = useState("Recommended approach"),
    [editing, setEditing] = useState(false),
    [summary, setSummary] = useState(""),
    [chatText, setChatText] = useState(""),
    [stream, setStream] = useState<Message | null>(null),
    [reading, setReading] = useState(false),
    [month, setMonth] = useState("2026-11"),
    [profile, setProfile] = useState<State["me"] | null>(null),
    [strategy, setStrategy] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null),
    sending = useRef(false),
    alive = useRef(true),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    routeRef = useRef(pathname);
  routeRef.current = pathname;
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/bootstrap");
      if (!res.ok) throw Error();
      const d = await res.json();
      setData(d);
      setError("");
      return d as State;
    } catch {
      setError("We could not load this. Try again.");
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);
  useEffect(() => {
    setModal("");
    setEditing(false);
    setStream(null);
  }, [pathname]);
  useEffect(() => {
    if (data && !profile) setProfile(data.me);
  }, [data, profile]);
  const matter = data?.matters.find((m) => m.id === parts[1]);
  useEffect(() => {
    setStrategy(data?.strategies[parts[1]] || "");
  }, [parts[1], data?.strategies]);
  useEffect(() => {
    const thread = chatEnd.current?.parentElement;
    thread?.scrollTo({
      top: thread.scrollHeight,
      behavior: reading ? "instant" : "smooth",
    });
  }, [stream, reading, data?.chats]);
  const mutate = async (path: string, body: unknown, method = "POST") => {
    setBusy(true);
    try {
      const res = await fetch("/api/" + path, {
        method,
        headers:
          body instanceof FormData
            ? undefined
            : { "Content-Type": "application/json" },
        body:
          method === "DELETE"
            ? undefined
            : body instanceof FormData
              ? body
              : JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw Error(result.error || "Something went wrong");
      await refresh();
      return result;
    } catch (e) {
      notify(e instanceof Error ? e.message : "Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const query = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(pathname + (next.size ? "?" + next.toString() : ""), {
      scroll: false,
    });
  };
  const clear = () => router.replace(pathname, { scroll: false });
  const q = params.get("q") || "";
  const open = (name: string, id = "") => {
    if (name === "upload") setDroppedFile(null);
    setSelected(id);
    setModal(name);
  };
  const submit = async (
    e: FormEvent<HTMLFormElement>,
    path: string,
    method = "POST",
  ) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const r = await mutate(path, body, method);
    if (r) setModal("");
    return r;
  };
  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || sending.current || !matter) return;
      sending.current = true;
      setChatText("");
      setReading(true);
      const location = pathname;
      const user: Message = { id: crypto.randomUUID(), role: "user", text };
      setData((d) =>
        d
          ? {
              ...d,
              chats: {
                ...d.chats,
                [matter.id]: [...(d.chats[matter.id] || []), user],
              },
            }
          : d,
      );
      try {
        const res = await fetch(`/api/matters/${matter.id}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw Error();
        const answer: Message = await res.json();
        await new Promise((r) =>
          setTimeout(
            r,
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? 0
              : 1700,
          ),
        );
        setReading(false);
        const stride = window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches
          ? answer.text.length + 18
          : 18;
        for (let i = 0; i <= answer.text.length + stride; i += stride) {
          if (!alive.current || routeRef.current !== location) break;
          setStream({ ...answer, text: answer.text.slice(0, i) });
          await new Promise((r) => setTimeout(r, 32));
        }
        await refresh();
        setStream(null);
      } catch {
        notify("Message could not be sent. Please retry.");
        await refresh();
      } finally {
        setReading(false);
        sending.current = false;
      }
    },
    [matter, pathname, refresh, notify],
  );
  const prefilled = useRef("");
  useEffect(() => {
    const question = params.get("question");
    if (
      data &&
      matter &&
      sub === "chat" &&
      question &&
      prefilled.current !== question
    ) {
      prefilled.current = question;
      void send(question);
    }
  }, [data, matter, sub, params, send]);
  if (!data)
    return (
      <div className="boot">
        <div className="logo-grid">
          {Array.from({ length: 16 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <h1>Casevex</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button onClick={refresh}>Try again</button>
          </>
        ) : (
          <>
            <p>Opening your workspace</p>
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </>
        )}
      </div>
    );
  const unread = data.notices.filter((n) => !n.read).length;
  const nameOf = (id: string) =>
    data.matters.find((m) => m.id === id)?.name || "Matter";
  const hasImpact = (id: string) =>
    data.notices.some(
      (n) => !n.read && n.kind === "ruling" && n.matterIds.includes(id),
    );

  async function openNotice(n: Notice) {
    setSelected(n.id);
    setModal("notice");
    if (!n.read) await mutate("notices/read", { ids: [n.id] });
  }

  let content: ReactNode;
  if (page === "dashboard")
    content = (
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
                "/matters/anderson/chat?question=" +
                  encodeURIComponent(question),
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
  else if (page === "matters" && !parts[1]) {
    const filtered = data.matters.filter(
      (m) =>
        (m.name + " " + m.docket).toLowerCase().includes(q.toLowerCase()) &&
        (!params.get("status") || m.status === params.get("status")) &&
        (!params.get("type") || m.type === params.get("type")) &&
        (!params.get("scope") || m.role === params.get("scope")),
    );
    content = (
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
                      {
                        data.agents.find((a) => a.id === m.assignedAgentId)
                          ?.name
                      }
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
  } else if (page === "matters" && matter) {
    const documents = data.documents.filter((d) => d.matterId === matter.id),
      deadlines = data.deadlines.filter((d) => d.matterId === matter.id),
      agent = data.agents.find((a) => a.id === matter.assignedAgentId);
    let body: ReactNode;
    if (sub === "overview")
      body = (
        <>
          {hasImpact(matter.id) && <Ruling />}
          <div className="page-body matter-grid">
            <div className="stack">
              <Card
                title="Case summary"
                action={
                  <button
                    className="text-button"
                    onClick={() => {
                      setSummary(matter.summary);
                      setEditing(true);
                    }}
                  >
                    Edit
                  </button>
                }
              >
                {editing ? (
                  <>
                    <textarea
                      aria-label="Case summary"
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                    />
                    <div className="actions">
                      <button onClick={() => setEditing(false)}>Cancel</button>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={async () => {
                          if (
                            await mutate(
                              "matters/" + matter.id,
                              { summary },
                              "PATCH",
                            )
                          )
                            setEditing(false);
                        }}
                      >
                        Save summary
                      </button>
                    </div>
                  </>
                ) : (
                  <p>{matter.summary}</p>
                )}
                <div className="facts">
                  <div>
                    <span className="eyebrow">Role</span>
                    <p>{matter.role}</p>
                  </div>
                  <div>
                    <span className="eyebrow">Next deadline</span>
                    <p>
                      {deadlines[0]
                        ? date(deadlines[0].dueAt)
                        : "Not scheduled"}
                    </p>
                  </div>
                  <div>
                    <span className="eyebrow">Status</span>
                    <p>
                      <Chip tone="olive">{label(matter.status)}</Chip>
                    </p>
                  </div>
                </div>
              </Card>
              <Card title="Casevex analysis" className="grow">
                <div className="tabs analysis-tabs">
                  {[
                    "Recommended approach",
                    "Key authorities",
                    "Risks",
                    "Next steps",
                  ].map((t) => (
                    <button
                      key={t}
                      className={analysis === t ? "active" : ""}
                      onClick={() => setAnalysis(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="analysis-panel scroll">
                  {analysis === "Recommended approach" ? (
                    <>
                      <p>
                        Begin with the disputed facts and the current procedural
                        posture. Review the matter record and identify the
                        evidence supporting each claim.
                      </p>
                      <p>
                        {matter.id === "anderson"
                          ? "The fictional Nexora ruling may inform the trade secret argument. Compare the sample declaration against the proposed standard."
                          : "No matter-specific research has been verified. Add primary authority and supporting documents before drafting."}
                      </p>
                    </>
                  ) : analysis === "Key authorities" ? (
                    <Link href="/precedents">
                      Review saved authorities <Icon name="arrow" size={16} />
                    </Link>
                  ) : analysis === "Risks" ? (
                    <ul>
                      <li>
                        Sample citations and factual assumptions require
                        attorney review.
                      </li>
                      <li>
                        Jurisdiction, procedural posture, and negative treatment
                        have not been checked.
                      </li>
                    </ul>
                  ) : (
                    <ol>
                      <li>Confirm the matter record and key dates.</li>
                      <li>
                        Review controlling authority with the assigned attorney.
                      </li>
                      <li>Update the strategy and prepare the next filing.</li>
                    </ol>
                  )}
                </div>
                <Foot />
              </Card>
            </div>
            <div className="stack">
              <Card
                title="Key deadlines"
                action={
                  <Link href={`/matters/${matter.id}/deadlines`}>
                    View all →
                  </Link>
                }
              >
                <DeadlineList items={deadlines} />
              </Card>
              <Card
                title="Key documents"
                action={
                  <Link href={`/matters/${matter.id}/documents`}>
                    View all →
                  </Link>
                }
              >
                <div className="scroll">
                  {documents.slice(0, 3).map((d) => (
                    <button
                      key={d.id}
                      className="list-row"
                      onClick={() => open("document", d.id)}
                    >
                      <span className={"file-badge " + d.ext}>
                        {d.ext.toUpperCase()}
                      </span>
                      <span>
                        {d.name}
                        <small>{label(d.status)}</small>
                      </span>
                      <Icon name="chevron" size={16} />
                    </button>
                  ))}
                  {!documents.length && (
                    <Empty text="No documents added yet." />
                  )}
                </div>
              </Card>
            </div>
          </div>
        </>
      );
    else if (sub === "chat")
      body = (
        <div className="page-body chat-grid">
          <Card className="chat-card">
            <div className="card-head">
              <div className="agent-title">
                <Icon name="agents" />
                <div>
                  <h3>Casevex {agent?.name.toLowerCase()} agent</h3>
                  <small className="cx-short-hide">
                    Assigned matter agent for {matter.name}
                  </small>
                </div>
              </div>
              <Chip>
                <Icon name="lock" size={12} />
                Demo chat
              </Chip>
            </div>
            <div className="chat-thread scroll" aria-live="polite">
              {(data.chats[matter.id] || []).map((msg) =>
                msg.role === "user" ? (
                  <div key={msg.id} className="user-message">
                    <small>You · JW</small>
                    <p>{msg.text}</p>
                  </div>
                ) : (
                  <Answer key={msg.id} msg={msg} />
                ),
              )}
              {!data.chats[matter.id]?.length && !reading && (
                <Empty text="Start a research conversation for this matter." />
              )}
              {reading && (
                <ResearchProgress
                  sources={matter.id === "anderson" ? sampleSources : []}
                />
              )}
              {stream && <Answer msg={stream} />}
              <div ref={chatEnd} />
            </div>
            <div className="suggestions">
              {[
                "Summarize the new ruling",
                "What should our next filing emphasize?",
                "Draft the argument update",
              ].map((p) => (
                <button
                  key={p}
                  disabled={reading || !!stream}
                  onClick={() => send(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                void send(chatText);
              }}
            >
              <button
                type="button"
                className="icon-button flat"
                aria-label="Attach a document"
                onClick={() => open("upload")}
              >
                <Icon name="upload" />
              </button>
              <textarea
                rows={1}
                aria-label="Message your matter agent"
                placeholder="Message your matter agent"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(chatText);
                  }
                }}
              />
              <button
                className="rose-button icon-button"
                aria-label="Send message"
                disabled={!chatText.trim() || reading || !!stream}
              >
                <Icon name="send" />
              </button>
            </form>
            <Foot />
          </Card>
          <aside className="stack chat-rail">
            <Card title="Assigned agent">
              <div className="agent-title">
                <Icon name="agents" />
                <div>
                  <b>Casevex {agent?.name} agent</b>
                  <small>{agent?.practiceArea}</small>
                </div>
              </div>
              <button
                className="text-button"
                onClick={() => router.push("/agents")}
              >
                Change agent →
              </button>
            </Card>
            {["anderson", "ridgeway"].includes(matter.id) && <Ruling compact />}
            {deadlines[0] && (
              <div className="next-deadline">
                <p className="eyebrow">Next deadline</p>
                <p>
                  <span className="numeral">
                    {Math.round(
                      (Date.parse(deadlines[0].dueAt) - Date.parse(TODAY)) /
                        86400000,
                    )}
                  </span>{" "}
                  days
                </p>
                <p>
                  {date(deadlines[0].dueAt)} · {deadlines[0].title}
                </p>
              </div>
            )}
            <Card title="Quick actions">
              <Link
                className="list-row"
                href={`/matters/${matter.id}/strategy`}
              >
                <Icon name="edit" />
                Update strategy <Icon name="chevron" size={16} />
              </Link>
              <Link className="list-row" href="/precedents">
                <Icon name="precedents" />
                Open cited authority <Icon name="chevron" size={16} />
              </Link>
              <button
                className="list-row"
                onClick={() =>
                  download(
                    "casevex-chat-memo.txt",
                    `CASEVEX PROTOTYPE | ${matter.name}\n\n${(data.chats[matter.id] || []).map((m) => m.role.toUpperCase() + ": " + m.text).join("\n\n")}\n\n${disclaimer}`,
                  )
                }
              >
                <Icon name="documents" />
                Export chat to memo
              </button>
            </Card>
          </aside>
        </div>
      );
    else if (sub === "documents")
      body = (
        <Card
          className="page-body"
          title="Matter documents"
          action={
            <button onClick={() => open("upload")}>
              <Icon name="upload" />
              Upload document
            </button>
          }
        >
          <DocumentTable items={documents} />
        </Card>
      );
    else if (sub === "deadlines")
      body = (
        <Card
          className="page-body"
          title="Matter deadlines"
          action={<button onClick={() => open("event")}>Add event</button>}
        >
          <DeadlineList items={deadlines} />
        </Card>
      );
    else if (sub === "notices")
      body = (
        <Card className="page-body" title="Matter notices">
          <div className="scroll">
            {data.notices
              .filter((n) => n.matterIds.includes(matter.id))
              .map((n) => (
                <button
                  className="list-row"
                  key={n.id}
                  onClick={() => openNotice(n)}
                >
                  <Icon name="notices" />
                  <span className="grow">
                    {n.title}
                    <small>{n.source}</small>
                  </span>
                  <Chip>{n.read ? "Read" : "Unread"}</Chip>
                </button>
              ))}
          </div>
        </Card>
      );
    else if (sub === "strategy")
      body = (
        <Card className="page-body" title="Case strategy">
          <p>
            Build the working strategy with your team. This prototype saves
            notes for this demo session.
          </p>
          <textarea
            className="strategy-editor"
            aria-label="Case strategy"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            placeholder="Objectives, key arguments, evidentiary gaps, and next steps…"
          />
          <div className="actions">
            <button onClick={() => router.push(`/matters/${matter.id}/chat`)}>
              Ask the matter agent
            </button>
            <button
              className="primary"
              disabled={busy || strategy === (data.strategies[matter.id] || "")}
              onClick={async () => {
                if (
                  await mutate(
                    `matters/${matter.id}/strategy`,
                    { text: strategy },
                    "PATCH",
                  )
                )
                  notify("Strategy saved.");
              }}
            >
              Save strategy
            </button>
          </div>
          <Foot />
        </Card>
      );
    else
      body = (
        <Card className="page-body" title="Matter research">
          <p>
            Review the authority library or start a research conversation for
            this matter.
          </p>
          <div className="actions">
            <Link className="button primary" href="/precedents">
              Browse precedents
            </Link>
            <Link className="button" href={`/matters/${matter.id}/chat`}>
              Open agent chat
            </Link>
          </div>
          <Foot />
        </Card>
      );
    content = (
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
            <Link
              className="button primary"
              href={`/matters/${matter.id}/chat`}
            >
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
              {t === "documents" &&
                ` (${matter.documentCount + documents.filter((d) => !d.id.startsWith("doc")).length})`}
              {t === "notices" && hasImpact(matter.id) && (
                <Chip tone="rose">1</Chip>
              )}
            </Link>
          ))}
        </nav>
        {body}
      </>
    );
  } else if (page === "notices") {
    const tab = params.get("tab") || "All";
    const items = data.notices.filter(
      (n) =>
        tab === "All" ||
        (tab === "Unread" && !n.read) ||
        n.kind === tab.toLowerCase().replace(/s$/, ""),
    );
    content = (
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
  } else if (page === "agents") {
    const items = data.agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q.toLowerCase()) &&
        (!params.get("area") || a.practiceArea === params.get("area")) &&
        (!params.get("availability") ||
          a.availability === params.get("availability")),
    );
    content = (
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
            options={["available", "at_capacity"]}
          />
        </div>
        <p className="eyebrow">
          {items.length} agents · Prototype capabilities
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
                <span className="verified">
                  <i className="square" />
                  Available
                </span>
              </div>
              <button onClick={() => open("agent", a.id)}>
                Add agent <Icon name="plus" size={16} />
              </button>
            </Card>
          ))}
          {!items.length && <Empty onClear={clear} />}
        </div>
      </>
    );
  } else if (page === "precedents") {
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
    content = (
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
              <p className="eyebrow">
                Saved authority · {items.length} results
              </p>
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
  } else if (page === "documents") {
    const items = data.documents.filter(
      (d) =>
        d.name.toLowerCase().includes(q.toLowerCase()) &&
        (!params.get("matterId") || d.matterId === params.get("matterId")) &&
        (!params.get("type") || d.type === params.get("type")),
    );
    content = (
      <>
        <Header
          title="Documents"
          subtitle="All legal documents across your matters."
          action={
            <button className="primary" onClick={() => open("upload")}>
              <Icon name="upload" />
              Upload document
            </button>
          }
        />
        <div className="filters">
          <Search placeholder="Search documents…" />
          <select
            aria-label="Filter by matter"
            value={params.get("matterId") || ""}
            onChange={(e) => query("matterId", e.target.value)}
          >
            <option value="">All matters</option>
            {data.matters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <Filter
            name="type"
            title="All types"
            options={[...new Set(data.documents.map((d) => d.type))]}
          />
        </div>
        <Card className="page-body">
          <DocumentTable items={items} />
        </Card>
        <button
          className="dropzone"
          onClick={() => open("upload")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files.length) {
              open("upload");
              setDroppedFile(files[0]);
            }
          }}
        >
          <Icon name="upload" />
          <span>
            Upload a document to your workspace{" "}
            <small>
              PDF or DOCX · Up to 20 MB · Metadata only in this prototype
            </small>
          </span>
        </button>
      </>
    );
  } else if (page === "calendar") {
    const [year, mon] = month.split("-").map(Number);
    const first = new Date(year, mon - 1, 1).getDay(),
      days = new Date(year, mon, 0).getDate();
    const title = new Date(year, mon - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const changeMonth = (offset: number) => {
      const d = new Date(year, mon - 1 + offset, 1);
      setMonth(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      );
    };
    const inMonth = data.deadlines.filter((d) => d.dueAt.startsWith(month));
    content = (
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
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (d) => (
                      <span key={d}>{d}</span>
                    ),
                  )}
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
  } else if (page === "settings") {
    const section = parts[1] || "profile";
    content = (
      <>
        <Header
          title="Settings"
          subtitle="Manage your account, workspace, and preferences."
        />
        <div className="tabs">
          {[
            "profile",
            "workspace",
            "notifications",
            "integrations",
            "security",
          ].map((t) => (
            <Link
              key={t}
              href={"/settings/" + t}
              className={section === t ? "active" : ""}
            >
              {label(t)}
            </Link>
          ))}
        </div>
        {section === "profile" && profile ? (
          <Card className="page-body settings-card" title="Profile">
            <form
              className="profile-form scroll"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await mutate("me", profile, "PATCH"))
                  notify("Profile saved.");
              }}
            >
              <div className="motion-preview-link">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => open("motion")}
                >
                  Preview research animation <Icon name="arrow" size={16} />
                </button>
                <small>Adapted from your phone prototype</small>
              </div>
              <div className="profile-avatar">
                <span className="avatar large">
                  {profile.name
                    .split(" ")
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <span>
                  <b>Your account</b>
                  <small>
                    Demo profile · Changes last for this server session
                  </small>
                </span>
              </div>
              <div className="form-grid">
                <label>
                  Full name
                  <input
                    required
                    value={profile.name}
                    onChange={(e) =>
                      setProfile({ ...profile, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Role
                  <select
                    value={profile.role}
                    onChange={(e) =>
                      setProfile({ ...profile, role: e.target.value })
                    }
                  >
                    {["Partner", "Associate", "Paralegal", "Admin"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  Email
                  <input
                    type="email"
                    required
                    value={profile.email}
                    onChange={(e) =>
                      setProfile({ ...profile, email: e.target.value })
                    }
                  />
                </label>
                <div className="full">
                  <label>Display</label>
                  <div className="segmented">
                    {["light", "dark"].map((t) => (
                      <button
                        type="button"
                        key={t}
                        className={profile.theme === t ? "selected" : ""}
                        onClick={() => {
                          setProfile({ ...profile, theme: t });
                          if (t === "dark")
                            notify(
                              "Dark preference saved on submit. Dark styling is planned.",
                            );
                        }}
                      >
                        {label(t)}
                      </button>
                    ))}
                  </div>
                </div>
                <label>
                  Default practice area
                  <select
                    value={profile.defaultPracticeArea}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        defaultPracticeArea: e.target.value,
                      })
                    }
                  >
                    {areas.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Time zone
                  <select
                    value={profile.timeZone}
                    onChange={(e) =>
                      setProfile({ ...profile, timeZone: e.target.value })
                    }
                  >
                    {[
                      "America/New_York",
                      "America/Chicago",
                      "America/Denver",
                      "America/Los_Angeles",
                      "Europe/London",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-footer">
                <button type="button" onClick={() => setProfile(data.me)}>
                  Cancel
                </button>
                <button
                  className="primary"
                  disabled={
                    busy || JSON.stringify(profile) === JSON.stringify(data.me)
                  }
                >
                  Save changes
                </button>
              </div>
            </form>
          </Card>
        ) : (
          <Card className="page-body" title={label(section)}>
            <h2>
              {section === "workspace"
                ? "Wells & Associates"
                : section === "security"
                  ? "Access and security"
                  : section === "integrations"
                    ? "Connected services"
                    : "Notification preferences"}
            </h2>
            <p>
              {section === "workspace"
                ? "A sample workspace for litigation research."
                : section === "security"
                  ? "Authentication, matter permissions, and audit logging are planned for the backend."
                  : section === "integrations"
                    ? "Court feeds, document storage, and calendar connections are not connected in this prototype."
                    : "Email, in-app alerts, and digest delivery will be configurable in the production app."}
            </p>
            <Chip>Planned for backend</Chip>
            <p>
              See the backend plan in the repository for scope, data contracts,
              and implementation phases.
            </p>
            {section === "workspace" && (
              <button
                onClick={async () => {
                  if (await mutate("reset", {})) {
                    setProfile(null);
                    notify("Demo workspace reset.");
                  }
                }}
              >
                Reset demo data
              </button>
            )}
          </Card>
        )}
      </>
    );
  } else
    content = (
      <>
        <Header
          title="Page not found"
          subtitle="This matter or page does not exist in this demo."
        />
        <Link className="button" href="/">
          Return to dashboard
        </Link>
      </>
    );
  return (
    <WorkspaceContext.Provider
      value={{
        data,
        matter,
        page,
        unread,
        open,
        nameOf,
        hasImpact,
        openNotice,
        params,
        query,
        clear,
      }}
    >
      <div className="app-shell">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <aside className="sidebar">
          <Link href="/" className="brand">
            <span className="logo-grid">
              {Array.from({ length: 16 }, (_, i) => (
                <i key={i} />
              ))}
            </span>
            Casevex
          </Link>
          <nav className="main-nav" aria-label="Primary">
            {nav.map(([href, title, icon]) => (
              <Link
                key={title}
                href={"/" + href}
                className={
                  (
                    href === ""
                      ? page === "dashboard"
                      : page === href.split("/")[0]
                  )
                    ? "active"
                    : ""
                }
                aria-current={
                  (
                    href === ""
                      ? page === "dashboard"
                      : page === href.split("/")[0]
                  )
                    ? "page"
                    : undefined
                }
              >
                <Icon name={icon} />
                {title}
                {title === "Notices" && unread > 0 && (
                  <span className="nav-count">{unread}</span>
                )}
              </Link>
            ))}
          </nav>
          <div className="sidebar-matters">
            <p className="eyebrow">Active matters</p>
            <div className="scroll">
              {data.matters.map((m) => (
                <Link
                  key={m.id}
                  href={"/matters/" + m.id}
                  className={matter?.id === m.id ? "selected" : ""}
                >
                  <Icon name="matters" size={15} />
                  <span>{m.name}</span>
                  {hasImpact(m.id) && <i className="impact-dot" />}
                </Link>
              ))}
            </div>
          </div>
          <Link className="user-block" href="/settings/profile">
            <span className="avatar">
              {data.me.name
                .split(" ")
                .map((s) => s[0])
                .join("")
                .slice(0, 2)}
            </span>
            <span className="grow">
              {data.me.name}
              <small>{data.me.role}</small>
            </span>
            <span>⌄</span>
          </Link>
        </aside>
        <main id="main" tabIndex={-1}>
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button onClick={refresh}>Try again</button>
            </div>
          )}
          {content}
        </main>
        {toast && (
          <div className="toast" role="status">
            {toast}
            <button
              className="icon-button flat"
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {modal && (
          <Modal
            title={
              (
                {
                  matter: "New matter",
                  upload: "Upload document",
                  event: "Add event",
                  notice: "Notice details",
                  document: "Document details",
                  precedent: "Add precedent",
                  agent: "Assign agent",
                  share: "Share matter",
                  "matter-actions": "Matter actions",
                  search: "Search your authority library",
                  "event-detail": "Event details",
                  motion: "Research motion",
                } as Record<string, string>
              )[modal] || modal
            }
            onClose={() => setModal("")}
            drawer={modal === "notice"}
          >
            {modal === "matter" && (
              <form
                onSubmit={async (e) => {
                  const r = await submit(e, "matters");
                  if (r) router.push("/matters/" + r.id);
                }}
              >
                <label>
                  Matter name
                  <input
                    autoFocus
                    name="name"
                    required
                    placeholder="Client v. Respondent"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Docket
                    <input name="docket" placeholder="No. 1:26-cv-…" />
                  </label>
                  <label>
                    Court
                    <input name="court" required placeholder="S.D.N.Y." />
                  </label>
                  <label>
                    Type
                    <select name="type">
                      {areas.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Role
                    <select name="role">
                      {["Plaintiff", "Defendant", "Other"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Assigned agent
                  <select name="assignedAgentId">
                    {data.agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Case summary
                  <textarea
                    name="summary"
                    placeholder="What is this matter about?"
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Create matter
                </button>
              </form>
            )}
            {modal === "upload" && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  if (droppedFile) form.set("file", droppedFile);
                  if (await mutate("documents", form)) {
                    setModal("");
                    notify(
                      "Document metadata added. File content is not stored in this prototype.",
                    );
                  }
                }}
              >
                <p>
                  Record a PDF or DOCX in a matter. File contents are not
                  retained or analyzed in this demo.
                </p>
                <label>
                  Matter
                  <select
                    name="matterId"
                    defaultValue={
                      matter?.id || params.get("matterId") || "anderson"
                    }
                  >
                    {data.matters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Document
                  {droppedFile ? (
                    <div className="demo-note">
                      {droppedFile.name}
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setDroppedFile(null)}
                      >
                        Choose a different file
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      name="file"
                      required
                      accept=".pdf,.docx"
                    />
                  )}
                </label>
                <small>Maximum 20 MB</small>
                <button className="primary" disabled={busy}>
                  Add document metadata
                </button>
              </form>
            )}
            {modal === "event" && (
              <form
                onSubmit={async (e) => {
                  if (await submit(e, "deadlines")) notify("Event added.");
                }}
              >
                <label>
                  Title
                  <input name="title" required autoFocus />
                </label>
                <label>
                  Matter
                  <select
                    name="matterId"
                    defaultValue={matter?.id || "anderson"}
                  >
                    {data.matters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid">
                  <label>
                    Date
                    <input
                      type="date"
                      name="dueAt"
                      required
                      defaultValue={TODAY}
                    />
                  </label>
                  <label>
                    Kind
                    <select name="kind">
                      <option>deadline</option>
                      <option>hearing</option>
                      <option>meeting</option>
                    </select>
                  </label>
                </div>
                <button className="primary" disabled={busy}>
                  Add event
                </button>
              </form>
            )}
            {modal === "event-detail" &&
              (() => {
                const d = data.deadlines.find((x) => x.id === selected);
                return (
                  d && (
                    <>
                      <Chip>{label(d.kind)}</Chip>
                      <h2>{d.title}</h2>
                      <p>{date(d.dueAt)}</p>
                      <Link
                        className="button primary"
                        href={"/matters/" + d.matterId}
                      >
                        {nameOf(d.matterId)} <Icon name="arrow" />
                      </Link>
                      <p className="disclaimer">
                        Sample date. Verify against the applicable order and
                        docket.
                      </p>
                    </>
                  )
                );
              })()}
            {modal === "notice" &&
              (() => {
                const n = data.notices.find((x) => x.id === selected);
                return (
                  n && (
                    <>
                      <p className="eyebrow">
                        {n.kind} · {date(n.createdAt)}
                      </p>
                      <h2>{n.title}</h2>
                      <p className="muted">{n.source}</p>
                      <p>{n.detail}</p>
                      <h3>Affected matters</h3>
                      {n.matterIds.map((id) => (
                        <Link
                          className="impact-card"
                          href={"/matters/" + id}
                          key={id}
                        >
                          <b>{nameOf(id)}</b>
                          {n.id === "n1" && (
                            <>
                              <Chip tone={id === "anderson" ? "olive" : "rose"}>
                                {id === "anderson" ? "Strengthens" : "Weakens"}{" "}
                                · Sample
                              </Chip>
                              <p>
                                {id === "anderson"
                                  ? "A broader confidential-information standard may support the sample claim."
                                  : "A broader standard may create additional exposure under the sample facts."}
                              </p>
                            </>
                          )}
                          <span>Open matter →</span>
                        </Link>
                      ))}
                      <Foot />
                    </>
                  )
                );
              })()}
            {modal === "precedent" && (
              <form
                onSubmit={async (e) => {
                  if (await submit(e, "precedents"))
                    notify("Authority added for verification.");
                }}
              >
                <p>
                  Add an authority to the review queue. No citation is verified
                  automatically in this prototype.
                </p>
                <label>
                  Case name
                  <input name="caseName" required autoFocus />
                </label>
                <label>
                  Citation
                  <input
                    name="citation"
                    required
                    placeholder="910 F.3d 633 (2d Cir. 2018)"
                  />
                </label>
                <label>
                  Court
                  <input name="court" />
                </label>
                <button className="primary" disabled={busy}>
                  Add to library
                </button>
              </form>
            )}
            {modal === "agent" && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  if (
                    await mutate(
                      "agents/" + selected,
                      { matterIds: form.getAll("matterIds") },
                      "PATCH",
                    )
                  ) {
                    setModal("");
                    notify("Agent assignments updated.");
                  }
                }}
              >
                <p>
                  Assign the Casevex{" "}
                  {data.agents
                    .find((a) => a.id === selected)
                    ?.name.toLowerCase()}{" "}
                  agent to selected matters.
                </p>
                {data.matters.map((m) => (
                  <label className="checkbox-label" key={m.id}>
                    <input
                      type="checkbox"
                      name="matterIds"
                      value={m.id}
                      defaultChecked={m.assignedAgentId === selected}
                    />
                    {m.name}
                  </label>
                ))}
                <small>
                  Checked matters are assigned to this agent. Unchecked matters
                  retain their current agent.
                </small>
                <button className="primary" disabled={busy}>
                  Save assignments
                </button>
              </form>
            )}
            {modal === "share" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setModal("");
                  notify(
                    "Demo only: sharing preview completed. No invitation was sent.",
                  );
                }}
              >
                <p>
                  Preview a matter invitation. No email is sent and no access is
                  granted.
                </p>
                <label>
                  Email
                  <input type="email" required name="email" />
                </label>
                <label>
                  Access
                  <select>
                    <option>Can view</option>
                    <option>Can edit</option>
                  </select>
                </label>
                <button className="primary">Preview invitation</button>
              </form>
            )}
            {modal === "matter-actions" && matter && (
              <div className="menu-actions">
                <button
                  onClick={async () => {
                    if (
                      await mutate(
                        "matters/" + matter.id,
                        {
                          status:
                            matter.status === "archived"
                              ? "active"
                              : "archived",
                        },
                        "PATCH",
                      )
                    ) {
                      setModal("");
                      notify("Matter status updated.");
                    }
                  }}
                >
                  {matter.status === "archived" ? "Restore" : "Archive"} matter
                </button>
                <button
                  onClick={async () => {
                    const result = await mutate("matters", {
                      ...matter,
                      name: matter.name + " (copy)",
                    });
                    if (result) {
                      setModal("");
                      router.push("/matters/" + result.id);
                    }
                  }}
                >
                  Duplicate matter
                </button>
                <button
                  onClick={() => {
                    download(
                      "matter-summary.txt",
                      `${matter.name}\n${matter.docket} | ${matter.court}\n\n${matter.summary}\n\n${disclaimer}`,
                    );
                    setModal("");
                  }}
                >
                  Export summary
                </button>
              </div>
            )}
            {modal === "document" &&
              (() => {
                const d = data.documents.find((d) => d.id === selected);
                return (
                  d && (
                    <>
                      <Chip>
                        {d.ext.toUpperCase()} · {label(d.status)}
                      </Chip>
                      <h2>{d.name}</h2>
                      <p>
                        {nameOf(d.matterId)} ·{" "}
                        {(d.sizeBytes / 1000000).toFixed(2)} MB
                      </p>
                      <p className="demo-note">
                        Document metadata preview. No original file or document
                        text is stored.
                      </p>
                      <form
                        onSubmit={async (e) => {
                          if (await submit(e, "documents/" + d.id, "PATCH"))
                            notify("Document updated.");
                        }}
                      >
                        <label>
                          Name
                          <input name="name" required defaultValue={d.name} />
                        </label>
                        <label>
                          Move to matter
                          <select name="matterId" defaultValue={d.matterId}>
                            {data.matters.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="actions">
                          <button disabled={busy} className="primary">
                            Save changes
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              download(
                                d.name + "-metadata.txt",
                                `SAMPLE METADATA ONLY\nName: ${d.name}\nMatter: ${nameOf(d.matterId)}\nType: ${d.ext}\nStatus: ${d.status}\nNo file content is stored.`,
                              )
                            }
                          >
                            Export metadata
                          </button>
                        </div>
                      </form>
                      <details className="delete-confirm">
                        <summary>Delete document</summary>
                        <p>Remove this document record from the demo?</p>
                        <button
                          className="rose-button"
                          disabled={busy}
                          onClick={async () => {
                            if (
                              await mutate("documents/" + d.id, {}, "DELETE")
                            ) {
                              setModal("");
                              notify("Document record deleted.");
                            }
                          }}
                        >
                          Confirm delete
                        </button>
                      </details>
                    </>
                  )
                );
              })()}
            {modal === "motion" && (
              <>
                <p>
                  The source-by-source animation imported from your phone
                  prototype, adapted to the Casevex research workspace.
                </p>
                <ResearchProgress key={selected} sources={sampleSources} />
                <div className="actions">
                  <button onClick={() => setSelected(crypto.randomUUID())}>
                    Replay animation
                  </button>
                  <Link
                    className="button primary"
                    href="/matters/anderson/chat"
                  >
                    Try in agent chat
                  </Link>
                </div>
                <Foot />
              </>
            )}
            {modal === "search" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = new FormData(e.currentTarget).get("q");
                  setModal("");
                  router.push("/precedents?q=" + encodeURIComponent(String(v)));
                }}
              >
                <label>
                  Search cases, citations, or topics
                  <input
                    name="q"
                    autoFocus
                    required
                    placeholder="Trade secrets, arbitration…"
                  />
                </label>
                <button className="primary">Search precedents</button>
              </form>
            )}
          </Modal>
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
