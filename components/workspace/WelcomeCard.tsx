"use client";
import Icon from "@/components/Icon";
import { useWorkspace } from "@/components/workspace/context";

/**
 * First thing a new account sees: an empty workspace, with a way to add a
 * real matter or, in the demo, to practise on made-up sample cases.
 */
export default function WelcomeCard() {
  const { data, open, mutate, notify, busy } = useWorkspace();
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
              if (await mutate("samples", {}))
                notify("Five sample cases added. Remove them any time.");
            }}
          >
            Practice with sample cases
          </button>
        )}
      </div>
      {data.samples === "off" && (
        <small>
          Sample cases are a guided tour: five made-up matters with documents,
          deadlines and rulings you can try things on. They are clearly
          labelled, and you can remove them with one click.
        </small>
      )}
    </section>
  );
}
