/** The legal model slot takes lib/ai's complete() with no adapter. */
import { describe, expect, it } from "vitest";
import { complete } from "@/lib/ai";
import { AiError, type Complete } from "@/lib/legal/model";
import { buildRegistry } from "@/lib/legal/registry";
import { answerQuestion } from "@/lib/legal/research";
import { retrieve } from "@/lib/legal/retrieve";

describe("model slot", () => {
  it("accepts lib/ai's complete() without an adapter", () => {
    const slot: Complete = complete; // fails tsc if the shapes drift
    expect(typeof slot).toBe("function");
  });

  it("falls back to an extractive answer when no AI key is configured", async () => {
    const question =
      "What must a plaintiff allege for a consumer protection claim?";
    const r = await retrieve(buildRegistry({ NODE_ENV: "test" }), { question });
    const notConfigured: Complete = async () => {
      throw new AiError("not_configured", "No AI key is set.");
    };
    const a = await answerQuestion(question, r, { complete: notConfigured });
    expect(a.mode).toBe("extractive");
    expect(a.answer.limitations[0]).toMatch(/No AI model is configured/);
  });

  it("surfaces other AI failures instead of hiding them", async () => {
    const question = "consumer protection claim";
    const r = await retrieve(buildRegistry({ NODE_ENV: "test" }), { question });
    const broken: Complete = async () => {
      throw new AiError("budget_exceeded", "over budget");
    };
    await expect(
      answerQuestion(question, r, { complete: broken }),
    ).rejects.toMatchObject({ code: "budget_exceeded" });
  });
});
