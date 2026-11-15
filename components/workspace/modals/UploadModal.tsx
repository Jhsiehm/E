"use client";
import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { useWorkspace } from "@/components/workspace/context";
import { api } from "@/lib/api/client";
import { uploadDocument } from "@/lib/api/upload";
import {
  filesFromDrop,
  runQueue,
  toItems,
  type BatchItem,
} from "@/lib/api/upload-batch";
import UploadList from "./UploadList";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Add one document or many at once. People pick files or a whole folder,
 * or drag them in; each file shows its own result, and one that fails
 * never stops the rest. With the real database each file goes to private
 * storage; the demo records names only.
 */
export default function UploadModal({ fresh = false }: { fresh?: boolean }) {
  const ws = useWorkspace();
  const { params, data, matter, droppedFiles, selected } = ws;
  // Files dropped on the Documents page arrive with the window.
  const [items, setItems] = useState<BatchItem[]>(() => toItems(droppedFiles));
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [matterId, setMatterId] = useState(
    (fresh && selected) ||
      matter?.id ||
      params.get("matterId") ||
      data.matters[0]?.id ||
      "",
  );
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const add = (files: File[]) =>
    setItems((now) => [...now, ...toItems(files, now)]);

  const update = (id: string, patch: Partial<BatchItem>) =>
    setItems((now) => now.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const ready = items.filter((i) => i.status === "waiting");
  const saved = items.filter((i) => i.status === "saved").length;
  const failed = items.filter((i) => i.status === "failed");
  const skipped = items.filter((i) => i.status === "skipped").length;
  const done = !running && saved > 0 && ready.length === 0;
  const matterName = data.matters.find((m) => m.id === matterId)?.name;

  const start = async (queue: BatchItem[]) => {
    if (!queue.length || !matterId) return;
    setRunning(true);
    ws.setBusy(true);
    let ok = 0;
    await runQueue(
      queue,
      async (item) => {
        update(item.id, { status: "uploading", note: undefined });
        await uploadDocument(api, item.file, matterId);
        ok++;
        update(item.id, { status: "saved" });
      },
      (item, err) =>
        update(item.id, {
          status: "failed",
          note:
            err instanceof Error && err.message
              ? err.message
              : "Something went wrong. Try again.",
        }),
    );
    setRunning(false);
    ws.setBusy(false);
    if (ok) {
      await ws.refresh().catch(() => undefined);
      ws.notify(
        `${plural(ok, "document")} added to ${matterName ?? "the matter"}.`,
      );
    }
  };

  const retry = () => {
    const again = failed.map((i) => ({ ...i, status: "waiting" as const }));
    setItems((now) =>
      now.map((i) => (i.status === "failed" ? { ...i, status: "waiting" } : i)),
    );
    void start(again);
  };

  const summary = running
    ? `${saved} of ${items.length - skipped} saved so far. Please keep this window open.`
    : done || failed.length
      ? [
          saved && `${plural(saved, "document")} saved.`,
          failed.length && `${plural(failed.length, "file")} did not upload.`,
          skipped && `${plural(skipped, "file")} not added.`,
        ]
          .filter(Boolean)
          .join(" ")
      : items.length
        ? `${plural(ready.length, "document")} ready to upload.${skipped ? ` ${plural(skipped, "file")} can't be added.` : ""}`
        : "";

  return (
    <form
      className="upload-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (done && !failed.length) return ws.setModal("");
        void start(ready);
      }}
    >
      {fresh ? (
        <p>
          <strong>{matterName ?? "Your case"}</strong> is created. Add its
          documents now, as many as you like, or skip this and add them later
          from the Documents tab.
        </p>
      ) : (
        <p>
          Add PDF or Word files to a matter, as many as you like. Only people on
          that matter can open them.
        </p>
      )}
      {!fresh && (
        <label>
          Matter
          <select
            name="matterId"
            value={matterId}
            disabled={running}
            onChange={(e) => setMatterId(e.target.value)}
          >
            {data.matters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!running && !done && (
        <div
          className={`upload-drop${dragging ? " is-over" : ""}${items.length ? " is-compact" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            filesFromDrop(e.dataTransfer).then(add);
          }}
        >
          <Icon name="upload" />
          <span>
            {items.length
              ? "Drag in more files, or"
              : "Drag files or a whole folder here, or"}
          </span>
          <span className="upload-pick">
            <button type="button" onClick={() => filesInput.current?.click()}>
              Choose files
            </button>
            <button type="button" onClick={() => folderInput.current?.click()}>
              Choose a folder
            </button>
          </span>
          <small>PDF or Word (.docx) · Up to 20 MB each</small>
          <input
            ref={filesInput}
            type="file"
            multiple
            accept=".pdf,.docx"
            hidden
            aria-label="Choose files"
            onChange={(e) => {
              add(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <input
            ref={(el) => {
              folderInput.current = el;
              if (el) el.webkitdirectory = true;
            }}
            type="file"
            hidden
            aria-label="Choose a folder"
            onChange={(e) => {
              add(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>
      )}
      {items.length > 0 && (
        <>
          <p className="upload-summary" aria-live="polite">
            {summary}
          </p>
          <UploadList
            items={items}
            onRemove={
              running
                ? undefined
                : (id) => setItems((now) => now.filter((i) => i.id !== id))
            }
          />
        </>
      )}
      <div className="upload-actions">
        {fresh && !running && saved === 0 && failed.length === 0 && (
          <button type="button" onClick={() => ws.setModal("")}>
            Skip for now
          </button>
        )}
        {!running && failed.length > 0 && (
          <button type="button" onClick={retry}>
            Try again
          </button>
        )}
        {done && failed.length === 0 ? (
          <button className="primary" type="submit">
            Done
          </button>
        ) : done ? (
          <button type="button" onClick={() => ws.setModal("")}>
            Close
          </button>
        ) : (
          <button
            className="primary"
            type="submit"
            disabled={running || !ready.length}
          >
            {running
              ? "Uploading…"
              : ready.length
                ? `Upload ${plural(ready.length, "document")}`
                : "Upload documents"}
          </button>
        )}
      </div>
    </form>
  );
}
