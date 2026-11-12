/**
 * Builds the enabled provider set from the environment.
 *
 * - Fixture data mode: only the synthetic fixture provider. The demo never
 *   mixes sample matters with real law.
 * - Live mode: a real provider is enabled only when it is named in
 *   CASEVEX_LEGAL_PROVIDERS *and* its credential is set (05: "each disabled
 *   until verified access/rights").
 */
import { resolveDataMode, type DataMode } from "../runtime/data-mode";
import type { HttpOptions } from "./http";
import { CourtListenerAdapter } from "./providers/courtlistener";
import { FixtureAdapter } from "./providers/fixture";
import { GovInfoAdapter } from "./providers/govinfo";
import { NyLegislationAdapter } from "./providers/ny-legislation";
import { MemoryAuthorityStore, type AuthorityStore } from "./store";
import type { LegalProviderAdapter, ProviderId } from "./types";

type Env = Partial<Record<string, string>>;

export interface LegalRegistry {
  mode: DataMode;
  providers: LegalProviderAdapter[];
  /** Providers that exist and are switched on. */
  enabled: LegalProviderAdapter[];
  get(id: ProviderId): LegalProviderAdapter | undefined;
  store: AuthorityStore;
}

export function buildRegistry(
  env: Env = process.env,
  opts: { http?: HttpOptions; store?: AuthorityStore } = {},
): LegalRegistry {
  const mode = resolveDataMode(env);
  const store = opts.store ?? new MemoryAuthorityStore();
  let providers: LegalProviderAdapter[];
  if (mode === "fixture") providers = [new FixtureAdapter()];
  else {
    const listed = new Set(
      (env.CASEVEX_LEGAL_PROVIDERS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    providers = [
      new CourtListenerAdapter({
        token: env.COURTLISTENER_API_TOKEN,
        enabled: listed.has("courtlistener"),
        http: opts.http,
      }),
      new NyLegislationAdapter({
        apiKey: env.NY_OPENLEG_API_KEY,
        enabled: listed.has("ny_legislation"),
        http: opts.http,
      }),
      new GovInfoAdapter({
        apiKey: env.GOVINFO_API_KEY,
        enabled: listed.has("govinfo"),
        http: opts.http,
      }),
    ];
  }
  const enabled = providers.filter((p) => p.getCoverage().enabled);
  return {
    mode,
    providers,
    enabled,
    store,
    get: (id) => enabled.find((p) => p.id === id),
  };
}

let shared: LegalRegistry | undefined;

/** Process-wide registry so provider health and the cache persist per instance. */
export function getRegistry(): LegalRegistry {
  shared ??= buildRegistry();
  return shared;
}

export function resetRegistryForTests() {
  shared = undefined;
}

/** "courtlistener:123" -> ["courtlistener", "123"] for enabled providers. */
export function splitSourceId(id: string): [ProviderId, string] | null {
  const i = id.indexOf(":");
  if (i <= 0) return null;
  const provider = id.slice(0, i) as ProviderId;
  if (
    !["courtlistener", "ny_legislation", "govinfo", "fixture"].includes(
      provider,
    )
  )
    return null;
  return [provider, id.slice(i + 1)];
}
