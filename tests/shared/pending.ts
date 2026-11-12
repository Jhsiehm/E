// Lets cross-module suites be written before the module they test is merged.
// An adapter asks for a module by repo path; if the file is not on this branch
// yet, it gets null and its suites skip with a note, then switch on
// automatically once the module lands on the branch under test.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

function resolve(repoPath: string): string | null {
  for (const ext of [".ts", ".tsx", ".mts", ".js", ".mjs", "/index.ts"])
    if (existsSync(root + repoPath + ext)) return root + repoPath + ext;
  return null;
}

export function hasModule(repoPath: string): boolean {
  return resolve(repoPath) !== null;
}

export async function loadModule<T = Record<string, unknown>>(
  repoPath: string,
): Promise<T | null> {
  const file = resolve(repoPath);
  if (!file) return null;
  return (await import(/* @vite-ignore */ file)) as T;
}
