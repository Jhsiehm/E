// Citation verification: real (synthetic-corpus) citations verify, invented
// or misquoted ones are rejected and never presented as verified.

import { describe, expect, it } from "vitest";
import { citationProbes } from "../shared/fixtures/citations";
import { citationAdapter, THREADS } from "./adapters";

const cite = await citationAdapter();

describe.skipIf(!cite)(`citation verification [${THREADS.sources}]`, () => {
  for (const probe of citationProbes) {
    it(`${probe.mustReject ? "REJECT" : "ACCEPT"}: ${probe.name}`, async () => {
      const r = await cite!.verify(probe);
      expect(r.verified).toBe(!probe.mustReject);
      expect([probe.expected, ...(probe.alsoAcceptable ?? [])]).toContain(
        r.state,
      );
    });
  }

  it("zero invented-citation acceptance across the negative set", async () => {
    const accepted = [];
    for (const p of citationProbes.filter((x) => x.mustReject))
      if ((await cite!.verify(p)).verified) accepted.push(p.name);
    expect(accepted).toEqual([]);
  });
});

describe.skipIf(!!cite)("citation verification (pending)", () => {
  it.todo(
    `waiting on "${THREADS.sources}" to land; wire citationAdapter() in tests/cross-module/adapters.ts`,
  );
});
