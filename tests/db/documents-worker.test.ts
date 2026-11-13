// The worker's document jobs end to end on a real Postgres: an uploaded file
// is read into chunks people on the matter can search, a bad file is marked
// failed with a plain reason, and a deleted document's file is removed.
// File storage is an in-memory stand-in.

import { createHash } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FileStore } from "@/worker/files";
import { buildHandlers } from "@/worker/handlers";
import { runOnce } from "@/worker/run";
import { PgJobStore } from "@/worker/store";
import { tinyDocx, tinyPdf } from "../shared/fixtures/files";
import { MATTER_M_OPEN } from "../shared/fixtures/tenancy";
import { TEST_DB_URL, createTestDb, uuidFor, type TestDb } from "./harness";

const OPEN = uuidFor(MATTER_M_OPEN);
const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe.skipIf(!TEST_DB_URL)("document worker jobs", () => {
  let db: TestDb;
  let workerPool: pg.Pool;
  const stored = new Map<string, Buffer>();
  const removed: string[] = [];
  const files: FileStore = {
    download: async (key) => {
      const b = stored.get(key);
      if (!b) throw new Error("missing");
      return b;
    },
    remove: async (key) => {
      stored.delete(key);
      removed.push(key);
    },
  };

  beforeAll(async () => {
    db = await createTestDb();
    workerPool = new pg.Pool({
      connectionString: db.url,
      options: "-c role=casevex_worker",
      max: 2,
    });
  });
  afterAll(async () => {
    await workerPool?.end();
    await db?.close();
  });

  const work = () =>
    runOnce(new PgJobStore(workerPool), {
      workerId: "test",
      handlers: buildHandlers({ pool: workerPool, files }),
      batch: 10,
    });

  /** Uploads `bytes` as attorneyA1, as the browser and API would. */
  const upload = (name: string, mime: string, bytes: Buffer, claimed = bytes) =>
    db.commitAs("attorneyA1", async (c) => {
      const { rows } = await c.query(
        "select * from public.start_document_upload($1, $2, $3, $4, $5)",
        [
          OPEN,
          name,
          mime,
          claimed.length,
          createHash("sha256").update(claimed).digest("hex"),
        ],
      );
      const v = rows[0] as {
        document_id: string;
        version_id: string;
        object_key: string;
      };
      stored.set(v.object_key, bytes);
      await c.query(
        "insert into storage.objects (bucket_id, name, owner, metadata) values ('matter-files', $1, auth.uid(), $2)",
        [v.object_key, JSON.stringify({ size: claimed.length })],
      );
      await c.query("select public.finish_document_upload($1)", [v.version_id]);
      return v;
    });
  const version = (id: string) =>
    db.pool
      .query(
        "select processing_state, processing_error, page_count from public.document_versions where id = $1",
        [id],
      )
      .then((r) => r.rows[0]);

  it("reads a PDF into chunks that people on the matter can see", async () => {
    const v = await upload(
      "Complaint.pdf",
      PDF,
      tinyPdf("Defendant sold defective blenders"),
    );
    await work();
    expect(await version(v.version_id)).toEqual({
      processing_state: "ready",
      processing_error: null,
      page_count: 1,
    });
    const text = await db.as("paralegalA2", (c) =>
      c
        .query(
          "select c.page_number, c.body from public.document_chunks c where c.document_version_id = $1",
          [v.version_id],
        )
        .then((r) => r.rows),
    );
    expect(text).toHaveLength(1);
    expect(text[0].page_number).toBe(1);
    expect(text[0].body).toContain("defective blenders");
  });

  it("reads a Word file", async () => {
    const v = await upload("Memo.docx", DOCX, tinyDocx(["Privileged memo"]));
    await work();
    expect((await version(v.version_id)).processing_state).toBe("ready");
  });

  it("marks a disguised file failed, with a reason people can read", async () => {
    const fake = Buffer.from("<html>not a pdf</html>");
    const v = await upload("Exhibit.pdf", PDF, fake);
    await work();
    expect(await version(v.version_id)).toEqual({
      processing_state: "failed",
      processing_error: "The file's contents are not a PDF or Word document.",
      page_count: null,
    });
  });

  it("marks a file swapped after upload as failed", async () => {
    const v = await upload(
      "Order.pdf",
      PDF,
      tinyPdf("Swapped!"),
      tinyPdf("Original"),
    );
    await work();
    expect((await version(v.version_id)).processing_error).toBe(
      "The file does not match what was uploaded.",
    );
  });

  it("removes the stored file when its document is deleted", async () => {
    const v = await upload("Draft.pdf", PDF, tinyPdf("Draft"));
    await work();
    await db.commitAs("attorneyA1", (c) =>
      c.query("delete from public.documents where id = $1", [v.document_id]),
    );
    await work();
    expect(removed).toContain(v.object_key);
    expect(stored.has(v.object_key)).toBe(false);
  });
});
