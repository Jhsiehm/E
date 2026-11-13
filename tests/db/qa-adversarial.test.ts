// QA adversarial probes against the real matters database (RLS + RPCs).
// Each probe checks both directions: the allowed person succeeds, the
// person who should be stopped is stopped.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import {
  actors,
  MATTER_M1,
  MATTER_M_OPEN,
  WORKSPACE_A,
} from "../shared/fixtures/tenancy";
import { createTestDb, TEST_DB_URL, uuidFor, type TestDb } from "./harness";

const A = uuidFor(WORKSPACE_A);
const M1 = uuidFor(MATTER_M1);
const OPEN = uuidFor(MATTER_M_OPEN);
const id = (k: keyof typeof actors) => uuidFor(actors[k].id);

async function state(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (e) {
    return (e as { code?: string }).code ?? "error";
  }
}

describe.skipIf(!TEST_DB_URL)("QA adversarial: matters database", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => db?.close());

  const addDeadline = (
    c: pg.PoolClient,
    matter: string,
    confirmedBy: string | null,
    by: string,
  ) =>
    c.query(
      `insert into public.matter_deadlines (workspace_id, matter_id, title, due_on, created_by, confirmed_by, confirmed_at)
       values ($1, $2, 'Answer due', '2026-12-01', $3, $4, case when $4::uuid is null then null else now() end)
       returning id`,
      [A, matter, by, confirmedBy],
    );

  it("a paralegal cannot record a deadline as confirmed by an attorney", async () => {
    const r = await db.as("paralegalA2", (c) =>
      state(addDeadline(c, OPEN, id("attorneyA1"), id("paralegalA2"))),
    );
    expect(r).not.toBe("ok");
  });

  it("a paralegal cannot mark an existing deadline confirmed", async () => {
    const r = await db.as("paralegalA2", async (c) => {
      const { rows } = await addDeadline(c, OPEN, null, id("paralegalA2"));
      return state(
        c
          .query(
            "update public.matter_deadlines set confirmed_by = $2, confirmed_at = now() where id = $1",
            [rows[0].id, id("paralegalA2")],
          )
          .then((q) => {
            if (q.rowCount !== 1)
              throw Object.assign(new Error("no row"), { code: "denied" });
          }),
      );
    });
    expect(r).not.toBe("ok");
  });

  it("an attorney cannot confirm a deadline in someone else's name", async () => {
    const r = await db.as("attorneyA1", (c) =>
      state(addDeadline(c, OPEN, id("ownerA"), id("attorneyA1"))),
    );
    expect(r).not.toBe("ok");
  });

  it("an attorney can confirm a deadline as themselves", async () => {
    const r = await db.as("attorneyA1", (c) =>
      state(addDeadline(c, OPEN, id("attorneyA1"), id("attorneyA1"))),
    );
    expect(r).toBe("ok");
  });

  it("a matter an attorney creates can still be shared with a colleague by someone", async () => {
    // With sharing limited to owners/admins on the matter, and owners not
    // seeing matters they are not on, an attorney-created matter would have
    // nobody able to add the paralegal assigned to it.
    const results = await db.as("attorneyA1", async (c) => {
      const { rows } = await c.query(
        "select public.create_matter($1, 'New intake') as id",
        [A],
      );
      const byCreator = await state(
        c.query("select public.add_matter_member($1, $2)", [
          rows[0].id,
          id("paralegalA2"),
        ]),
      );
      return { matter: rows[0].id as string, byCreator };
    });
    const byOwner = await db.as("ownerA", (c) =>
      state(
        c.query("select public.add_matter_member($1, $2)", [
          results.matter,
          id("paralegalA2"),
        ]),
      ),
    );
    expect([results.byCreator, byOwner]).toContain("ok");
  });

  it("people walled off a matter cannot see who is on it, its deadlines or strategy", async () => {
    const counts = await db.as("paralegalA2", async (c) => ({
      members: (
        await c.query(
          "select 1 from public.matter_members where matter_id = $1",
          [M1],
        )
      ).rowCount,
      deadlines: (
        await c.query(
          "select 1 from public.matter_deadlines where matter_id = $1",
          [M1],
        )
      ).rowCount,
      strategy: (
        await c.query(
          "select 1 from public.matter_strategy where matter_id = $1",
          [M1],
        )
      ).rowCount,
    }));
    expect(counts).toEqual({ members: 0, deadlines: 0, strategy: 0 });
  });

  it("a revoked member keeps no access through an old matter list entry", async () => {
    const r = await db.as("revokedA4", async (c) => ({
      read: (await c.query("select 1 from public.matters where id = $1", [M1]))
        .rowCount,
      members: (
        await c.query(
          "select 1 from public.matter_members where matter_id = $1",
          [M1],
        )
      ).rowCount,
      share: await state(
        c.query("select public.add_matter_member($1, $2)", [
          M1,
          id("paralegalA2"),
        ]),
      ),
    }));
    expect(r).toEqual({ read: 0, members: 0, share: "42501" });
  });

  it("unknown and forbidden matters give the same error (no existence oracle)", async () => {
    // Separate transactions: an error aborts the rest of a transaction.
    const tryShare = (matter: string) =>
      db.as("paralegalA2", (c) =>
        state(
          c.query("select public.add_matter_member($1, $2)", [
            matter,
            id("paralegalA2"),
          ]),
        ),
      );
    const r = [
      await tryShare(M1),
      await tryShare("00000000-0000-4000-8000-000000000000"),
    ];
    expect(r[0]).toBe(r[1]);
  });
});
