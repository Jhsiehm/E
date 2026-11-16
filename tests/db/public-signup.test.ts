import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, TEST_DB_URL, uuidFor, type TestDb } from "./harness";

describe.skipIf(!TEST_DB_URL)("public signup workspace isolation", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => {
    await db?.close();
  });

  it("two new users get separate private workspaces even with the same firm name", async () => {
    const client = await db.pool.connect();
    const a = uuidFor("public-signup-a"),
      b = uuidFor("public-signup-b");
    try {
      await client.query("begin");
      await client.query(
        "insert into auth.users (id, email) values ($1, $2), ($3, $4)",
        [a, "new-a@example.invalid", b, "new-b@example.invalid"],
      );
      await client.query("set local role authenticated");
      const asUser = (id: string) =>
        client.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: id, role: "authenticated" }),
        ]);
      await asUser(a);
      const first = await client.query(
        "select public.create_workspace($1) as id",
        ["My firm"],
      );
      await asUser(b);
      const second = await client.query(
        "select public.create_workspace($1) as id",
        ["My firm"],
      );
      const idA = first.rows[0].id,
        idB = second.rows[0].id;
      expect(idA).not.toBe(idB);
      expect(
        (await client.query("select id from public.workspaces")).rows,
      ).toEqual([{ id: idB }]);
      expect(
        (
          await client.query(
            "select workspace_id, user_id, role, status from public.memberships",
          )
        ).rows,
      ).toEqual([
        { workspace_id: idB, user_id: b, role: "owner", status: "active" },
      ]);
      await asUser(a);
      expect(
        (await client.query("select id from public.workspaces")).rows,
      ).toEqual([{ id: idA }]);
      expect(
        (await client.query("select user_id from public.memberships")).rows,
      ).toEqual([{ user_id: a }]);
    } finally {
      await client.query("rollback");
      client.release();
    }
  });
});
