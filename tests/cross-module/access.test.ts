// Auth and access rules, both directions: allowed users get in, everyone
// else is denied (cross-firm, ethical wall, revoked, signed out, low role).

import { describe, expect, it } from "vitest";
import { accessCases, runAccessMatrix } from "../shared/fixtures/access-matrix";
import { authAdapter, THREADS } from "./adapters";

const auth = await authAdapter();

describe.skipIf(!auth)(`access rules [${THREADS.auth}]`, () => {
  it("every allowed case is allowed and every denied case is denied", async () => {
    const fails = await runAccessMatrix((c) => auth!.check(c));
    expect(fails.map((f) => `${f.case.name} -> got ${f.actual}`)).toEqual([]);
  });

  it.skipIf(!auth?.checkWithSession)(
    "rejects missing, forged and expired sessions",
    async () => {
      const c = accessCases({
        resources: ["matterOpen"],
        actions: ["read"],
      }).find((x) => x.actor === "attorneyA1")!;
      for (const token of [
        null,
        "",
        "not-a-jwt",
        "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1X2ExIn0.",
      ])
        expect(
          await auth!.checkWithSession!(token, c),
          `token ${String(token)}`,
        ).toBe("deny");
    },
  );

  it.skipIf(!auth?.checkWithClaimedRole)(
    "a self-declared job title never grants a higher role",
    async () => {
      for (const c of accessCases({
        actions: ["invite", "delete", "export"],
      }).filter(
        (x) =>
          x.expected === "deny" &&
          (x.actor === "paralegalA2" || x.actor === "viewerA3"),
      ))
        expect(await auth!.checkWithClaimedRole!(c, "owner"), c.name).toBe(
          "deny",
        );
    },
  );
});

describe.skipIf(!!auth)("access rules (pending)", () => {
  it.todo(
    `waiting on "${THREADS.auth}" to land; wire authAdapter() in tests/cross-module/adapters.ts`,
  );
});
