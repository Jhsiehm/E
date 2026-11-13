// Runs each access-matrix case against the real database rules: row-level
// security for reads, edits and deletes, and private.can / can_workspace (the
// same functions the policies use) for actions that have no table yet.

import type pg from "pg";
import type { AccessCase, Decision } from "../shared/fixtures/access-matrix";
import { resources } from "../shared/fixtures/tenancy";
import type { AuthAdapter } from "../cross-module/adapters";
import { createTestDb, uuidFor, type TestDb } from "./harness";

let shared: Promise<TestDb> | null = null;
export const testDb = () => (shared ??= createTestDb());

async function decide(c: pg.PoolClient, ac: AccessCase): Promise<Decision> {
  const r = resources[ac.resource];
  const ws = uuidFor(r.workspaceId);
  const matter = "matterId" in r ? uuidFor(r.matterId) : null;
  const yes = (b: boolean): Decision => (b ? "allow" : "deny");
  const fn = async (sql: string, args: unknown[]) =>
    yes(Boolean((await c.query(sql, args)).rows[0]?.ok));

  if (r.kind === "workspace") {
    if (ac.action === "read")
      return yes(
        (await c.query("select 1 from public.workspaces where id = $1", [ws]))
          .rowCount === 1,
      );
    if (ac.action === "write")
      return yes(
        (
          await c.query(
            "update public.workspaces set name = name where id = $1",
            [ws],
          )
        ).rowCount === 1,
      );
    return fn("select private.can_workspace($1, $2) as ok", [ws, ac.action]);
  }
  const action = ac.action === "invite" ? "share" : ac.action;
  if (r.kind === "matter") {
    const sql = {
      read: "select 1 from public.matters where id = $1",
      write: "update public.matters set summary = summary where id = $1",
      delete: "delete from public.matters where id = $1",
    }[action as "read" | "write" | "delete"];
    if (sql) return yes((await c.query(sql, [matter])).rowCount === 1);
  }
  // Documents and research runs have no tables yet; they will use these rules.
  return fn("select private.can($1, $2, $3) as ok", [ws, matter, action]);
}

export async function dbAuthAdapter(): Promise<AuthAdapter> {
  const db = await testDb();
  return {
    owner: "bedrock 1: matters database (supabase/migrations)",
    check: (ac) => db.as(ac.actor, (c) => decide(c, ac)),
    checkWithClaimedRole: (ac, claimedRole) =>
      db.as(ac.actor, (c) => decide(c, ac), {
        app_role: claimedRole,
        user_metadata: { role: claimedRole, job_title: claimedRole },
      }),
  };
}
