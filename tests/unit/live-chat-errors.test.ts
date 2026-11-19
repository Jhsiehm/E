import { describe, expect, it } from "vitest";
import { aiAccountProblem } from "@/lib/adapters/live/chat";
import { AiError } from "@/lib/ai";

describe("aiAccountProblem", () => {
  it("names key, credit and BYOK-only account problems", () => {
    expect(aiAccountProblem(new AiError("unauthorized", "401"))).toMatch(
      /rejected/,
    );
    expect(
      aiAccountProblem(new AiError("insufficient_credits", "402")),
    ).toMatch(/credits/);
    expect(
      aiAccountProblem(
        new AiError(
          "provider_error",
          "OpenRouter returned 404: No endpoints found that can be served by your own provider keys.",
        ),
      ),
    ).toMatch(/workspace settings/);
  });
  it("leaves other failures alone", () => {
    expect(aiAccountProblem(new AiError("timeout", "slow"))).toBeNull();
    expect(aiAccountProblem(new Error("boom"))).toBeNull();
    expect(aiAccountProblem(null)).toBeNull();
  });
});
