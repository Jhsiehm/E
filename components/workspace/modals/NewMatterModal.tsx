"use client";
import { areas } from "@/components/workspace/format";
import { useWorkspace } from "@/components/workspace/context";

/** Create a matter. */
export default function NewMatterModal() {
  const { router, data, busy, submit } = useWorkspace();
  return (
    <form
      onSubmit={async (e) => {
        const r = await submit(e, "matters");
        if (r) router.push("/matters/" + r.id);
      }}
    >
      <label>
        Matter name
        <input
          autoFocus
          name="name"
          required
          placeholder="Client v. Respondent"
        />
      </label>
      <div className="form-grid">
        <label>
          Docket
          <input name="docket" placeholder="No. 1:26-cv-…" />
        </label>
        <label>
          Court
          <input name="court" required placeholder="S.D.N.Y." />
        </label>
        <label>
          Type
          <select name="type">
            {areas.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Role
          <select name="role">
            {["Plaintiff", "Defendant", "Other"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Assigned agent
        <select name="assignedAgentId">
          {data.agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Case summary
        <textarea name="summary" placeholder="What is this matter about?" />
      </label>
      <button className="primary" disabled={busy}>
        Create matter
      </button>
    </form>
  );
}
