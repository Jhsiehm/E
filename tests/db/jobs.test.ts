// Background jobs: who may queue them, exclusive claims, retries, leases,
// and the worker loop end to end on a real Postgres.

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HANDLERS } from "@/worker/handlers";
import { runOnce } from "@/worker/run";
import { PgJobStore } from "@/worker/store";
import {
  MATTER_M1,
  MATTER_M_OPEN,
  WORKSPACE_A,
  actors,
} from "../shared/fixtures/tenancy";
import { TEST_DB_URL, createTestDb, uuidFor, type TestDb } from "./harness";

const A = uuidFor(WORKSPACE_A);
const M1 = uuidFor(MATTER_M1);
const OPEN = uuidFor(MATTER_M_OPEN);
type Who = Parameters<TestDb["as"]>[0];

describe.skipIf(!TEST_DB_URL)("background jobs", () => {
  let db: TestDb;
  let workerPool: pg.Pool;
  beforeAll(async () => {
    db = await createTestDb();
    workerPool = new pg.Pool({
      connectionString: db.url,
      options: "-c role=casevex_worker",
      max: 4,
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
  const enqueue = (
    who: Who,
    matter: string | null,
    key: string | null = null,
  ) =>
    db.as(who, (c) =>
      c
        .query(
          "select public.enqueue_job($1, 'system.ping', '{}', $2, $3) as id",
          [A, matter, key],
        )
        .then((r) => r.rows[0].id as string),
    );

  it("people queue jobs only on matters they can edit", async () => {
    expect(await state(enqueue("attorneyA1", M1))).toBe("ok");
    expect(await state(enqueue("paralegalA2", M1))).toBe("42501"); // walled off
    expect(await state(enqueue("viewerA3", OPEN))).toBe("42501"); // read-only
    expect(await state(enqueue("attorneyB1", OPEN))).toBe("42501"); // other firm
  });

  it("the same idempotency key never queues the job twice", async () => {
    const insert = (c: pg.PoolClient) =>
      c.query(
        "select public.enqueue_job($1, 'system.ping', '{}', $2, 'upload-42') as id",
        [A, OPEN],
      );
    await db.as("paralegalA2", async (c) => {
      const a = (await insert(c)).rows[0].id;
      const b = (await insert(c)).rows[0].id;
      expect(a).toBe(b);
    });
  });

  it("people cannot claim or finish jobs; only the worker role can", async () => {
    expect(
      await db.as("ownerA", (c) =>
        state(
          c.query("select * from worker.claim_jobs('x', array['system.ping'])"),
        ),
      ),
    ).toBe("42501");
  });

  it("two workers never get the same job", async () => {
    const ids = await Promise.all(
      Array.from({ length: 6 }, () =>
        db.pool.query(
          "insert into public.jobs (workspace_id, kind) values ($1, 'system.race') returning id",
          [A],
        ),
      ),
    );
    expect(ids).toHaveLength(6);
    const claim = (w: string) =>
      workerPool
        .query(
          "select id from worker.claim_jobs($1, array['system.race'], 6)",
          [w],
        )
        .then((r) => r.rows.map((x) => x.id as string));
    const [a, b] = await Promise.all([claim("w1"), claim("w2")]);
    expect(a.length + b.length).toBe(6);
    expect(a.filter((id) => b.includes(id))).toEqual([]);
  });

  it("retries with a wait, then stops as failed with the reason", async () => {
    const { rows } = await db.pool.query(
      "insert into public.jobs (workspace_id, kind, max_attempts) values ($1, 'system.flaky', 2) returning id",
      [A],
    );
    const id = rows[0].id;
    const cycle = async () => {
      await db.pool.query(
        "update public.jobs set run_after = now() where id = $1",
        [id],
      );
      await workerPool.query(
        "select worker.claim_jobs('w', array['system.flaky'])",
      );
      const r = await workerPool.query(
        "select worker.fail_job($1, 'w', 'Court site is down.') as s",
        [id],
      );
      return r.rows[0].s;
    };
    expect(await cycle()).toBe("queued");
    expect(await cycle()).toBe("failed");
    const job = await db.pool.query(
      "select last_error, attempts from public.jobs where id = $1",
      [id],
    );
    expect(job.rows[0]).toEqual({
      last_error: "Court site is down.",
      attempts: 2,
    });
  });

  it("a job whose worker died is picked up again when the lease runs out", async () => {
    const { rows } = await db.pool.query(
      "insert into public.jobs (workspace_id, kind) values ($1, 'system.lease') returning id",
      [A],
    );
    await workerPool.query(
      "select worker.claim_jobs('dead', array['system.lease'], 1, 1)",
    );
    expect(
      (
        await workerPool.query(
          "select * from worker.claim_jobs('w2', array['system.lease'])",
        )
      ).rowCount,
    ).toBe(0);
    await db.pool.query(
      "update public.jobs set locked_until = now() - interval '1 second' where id = $1",
      [rows[0].id],
    );
    const again = await workerPool.query(
      "select attempts from worker.claim_jobs('w2', array['system.lease'])",
    );
    expect(again.rows[0].attempts).toBe(2);
    // The dead worker can no longer finish it.
    const late = await workerPool.query(
      "select worker.complete_job($1, 'dead') as ok",
      [rows[0].id],
    );
    expect(late.rows[0].ok).toBe(false);
  });

  it("the worker loop runs a queued job to success, visible to the person who queued it", async () => {
    const id = await db.as("attorneyA1", async (c) => {
      const r = await c.query(
        "select public.enqueue_job($1, 'system.ping', '{}', $2) as id",
        [A, M1],
      );
      await c.query("commit");
      return r.rows[0].id as string;
    });
    const store = new PgJobStore(workerPool);
    while (
      (await runOnce(store, { workerId: "loop", handlers: HANDLERS })) > 0
    );
    const status = (who: Who) =>
      db.as(
        who,
        async (c) =>
          (
            await c.query(
              "select status, result from public.jobs where id = $1",
              [id],
            )
          ).rows[0],
      );
    expect(await status("attorneyA1")).toMatchObject({
      status: "succeeded",
      result: { pong: true },
    });
    expect(await status("paralegalA2")).toBeUndefined(); // not on M1
    expect(actors.attorneyA1.matters).toContain(MATTER_M1);
  });
});
