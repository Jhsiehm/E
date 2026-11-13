// Audit trail and AI usage log: written automatically, readable only by firm
// owners and admins, and impossible to edit or delete.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MATTER_M_OPEN,
  WORKSPACE_A,
  WORKSPACE_B,
  actors,
} from "../shared/fixtures/tenancy";
import { TEST_DB_URL, createTestDb, uuidFor, type TestDb } from "./harness";

const A = uuidFor(WORKSPACE_A);
const B = uuidFor(WORKSPACE_B);
const OPEN = uuidFor(MATTER_M_OPEN);
const units = JSON.stringify({
  function_key: "research.draft",
  input_tokens: 10,
});

describe.skipIf(!TEST_DB_URL)("audit and usage logs", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => db?.close());

  const sqlState = (p: Promise<unknown>) =>
    p.then(
      () => "ok",
      (e: { code?: string }) => e.code ?? "error",
    );

  it("an edit leaves one audit row naming the changed field, not its content", async () => {
    await db.pool.query(
      "update public.matters set summary = 'confidential strategy' where id = $1",
      [OPEN],
    );
    const { rows } = await db.pool.query(
      "select action, changed_fields, to_jsonb(a)::text as raw from public.audit_events a where target_id = $1 and action = 'matter.update'",
      [OPEN],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].changed_fields).toEqual(["summary"]);
    expect(rows[0].raw).not.toContain("confidential strategy");
  });

  it("records who acted when a person makes the change", async () => {
    const actor = await db.as("paralegalA2", async (c) => {
      await c.query(
        "update public.matters set docket = '1:26-cv-1' where id = $1",
        [OPEN],
      );
      await c.query("set local role postgres");
      const { rows } = await c.query(
        "select actor_id from public.audit_events where target_id = $1 order by id desc limit 1",
        [OPEN],
      );
      return rows[0].actor_id;
    });
    expect(actor).toBe(uuidFor(actors.paralegalA2.id));
  });

  it("only firm owners and admins can read the audit trail", async () => {
    const count = (who: Parameters<TestDb["as"]>[0]) =>
      db.as(
        who,
        async (c) =>
          (await c.query("select 1 from public.audit_events")).rowCount,
      );
    expect(await count("ownerA")).toBeGreaterThan(0);
    expect(await count("attorneyA1")).toBe(0);
    expect(await count("attorneyB1")).toBe(0); // B's owner is not seeded; B1 is an attorney
  });

  it("no one can edit or delete log rows, not even the database owner", async () => {
    expect(
      await sqlState(
        db.pool.query("update public.audit_events set action = 'x.y'"),
      ),
    ).toBe("42501");
    expect(
      await sqlState(db.pool.query("delete from public.audit_events")),
    ).toBe("42501");
    await db.pool.query(
      "insert into public.usage_events (workspace_id, provider, units, cost_usd) values ($1, 'openrouter', $2, 0.01)",
      [A, units],
    );
    expect(
      await sqlState(
        db.pool.query("update public.usage_events set cost_usd = 0"),
      ),
    ).toBe("42501");
    expect(
      await sqlState(db.pool.query("delete from public.usage_events")),
    ).toBe("42501");
  });

  it("members log their own AI calls for their own firm only", async () => {
    const log = (
      who: Parameters<TestDb["as"]>[0],
      ws: string,
      userId: string,
    ) =>
      db.as(who, (c) =>
        sqlState(
          c.query(
            "insert into public.usage_events (workspace_id, user_id, provider, units, cost_usd) values ($1, $2, 'openrouter', $3, 0.02)",
            [ws, userId, units],
          ),
        ),
      );
    const a2 = uuidFor(actors.paralegalA2.id);
    expect(await log("paralegalA2", A, a2)).toBe("ok");
    expect(await log("paralegalA2", A, uuidFor(actors.attorneyA1.id))).toBe(
      "42501",
    );
    expect(await log("paralegalA2", B, a2)).toBe("42501");
    expect(await log("revokedA4", A, uuidFor(actors.revokedA4.id))).toBe(
      "42501",
    );
  });

  it("members see today's firm total, not the itemized bill or another firm's", async () => {
    await db.as("paralegalA2", async (c) => {
      expect(
        (await c.query("select 1 from public.usage_events")).rowCount,
      ).toBe(0);
      const mine = await c.query("select public.ai_spend_today($1) as usd", [
        A,
      ]);
      expect(Number(mine.rows[0].usd)).toBeGreaterThan(0);
      const other = await c.query("select public.ai_spend_today($1) as usd", [
        B,
      ]);
      expect(other.rows[0].usd).toBeNull();
    });
  });
});
