import { getPassages } from "@/lib/legal/api";
import { getRegistry } from "@/lib/legal/registry";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return getPassages(getRegistry(), (await params).id);
}
