// Matter chat memory and reading files without the worker: a conversation is
// private to the person who had it, and only people who may add documents to
// a matter may store the text read from its files.

import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MATTER_M1,
  MATTER_M_OPEN,
  WORKSPACE_A,
} from "../shared/fixtures/tenancy";
import { TEST_DB_URL, createTestDb, uuidFor, type TestDb } from "./harness";

const WS = uuidFor(WORKSPACE_A);
const M1 = uuidFor(MATTER_M1);
const OPEN = uuidFor(MATTER_M_OPEN);
type Who = Parameters<TestDb["as"]>[0];

describe.skipIf(!TEST_DB_URL)("matter chat database", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => {
    await db?.close();
  });

  const state = (p: Promise<unknown>) =>
    p.then(
      () => "ok",
      (e: { code?: string }) => e.code ?? "error",
    );
  const say = (
    c: pg.PoolClient,
    matter: string,
    body = "Thoughts on this case?",
  ) =>
    c.query(
      "insert into public.matter_chat_messages (workspace_id, matter_id, role, body) values ($1, $2, 'user', $3)",
      [WS, matter, body],
    );
  const count = (who: Who, matter: string) =>
    db.as(who, (c) =>
      c
        .query(
          "select count(*)::int as n from public.matter_chat_messages where matter_id = $1",
          [matter],
        )
        .then((r) => r.rows[0].n as number),
    );

  it("a conversation is seen only by the person who had it", async () => {
    await db.commitAs("attorneyA1", (c) => say(c, OPEN));
    await db.commitAs("attorneyA1", (c) => say(c, M1));
    expect(await count("attorneyA1", OPEN)).toBe(1);
    expect(await count("attorneyA1", M1)).toBe(1);
    for (const who of [
      "ownerA",
      "paralegalA2",
      "viewerA3",
      "attorneyB1",
    ] as const)
      expect(await count(who, OPEN), who).toBe(0);
  });

  it("nobody can write into someone else's conversation or a matter they are not on", async () => {
    expect(
      await db.as("paralegalA2", (c) =>
        state(
          c.query(
            "insert into public.matter_chat_messages (workspace_id, matter_id, user_id, role, body) values ($1, $2, $3, 'user', 'x')",
            [WS, OPEN, uuidFor("u_a1")],
          ),
        ),
      ),
    ).toBe("42501");
    expect(await db.as("paralegalA2", (c) => state(say(c, M1)))).toBe("42501");
    expect(await db.as("attorneyB1", (c) => state(say(c, OPEN)))).toBe("42501");
    // A viewer on the matter can keep their own conversation.
    expect(await db.as("viewerA3", (c) => state(say(c, OPEN)))).toBe("ok");
  });

  it("starting over deletes only your own messages", async () => {
    await db.commitAs("ownerA", (c) => say(c, OPEN));
    await db.commitAs("paralegalA2", (c) =>
      c.query("delete from public.matter_chat_messages where matter_id = $1", [
        OPEN,
      ]),
    );
    expect(await count("ownerA", OPEN)).toBe(1);
    expect(await count("attorneyA1", OPEN)).toBe(1);
  });

  // --- reading files on the site -------------------------------------------------

  const upload = (who: Who, matter = OPEN) =>
    db.commitAs(who, async (c) => {
      const v = (
        await c.query(
          "select * from public.start_document_upload($1, 'Lease.pdf', 'application/pdf', 1000, $2)",
          [matter, "b".repeat(64)],
        )
      ).rows[0] as { version_id: string; object_key: string };
      await c.query(
        "insert into storage.objects (bucket_id, name, owner, metadata) values ('matter-files', $1, auth.uid(), $2)",
        [v.object_key, JSON.stringify({ size: 1000 })],
      );
      await c.query("select public.finish_document_upload($1)", [v.version_id]);
      return v.version_id;
    });
  const save = (who: Who, version: string, reason: string | null = null) =>
    db.as(who, (c) =>
      c
        .query("select public.save_document_text($1, $2, 3, $3) as done", [
          version,
          JSON.stringify([{ page: 1, body: "The tenant shall pay rent." }]),
          reason,
        ])
        .then((r) => r.rows[0].done as boolean),
    );

  it("people who may add documents store a file's text; others cannot", async () => {
    const v = await upload("attorneyA1");
    for (const who of ["viewerA3", "attorneyB1", "revokedA4"] as const)
      expect(await state(save(who, v)), who).toBe("42501");
    const done = await db.commitAs("paralegalA2", (c) =>
      c
        .query("select public.save_document_text($1, $2, 3) as done", [
          v,
          JSON.stringify([{ page: 1, body: "The tenant shall pay rent." }]),
        ])
        .then((r) => r.rows[0].done as boolean),
    );
    expect(done).toBe(true);
    const row = await db.pool.query(
      "select processing_state, page_count, (select count(*)::int from public.document_chunks where document_version_id = $1) as chunks from public.document_versions where id = $1",
      [v],
    );
    expect(row.rows[0]).toEqual({
      processing_state: "ready",
      page_count: 3,
      chunks: 1,
    });
    // Already read: a second save changes nothing.
    expect(await save("attorneyA1", v)).toBe(false);
  });

  it("an unreadable file gets a plain reason", async () => {
    const v = await upload("attorneyA1");
    expect(await save("attorneyA1", v, "No text was found.")).toBe(true);
    await db.commitAs("attorneyA1", (c) =>
      c.query(
        "select public.save_document_text($1, '[]', null, 'No text was found.')",
        [v],
      ),
    );
    const row = await db.pool.query(
      "select processing_state, processing_error from public.document_versions where id = $1",
      [v],
    );
    expect(row.rows[0]).toEqual({
      processing_state: "failed",
      processing_error: "No text was found.",
    });
  });

  it("the setup file can be run twice", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../../supabase/migrations/20261116000001_matter_chat.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.pool.query(sql);
    await db.pool.query(sql);
    expect(await count("attorneyA1", M1)).toBe(1);
  });
});
