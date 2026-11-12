"use client";
import { useWorkspace } from "@/components/workspace/context";

/** Assign an agent to a matter. */
export default function AgentModal() {
  const { data, setModal, selected, busy, notify, mutate } = useWorkspace();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        if (
          await mutate(
            "agents/" + selected,
            { matterIds: form.getAll("matterIds") },
            "PATCH",
          )
        ) {
          setModal("");
          notify("Agent assignments updated.");
        }
      }}
    >
      <p>
        Assign the Casevex{" "}
        {data.agents.find((a) => a.id === selected)?.name.toLowerCase()} agent
        to selected matters.
      </p>
      {data.matters.map((m) => (
        <label className="checkbox-label" key={m.id}>
          <input
            type="checkbox"
            name="matterIds"
            value={m.id}
            defaultChecked={m.assignedAgentId === selected}
          />
          {m.name}
        </label>
      ))}
      <small>
        Checked matters are assigned to this agent. Unchecked matters retain
        their current agent.
      </small>
      <button className="primary" disabled={busy}>
        Save assignments
      </button>
    </form>
  );
}
