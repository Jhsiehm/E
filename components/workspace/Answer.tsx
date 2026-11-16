"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import type { Message } from "@/lib/mock/data";
import { Chip, Foot } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";

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
            .filter((s) => s.verified)
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
const HEADINGS = new Set([
  "Points against",
  "Before you rely on this",
  "Recommended next step",
]);

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
        <Chip tone={msg.mode === "model" ? "olive" : ""}>
          {msg.mode === "model"
            ? "Checked against sources"
            : msg.mode === "extractive"
              ? "Quoted passages only"
              : "Simulated answer"}
        </Chip>
      </div>
      <p className="eyebrow rose-text">Short answer</p>
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
