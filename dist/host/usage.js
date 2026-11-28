const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
const count = (v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : undefined;
const own = (v, key) => Object.hasOwn(v, key);
export function readUsage(value, protocol) {
    const u = object(value), result = {};
    if (protocol === 'anthropic-messages') {
        const input = count(u.input_tokens), cached = count(u.cache_read_input_tokens), written = count(u.cache_creation_input_tokens);
        if (input !== undefined) {
            result.anthropicInput = input;
            result.input = input + (cached ?? 0) + (written ?? 0);
        }
        if (cached !== undefined)
            result.cached = cached;
        if (written !== undefined)
            result.cacheWrite = written;
        const output = count(u.output_tokens);
        if (output !== undefined)
            result.output = output;
    }
    else {
        const chat = protocol === 'openai-chat-completions';
        const input = count(u[chat ? 'prompt_tokens' : 'input_tokens']), output = count(u[chat ? 'completion_tokens' : 'output_tokens']);
        if (input !== undefined)
            result.input = input;
        if (output !== undefined)
            result.output = output;
        const inputDetails = object(u[chat ? 'prompt_tokens_details' : 'input_tokens_details']);
        const outputDetails = object(u[chat ? 'completion_tokens_details' : 'output_tokens_details']);
        const cached = count(inputDetails.cached_tokens) ?? count(u.cached_tokens);
        const written = count(inputDetails.cache_creation_tokens), reasoning = count(outputDetails.reasoning_tokens);
        if (cached !== undefined)
            result.cached = cached;
        if (written !== undefined)
            result.cacheWrite = written;
        if (reasoning !== undefined)
            result.reasoning = reasoning;
    }
    return result;
}
export function mergeUsage(current, incoming) {
    const merged = { ...current, ...incoming };
    // A later partial Claude snapshot can update either cache counter independently.
    if (merged.anthropicInput !== undefined)
        merged.input = merged.anthropicInput + merged.cached + merged.cacheWrite;
    return merged;
}
const MAX_EVENT_CHARS = 1024 * 1024;
const MAX_USAGE_CHARS = 64 * 1024;
const MAX_DEPTH = 128;
const MAX_KEY_CHARS = 256;
const MAX_SCALAR_CHARS = 256;
const SPACE = /[\x20\t\r\n]/;
/** Validates JSON while retaining only bounded usage objects and selected envelope scalars.
 * Content strings, tool inputs and output arrays are scanned and immediately discarded. */
class JsonProbe {
    malformed = false;
    limitExceeded = false;
    usages = new Map();
    metadata = new Map();
    stack = [];
    prefixes = new Set();
    usagePaths;
    scalarPaths = new Set(['type', 'status', 'error', 'response.type', 'response.status', 'response.error']);
    root = 'value';
    token;
    stringKind = 'value';
    raw;
    tokenPath;
    escaped = false;
    unicode = 0;
    capture;
    stopped = false;
    constructor(paths) {
        this.usagePaths = new Set(paths);
        for (const path of [...paths, ...this.scalarPaths]) {
            const parts = path.split('.');
            for (let i = 1; i <= parts.length; i++)
                this.prefixes.add(parts.slice(0, i).join('.'));
        }
    }
    pathKey(path) { return path?.join('.'); }
    valuePath() {
        const frame = this.stack[this.stack.length - 1];
        if (!frame)
            return [];
        if (frame.kind !== 'object' || frame.path === undefined || frame.key === undefined || frame.key.includes('.'))
            return undefined;
        const path = [...frame.path, frame.key];
        return this.prefixes.has(path.join('.')) ? path : undefined;
    }
    bad() { this.malformed = true; this.stopped = true; this.capture = undefined; }
    limited() { this.limitExceeded = true; this.stopped = true; this.capture = undefined; }
    appendCapture(char) {
        const capture = this.capture;
        if (!capture || capture.exceeded)
            return;
        if (capture.text.length >= MAX_USAGE_CHARS) {
            capture.text = '';
            capture.exceeded = true;
            this.limitExceeded = true;
        }
        else
            capture.text += char;
    }
    scalar(path, value) {
        const key = this.pathKey(path);
        if (key !== undefined && this.scalarPaths.has(key))
            this.metadata.set(key, value);
    }
    completeValue() {
        const parent = this.stack[this.stack.length - 1];
        if (parent) {
            parent.state = 'commaOrEnd';
            parent.key = undefined;
        }
        else
            this.root = 'done';
    }
    startValue(char) {
        const path = this.valuePath(), key = this.pathKey(path);
        // Match JSON's last-property-wins semantics without retaining parent objects.
        if (key) {
            for (const previous of this.usages.keys())
                if (previous === key || previous.startsWith(key + '.'))
                    this.usages.delete(previous);
            for (const previous of this.metadata.keys())
                if (previous === key || previous.startsWith(key + '.'))
                    this.metadata.delete(previous);
        }
        if (char === '{' || char === '[') {
            if (this.stack.length >= MAX_DEPTH) {
                this.limited();
                return;
            }
            if (key !== undefined && this.scalarPaths.has(key))
                this.metadata.set(key, true);
            if (char === '{' && key !== undefined && this.usagePaths.has(key) && !this.capture) {
                this.capture = { path: key, depth: this.stack.length + 1, text: '{', exceeded: false };
            }
            this.stack.push({ kind: char === '{' ? 'object' : 'array', state: char === '{' ? 'keyOrEnd' : 'valueOrEnd', path });
        }
        else if (char === '"') {
            this.token = 'string';
            this.stringKind = 'value';
            this.tokenPath = path;
            this.raw = key !== undefined && this.scalarPaths.has(key) ? '"' : undefined;
            this.escaped = false;
            this.unicode = 0;
        }
        else if (char === '-' || /[0-9tfn]/.test(char)) {
            this.token = 'primitive';
            this.raw = char;
            this.tokenPath = path;
        }
        else
            this.bad();
    }
    close(kind) {
        const frame = this.stack[this.stack.length - 1];
        if (!frame || frame.kind !== kind) {
            this.bad();
            return;
        }
        const allowed = kind === 'object' ? frame.state === 'keyOrEnd' || frame.state === 'commaOrEnd' : frame.state === 'valueOrEnd' || frame.state === 'commaOrEnd';
        if (!allowed) {
            this.bad();
            return;
        }
        const capture = this.capture;
        if (capture && capture.depth === this.stack.length) {
            if (!capture.exceeded) {
                try {
                    this.usages.set(capture.path, JSON.parse(capture.text));
                }
                catch {
                    this.bad();
                    return;
                }
            }
            else
                this.usages.delete(capture.path);
            this.capture = undefined;
        }
        this.stack.pop();
        this.completeValue();
    }
    primitive() {
        const raw = this.raw;
        if (!/^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)$/.test(raw)) {
            this.bad();
            return;
        }
        this.scalar(this.tokenPath, JSON.parse(raw));
        this.token = undefined;
        this.raw = undefined;
        this.completeValue();
    }
    char(char) {
        if (this.stopped)
            return;
        this.appendCapture(char);
        if (this.token === 'string') {
            if (this.raw !== undefined) {
                if (this.raw.length < (this.stringKind === 'key' ? MAX_KEY_CHARS : MAX_SCALAR_CHARS))
                    this.raw += char;
                else
                    this.raw = undefined;
            }
            if (this.unicode) {
                if (!/[0-9a-fA-F]/.test(char))
                    this.bad();
                else
                    this.unicode--;
                return;
            }
            if (this.escaped) {
                this.escaped = false;
                if (char === 'u')
                    this.unicode = 4;
                else if (!'"\\/bfnrt'.includes(char))
                    this.bad();
                return;
            }
            if (char === '\\') {
                this.escaped = true;
                return;
            }
            if (char === '"') {
                let value;
                if (this.raw !== undefined) {
                    try {
                        value = JSON.parse(this.raw);
                    }
                    catch {
                        this.bad();
                        return;
                    }
                }
                this.token = undefined;
                this.raw = undefined;
                if (this.stringKind === 'key') {
                    const frame = this.stack[this.stack.length - 1];
                    frame.key = typeof value === 'string' ? value : undefined;
                    frame.state = 'colon';
                }
                else {
                    const key = this.pathKey(this.tokenPath);
                    if (value === undefined && (key === 'error' || key === 'response.error'))
                        value = true;
                    this.scalar(this.tokenPath, value);
                    this.completeValue();
                }
            }
            else if (char.charCodeAt(0) < 0x20)
                this.bad();
            return;
        }
        if (this.token === 'primitive') {
            if (!SPACE.test(char) && char !== ',' && char !== '}' && char !== ']') {
                if (this.raw.length >= MAX_SCALAR_CHARS)
                    this.limited();
                else
                    this.raw += char;
                return;
            }
            this.primitive();
            if (this.stopped)
                return;
            // This delimiter was already appended to the usage capture above.
        }
        if (SPACE.test(char))
            return;
        const frame = this.stack[this.stack.length - 1];
        if (!frame) {
            if (this.root === 'done')
                this.bad();
            else
                this.startValue(char);
            return;
        }
        if (frame.state === 'keyOrEnd' || frame.state === 'key') {
            if (char === '}' && frame.state === 'keyOrEnd') {
                this.close('object');
                return;
            }
            if (char !== '"') {
                this.bad();
                return;
            }
            this.token = 'string';
            this.stringKind = 'key';
            this.raw = '"';
            this.escaped = false;
            this.unicode = 0;
            return;
        }
        if (frame.state === 'colon') {
            if (char === ':')
                frame.state = 'value';
            else
                this.bad();
            return;
        }
        if (frame.state === 'value' || frame.state === 'valueOrEnd') {
            if (char === ']' && frame.state === 'valueOrEnd') {
                this.close('array');
                return;
            }
            this.startValue(char);
            return;
        }
        if (char === ',')
            frame.state = frame.kind === 'object' ? 'key' : 'value';
        else if (char === '}')
            this.close('object');
        else if (char === ']')
            this.close('array');
        else
            this.bad();
    }
    push(text) { for (let i = 0; i < text.length && !this.stopped; i++)
        this.char(text[i]); }
    finish() {
        if (this.stopped)
            return;
        if (this.token === 'primitive')
            this.primitive();
        if (this.token || this.stack.length || this.root !== 'done')
            this.bad();
    }
}
/** Incremental SSE framing: no full line or content event is retained. */
class SseProbe {
    paths;
    emit;
    event;
    field = '';
    value = '';
    colon = false;
    skipSpace = false;
    dataStarted = false;
    lineEmpty = true;
    skipLF = false;
    constructor(paths, emit) {
        this.paths = paths;
        this.emit = emit;
        this.event = this.fresh();
    }
    fresh() { return { json: new JsonProbe(this.paths), event: '', data: false, short: '', size: 0, exceeded: false }; }
    dataLine() {
        if (this.dataStarted)
            return;
        this.dataStarted = true;
        if (this.event.data)
            this.dataChar('\n');
        this.event.data = true;
    }
    dataChar(char) {
        if (this.event.exceeded)
            return;
        this.event.json.push(char);
        if (this.event.short !== undefined) {
            if (this.event.short.length < 32)
                this.event.short += char;
            else
                this.event.short = undefined;
        }
    }
    line() {
        if (this.lineEmpty) {
            if (this.event.data || this.event.exceeded)
                this.emit(this.event);
            this.event = this.fresh();
        }
        else {
            if (this.field === 'data')
                this.dataLine();
            if (this.field === 'event')
                this.event.event = this.value;
        }
        this.field = '';
        this.value = '';
        this.colon = false;
        this.skipSpace = false;
        this.dataStarted = false;
        this.lineEmpty = true;
    }
    push(text) {
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (this.skipLF) {
                this.skipLF = false;
                if (char === '\n')
                    continue;
            }
            if (++this.event.size > MAX_EVENT_CHARS)
                this.event.exceeded = true;
            if (char === '\r' || char === '\n') {
                if (char === '\r')
                    this.skipLF = true;
                this.line();
                continue;
            }
            this.lineEmpty = false;
            if (!this.colon) {
                if (char === ':') {
                    this.colon = true;
                    this.skipSpace = true;
                    if (this.field === 'data')
                        this.dataLine();
                }
                else if (this.field.length < 32)
                    this.field += char;
                else
                    this.field = '!';
            }
            else {
                if (this.skipSpace) {
                    this.skipSpace = false;
                    if (char === ' ')
                        continue;
                }
                if (this.field === 'data')
                    this.dataChar(char);
                else if (this.field === 'event' && this.value.length < MAX_SCALAR_CHARS)
                    this.value += char;
            }
        }
    }
    finish() { if (!this.lineEmpty)
        this.line(); if (this.event.data || this.event.exceeded)
        this.emit(this.event); }
}
const usagePaths = (protocol, sse) => !sse ? ['usage']
    : protocol === 'openai-responses' ? ['response.usage']
        : protocol === 'anthropic-messages' ? ['message.usage', 'usage'] : ['usage'];
