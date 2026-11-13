// Matter rules beyond the access matrix: creation, sharing, walls between
// firms, and fields that must never change. Runs on a real Postgres with the
// Supabase migrations applied (CASEVEX_TEST_DATABASE_URL); skipped without it.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MATTER_M1,
  MATTER_M2,
  MATTER_M_OPEN,
  WORKSPACE_A,
  WORKSPACE_B,
  actors,
} from "../shared/fixtures/tenancy";
import { TEST_DB_URL, createTestDb, uuidFor, type TestDb } from "./harness";

const A = uuidFor(WORKSPACE_A);
const B = uuidFor(WORKSPACE_B);
const OPEN = uuidFor(MATTER_M_OPEN);
const M1 = uuidFor(MATTER_M1);
const M2 = uuidFor(MATTER_M2);

describe.skipIf(!TEST_DB_URL)("matters database", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => db?.close());

  const sqlState = async (p: Promise<unknown>) =>
    p.then(
      () => "ok",
      (e: { code?: string }) => e.code ?? "error",
    );

  it("a new matter is visible to its creator and walled off from everyone else", async () => {
    await db.as("paralegalA2", async (c) => {
      const { rows } = await c.query(
        "select public.create_matter($1, 'Rivera v. Acme') as id",
        [A],
      );
      const id = rows[0].id;
      const seen = await c.query(
        "select name from public.matters where id = $1",
        [id],
      );
      expect(seen.rows[0].name).toBe("Rivera v. Acme");
      // Same transaction, now as the firm owner: the wall holds.
      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: uuidFor(actors.ownerA.id) }),
      ]);
      const owner = await c.query(
        "select 1 from public.matters where id = $1",
        [id],
      );
      expect(owner.rowCount).toBe(0);
    });
  });

  it("viewers, other firms and signed-out visitors cannot create matters", async () => {
    for (const who of ["viewerA3", "attorneyB1", "revokedA4"] as const)
      expect(
        await db.as(who, (c) =>
          sqlState(c.query("select public.create_matter($1, 'X')", [A])),
        ),
        who,
      ).toBe("42501");
    expect(
      await db.as("anonymous", (c) =>
        sqlState(c.query("select public.create_matter($1, 'X')", [A])),
      ),
    ).toBe("42501");
  });

  it("nobody can move a matter to another firm or edit its bookkeeping", async () => {
    const attempts: [string, unknown[]][] = [
      ["update public.matters set workspace_id = $2 where id = $1", [OPEN, B]],
      [
        "update public.matters set created_by = $2 where id = $1",
        [OPEN, uuidFor(actors.attorneyB1.id)],
      ],
      ["update public.matters set version = 99 where id = $1", [OPEN]],
    ];
    for (const [sql, args] of attempts)
      expect(
        await db.as("ownerA", (c) => sqlState(c.query(sql, args))),
        sql,
      ).toBe("42501");
  });

  it("edits bump the version", async () => {
    await db.as("attorneyA1", async (c) => {
      await c.query("update public.matters set summary = 'v2' where id = $1", [
        M1,
      ]);
      const { rows } = await c.query(
        "select version from public.matters where id = $1",
        [M1],
      );
      expect(rows[0].version).toBe(2);
    });
  });

  it("owners, admins and attorneys on the matter can share it, only within the firm", async () => {
    const add = (
      who: Parameters<TestDb["as"]>[0],
      matter: string,
      user: string,
    ) =>
      db.as(who, (c) =>
        sqlState(
          c.query("select public.add_matter_member($1, $2)", [matter, user]),
        ),
      );
    expect(await add("ownerA", OPEN, uuidFor(actors.attorneyB1.id))).toBe(
      "23503",
    );
    expect(await add("ownerA", M1, uuidFor(actors.paralegalA2.id))).toBe(
      "42501",
    );
    expect(await add("attorneyA1", M1, uuidFor(actors.paralegalA2.id))).toBe(
      "ok",
    );
    expect(await add("paralegalA2", OPEN, uuidFor(actors.attorneyA1.id))).toBe(
      "42501",
    );
    expect(await add("ownerA", OPEN, uuidFor(actors.paralegalA2.id))).toBe(
      "ok",
    );
  });

  it("a matter always keeps at least one person", async () => {
    const result = await db.as("ownerA", async (c) => {
      const { rows } = await c.query(
        "select public.create_matter($1, 'Solo') as id",
        [A],
      );
      return sqlState(
        c.query("select public.remove_matter_member($1, $2)", [
          rows[0].id,
          uuidFor(actors.ownerA.id),
        ]),
      );
    });
    expect(result).toBe("23514");
  });

  it("deadlines cannot be attached to another firm's matter", async () => {
    const insert = (ws: string, matter: string) =>
      db.as("attorneyA1", (c) =>
        sqlState(
          c.query(
            "insert into public.matter_deadlines (workspace_id, matter_id, title, due_on, created_by) values ($1, $2, 'File reply', '2026-12-01', $3)",
            [ws, matter, uuidFor(actors.attorneyA1.id)],
          ),
        ),
      );
    expect(await insert(A, M1)).toBe("ok");
    expect(await insert(B, M2)).toBe("42501"); // RLS
    expect(await insert(A, M2)).not.toBe("ok"); // RLS or the composite key
  });

  it("deadlines are confirmed only by an attorney on the matter, in their own name", async () => {
    const id = (who: keyof typeof actors) => uuidFor(actors[who].id);
    const add = (
      who: Parameters<TestDb["as"]>[0],
      confirmedBy: string | null,
    ) =>
      db.as(who, (c) =>
        sqlState(
          c.query(
            "insert into public.matter_deadlines (workspace_id, matter_id, title, due_on, created_by, confirmed_by) values ($1, $2, 'Answer due', '2026-12-01', $3, $4)",
            [A, OPEN, id(who as keyof typeof actors), confirmedBy],
          ),
        ),
      );
    expect(await add("paralegalA2", id("attorneyA1"))).toBe("42501");
    expect(await add("paralegalA2", id("paralegalA2"))).toBe("42501");
    expect(await add("attorneyA1", id("ownerA"))).toBe("42501");
    expect(await add("attorneyA1", id("attorneyA1"))).toBe("ok");
    // confirmed_at is stamped by the database; a value sent without a
    // confirmation is dropped.
    const stamped = await db.as("paralegalA2", async (c) => {
      const { rows } = await c.query(
        "insert into public.matter_deadlines (workspace_id, matter_id, title, due_on, created_by, confirmed_at) values ($1, $2, 'X', '2026-12-01', $3, now()) returning confirmed_at",
        [A, OPEN, id("paralegalA2")],
      );
      return rows[0].confirmed_at;
    });
    expect(stamped).toBeNull();
  });

  it("a paralegal cannot confirm a deadline, and moving a confirmed date clears it", async () => {
    await db.as("attorneyA1", async (c) => {
      const me = uuidFor(actors.attorneyA1.id);
      const { rows } = await c.query(
        "insert into public.matter_deadlines (workspace_id, matter_id, title, due_on, created_by, confirmed_by) values ($1, $2, 'Reply', '2026-12-01', $3, $3) returning id, confirmed_at",
        [A, OPEN, me],
      );
      expect(rows[0].confirmed_at).not.toBeNull();
      await c.query(
        "update public.matter_deadlines set due_on = '2026-12-05' where id = $1",
        [rows[0].id],
      );
      const after = await c.query(
        "select confirmed_by, confirmed_at from public.matter_deadlines where id = $1",
        [rows[0].id],
      );
      expect(after.rows[0]).toEqual({ confirmed_by: null, confirmed_at: null });
    });
    const forged = await db.as("paralegalA2", async (c) => {
      const me = uuidFor(actors.paralegalA2.id);
      const { rows } = await c.query(
        "insert into public.matter_deadlines (workspace_id, matter_id, title, due_on, created_by) values ($1, $2, 'Serve', '2026-12-02', $3) returning id",
        [A, OPEN, me],
      );
      return sqlState(
        c.query(
          "update public.matter_deadlines set confirmed_by = $2 where id = $1",
          [rows[0].id, uuidFor(actors.attorneyA1.id)],
        ),
      );
    });
    expect(forged).toBe("42501");
  });

  it("strategy notes save for writers and are read-only for viewers", async () => {
    const save = (who: Parameters<TestDb["as"]>[0]) =>
      db.as(who, (c) =>
        sqlState(
          c.query(
            "insert into public.matter_strategy (matter_id, workspace_id, body) values ($1, $2, 'Plan')",
            [OPEN, A],
          ),
        ),
      );
    expect(await save("paralegalA2")).toBe("ok");
    expect(await save("viewerA3")).toBe("42501");
  });
});
