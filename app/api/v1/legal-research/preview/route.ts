import { complete } from "@/lib/ai";
import { researchPreview } from "@/lib/legal/api";
import { getRegistry } from "@/lib/legal/registry";

export const dynamic = "force-dynamic";
// Provider fetches plus up to two model calls.
export const maxDuration = 60;

/**
 * Uses the AI model routing module for research.draft and
 * research.verify_support. Without an AI key it answers extractively.
 */
export function POST(req: Request) {
  return researchPreview(getRegistry(), req, { complete });
}
