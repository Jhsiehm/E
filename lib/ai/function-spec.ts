import type { DataClass, ModelId } from "./models";
import type { Tier } from "./tiers";

export type Surface = "web" | "mobile" | "worker";
export type Phase = "P2" | "P3" | "P4" | "P5" | "P6";

export interface AiFunctionSpec {
  key: string;
  label: string;
  /** Where the user triggers it; every call still runs server-side. */
  surfaces: readonly Surface[];
  phase: Phase;
  tier: Tier;
  dataClass: DataClass;
  /** Replaces the tier chain when set. */
  chain?: readonly ModelId[];
  /** No model in this function's chain may share a vendor with any model in that function's chain (fallbacks included). Enforced by resolveRoute. */
  independentOf?: string;
  structuredOutput: boolean;
  temperature: number;
  typicalInputTokens: number;
  typicalOutputTokens: number;
  maxOutputTokens: number;
  /** Overrides the tier ceiling when set. */
  maxUsdPerCall?: number;
  why: string;
}
