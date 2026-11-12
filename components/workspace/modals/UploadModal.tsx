"use client";
import { useWorkspace } from "@/components/workspace/context";

/** Upload a document (prototype: metadata only). */
export default function UploadModal() {
  const {
    params,
    data,
    setModal,
    droppedFile,
    setDroppedFile,
    busy,
    notify,
    matter,
    mutate,
  } = useWorkspace();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        if (droppedFile) form.set("file", droppedFile);
        if (await mutate("documents", form)) {
          setModal("");
          notify(
            "Document metadata added. File content is not stored in this prototype.",
          );
        }
      }}
    >
      <p>
        Record a PDF or DOCX in a matter. File contents are not retained or
        analyzed in this demo.
      </p>
      <label>
        Matter
        <select
          name="matterId"
          defaultValue={matter?.id || params.get("matterId") || "anderson"}
        >
          {data.matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Document
        {droppedFile ? (
          <div className="demo-note">
            {droppedFile.name}
            <button
              type="button"
              className="text-button"
              onClick={() => setDroppedFile(null)}
            >
              Choose a different file
            </button>
          </div>
        ) : (
          <input type="file" name="file" required accept=".pdf,.docx" />
        )}
      </label>
      <small>Maximum 20 MB</small>
      <button className="primary" disabled={busy}>
        Add document metadata
      </button>
    </form>
  );
}
