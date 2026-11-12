import { Suspense, type ReactNode } from "react";
import Workspace from "@/components/Workspace";

/**
 * The workspace lives in a layout so it stays mounted across client
 * navigations. Rendered from the catch-all page, it remounted on every route
 * change, refetched all state and flashed the boot screen between tabs.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<div className="boot">Opening Casevex…</div>}>
        <Workspace />
      </Suspense>
      {children}
    </>
  );
}
