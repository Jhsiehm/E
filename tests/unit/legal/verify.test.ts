import { describe, expect, it } from "vitest";
import { checkQuote } from "@/lib/legal/verify";

const passage =
  "To state a claim under the statute, a plaintiff must allege that the defendant engaged in consumer-oriented conduct, that the conduct was materially misleading, and that the plaintiff suffered injury.";

describe("checkQuote", () => {
  it("matches exactly despite case and curly quotes", () => {
    const r = checkQuote(
      "“A PLAINTIFF MUST ALLEGE that the defendant engaged in consumer-oriented conduct”",
      passage,
    );
    expect(r.status).toBe("exact");
    expect(r.span).not.toBeNull();
  });

  it("accepts ellipses when fragments appear in order", () => {
    expect(
      checkQuote(
        "a plaintiff must allege … the conduct was materially misleading",
        passage,
      ).status,
    ).toBe("exact");
    expect(
      checkQuote(
        "the conduct was materially misleading … a plaintiff must allege",
        passage,
      ).status,
    ).not.toBe("exact");
  });

  it("allows a one-word slip as fuzzy", () => {
    const r = checkQuote(
      "a plaintiff must allege that the defendant engaged in consumer-oriented behavior, that the conduct was materially misleading",
      passage,
    );
    expect(r.status).toBe("fuzzy");
    expect(r.similarity).toBeGreaterThanOrEqual(0.9);
  });

  it("rejects a near-match that flips negation", () => {
    const text =
      "The statute does not require reliance, but the plaintiff must show that the deceptive act caused actual injury.";
    expect(
      checkQuote(
        "The statute does now require reliance, but the plaintiff must show that the deceptive act caused actual injury.",
        text,
      ).status,
    ).toBe("mismatch");
    expect(
      checkQuote(
        "The statute does require reliance, but the plaintiff must show that the deceptive act caused actual injury.",
        text,
      ).status,
    ).toBe("mismatch");
    expect(
      checkQuote(
        "The statute does not require reliance, but a plaintiff must show that the deceptive act caused actual injury.",
        text,
      ).status,
    ).toBe("fuzzy");
  });

  it("rejects fabricated quotes and trivially short ones", () => {
    expect(
      checkQuote(
        "reliance is an essential element of every claim under the statute",
        passage,
      ).status,
    ).toBe("mismatch");
    expect(checkQuote("the", passage).status).toBe("mismatch");
  });
});
