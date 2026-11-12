"use client";
import { useWorkspace } from "@/components/workspace/context";

/** Data scoped to the matter in the current route. Only call under MatterPage (matter is resolved). */
export function useMatterScope() {
  const { data, matter: current } = useWorkspace();
  const matter = current!;
  const documents = data.documents.filter((d) => d.matterId === matter.id),
    deadlines = data.deadlines.filter((d) => d.matterId === matter.id),
    agent = data.agents.find((a) => a.id === matter.assignedAgentId);
  return { matter, documents, deadlines, agent };
}
