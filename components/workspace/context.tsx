"use client";
import { createContext, useContext } from "react";
import type { LoadedWorkspace } from "./useWorkspaceController";

export const WorkspaceContext = createContext<LoadedWorkspace | null>(null);

/** Workspace state for any component rendered inside the loaded shell. */
export function useWorkspace(): LoadedWorkspace {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside <Workspace>");
  return value;
}
