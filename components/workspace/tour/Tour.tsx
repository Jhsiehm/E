"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "@/components/workspace/context";
import { TOUR_STEPS } from "./steps";

const KEY = "casevex-tour-step";
const START = "casevex:tour-start";

/** Opens the guided tour from anywhere (welcome card, sample banner). */
export function startTour() {
  window.dispatchEvent(new Event(START));
}

function saved(): number | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n >= 0 && n < TOUR_STEPS.length ? n : null;
  } catch {
    return null;
  }
}

function save(step: number | null) {
  try {
    if (step === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, String(step));
  } catch {
    /* The tour still works for this visit without storage. */
  }
}

/**
 * A short, skippable walkthrough on the sample cases. Each step opens the
 * screen it talks about and outlines the part to look at; the card sits in
 * a corner so the screen stays usable. It only runs while sample cases are
 * loaded, because its examples live in them.
 */
export default function Tour() {
  const { data, mutate, notify, busy } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<number | null>(null);
  const samplesOn = data.samples === "on";

  const go = useCallback(
    (next: number | null) => {
      setStep(next);
      save(next);
      if (next !== null) router.push(TOUR_STEPS[next].path);
    },
    [router],
  );

  useEffect(() => {
    const resume = saved();
    // Picks up a tour left open before a reload; storage is browser-only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (resume !== null) setStep(resume);
    const onStart = () => go(0);
    window.addEventListener(START, onStart);
    return () => window.removeEventListener(START, onStart);
  }, [go]);

  const current = step === null || !samplesOn ? null : TOUR_STEPS[step];

  useEffect(() => {
    if (!current?.target || pathname !== current.path) return;
    const el = document.querySelector(current.target);
    el?.classList.add("tour-target");
    return () => el?.classList.remove("tour-target");
  }, [current, pathname]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") go(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, go]);

  if (!current || step === null) return null;
  const last = step === TOUR_STEPS.length - 1;
  return (
    <section
      className="tour-card"
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
    >
      <p className="eyebrow" aria-live="polite">
        Guided tour · Step {step + 1} of {TOUR_STEPS.length}
      </p>
      <h2 id="tour-title">{current.title}</h2>
      <p id="tour-body">{current.body}</p>
      <div className="tour-progress" aria-hidden="true">
        {TOUR_STEPS.map((_, i) => (
          <i key={i} className={i <= step ? "on" : ""} />
        ))}
      </div>
      <div className="tour-actions">
        <button type="button" className="flat" onClick={() => go(null)}>
          {last ? "Close" : "Skip tour"}
        </button>
        <span className="grow" />
        {step > 0 && (
          <button type="button" onClick={() => go(step - 1)}>
            Back
          </button>
        )}
        {last ? (
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={async () => {
              go(null);
              if (await mutate("samples", {}, "DELETE"))
                notify(
                  "Sample cases removed. Add your first matter when ready.",
                );
            }}
          >
            Remove sample cases
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            onClick={() => go(step + 1)}
          >
            Next
          </button>
        )}
      </div>
    </section>
  );
}
