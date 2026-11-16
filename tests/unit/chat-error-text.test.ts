import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { chatErrorText } from "@/components/workspace/chat-state";

const err = (status: number, code: string, message: string) =>
  new ApiError({ status, code, message });

describe("chatErrorText", () => {
  it("never shows the host's wording for a platform timeout", () => {
    const t = chatErrorText(
      err(504, "service_unavailable", "An error occurred with your deployment"),
    );
    expect(t).toMatch(/took too long/);
    expect(t).not.toMatch(/deployment/);
  });
  it("shows our own written messages for 4xx and 503", () => {
    expect(chatErrorText(err(429, "rate_limited", "Budget reached."))).toBe(
      "Budget reached.",
    );
    expect(
      chatErrorText(err(503, "service_not_configured", "Not switched on.")),
    ).toBe("Not switched on.");
  });
  it("falls back for other failures", () => {
    expect(chatErrorText(err(500, "service_unavailable", "x"))).toMatch(
      /could not finish/,
    );
    expect(chatErrorText(new Error("boom"))).toMatch(/could not be sent/);
  });
});
