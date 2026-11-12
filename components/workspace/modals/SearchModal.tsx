"use client";
import { useWorkspace } from "@/components/workspace/context";

/** Global authority search. */
export default function SearchModal() {
  const { router, setModal } = useWorkspace();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = new FormData(e.currentTarget).get("q");
        setModal("");
        router.push("/precedents?q=" + encodeURIComponent(String(v)));
      }}
    >
      <label>
        Search cases, citations, or topics
        <input
          name="q"
          autoFocus
          required
          placeholder="Trade secrets, arbitration…"
        />
      </label>
      <button className="primary">Search precedents</button>
    </form>
  );
}
