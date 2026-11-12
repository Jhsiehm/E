import { researchPreview } from "@/lib/legal/api";
import { getRegistry } from "@/lib/legal/registry";

export const dynamic = "force-dynamic";
// Provider fetches plus up to two model calls.
export const maxDuration = 60;

// The AI model routing module (@/lib/ai) is passed as `complete` once it is
// on main; until then this endpoint returns extractive answers.
export function POST(req: Request) {
  return researchPreview(getRegistry(), req);
}
