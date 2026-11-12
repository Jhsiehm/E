"use client";
import Link from "next/link";
import ResearchProgress from "@/components/ResearchProgress";
import { sources as sampleSources } from "@/lib/mock/data";
import { Foot } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";

/** Research motion preview. */
export default function MotionModal() {
  const { selected, setSelected } = useWorkspace();
  return (
    <>
      <p>
        The source-by-source animation imported from your phone prototype,
        adapted to the Casevex research workspace.
      </p>
      <ResearchProgress key={selected} sources={sampleSources} />
      <div className="actions">
        <button onClick={() => setSelected(crypto.randomUUID())}>
          Replay animation
        </button>
        <Link className="button primary" href="/matters/anderson/chat">
          Try in agent chat
        </Link>
      </div>
      <Foot />
    </>
  );
}
