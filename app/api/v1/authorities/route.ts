import { searchAuthorities } from "@/lib/legal/api";
import { getRegistry } from "@/lib/legal/registry";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return searchAuthorities(getRegistry(), req);
}
