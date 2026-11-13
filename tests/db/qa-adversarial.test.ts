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

// Switches who is asking, inside the same transaction, so rows one person
// wrote (and that roll back afterwards) can be probed by another.
const actAs = (c: pg.PoolClient, who: keyof typeof actors | string) =>
  c.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({
      sub: who in actors ? id(who as keyof typeof actors) : who,
      role: "authenticated",
    }),
  ]);

const ADMIN_A = uuidFor("qa_admin_a");

describe.skipIf(!TEST_DB_URL)("QA adversarial: matters database", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
    // The shared fixtures have no firm admin; add one for firm-level rules.
    await db.pool.query(
      "insert into auth.users (id, email) values ($1, 'admin-a@example.invalid')",
      [ADMIN_A],
    );
    await db.pool.query(
      "insert into public.memberships (workspace_id, user_id, role, status) values ($1, $2, 'admin', 'active')",
      [A, ADMIN_A],
    );
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

  it("a deadline cannot be added in someone else's name", async () => {
    const r = await db.as("paralegalA2", (c) =>
      state(addDeadline(c, OPEN, null, id("attorneyA1"))),
    );
    expect(r).not.toBe("ok");
  });

  it("walled-off people see no strategy or deadlines that really exist", async () => {
    // Write real rows on M1 first, so a leak would show up as a count.
    const counts = await db.as("attorneyA1", async (c) => {
      await c.query(
        "insert into public.matter_strategy (matter_id, workspace_id, body) values ($1, $2, 'Settle early')",
        [M1, A],
      );
      await addDeadline(c, M1, null, id("attorneyA1"));
      const mine = await c.query(
        "select (select count(*) from public.matter_strategy where matter_id = $1)::int as s, (select count(*) from public.matter_deadlines where matter_id = $1)::int as d",
        [M1],
      );
      await actAs(c, "paralegalA2");
      const theirs = await c.query(
        "select (select count(*) from public.matter_strategy where matter_id = $1)::int as s, (select count(*) from public.matter_deadlines where matter_id = $1)::int as d",
        [M1],
      );
      return { mine: mine.rows[0], theirs: theirs.rows[0] };
    });
    expect(counts.mine).toEqual({ s: 1, d: 1 });
    expect(counts.theirs).toEqual({ s: 0, d: 0 });
  });

  it("removed staff cannot be put back on a matter", async () => {
    const r = await db.as("ownerA", (c) =>
      state(
        c.query("select public.add_matter_member($1, $2)", [
          OPEN,
          id("revokedA4"),
        ]),
      ),
    );
    expect(r).toBe("23503");
  });

  it("only the owner renames the firm, not an admin or attorney", async () => {
    const rename = (who: keyof typeof actors | string) =>
      db.pool.connect().then(async (c) => {
        try {
          await c.query("begin");
          await c.query("set local role authenticated");
          await actAs(c, who);
          const q = await c.query(
            "update public.workspaces set name = 'Renamed' where id = $1",
            [A],
          );
          return q.rowCount;
        } finally {
          await c.query("rollback");
          c.release();
        }
      });
    expect(await rename("ownerA")).toBe(1);
    expect(await rename(ADMIN_A)).toBe(0);
    expect(await rename("attorneyA1")).toBe(0);
  });

  it("a firm-level job is seen and cancelled only by the person who started it", async () => {
    const r = await db.as("attorneyA1", async (c) => {
      const { rows } = await c.query(
        "select public.enqueue_job($1, 'system.ping', '{}', null, null) as id",
        [A],
      );
      const job = rows[0].id as string;
      await actAs(c, "paralegalA2");
      const seen = (
        await c.query("select 1 from public.jobs where id = $1", [job])
      ).rowCount;
      const cancelled = (
        await c.query("select public.cancel_job($1) as ok", [job])
      ).rows[0].ok;
      await actAs(c, "attorneyA1");
      const own = (
        await c.query("select 1 from public.jobs where id = $1", [job])
      ).rowCount;
      return { seen, cancelled, own };
    });
    expect(r).toEqual({ seen: 0, cancelled: false, own: 1 });
  });

  it("people cannot read job payloads (only the worker can)", async () => {
    const r = await db.as("attorneyA1", (c) =>
      state(c.query("select payload from public.jobs limit 1")),
    );
    expect(r).toBe("42501");
  });
});
