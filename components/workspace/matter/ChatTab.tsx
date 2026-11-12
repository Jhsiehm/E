"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import ResearchProgress from "@/components/ResearchProgress";
import { disclaimer, TODAY } from "@/lib/mock/data";
import { sources as sampleSources } from "@/lib/mock/data";
import { date, download } from "@/components/workspace/format";
import { Chip, Card, Foot, Empty } from "@/components/workspace/ui";
import { Ruling, Answer } from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";
import { useMatterScope } from "@/components/workspace/matter/useMatterScope";

/** Matter agent chat with research progress and answers. */
export default function ChatTab() {
  const {
    router,
    data,
    chatText,
    setChatText,
    stream,
    reading,
    chatEnd,
    open,
    send,
  } = useWorkspace();
  const { matter, deadlines, agent } = useMatterScope();
  return (
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
          <Link className="list-row" href={`/matters/${matter.id}/strategy`}>
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
}
