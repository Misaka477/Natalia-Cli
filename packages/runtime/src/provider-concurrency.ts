/**
 * Per-provider concurrency limiting — the fan-out ceiling.
 *
 * N parallel sub-agents each call the provider; without a cap they trip rate
 * limits (429s) and hammer the provider. This is a semaphore keyed by provider
 * id: a stream acquires a slot before starting and releases it when the stream
 * ends, so excess requests queue instead of racing. The caps are user
 * configured (`runtime.providerConcurrency`); an absent provider is unlimited.
 */
export class ProviderConcurrencyLimiter {
  private active = new Map<string, number>();
  private queues = new Map<string, Array<() => void>>();

  constructor(private readonly caps: Record<string, number>) {}

  /** Acquires a slot for a provider; returns the release function. */
  async acquire(provider: string): Promise<() => void> {
    const cap = this.caps[provider] ?? Infinity;
    if (cap === Infinity) return () => undefined;
    const active = this.active.get(provider) ?? 0;
    if (active < cap) {
      this.active.set(provider, active + 1);
      return () => this.release(provider);
    }
    return await new Promise<() => void>((resolve) => {
      const queue = this.queues.get(provider) ?? [];
      queue.push(() => {
        this.active.set(provider, (this.active.get(provider) ?? 0) + 1);
        resolve(() => this.release(provider));
      });
      this.queues.set(provider, queue);
    });
  }

  /** In-flight requests for a provider. */
  activeCount(provider: string): number {
    return this.active.get(provider) ?? 0;
  }

  /** The configured cap for a provider (Infinity when unlimited). */
  capFor(provider: string): number {
    return this.caps[provider] ?? Infinity;
  }

  private release(provider: string) {
    const active = (this.active.get(provider) ?? 1) - 1;
    if (active <= 0) this.active.delete(provider);
    else this.active.set(provider, active);
    const next = this.queues.get(provider)?.shift();
    if (next) next();
  }
}

/**
 * Wraps a provider stream with a concurrency slot: the slot is acquired before
 * the first chunk and released when the stream ends (success or throw).
 */
export async function* withProviderConcurrency<T>(
  limiter: ProviderConcurrencyLimiter,
  provider: string,
  run: () => AsyncIterable<T>,
): AsyncGenerator<T> {
  const release = await limiter.acquire(provider);
  try {
    yield* run();
  } finally {
    release();
  }
}
