/** Validates model output by hand (no schema dependency). */
import type { ClaimStatus, Draft, DraftItem } from "./research-types";

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 4000) =>
  typeof v === "string" ? v.slice(0, max) : "";
const strs = (v: unknown, n = 12) =>
  Array.isArray(v)
    ? v
        .filter((x) => typeof x === "string")
        .slice(0, n)
        .map((x) => (x as string).slice(0, 600))
    : [];

function item(v: unknown): DraftItem | null {
  if (!isObj(v)) return null;
  const text = str(v.text, 2000).trim();
  if (!text) return null;
  const quotes = Array.isArray(v.quotes)
    ? v.quotes
        .filter(isObj)
        .map((q) => ({ source: str(q.source, 16), text: str(q.text, 800) }))
        .filter((q) => q.source && q.text)
        .slice(0, 6)
    : [];
  return { text, sources: strs(v.sources, 8), quotes };
}

export function parseDraft(v: unknown): Draft {
  if (!isObj(v)) throw new Error("draft must be an object");
  return {
    summary: str(v.summary, 2000),
    analysis: (Array.isArray(v.analysis) ? v.analysis : [])
      .map(item)
      .filter((x): x is DraftItem => !!x)
      .slice(0, 12),
    contrary: (Array.isArray(v.contrary) ? v.contrary : [])
      .map(item)
      .filter((x): x is DraftItem => !!x)
      .slice(0, 8),
    limitations: strs(v.limitations),
    nextSteps: strs(v.nextSteps),
    insufficient: v.insufficient === true,
  };
}

export interface SupportVerdict {
  claim: string;
  status: Exclude<ClaimStatus, "no_source">;
  reason: string;
}
export function parseVerdicts(v: unknown): SupportVerdict[] {
  const list = isObj(v) && Array.isArray(v.verdicts) ? v.verdicts : [];
  const ok = ["supported", "partially_supported", "contradicted", "unverified"];
  return list
    .filter(isObj)
    .map((x) => ({
      claim: str(x.claim, 32),
      status: str(x.status, 32),
      reason: str(x.reason, 600),
    }))
    .filter((x): x is SupportVerdict => ok.includes(x.status));
}

// --- prompts ------------------------------------------------------------------
