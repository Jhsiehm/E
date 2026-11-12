import { getCoverage } from "@/lib/legal/api";
import { getRegistry } from "@/lib/legal/registry";

export const dynamic = "force-dynamic";

export function GET() {
  return getCoverage(getRegistry());
}
