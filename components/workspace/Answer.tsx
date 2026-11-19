"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import type { Message } from "@/lib/mock/data";
import { Chip, Foot } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";
import { CHAT_HEADINGS } from "@/lib/legal/chat-headings";

type Checks = NonNullable<Message["sources"]>[number]["checks"];
const QUOTE = {
  exact: "Quote matches",
  close: "Quote nearly matches",
  mismatch: "Quote does not match",
  not_quoted: "Not quoted",
} as const;
const SUPPORT = {
  supports: "supports the point",
  partial: "supports it only in part",
  does_not_support: "does not support the point",
  not_checked: "support not checked",
} as const;
/** Each check in words; later treatment is never implied. */
const checkLine = (c: NonNullable<Checks>) =>
  `${QUOTE[c.quote]} · ${SUPPORT[c.support]} · Later treatment not checked`;

/** A research answer in the matter chat, simulated (demo) or real (live). */
export const sourcesFor = (msg: Message) => (
  <>
    {!!msg.sources?.length && (
      <>
        <p className="eyebrow">
          Sources ({msg.sources.length})
          {msg.mode ? "" : " · Simulated verification"}
        </p>
        <div className="sources">
          {msg.sources
            // Demo cards carry a simulated flag; live cards always show
            // and state each check instead.
            .filter((s) => s.checks || s.verified)
            .map((s) => (
              <Link
                id={`${msg.id}-source-${s.index}`}
                className="source"
                key={s.index}
                href={s.href}
                {...(/^https?:/.test(s.href)
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                <span className="square" />
                <span>
                  [{s.index}] {s.title}
                  <small>{s.meta}</small>
                  {s.checks && <small>{checkLine(s.checks)}</small>}
                </span>
                <Icon name="arrow" size={14} />
              </Link>
            ))}
        </div>
      </>
    )}
  </>
);

/** Section labels the live research answer uses (lib/legal/chat-message.ts). */
const HEADINGS = new Set<string>(Object.values(CHAT_HEADINGS));

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
        <Chip
          tone={
            msg.mode === "model" && msg.outcome !== "insufficient"
              ? "olive"
              : ""
          }
        >
          {msg.mode === "model"
            ? msg.outcome === "insufficient"
              ? "No checked conclusion"
              : "Checked against sources"
            : msg.mode === "extractive"
              ? "Quoted passages only"
              : "Simulated answer"}
        </Chip>
      </div>
      <p className="eyebrow rose-text">
        {msg.outcome === "insufficient" ? "What Casevex found" : "Short answer"}
      </p>
      {msg.text.split("\n\n").map((paragraph, i) =>
        HEADINGS.has(paragraph) ? (
          <p key={i} className="eyebrow">
            {paragraph}
          </p>
        ) : (
          <p key={i}>
            {paragraph.split(/(\[\d+\])/g).map((t, j) =>
              /^\[\d+\]$/.test(t) ? (
                <button
                  key={j}
                  className="citation"
                  aria-label={"Jump to source " + t}
                  onClick={() => {
                    const el = document.getElementById(
                      `${msg.id}-source-${t.slice(1, -1)}`,
                    );
                    el?.scrollIntoView({
                      block: "nearest",
                      behavior: "smooth",
                    });
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
        ),
      )}
      {sourcesFor(msg)}
      <Foot />
    </article>
  );
};
