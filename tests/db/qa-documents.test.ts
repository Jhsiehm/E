// QA: document rules that could be broken on purpose without any other test
// failing (found by mutation testing the documents migrations). Each probe
// checks one rule on its own, so a second safeguard cannot hide a broken one.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { MATTER_M1, MATTER_M_OPEN } from "../shared/fixtures/tenancy";
import { TEST_DB_URL, createTestDb, uuidFor, type TestDb } from "./harness";

const M1 = uuidFor(MATTER_M1);
const OPEN = uuidFor(MATTER_M_OPEN);
const PDF = "application/pdf";
const SHA = "b".repeat(64);
type Who = Parameters<TestDb["as"]>[0];

describe.skipIf(!TEST_DB_URL)("QA adversarial: documents database", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => db?.close());

  const state = (p: Promise<unknown>) =>
    p.then(
      () => "ok",
      (e: { code?: string }) => e.code ?? "error",
    );
  const start = (c: pg.PoolClient, matter: string, document?: string) =>
    c
      .query(
        "select * from public.start_document_upload($1, 'Brief.pdf', $2, 1000, $3, $4)",
        [matter, PDF, SHA, document ?? null],
      )
      .then(
        (r) =>
          r.rows[0] as {
            document_id: string;
            version_id: string;
            object_key: string;
          },
      );
  const putFile = (c: pg.PoolClient, key: string) =>
    c.query(
      "insert into storage.objects (bucket_id, name, owner, metadata) values ('matter-files', $1, auth.uid(), '{\"size\": 1000}')",
      [key],
    );
  const upload = (who: Who, matter: string) =>
    db.commitAs(who, async (c) => {
      const v = await start(c, matter);
      await putFile(c, v.object_key);
      await c.query("select public.finish_document_upload($1)", [v.version_id]);
      return v;
    });

  it("the files bucket is private", async () => {
    const { rows } = await db.pool.query(
      "select public from storage.buckets where id = 'matter-files'",
    );
    expect(rows).toEqual([{ public: false }]);
  });

  it("file versions and extracted text are each walled off on their own", async () => {
    const v = await upload("attorneyA1", M1);
    await db.pool.query(
      "insert into public.document_chunks (workspace_id, matter_id, document_version_id, ordinal, body) select workspace_id, matter_id, id, 0, 'Privileged' from public.document_versions where id = $1",
      [v.version_id],
    );
    const seen = (who: Who) =>
      db.as(who, async (c) => ({
        versions: (
          await c.query(
            "select 1 from public.document_versions where id = $1",
            [v.version_id],
          )
        ).rowCount,
        chunks: (
          await c.query(
            "select 1 from public.document_chunks where document_version_id = $1",
            [v.version_id],
          )
        ).rowCount,
      }));
    expect(await seen("attorneyA1")).toEqual({ versions: 1, chunks: 1 });
    for (const who of ["paralegalA2", "ownerA", "attorneyB1"] as const)
      expect(await seen(who), who).toEqual({ versions: 0, chunks: 0 });
  });

  it("viewers cannot rename a document; writers can", async () => {
    const v = await upload("paralegalA2", OPEN);
    const rename = (who: Who) =>
      db.as(who, (c) =>
        c
          .query("update public.documents set name = 'Renamed' where id = $1", [
            v.document_id,
          ])
          .then((r) => r.rowCount),
      );
    expect(await rename("viewerA3")).toBe(0);
    expect(await rename("attorneyA1")).toBe(1);
  });

  it("only the uploader can finish their upload", async () => {
    const v = await db.commitAs("attorneyA1", async (c) => {
      const s = await start(c, OPEN);
      await putFile(c, s.object_key);
      return s;
    });
    expect(
      await db.as("paralegalA2", (c) =>
        state(
          c.query("select public.finish_document_upload($1)", [v.version_id]),
        ),
      ),
    ).toBe("42501");
  });

  it("a new version cannot be filed under a document on another matter", async () => {
    const onM1 = await upload("attorneyA1", M1);
    expect(
      await db.as("attorneyA1", (c) => state(start(c, OPEN, onM1.document_id))),
    ).toBe("42501");
  });

  it("a finished upload's slot cannot be filled again", async () => {
    const v = await upload("attorneyA1", OPEN);
    // Even if the stored file goes away, the reservation is used up.
    await db.pool.query("delete from storage.objects where name = $1", [
      v.object_key,
    ]);
    expect(
      await db.as("attorneyA1", (c) => state(putFile(c, v.object_key))),
    ).toBe("42501");
  });
});
