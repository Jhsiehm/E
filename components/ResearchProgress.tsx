"use client";
import { useEffect, useState } from "react";
import type { Source } from "@/lib/mock/data";
/** The phone reference's row-per-source motif, explicitly simulated until a verifier exists. */
export default function ResearchProgress({
  sources,
  completed = false,
}: {
  sources: Source[];
  completed?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = Math.min(sources.length, 4);
  useEffect(() => {
    const visibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useEffect(() => {
    if (paused || !count) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      setStep(count * 4);
      return;
    }
    const timer = setInterval(
      () => setStep((s) => Math.min(s + 1, count * 4)),
      120,
    );
    return () => clearInterval(timer);
  }, [count, paused]);
  const current = completed ? count * 4 : step,
    done = Math.min(count, Math.floor(current / 4));
  return (
    <div
      className={"research-progress " + (paused ? "motion-paused" : "")}
      role="status"
      aria-live="polite"
    >
      <div className="research-progress-top">
        <div className="source-grid" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => {
            const row = Math.floor(i / 4);
            const state =
              row >= count
                ? "unused"
                : row < done
                  ? "complete"
                  : i < current
                    ? "reading"
                    : "waiting";
            return (
              <span
                key={i}
                className={"source-cell " + state}
                style={{ animationDelay: `-${i * 0.16}s` }}
              />
            );
          })}
        </div>
        <div>
          <div className="source-count">
            {done}
            <span>/{count}</span>
          </div>
          <p>sample sources reviewed</p>
          <small>Simulated verification</small>
        </div>
      </div>
      <div className="reading-source">
        <span className="eyebrow">
          {count
            ? done === count
              ? "Sample review complete"
              : `Reading ${done + 1} of ${count}`
            : "Preparing your demo response"}
        </span>
        <p>
          {sources[Math.min(done, count - 1)]?.title ||
            "No primary sources attached"}
        </p>
        <small>
          {sources[Math.min(done, count - 1)]?.meta ||
            "Add sources before relying on a research answer."}
        </small>
      </div>
    </div>
  );
}
