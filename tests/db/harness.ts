// Creates a throwaway database with every Supabase migration applied, seeds
// the synthetic tenancy from tests/shared/fixtures/tenancy.ts, and runs SQL
// as a given person under row-level security. Needs CASEVEX_TEST_DATABASE_URL
// (a Postgres superuser URL); suites skip without it.

import { createHash, randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import {
  actors,
  MATTER_M1,
  MATTER_M2,
  MATTER_M_OPEN,
  WORKSPACE_A,
  WORKSPACE_B,
  type ActorKey,
} from "../shared/fixtures/tenancy";

export const TEST_DB_URL = process.env.CASEVEX_TEST_DATABASE_URL;

const ROOT = join(import.meta.dirname, "..", "..");

/** Stable uuid for a fixture id such as "u_a1" or "matter_m1". */
export function uuidFor(id: string): string {
  const h = createHash("md5").update(`casevex-fixture:${id}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function migrationFiles(): string[] {
  const dir = join(ROOT, "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
    .sort()
    .map((f) => join(dir, f));
}

export interface TestDb {
  pool: pg.Pool;
  /** Runs fn inside a transaction as the actor (RLS applies), then rolls back. */
  as<T>(
    actor: ActorKey,
    fn: (c: pg.PoolClient) => Promise<T>,
    extraClaims?: Record<string, unknown>,
  ): Promise<T>;
  close(): Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  if (!TEST_DB_URL) throw new Error("CASEVEX_TEST_DATABASE_URL is not set");
  const name = `casevex_test_${randomBytes(4).toString("hex")}`;
  const admin = new pg.Client({ connectionString: TEST_DB_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(TEST_DB_URL);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 4 });
  await pool.query(
    readFileSync(join(import.meta.dirname, "supabase-shim.sql"), "utf8"),
  );
  for (const file of migrationFiles())
    await pool.query(readFileSync(file, "utf8"));
  await seedTenancy(pool);

  return {
    pool,
    async as(actor, fn, extraClaims = {}) {
      const a = actors[actor];
      const c = await pool.connect();
      try {
        await c.query("begin");
        if (a.status === "anonymous") await c.query("set local role anon");
        else {
          await c.query("set local role authenticated");
          await c.query("select set_config('request.jwt.claims', $1, true)", [
            JSON.stringify({
              sub: uuidFor(a.id),
              role: "authenticated",
              ...extraClaims,
            }),
          ]);
        }
        return await fn(c);
      } finally {
        await c.query("rollback").catch(() => undefined);
        c.release();
      }
    },
    async close() {
      await pool.end();
      const a = new pg.Client({ connectionString: TEST_DB_URL });
      await a.connect();
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

async function seedTenancy(pool: pg.Pool) {
  const people = Object.values(actors).filter((a) => a.status !== "anonymous");
  for (const a of people)
    await pool.query("insert into auth.users (id, email) values ($1, $2)", [
      uuidFor(a.id),
      a.email,
    ]);
  const ws = [
    [WORKSPACE_A, "Firm A", actors.ownerA.id],
    [WORKSPACE_B, "Firm B", actors.attorneyB1.id],
  ];
  for (const [id, wsName, by] of ws)
    await pool.query(
      "insert into public.workspaces (id, name, slug, created_by) values ($1, $2, $3, $4)",
      [uuidFor(id), wsName, id.replace("_", "-"), uuidFor(by)],
    );
  for (const a of people)
    await pool.query(
      "insert into public.memberships (workspace_id, user_id, role, status) values ($1, $2, $3, $4)",
      [
        uuidFor(a.workspaceId!),
        uuidFor(a.id),
        a.role,
        a.status === "active" ? "active" : "removed",
      ],
    );
  const matters = [
    [MATTER_M1, WORKSPACE_A, actors.attorneyA1.id],
    [MATTER_M_OPEN, WORKSPACE_A, actors.ownerA.id],
    [MATTER_M2, WORKSPACE_B, actors.attorneyB1.id],
  ];
  for (const [id, w, by] of matters)
    await pool.query(
      "insert into public.matters (id, workspace_id, name, created_by) values ($1, $2, $3, $4)",
      [uuidFor(id), uuidFor(w), `Matter ${id}`, uuidFor(by)],
    );
  for (const a of people)
    for (const m of a.matters)
      await pool.query(
        "insert into public.matter_members (workspace_id, matter_id, user_id) values ($1, $2, $3)",
        [uuidFor(a.workspaceId!), uuidFor(m), uuidFor(a.id)],
      );
}
