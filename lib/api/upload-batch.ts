/**
 * Helpers for adding many documents at once: plain-word checks before a
 * file is sent, reading files out of a dropped folder, and a small queue
 * so one failed file never stops the others.
 */

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED = new Set(["pdf", "docx"]);

export type BatchStatus =
  "waiting" | "uploading" | "saved" | "skipped" | "failed";

export type BatchItem = {
  id: string;
  file: File;
  status: BatchStatus;
  /** Why a file was skipped or failed, in plain words. */
  note?: string;
};

/** System files a folder carries that nobody means to upload. */
export function isHiddenFile(name: string) {
  return name.startsWith(".") || name.startsWith("~$") || name === "Thumbs.db";
}

/** Why a file can't be added, or null when it can. */
export function checkFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "doc")
    return "Older Word format. Save it as .docx in Word, then add it.";
  if (!ACCEPTED.has(ext) || !file.name.includes("."))
    return "Only PDF and Word (.docx) files can be added.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_FILE_BYTES) return "Larger than 20 MB.";
  return null;
}

const keyOf = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

/**
 * Turns picked files into list rows. Hidden system files are left out,
 * and a file already in the list is not added twice.
 */
export function toItems(files: File[], existing: BatchItem[] = []) {
  const seen = new Set(existing.map((i) => keyOf(i.file)));
  const items: BatchItem[] = [];
  for (const file of files) {
    if (isHiddenFile(file.name) || seen.has(keyOf(file))) continue;
    seen.add(keyOf(file));
    const note = checkFile(file);
    items.push({
      id: `${keyOf(file)}|${existing.length + items.length}`,
      file,
      status: note ? "skipped" : "waiting",
      note: note ?? undefined,
    });
  }
  return items;
}

type Entry = FileSystemEntry;

function readAll(dir: FileSystemDirectoryEntry): Promise<Entry[]> {
  const reader = dir.createReader();
  const out: Entry[] = [];
  return new Promise((resolve, reject) => {
    // Browsers hand directory contents back in batches until one is empty.
    const next = () =>
      reader.readEntries((batch) => {
        if (!batch.length) return resolve(out);
        out.push(...batch);
        next();
      }, reject);
    next();
  });
}

async function walk(entry: Entry, depth = 0): Promise<File[]> {
  if (entry.isFile)
    return [
      await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      ),
    ];
  if (!entry.isDirectory || depth > 20 || isHiddenFile(entry.name)) return [];
  const children = await readAll(entry as FileSystemDirectoryEntry);
  const nested = await Promise.all(children.map((c) => walk(c, depth + 1)));
  return nested.flat();
}

/**
 * The files from a drag and drop, including everything inside dropped
 * folders. The entries must be taken before the first await, because the
 * browser empties the drop data once the event handler returns.
 */
export async function filesFromDrop(data: DataTransfer): Promise<File[]> {
  const entries = Array.from(data.items ?? [])
    .filter((i) => i.kind === "file")
    .map((i) => i.webkitGetAsEntry?.() ?? null);
  const plain = Array.from(data.files ?? []);
  if (!entries.length || entries.some((e) => !e)) return plain;
  try {
    const lists = await Promise.all((entries as Entry[]).map((e) => walk(e)));
    return lists.flat();
  } catch {
    return plain;
  }
}

/**
 * Runs `work` for every item, a few at a time. A failure is reported for
 * that item only and the rest carry on.
 */
export async function runQueue<T>(
  items: T[],
  work: (item: T) => Promise<void>,
  onError: (item: T, err: unknown) => void,
  limit = 3,
) {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await work(item);
      } catch (err) {
        onError(item, err);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, lane),
  );
}

/** Short file size for the list, such as "840 KB" or "3.2 MB". */
export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
