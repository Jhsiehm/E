// Documents and their files: who may upload, read and delete them, that a
// file can only land at the place the database reserved for it, and the
// worker's side of reading a file. Runs on a real Postgres with the Supabase
// shim (storage.objects stands in for Supabase Storage).

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MATTER_M1, MATTER_M_OPEN } from "../shared/fixtures/tenancy";
import { TEST_DB_URL, createTestDb, uuidFor, type TestDb } from "./harness";

const M1 = uuidFor(MATTER_M1);
const OPEN = uuidFor(MATTER_M_OPEN);
const PDF = "application/pdf";
const SHA = "a".repeat(64);
type Who = Parameters<TestDb["as"]>[0];

describe.skipIf(!TEST_DB_URL)("documents database", () => {
  let db: TestDb;
  let workerPool: pg.Pool;
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

  const state = (p: Promise<unknown>) =>
    p.then(
      () => "ok",
      (e: { code?: string }) => e.code ?? "error",
    );
  const start = (
    c: pg.PoolClient,
    matter: string,
    name = "Complaint.pdf",
    mime = PDF,
    size = 1000,
  ) =>
    c
      .query("select * from public.start_document_upload($1, $2, $3, $4, $5)", [
        matter,
        name,
        mime,
        size,
        SHA,
      ])
      .then(
        (r) =>
          r.rows[0] as {
            document_id: string;
            version_id: string;
            object_key: string;
          },
      );
  const putFile = (c: pg.PoolClient, key: string, size = 1000) =>
    c.query(
      "insert into storage.objects (bucket_id, name, owner, metadata) values ('matter-files', $1, auth.uid(), $2)",
      [key, JSON.stringify({ size })],
    );
  /** Runs p inside a savepoint so a refusal does not end the transaction. */
  const attempt = async (c: pg.PoolClient, p: () => Promise<unknown>) => {
    await c.query("savepoint attempt");
    const r = await state(p());
    await c.query(
      r === "ok"
        ? "release savepoint attempt"
        : "rollback to savepoint attempt",
    );
    return r;
  };
  /** Starts, uploads and finishes a PDF as `who` (committed); returns its ids. */
  const upload = (who: Who, matter = OPEN) =>
    db.commitAs(who, async (c) => {
      const v = await start(c, matter);
      await putFile(c, v.object_key);
      await c.query("select public.finish_document_upload($1)", [v.version_id]);
      return v;
    });

  it("people who can edit a matter upload to it; others cannot start", async () => {
    expect(await state(upload("attorneyA1", M1))).toBe("ok");
    expect(await state(upload("paralegalA2"))).toBe("ok");
    for (const who of [
      "viewerA3",
      "ownerA",
      "attorneyB1",
      "revokedA4",
    ] as const)
      expect(
        await db.as(who, (c) =>
          state(start(c, who === "viewerA3" ? OPEN : M1)),
        ),
        who,
      ).toBe("42501");
  });

  it("only PDF and DOCX up to 20 MB are accepted", async () => {
    const tryStart = (name: string, mime: string, size = 1000) =>
      db.as("attorneyA1", (c) => state(start(c, OPEN, name, mime, size)));
    expect(await tryStart("x.exe", "application/octet-stream")).toBe("22023");
    expect(await tryStart("x.pdf", "text/html")).toBe("22023");
    expect(await tryStart("x.docx", PDF)).toBe("22023");
    expect(await tryStart("x.pdf", PDF, 21_000_000)).toBe("23514");
  });

  it("a file can only be stored at its reserved place, once, by its uploader", async () => {
    await db.as("attorneyA1", async (c) => {
      const v = await start(c, OPEN);
      const other = v.object_key.replace(/[^/]+$/, crypto.randomUUID());
      expect(await attempt(c, () => putFile(c, other))).toBe("42501");
      expect(await attempt(c, () => putFile(c, v.object_key))).toBe("ok");
      await c.query("select public.finish_document_upload($1)", [v.version_id]);
      // Finished: the reservation is used up, so no second file or overwrite.
      await c.query("delete from storage.objects where name = $1", [
        v.object_key,
      ]);
      expect(await attempt(c, () => putFile(c, v.object_key))).not.toBe("ok");
    });
    // Someone else on the matter cannot fill another person's reservation.
    const v = await db.commitAs("attorneyA1", (c) => start(c, OPEN));
    expect(
      await db.as("paralegalA2", (c) => state(putFile(c, v.object_key))),
    ).toBe("42501");
  });

  it("finishing checks the file arrived at the announced size and queues reading", async () => {
    await db.as("attorneyA1", async (c) => {
      const v = await start(c, OPEN);
      expect(
        await attempt(c, () =>
          c.query("select public.finish_document_upload($1)", [v.version_id]),
        ),
      ).toBe("22023"); // nothing uploaded yet
      await putFile(c, v.object_key, 999);
      expect(
        await attempt(c, () =>
          c.query("select public.finish_document_upload($1)", [v.version_id]),
        ),
      ).toBe("22023");
    });
    const v = await upload("attorneyA1");
    const { rows } = await db.pool.query(
      "select kind, payload from public.jobs where idempotency_key = $1",
      ["document.extract:" + v.version_id],
    );
    expect(rows).toEqual([
      { kind: "document.extract", payload: { version_id: v.version_id } },
    ]);
  });

  it("the wall holds for documents, their text and their files", async () => {
    const v = await upload("attorneyA1", M1);
    await workerPool.query("select worker.begin_extract($1)", [v.version_id]);
    await workerPool.query("select worker.save_extract($1, $2, 1)", [
      v.version_id,
      JSON.stringify([{ page: 1, body: "Privileged" }]),
    ]);
    const seen = (who: Who) =>
      db.as(who, async (c) => {
        const q = (sql: string) =>
          c.query(sql, [v.document_id]).then((r) => r.rowCount);
        return {
          doc: await q("select 1 from public.documents where id = $1"),
          text: await q(
            "select 1 from public.document_chunks c join public.document_versions v on v.id = c.document_version_id where v.document_id = $1",
          ),
          file: await c
            .query("select 1 from storage.objects where name = $1", [
              v.object_key,
            ])
            .then((r) => r.rowCount),
        };
      });
    expect(await seen("attorneyA1")).toEqual({ doc: 1, text: 1, file: 1 });
    for (const who of ["ownerA", "paralegalA2", "attorneyB1"] as const)
      expect(await seen(who), who).toEqual({ doc: 0, text: 0, file: 0 });
  });

  it("only the worker records extracted text", async () => {
    const v = await upload("attorneyA1");
    expect(
      await db.as("attorneyA1", (c) =>
        state(
          c.query("select worker.save_extract($1, '[]', 0)", [v.version_id]),
        ),
      ),
    ).toBe("42501");
    expect(
      await db.as("attorneyA1", (c) =>
        state(
          c.query(
            "update public.document_versions set processing_state = 'ready' where id = $1",
            [v.version_id],
          ),
        ),
      ),
    ).toBe("42501");
    await workerPool.query(
      "select worker.fail_extract($1, 'This PDF has no text.')",
      [v.version_id],
    );
    const { rows } = await db.pool.query(
      "select processing_state, processing_error from public.document_versions where id = $1",
      [v.version_id],
    );
    expect(rows[0]).toEqual({
      processing_state: "failed",
      processing_error: "This PDF has no text.",
    });
  });

  it("deleting a document needs delete rights and queues removal of its file", async () => {
    const v = await upload("paralegalA2");
    const del = (who: Who) =>
      db.as(who, (c) =>
        c
          .query("delete from public.documents where id = $1", [v.document_id])
          .then((r) => r.rowCount),
      );
    expect(await del("paralegalA2")).toBe(0); // paralegals cannot delete
    expect(
      await db.as("attorneyA1", (c) =>
        c
          .query("delete from storage.objects where name = $1", [v.object_key])
          .then((r) => r.rowCount),
      ),
    ).toBe(0); // nobody deletes stored files directly
    expect(
      await db.commitAs("attorneyA1", (c) =>
        c
          .query("delete from public.documents where id = $1", [v.document_id])
          .then((r) => r.rowCount),
      ),
    ).toBe(1);
    const { rows } = await db.pool.query(
      "select payload from public.jobs where kind = 'document.purge' and payload ->> 'object_key' = $1",
      [v.object_key],
    );
    expect(rows).toHaveLength(1);
  });

  it("new versions keep the same file type and count up", async () => {
    const first = await upload("attorneyA1");
    const next = await db.as("attorneyA1", async (c) => {
      const { rows } = await c.query(
        "select version_id from public.start_document_upload($1, 'Complaint v2.pdf', $2, 10, $3, $4)",
        [OPEN, PDF, SHA, first.document_id],
      );
      const v = await c.query(
        "select version from public.document_versions where id = $1",
        [rows[0].version_id],
      );
      return v.rows[0].version;
    });
    expect(next).toBe(2);
    expect(
      await db.as("attorneyA1", (c) =>
        state(
          c.query(
            "select * from public.start_document_upload($1, 'x.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 10, $2, $3)",
            [OPEN, SHA, first.document_id],
          ),
        ),
      ),
    ).toBe("22023");
  });
});
