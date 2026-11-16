"use client";
import { useEffect, useState } from "react";

/**
 * Shown while real research runs. The server does not report its steps yet,
 * so this names what happens and how long it has taken, without pretending
 * to know which step is running.
 */
export default function LiveResearchStatus() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="research-progress" role="status" aria-live="polite">
      <div className="research-progress-top">
        <div className="source-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <span
              key={i}
              className="source-cell reading"
              style={{ animationDelay: `-${i * 0.4}s` }}
            />
          ))}
        </div>
        <div>
          <p>Researching your question</p>
          <small>
            {seconds < 60
              ? `${seconds} second${seconds === 1 ? "" : "s"}`
              : "Still working. Longer questions can take up to a minute."}
          </small>
        </div>
      </div>
      <div className="reading-source">
        <span className="eyebrow">What Casevex is doing</span>
        <p className="live-steps">
          Searching court opinions and statutes, writing a short answer from
          what it finds, then having a second AI check every point against the
          source.
        </p>
      </div>
    </div>
  );
}