export class UsageCollector {
    protocol;
    decoder = new TextDecoder('utf-8', { fatal: true });
    mode;
    json;
    sse;
    merged = {};
    state = 'incomplete';
    terminated = false;
    /** A protocol terminal event may close the bridge before the network reaches EOF. */
    get terminal() { return this.terminated; }
    malformed = false;
    limitExceeded = false;
    decodeFailed = false;
    ended;
    constructor(protocol, contentType) {
        this.protocol = protocol;
        if (contentType?.toLowerCase().includes('text/event-stream'))
            this.select('sse');
        else if (contentType?.toLowerCase().includes('json'))
            this.select('json');
    }
    select(mode) {
        this.mode = mode;
        if (mode === 'json')
            this.json = new JsonProbe(usagePaths(this.protocol, false));
        else
            this.sse = new SseProbe(usagePaths(this.protocol, true), event => this.event(event));
    }
    status(probe, name = '', json = false) {
        const type = probe.metadata.get('type'), status = probe.metadata.get('response.status') ?? probe.metadata.get('status');
        if (json || ['failed', 'cancelled', 'incomplete'].includes(String(status))
            || ['error', 'response.error', 'response.failed', 'response.cancelled', 'response.incomplete', 'response.completed', 'message_stop'].includes(String(type))
            || ['error', 'response.error', 'response.failed', 'response.cancelled', 'response.incomplete', 'response.completed', 'message_stop'].includes(name)
            || probe.metadata.get('error') || probe.metadata.get('response.error'))
            this.terminated = true;
        if (type === 'error' || name === 'error' || name === 'response.error' || type === 'response.error' || probe.metadata.get('error') || probe.metadata.get('response.error') || status === 'failed' || name === 'response.failed' || type === 'response.failed')
            this.state = 'failed';
        else if (status === 'cancelled' || name === 'response.cancelled' || type === 'response.cancelled')
            this.state = 'cancelled';
        else if (status === 'incomplete' || name === 'response.incomplete' || type === 'response.incomplete')
            this.state = 'incomplete';
        else if (json || (this.protocol === 'anthropic-messages' && (name === 'message_stop' || type === 'message_stop')) || (this.protocol === 'openai-responses' && (name === 'response.completed' || type === 'response.completed'))) {
            if (this.state !== 'failed' && this.state !== 'cancelled')
                this.state = 'complete';
        }
    }
    absorb(probe) {
        for (const value of probe.usages.values())
            this.merged = { ...this.merged, ...readUsage(value, this.protocol) };
    }
    event(event) {
        if (event.exceeded) {
            this.limitExceeded = true;
            return;
        }
        if (event.short?.trim() === '[DONE]') {
            this.terminated = true;
            if (this.protocol === 'openai-chat-completions' && this.state !== 'failed' && this.state !== 'cancelled')
                this.state = 'complete';
            return;
        }
        event.json.finish();
        this.limitExceeded ||= event.json.limitExceeded;
        if (event.json.malformed) {
            this.malformed = true;
            return;
        }
        this.absorb(event.json);
        this.status(event.json, event.event);
    }
    text(text) {
        if (!this.mode) {
            let i = 0;
            while (i < text.length && (SPACE.test(text[i]) || text[i] === '\uFEFF'))
                i++;
            if (i === text.length)
                return;
            const char = text[i];
            this.select(char === ':' || /[deir]/.test(char) ? 'sse' : 'json');
            text = text.slice(i);
        }
        if (this.mode === 'json')
            this.json.push(text);
        else
            this.sse.push(text);
    }
    push(chunk) {
        if (this.ended || this.decodeFailed)
            return;
        try {
            this.text(this.decoder.decode(chunk, { stream: true }));
        }
        catch {
            this.malformed = true;
            this.decodeFailed = true;
        }
    }
    sample() {
        const usage = this.merged;
        const present = this.protocol === 'anthropic-messages' ? own(usage, 'anthropicInput') || own(usage, 'cached') || own(usage, 'cacheWrite') : own(usage, 'input');
        if (!present)
            return undefined;
        const prompt = this.protocol === 'anthropic-messages' ? (usage.anthropicInput ?? 0) + (usage.cached ?? 0) + (usage.cacheWrite ?? 0) : usage.input;
        if (count(prompt) === undefined)
            return undefined;
        return { prompt, cached: usage.cached ?? 0, written: usage.cacheWrite ?? 0, cacheReported: own(usage, 'cached') };
    }
    finish() {
        if (this.ended)
            return { ...this.ended, ...(this.ended.sample ? { sample: { ...this.ended.sample } } : {}) };
        if (!this.decodeFailed) {
            try {
                this.text(this.decoder.decode());
            }
            catch {
                this.malformed = true;
                this.decodeFailed = true;
            }
        }
        if (this.mode === 'json') {
            this.json.finish();
            this.malformed ||= this.json.malformed;
            this.limitExceeded ||= this.json.limitExceeded;
            if (!this.json.malformed) {
                this.absorb(this.json);
                this.status(this.json, '', true);
            }
        }
        else if (this.mode === 'sse')
            this.sse.finish();
        else
            this.malformed = true;
        this.ended = { ...(this.sample() ? { sample: this.sample() } : {}), state: this.state, malformed: this.malformed, limitExceeded: this.limitExceeded };
        return { ...this.ended, ...(this.ended.sample ? { sample: { ...this.ended.sample } } : {}) };
    }
}
/** Compatibility helper. Detection examines only an envelope's actual usage fields. */
export function extractUsage(text, protocol) {
    if (protocol) {
        const collector = new UsageCollector(protocol);
        collector.push(new TextEncoder().encode(text));
        return collector.finish().sample;
    }
    // Prefer the protocol whose actual usage projection reports the most input tokens.
    let sample;
    for (const candidate of ['anthropic-messages', 'openai-chat-completions', 'openai-responses']) {
        const collector = new UsageCollector(candidate);
        collector.push(new TextEncoder().encode(text));
        const next = collector.finish().sample;
        if (next && (!sample || next.prompt > sample.prompt || (!sample.cacheReported && next.cacheReported)))
            sample = next;
    }
    return sample;
}
//# sourceMappingURL=usage.js.map