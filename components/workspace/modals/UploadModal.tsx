"use client";
import { useWorkspace } from "@/components/workspace/context";
import { api } from "@/lib/api/client";
import { uploadDocument } from "@/lib/api/upload";

/**
 * Upload a document. With the real database the file goes to private
 * storage and the worker reads it; the demo records its name only.
 */
export default function UploadModal() {
  const {
    params,
    data,
    setModal,
    droppedFile,
    setDroppedFile,
    busy,
    setBusy,
    notify,
    matter,
    refresh,
  } = useWorkspace();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const file = droppedFile ?? form.get("file");
        if (!(file instanceof File) || !file.name)
          return notify("Choose a file.");
        if (file.size > 20 * 1024 * 1024)
          return notify("Maximum file size is 20 MB.");
        setBusy(true);
        try {
          const doc = (await uploadDocument(
            api,
            file,
            String(form.get("matterId")),
          )) as { processing?: string };
          await refresh();
          setModal("");
          notify(
            doc.processing
              ? "Uploaded. Casevex is reading the file; its text will be ready in a minute."
              : "Document added. The demo keeps the name only, not the file.",
          );
        } catch (err) {
          notify(err instanceof Error ? err.message : "Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Add a PDF or Word file to a matter. Only people on that matter can open
        it.
      </p>
      <label>
        Matter
        <select
          name="matterId"
          defaultValue={
            matter?.id || params.get("matterId") || data.matters[0]?.id
          }
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
        {busy ? "Uploading…" : "Upload document"}
      </button>
    </form>
  );
}
