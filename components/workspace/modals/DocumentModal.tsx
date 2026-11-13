"use client";
import { label, download } from "@/components/workspace/format";
import { Chip } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";
import { api } from "@/lib/api/client";

const READING: Record<string, string> = {
  pending: "Upload not finished.",
  uploaded: "Waiting to be read.",
  extracting: "Casevex is reading this file.",
  ready: "Text is ready for research.",
};

/** Document details, move and delete. */
export default function DocumentModal() {
  const { data, setModal, selected, busy, notify, mutate, submit, nameOf } =
    useWorkspace();
  const d = data.documents.find((d) => d.id === selected);
  // Only real stored files carry a reading state; the demo has names only.
  const live = d?.processing !== undefined;
  return (
    d && (
      <>
        <Chip>
          {d.ext.toUpperCase()} · {label(d.status)}
        </Chip>
        <h2>{d.name}</h2>
        <p>
          {nameOf(d.matterId)} · {(d.sizeBytes / 1000000).toFixed(2)} MB
        </p>
        {live ? (
          <p className="demo-note">
            {d.processing === "failed"
              ? (d.processingError ?? "This file could not be read.")
              : READING[d.processing ?? ""]}
          </p>
        ) : (
          <p className="demo-note">
            Document metadata preview. No original file or document text is
            stored.
          </p>
        )}
        <form
          onSubmit={async (e) => {
            if (await submit(e, "documents/" + d.id, "PATCH"))
              notify("Document updated.");
          }}
        >
          <label>
            Name
            <input name="name" required defaultValue={d.name} />
          </label>
          {!live && (
            <label>
              Move to matter
              <select name="matterId" defaultValue={d.matterId}>
                {data.matters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="actions">
            <button disabled={busy} className="primary">
              Save changes
            </button>
            {live ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { url } = await api.get<{ url: string }>(
                      `documents/${d.id}/download`,
                    );
                    window.location.assign(url);
                  } catch (err) {
                    notify(
                      err instanceof Error ? err.message : "Please try again.",
                    );
                  }
                }}
              >
                Download file
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  download(
                    d.name + "-metadata.txt",
                    `SAMPLE METADATA ONLY\nName: ${d.name}\nMatter: ${nameOf(d.matterId)}\nType: ${d.ext}\nStatus: ${d.status}\nNo file content is stored.`,
                  )
                }
              >
                Export metadata
              </button>
            )}
          </div>
        </form>
        <details className="delete-confirm">
          <summary>Delete document</summary>
          <p>
            {live
              ? "Delete this document and its stored file? This cannot be undone."
              : "Remove this document record from the demo?"}
          </p>
          <button
            className="rose-button"
            disabled={busy}
            onClick={async () => {
              if (await mutate("documents/" + d.id, {}, "DELETE")) {
                setModal("");
                notify("Document record deleted.");
              }
            }}
          >
            Confirm delete
          </button>
        </details>
      </>
    )
  );
}
