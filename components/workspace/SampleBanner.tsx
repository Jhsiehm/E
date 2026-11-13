"use client";
import { useWorkspace } from "@/components/workspace/context";
import { startTour } from "@/components/workspace/tour/Tour";

/**
 * Shown on every screen while the practice sample cases are loaded, so no
 * one mistakes them for real clients, cases or rulings.
 */
export default function SampleBanner() {
  const { data, mutate, notify, busy } = useWorkspace();
  if (data.samples !== "on") return null;
  return (
    <div className="sample-banner" role="note">
      <span>
        <b>You are exploring sample cases.</b> They are made up for practice.
        They are not real clients, cases or court rulings.
      </span>
      <span className="sample-banner-actions">
        <button type="button" onClick={startTour}>
          Take the tour
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (await mutate("samples", {}, "DELETE"))
              notify("Sample cases removed. Your own matters were kept.");
          }}
        >
          Remove sample cases
        </button>
      </span>
    </div>
  );
}
