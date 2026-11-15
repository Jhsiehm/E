"use client";
import Icon from "@/components/Icon";
import { formatSize, type BatchItem } from "@/lib/api/upload-batch";

const LABEL: Record<BatchItem["status"], string> = {
  waiting: "Ready",
  uploading: "Uploading…",
  saved: "Saved",
  skipped: "Not added",
  failed: "Did not upload",
};

/** One line per file, with what happened to it in plain words. */
export default function UploadList({
  items,
  onRemove,
}: {
  items: BatchItem[];
  onRemove?: (id: string) => void;
}) {
  return (
    <ul className="upload-list" aria-label="Files to upload">
      {items.map((item) => (
        <li key={item.id} className={`upload-row is-${item.status}`}>
          <span className="upload-mark" aria-hidden="true">
            {item.status === "saved" ? (
              <Icon name="check" size={16} />
            ) : item.status === "uploading" ? (
              <span className="upload-spinner" />
            ) : item.status === "skipped" || item.status === "failed" ? (
              "!"
            ) : null}
          </span>
          <span className="upload-name">
            <span>{item.file.name}</span>
            <small>{item.note ?? formatSize(item.file.size)}</small>
          </span>
          <span className="upload-state" role="status">
            {LABEL[item.status]}
          </span>
          {onRemove &&
          item.status !== "uploading" &&
          item.status !== "saved" ? (
            <button
              type="button"
              className="icon-button flat"
              aria-label={`Remove ${item.file.name}`}
              onClick={() => onRemove(item.id)}
            >
              <Icon name="close" size={14} />
            </button>
          ) : (
            <span className="upload-spacer" />
          )}
        </li>
      ))}
    </ul>
  );
}
