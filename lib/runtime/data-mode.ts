/**
 * Decides whether the app serves synthetic fixtures or the live backend.
 *
 * Rules (docs/decisions/0003-fixture-and-live-adapters.md):
 * - Development and test builds default to "fixture".
 * - Production builds (NODE_ENV=production) default to "live" and NEVER fall
 *   back to fixtures. A production build serves fixtures only when
 *   CASEVEX_DATA_MODE=fixture is set explicitly (the public demo deployment).
 * - A pilot/customer deployment (CASEVEX_DEPLOYMENT=pilot) refuses fixture mode
 *   outright, even when CASEVEX_DATA_MODE=fixture is set.
 */
export type DataMode = "fixture" | "live";
export type Deployment = "demo" | "pilot";

export const DATA_MODE_HEADER = "X-Casevex-Data-Mode";

type Env = Partial<
  Record<"NODE_ENV" | "CASEVEX_DATA_MODE" | "CASEVEX_DEPLOYMENT", string>
>;

export class DataModeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataModeConfigError";
  }
}

function read<T extends string>(
  name: keyof Env,
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if (!(allowed as readonly string[]).includes(v))
    throw new DataModeConfigError(
      `${name} must be one of ${allowed.join(", ")} (got "${v}")`,
    );
  return v as T;
}

export function resolveDeployment(env: Env = process.env): Deployment {
  return (
    read("CASEVEX_DEPLOYMENT", env.CASEVEX_DEPLOYMENT, [
      "demo",
      "pilot",
    ] as const) ?? "demo"
  );
}

export function resolveDataMode(env: Env = process.env): DataMode {
  const requested = read("CASEVEX_DATA_MODE", env.CASEVEX_DATA_MODE, [
    "fixture",
    "live",
  ] as const);
  if (resolveDeployment(env) === "pilot") {
    if (requested === "fixture")
      throw new DataModeConfigError(
        "Fixture data is forbidden when CASEVEX_DEPLOYMENT=pilot.",
      );
    return "live";
  }
  if (requested) return requested;
  return env.NODE_ENV === "production" ? "live" : "fixture";
}
