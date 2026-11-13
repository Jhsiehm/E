"use client";
import Icon from "@/components/Icon";
import { useWorkspace } from "@/components/workspace/context";
import { startTour } from "@/components/workspace/tour/Tour";

/**
 * First thing a new account sees: an empty workspace, with a way to add a
 * real matter or, in the demo, to practise on made-up sample cases.
 */
export default function WelcomeCard() {
  const { data, open, mutate, busy } = useWorkspace();
  if (data.matters.length > 0) return null;
  return (
    <section className="welcome-card" aria-labelledby="welcome-title">
      <h2 id="welcome-title">Your workspace is ready</h2>
      <p>
        Nothing is here yet. Start by adding your first matter. Its documents,
        deadlines and research will live inside it.
      </p>
      <div className="actions">
        <button className="primary" onClick={() => open("matter")}>
          <Icon name="plus" />
          Add your first matter
        </button>
        {data.samples === "off" && (
          <button
            disabled={busy}
            onClick={async () => {
              if (await mutate("samples", {})) startTour();
            }}
          >
            Take the guided tour
          </button>
        )}
      </div>
      {data.samples === "off" && (
        <small>
          The tour takes about two minutes. It adds five made-up sample matters
          to practise on, clearly labelled, and walks you through them. You can
          stop at any time and remove them with one click.
        </small>
      )}
    </section>
  );
}
