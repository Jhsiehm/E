"use client";
import { TODAY } from "@/lib/mock/data";
import { useWorkspace } from "@/components/workspace/context";

/** Add a calendar event. */
export default function EventModal() {
  const { data, busy, notify, matter, submit } = useWorkspace();
  return (
    <form
      onSubmit={async (e) => {
        if (await submit(e, "deadlines")) notify("Event added.");
      }}
    >
      <label>
        Title
        <input name="title" required autoFocus />
      </label>
      <label>
        Matter
        <select
          name="matterId"
          defaultValue={matter?.id || data.matters[0]?.id}
        >
          {data.matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label>
          Date
          <input type="date" name="dueAt" required defaultValue={TODAY} />
        </label>
        <label>
          Kind
          <select name="kind">
            <option>deadline</option>
            <option>hearing</option>
            <option>meeting</option>
          </select>
        </label>
      </div>
      <button className="primary" disabled={busy}>
        Add event
      </button>
    </form>
  );
}
