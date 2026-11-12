"use client";
import { Card, Foot } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";
import { useMatterScope } from "@/components/workspace/matter/useMatterScope";

/** Editable case strategy. */
export default function StrategyTab() {
  const { router, data, busy, strategy, setStrategy, notify, mutate } =
    useWorkspace();
  const { matter } = useMatterScope();
  return (
    <Card className="page-body" title="Case strategy">
      <p>
        Build the working strategy with your team. This prototype saves notes
        for this demo session.
      </p>
      <textarea
        className="strategy-editor"
        aria-label="Case strategy"
        value={strategy}
        onChange={(e) => setStrategy(e.target.value)}
        placeholder="Objectives, key arguments, evidentiary gaps, and next steps…"
      />
      <div className="actions">
        <button onClick={() => router.push(`/matters/${matter.id}/chat`)}>
          Ask the matter agent
        </button>
        <button
          className="primary"
          disabled={busy || strategy === (data.strategies[matter.id] || "")}
          onClick={async () => {
            if (
              await mutate(
                `matters/${matter.id}/strategy`,
                { text: strategy },
                "PATCH",
              )
            )
              notify("Strategy saved.");
          }}
        >
          Save strategy
        </button>
      </div>
      <Foot />
    </Card>
  );
}
