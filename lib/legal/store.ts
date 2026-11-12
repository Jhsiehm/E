/**
 * Authority text cache. In-memory until the authorities / authority_versions /
 * authority_passages tables exist (02 data model). A Postgres-backed store
 * implements the same interface; versions are immutable once stored.
 */
import type { AuthorityText } from "./types";

export interface AuthorityStore {
  get(authorityId: string): Promise<AuthorityText | undefined>;
  put(text: AuthorityText): Promise<void>;
}

export class MemoryAuthorityStore implements AuthorityStore {
  private readonly map = new Map<
    string,
    { value: AuthorityText; at: number }
  >();

  constructor(
    private readonly max = 200,
    private readonly ttlMs = 6 * 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  async get(id: string) {
    const hit = this.map.get(id);
    if (!hit) return undefined;
    if (this.now() - hit.at > this.ttlMs) {
      this.map.delete(id);
      return undefined;
    }
    // refresh LRU position
    this.map.delete(id);
    this.map.set(id, hit);
    return hit.value;
  }

  async put(value: AuthorityText) {
    this.map.delete(value.authority.id);
    this.map.set(value.authority.id, { value, at: this.now() });
    while (this.map.size > this.max)
      this.map.delete(this.map.keys().next().value!);
  }
}
