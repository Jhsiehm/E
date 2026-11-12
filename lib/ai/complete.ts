import {
  RunBudget,
  runAiFunction,
  type AiUsage,
  type ChatMessage,
  type ClientDeps,
} from "./client";
import type { AiFunctionKey } from "./functions";

/**
 * Thin call shape for feature code (retrieval, agents, monitoring):
 *
 *   const { output, modelId, provider, costUsd } = await complete({
 *     task: "research.plan",
 *     messages,
 *     responseSchema: PlanSchema,   // anything with parse(), e.g. a zod schema
 *     budgetUsd: runBudget,         // RunBudget shared across the run, or a number
 *   });
 *
 * `task` is an AI function key from functions.ts; the model is chosen by
 * routing.ts, never by the caller.
 */
export interface CompleteRequest<T> {
  task: AiFunctionKey;
  messages: ChatMessage[];
  responseSchema?: { parse: (value: unknown) => T } | ((value: unknown) => T);
  /** Shared run budget, or a one-off ceiling in USD for this call. */
  budgetUsd?: RunBudget | number;
  promptVersion?: string;
  signal?: AbortSignal;
  onUsage?: (usage: AiUsage) => void | Promise<void>;
}

export interface CompleteResult<T> {
  output: T;
  modelId: string;
  provider?: string;
  costUsd: number;
  usage: AiUsage;
}

export async function complete<T = string>(
  req: CompleteRequest<T>,
  deps?: ClientDeps,
): Promise<CompleteResult<T>> {
  const schema = req.responseSchema;
  const parse = !schema
    ? undefined
    : typeof schema === "function"
      ? schema
      : (v: unknown) => schema.parse(v);
  const budget =
    typeof req.budgetUsd === "number"
      ? new RunBudget(req.budgetUsd)
      : req.budgetUsd;
  const r = await runAiFunction<T>(
    req.task,
    {
      messages: req.messages,
      parse,
      budget,
      promptVersion: req.promptVersion,
      signal: req.signal,
      onUsage: req.onUsage,
    },
    deps,
  );
  return {
    output: r.data,
    modelId: r.usage.modelUsed,
    provider: r.usage.provider,
    costUsd: r.usage.costUsd,
    usage: r.usage,
  };
}
