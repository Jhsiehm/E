"use client";
import { useWorkspace } from "@/components/workspace/context";

/** Add a precedent to the library. */
export default function PrecedentModal() {
  const { busy, notify, submit } = useWorkspace();
  return (
    <form
      onSubmit={async (e) => {
        if (await submit(e, "precedents"))
          notify("Authority added for verification.");
      }}
    >
      <p>
        Add an authority to the review queue. No citation is verified
        automatically in this prototype.
      </p>
      <label>
        Case name
        <input name="caseName" required autoFocus />
      </label>
      <label>
        Citation
        <input
          name="citation"
          required
          placeholder="910 F.3d 633 (2d Cir. 2018)"
        />
      </label>
      <label>
        Court
        <input name="court" />
      </label>
      <button className="primary" disabled={busy}>
        Add to library
      </button>
    </form>
  );
}
