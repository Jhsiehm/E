import { describe, expect, it } from "vitest";
import { demoAnswer, sampleAnswer } from "@/lib/mock/data";

const anderson = { id: "anderson", name: "Anderson v. Meridian Tech" };
const parker = { id: "parker", name: "Parker Estates Trust" };

describe("demo chat answers", () => {
  it.each([
    "Summarize the new ruling",
    "What should our next filing emphasize?",
    "Draft the argument update",
    "How does Nexora affect us?",
  ])("gives the prepared Anderson answer for %s", (q) => {
    const a = demoAnswer(anderson, q);
    expect(a.text).toBe(sampleAnswer);
    expect(a.sources).toHaveLength(3);
  });

  it("never answers an unrelated question with the prepared answer", () => {
    const a = demoAnswer(
      anderson,
      "What is the statute of limitations for breach of contract in New York?",
    );
    expect(a.text).not.toBe(sampleAnswer);
    expect(a.text).toMatch(/No live legal research was performed/);
    expect(a.sources).toEqual([]);
  });

  it("labels answers on other matters as simulated", () => {
    const a = demoAnswer(parker, "Summarize the new ruling");
    expect(a.text).toMatch(/simulated research response for Parker/);
    expect(a.sources).toEqual([]);
  });
});
