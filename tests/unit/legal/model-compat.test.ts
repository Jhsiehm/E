/**
 * Type-level check that a function shaped like `complete` from @/lib/ai
 * (PR #3: optional provider, RunBudget | number budget, extra deps param,
 * usage field) is assignable to the legal pipeline's Complete slot.
 * Replace the local copy with the real import once lib/ai is on main.
 */
import { describe, expect, it } from "vitest";
import type { Complete } from "@/lib/legal/model";

class RunBudget {
  constructor(readonly maxUsd: number) {}
}
interface AiCompleteRequest<T> {
  task:
    | "research.plan"
    | "research.draft"
    | "research.verify_support"
    | "research.rerank"
    | "research.route";
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  responseSchema?: { parse: (value: unknown) => T } | ((value: unknown) => T);
  budgetUsd?: RunBudget | number;
  promptVersion?: string;
  signal?: AbortSignal;
  onUsage?: (usage: unknown) => void | Promise<void>;
}
interface AiCompleteResult<T> {
  output: T;
  modelId: string;
  provider?: string;
  costUsd: number;
  usage: { costUsd: number };
}
type AiComplete = <T = string>(
  req: AiCompleteRequest<T>,
  deps?: object,
) => Promise<AiCompleteResult<T>>;

describe("model slot", () => {
  it("accepts lib/ai's complete() without an adapter", () => {
    const aiComplete = null as unknown as AiComplete;
    const slot: Complete = aiComplete; // fails tsc if the shapes drift
    expect(slot).toBeNull();
  });
});
