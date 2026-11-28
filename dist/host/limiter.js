export class ProviderLimiter {
    gates = new Map();
    gate(providerId) {
        let gate = this.gates.get(providerId);
        if (!gate) {
            gate = { active: 0, waiters: [] };
            this.gates.set(providerId, gate);
        }
        return gate;
    }
    /** Hands the slot to the oldest waiter instead of dropping the counter, so active never exceeds the cap. */
    releaser(gate) {
        let released = false;
        return () => {
            if (released)
                return;
            released = true;
            const next = gate.waiters.shift();
            if (next)
                next();
            else
                gate.active = Math.max(0, gate.active - 1);
        };
    }
    async acquire(providerId, limit) {
        if (!Number.isInteger(limit) || limit <= 0)
            return () => { };
        const gate = this.gate(providerId);
        if (gate.active < limit) {
            gate.active++;
            return this.releaser(gate);
        }
        await new Promise(resolve => gate.waiters.push(resolve));
        return this.releaser(gate);
    }
    /**
     * Wraps an async iterable so that the upstream stream is only opened after a slot is granted, and
     * the slot is returned on completion, error, or early consumer return.
     */
    wrap(providerId, limit, factory) {
        if (!Number.isInteger(limit) || limit <= 0)
            return factory();
        const self = this;
        return {
            [Symbol.asyncIterator]() {
                let iterator;
                let release;
                const finish = () => { const done = release; release = undefined; iterator = undefined; done?.(); };
                return {
                    async next(...args) {
                        if (!iterator) {
                            release = await self.acquire(providerId, limit);
                            try {
                                iterator = factory()[Symbol.asyncIterator]();
                            }
                            catch (error) {
                                finish();
                                throw error;
                            }
                        }
                        try {
                            const result = await iterator.next(...args);
                            if (result.done)
                                finish();
                            return result;
                        }
                        catch (error) {
                            finish();
                            throw error;
                        }
                    },
                    async return(value) {
                        try {
                            return iterator?.return ? await iterator.return(value) : { done: true, value: value };
                        }
                        finally {
                            finish();
                        }
                    },
                    async throw(error) {
                        try {
                            if (iterator?.throw)
                                return await iterator.throw(error);
                            throw error;
                        }
                        finally {
                            finish();
                        }
                    },
                };
            },
        };
    }
    usage(providerId) {
        const gate = this.gates.get(providerId);
        return gate ? { active: gate.active, queued: gate.waiters.length } : { active: 0, queued: 0 };
    }
    clear() { this.gates.clear(); }
}
//# sourceMappingURL=limiter.js.map