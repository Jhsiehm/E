"use client";
import { useWorkspace } from "@/components/workspace/context";
import { startTour } from "@/components/workspace/tour/Tour";
import { useAccount } from "@/components/account/AccountProvider";
import { signOut } from "@/lib/account/actions";

/**
 * Shown on every screen while the practice sample cases are loaded, so no
 * one mistakes them for real clients, cases or rulings.
 */
export default function SampleBanner() {
  const { data, mutate, notify, busy } = useWorkspace();
  const { prototype } = useAccount();
  if (prototype)
    return (
      <div className="sample-banner" role="note">
        <span>
          <b>Demo workspace.</b> Fictional data and simulated research. Edits
          are temporary; use sample information only. Sample dates are set as of
          Nov 11, 2026.
        </span>
        <div className="sample-banner-actions">
          <button type="button" onClick={startTour}>
            Take the tour
          </button>
          {/* Reload the account and workspace after the route resets demo cookies. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/demo">Restart demo</a>
          <form action={signOut}>
            <button>Exit demo</button>
          </form>
        </div>
      </div>
    );
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
