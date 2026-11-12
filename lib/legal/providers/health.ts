/** In-process provider health for coverage reporting (05 failure behavior). */
export const STALE_AFTER_MS = 72 * 60 * 60 * 1000;

export class HealthTracker {
  private lastSucceededAt: string | null = null;
  private lastError: string | null = null;
  private lastFailedAt = 0;

  constructor(private readonly now: () => number = Date.now) {}

  async track<T>(p: Promise<T>): Promise<T> {
    try {
      const v = await p;
      this.lastSucceededAt = new Date(this.now()).toISOString();
      this.lastError = null;
      return v;
    } catch (err) {
      this.lastFailedAt = this.now();
      this.lastError = err instanceof Error ? err.message : "provider error";
      throw err;
    }
  }

  snapshot() {
    const ok = this.lastSucceededAt ? Date.parse(this.lastSucceededAt) : 0;
    return {
      lastSucceededAt: this.lastSucceededAt,
      lastError: this.lastError,
      // Degraded when the newest event is a failure or success is too old.
      stale:
        this.lastFailedAt > ok || (ok > 0 && this.now() - ok > STALE_AFTER_MS),
    };
  }
}
