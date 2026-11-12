import { resolveAuthority } from "@/lib/legal/api";
import { getRegistry } from "@/lib/legal/registry";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return resolveAuthority(getRegistry(), req);
}
