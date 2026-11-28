/**
 * Per-provider concurrency gate. Some upstream relays reject bursts, so the panel lets a supplier
 * declare a custom in-flight cap; requests beyond the cap wait in FIFO order and are admitted as
 * soon as an earlier stream finishes. A cap of 0 (or any non-positive value) means "unlimited" and
 * returns the exact native iterable with no queueing, no timers, and no extra objects.
 */
interface Gate {
  active: number;
  waiters: (() => void)[];
}

export class ProviderLimiter {
  private readonly gates = new Map<string, Gate>();

  private gate(providerId: string): Gate {
    let gate = this.gates.get(providerId);
    if (!gate) { gate = { active: 0, waiters: [] }; this.gates.set(providerId, gate); }
    return gate;
  }

  /** Hands the slot to the oldest waiter instead of dropping the counter, so active never exceeds the cap. */
  private releaser(gate: Gate): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = gate.waiters.shift();
      if (next) next();
      else gate.active = Math.max(0, gate.active - 1);
    };
  }

  async acquire(providerId: string, limit: number): Promise<() => void> {
    if (!Number.isInteger(limit) || limit <= 0) return () => {};
    const gate = this.gate(providerId);
    if (gate.active < limit) { gate.active++; return this.releaser(gate); }
    await new Promise<void>(resolve => gate.waiters.push(resolve));
    return this.releaser(gate);
  }

  /**
   * Wraps an async iterable so that the upstream stream is only opened after a slot is granted, and
   * the slot is returned on completion, error, or early consumer return.
   */
  wrap<T>(providerId: string, limit: number, factory: () => AsyncIterable<T>): AsyncIterable<T> {
    if (!Number.isInteger(limit) || limit <= 0) return factory();
    const self = this;
    return {
      [Symbol.asyncIterator](): AsyncIterator<T> {
        let iterator: AsyncIterator<T> | undefined;
        let release: (() => void) | undefined;
        const finish = () => { const done = release; release = undefined; iterator = undefined; done?.(); };
        return {
          async next(...args: [] | [unknown]): Promise<IteratorResult<T>> {
            if (!iterator) {
              release = await self.acquire(providerId, limit);
              try { iterator = factory()[Symbol.asyncIterator](); }
              catch (error) { finish(); throw error; }
            }
            try {
              const result = await iterator.next(...(args as []));
              if (result.done) finish();
              return result;
            } catch (error) { finish(); throw error; }
          },
          async return(value?: T): Promise<IteratorResult<T>> {
            try { return iterator?.return ? await iterator.return(value) : { done: true as const, value: value as T }; }
            finally { finish(); }
          },
          async throw(error?: unknown): Promise<IteratorResult<T>> {
            try {
              if (iterator?.throw) return await iterator.throw(error);
              throw error;
            } finally { finish(); }
          },
        } as AsyncIterator<T>;
      },
    };
  }

  usage(providerId: string): { active: number; queued: number } {
    const gate = this.gates.get(providerId);
    return gate ? { active: gate.active, queued: gate.waiters.length } : { active: 0, queued: 0 };
  }

  clear(): void { this.gates.clear(); }
}
