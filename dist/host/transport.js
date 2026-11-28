import { AsyncLocalStorage } from 'node:async_hooks';
import { transformRequest } from '../core/transform.js';
import { bridgeResponse } from './response.js';
const key = Symbol.for('dsh-mimic.transport.v1');
const shared = globalThis;
const maxBodyBytes = 16 * 1024 * 1024;
export function detectProtocol(url) {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    if (/\/chat\/completions$/.test(path))
        return 'openai-chat-completions';
    if (/\/responses$/.test(path))
        return 'openai-responses';
    if (/\/messages$/.test(path))
        return 'anthropic-messages';
    return undefined;
}
function matchesBase(url, base) {
    if (!base)
        return true;
    const a = new URL(url), b = new URL(base);
    const prefix = b.pathname.replace(/\/+$/, '');
    return a.origin === b.origin && (prefix === '' || prefix === '/' || a.pathname === prefix || a.pathname.startsWith(prefix + '/'));
}
function errorCode(error) {
    if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string')
        return error.code.slice(0, 80);
    return error instanceof SyntaxError ? 'INVALID_JSON_BODY' : 'REQUEST_TRANSFORM_FAILED';
}
const maxUsageChars = 4 * 1024 * 1024;
async function drainUsage(stream, sink) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let text = '';
    try {
        for (;;) {
            const chunk = await reader.read();
            if (chunk.done)
                break;
            if (text.length < maxUsageChars)
                text += decoder.decode(chunk.value, { stream: true });
        }
        if (text.length)
            sink(text);
    }
    catch { /* usage accounting must never surface as a request failure */ }
    finally {
        try {
            reader.releaseLock();
        }
        catch { /* already released by cancel */ }
    }
}
async function intercept(registry, scope, input, init) {
    const request = input instanceof Request ? input : undefined;
    const url = request?.url ?? String(input);
    const method = init?.method ?? request?.method ?? 'GET';
    let protocol;
    try {
        protocol = detectProtocol(url);
    }
    catch {
        return registry.original(input, init);
    }
    // Restrict to actual generation POSTs within the chosen provider's active async chain.
    if (method.toUpperCase() !== 'POST' || !protocol || !matchesBase(url, scope.rule.baseUrl ?? scope.baseUrl))
        return registry.original(input, init);
    if (scope.rule.client === 'none' || scope.rule.modelIds?.length && !scope.rule.modelIds.includes(scope.identity.modelId))
        return registry.original(input, init);
    let entry;
    try {
        let raw;
        if (typeof init?.body === 'string')
            raw = init.body;
        else if (init?.body instanceof Uint8Array)
            raw = new TextDecoder().decode(init.body);
        else if (init?.body instanceof ArrayBuffer)
            raw = new TextDecoder().decode(init.body);
        else if (init?.body instanceof Blob)
            raw = await init.body.text();
        else if (init?.body == null && request)
            raw = await request.clone().text();
        else
            throw Object.assign(new Error('Only JSON generation bodies are supported.'), { code: 'NON_JSON_GENERATION_BODY' });
        if (Buffer.byteLength(raw, 'utf8') > maxBodyBytes)
            throw Object.assign(new Error('Generation body exceeds 16 MiB.'), { code: 'BODY_TOO_LARGE' });
        const body = JSON.parse(raw);
        if (!body || typeof body !== 'object' || Array.isArray(body))
            throw Object.assign(new Error('Generation body must be a JSON object.'), { code: 'INVALID_JSON_BODY' });
        const headers = new Headers(init?.headers !== undefined ? init.headers : request?.headers);
        const context = { identity: { ...scope.identity, url, protocol }, rule: scope.rule, deviceId: scope.deviceId, accountId: scope.accountId };
        const result = transformRequest({ url, method, headers, body: body }, context);
        if (!result.changed)
            return registry.original(input, init);
        // Nothing is sent until BOTH transformations have completed successfully.
        const outgoing = {
            ...(request ? { method: request.method, signal: request.signal, credentials: request.credentials, redirect: request.redirect, cache: request.cache, mode: request.mode, referrer: request.referrer, referrerPolicy: request.referrerPolicy, integrity: request.integrity, keepalive: request.keepalive } : {}),
            ...init, method, headers: result.headers, body: JSON.stringify(result.body),
        };
        result.headers.delete('content-length');
        result.headers.delete('transfer-encoding');
        entry = scope.record(result, context);
        const response = await registry.original(result.url, outgoing);
        if (entry)
            entry.status = response.status;
        // Tee the reply so cache counters can be read without delaying or altering the caller's stream.
        if (scope.usage && response.ok && response.body) {
            const [caller, tap] = response.body.tee();
            void drainUsage(tap, scope.usage);
            return bridgeResponse(new Response(caller, { status: response.status, statusText: response.statusText, headers: response.headers }), result);
        }
        return bridgeResponse(response, result);
    }
    catch (error) {
        const code = errorCode(error);
        if (entry)
            entry.error = code;
        scope.onError(code);
        throw error;
    }
}
export function installTransport() {
    let registry = shared[key];
    if (!registry) {
        const original = globalThis.fetch;
        if (typeof original !== 'function')
            throw new Error('DSH Node runtime has no global fetch.');
        const storage = new AsyncLocalStorage();
        const created = { original, storage, leases: 0, wrapped: original };
        created.wrapped = ((input, init) => { const scope = storage.getStore(); return scope ? intercept(created, scope, input, init) : original(input, init); });
        globalThis.fetch = created.wrapped;
        shared[key] = created;
        registry = created;
    }
    const r = registry;
    r.leases++;
    let released = false;
    function bindFactory(run, factory) {
        const source = run(factory);
        return { [Symbol.asyncIterator]() {
                const iterator = run(() => source[Symbol.asyncIterator]());
                return {
                    next: (...args) => run(() => iterator.next(...args)),
                    return: (value) => run(() => iterator.return ? iterator.return(value) : Promise.resolve({ done: true, value })),
                    throw: (error) => run(() => iterator.throw ? iterator.throw(error) : Promise.reject(error)),
                };
            } };
    }
    return {
        run: (scope, fn) => r.storage.run(scope, fn),
        bind(scope, factory) {
            return bindFactory(fn => r.storage.run(scope, fn), factory);
        },
        bypass(factory) {
            // Fast path returns the exact native iterable; nested None calls shed their parent's scope.
            return r.storage.getStore() ? bindFactory(fn => r.storage.exit(fn), factory) : factory();
        },
        active: () => !released && r.leases > 0,
        registrations: () => r.leases,
        release() { if (released)
            return; released = true; if (--r.leases === 0) {
            if (globalThis.fetch === r.wrapped)
                globalThis.fetch = r.original;
            delete shared[key];
        } },
    };
}
//# sourceMappingURL=transport.js.map