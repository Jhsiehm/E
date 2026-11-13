"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Opening card ported from the phone prototype: a 4x4 mark pops in cell by
 * cell and ripples through the brand colours, two newspaper rules draw
 * across, then the greeting rises and the card fades away.
 *
 * It plays once per browser tab: on a real page load of the workspace or
 * right after signing in. The workspace layout stays mounted across client
 * navigations, so switching tabs never shows it. People who ask their system
 * for reduced motion never see it at all.
 */

const SEEN_KEY = "casevex-intro-seen";
/** Fade starts at 2.4s and lasts 0.5s; unmount just after. */
const UNMOUNT_MS = 3000;

/* Deadline count for the "due" line, published by the workspace once its
   data loads. A tiny external store so the splash can sit outside the
   workspace's Suspense boundary and be painted in the first HTML. */
let dueCount: number | null = null;
const listeners = new Set<() => void>();
export function publishDueThisWeek(n: number) {
  if (n === dueCount) return;
  dueCount = n;
  listeners.forEach((l) => l());
}
function useDueThisWeek() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => dueCount,
    () => null,
  );
}

/** Lets the next workspace load play the intro again (used after sign-in). */
export function replayIntroNextLoad() {
  try {
    sessionStorage.removeItem(SEEN_KEY);
  } catch {}
}

/* Runs while the HTML is parsed, before first paint, so a reload in the same
   tab never flashes the card. */
const SKIP_SCRIPT = `try{if(sessionStorage.getItem("${SEEN_KEY}"))document.documentElement.dataset.intro="seen"}catch(e){}`;

function greetingFor(timeZone?: string) {
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
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function IntroSplash({
  firstName,
  timeZone,
}: {
  firstName?: string;
  timeZone?: string;
}) {
  const [done, setDone] = useState(false);
  const due = useDueThisWeek();
  // Date and time are read on the client only, so server and client agree.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = !!sessionStorage.getItem(SEEN_KEY);
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {}
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (seen || reduced) {
      setDone(true);
      return;
    }
    // A sign-in in this tab cleared the flag; drop any skip mark left on
    // <html> by an earlier page load so the card shows.
    delete document.documentElement.dataset.intro;
    setNow(new Date());
    const t = setTimeout(() => setDone(true), UNMOUNT_MS);
    return () => clearTimeout(t);
  }, []);

  if (done) return null;

  const dateline = now
    ? now
        .toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone,
        })
        .toUpperCase()
    : " ";
  const time = now
    ? now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone,
      })
    : "";
  const dueLine =
    due === null
      ? "Opening your workspace."
      : due === 0
        ? "Nothing due this week."
        : due === 1
          ? "1 deadline this week."
          : `${due} deadlines this week.`;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SKIP_SCRIPT }} />
      <div className="intro paper" aria-hidden="true">
        <div className="intro-inner">
          <div className="intro-mark">
            <svg width="46" height="46" viewBox="0 0 58 58">
              {Array.from({ length: 16 }, (_, i) => {
                const r = Math.floor(i / 4);
                const k = i % 4;
                return (
                  <rect
                    key={i}
                    x={k * 15}
                    y={r * 15}
                    width="13"
                    height="13"
                    rx="2"
                    style={{
                      animationDelay: `${(i * 0.035).toFixed(2)}s, ${((r + k) * 0.11).toFixed(2)}s`,
                    }}
                  />
                );
              })}
            </svg>
          </div>
          <div className="intro-rule" />
          <div className="intro-dateline">
            <span>{dateline}</span>
            <span>{time}</span>
          </div>
          <div className="intro-rule intro-rule-double" />
          <span className="intro-greeting">
            {now
              ? `${greetingFor(timeZone)}${firstName ? `, ${firstName}` : ""}.`
              : "\u00a0"}
          </span>
          <span className="intro-due">{dueLine}</span>
        </div>
      </div>
    </>
  );
}
