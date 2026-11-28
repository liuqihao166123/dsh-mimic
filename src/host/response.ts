import type { TransformResult, WireProtocol } from '../types.js';
import { readUsage, mergeUsage, type NormalizedUsage } from './usage.js';

type Obj = Record<string, unknown>;
type Kind = 'text' | 'thinking' | 'tool';
type Usage = NormalizedUsage;
type Meta = { id?: string; model?: string; created?: number };
type Block = { key: string; kind: Kind; id?: string; name?: string; text?: string; args?: string; signature?: string; encrypted?: string };
type Event =
  | ({ type: 'start'; usage?: Partial<Usage> } & Meta)
  | ({ type: 'block' } & Block)
  | { type: 'delta'; key: string; text?: string; args?: string; signature?: string }
  | { type: 'end'; key: string }
  | { type: 'usage'; usage: Partial<Usage>; stop?: string; stopSequence?: string | null }
  | { type: 'finish'; stop?: string; stopSequence?: string | null }
  | { type: 'error'; error: Obj };
type SseEvent = { event?: string; data: string; id?: string; retry?: string };

// Bound each logical event, not a complete response or a network chunk.
const MAX_EVENT_CHARS = 1024 * 1024;
const MAX_BLOCKS = 4096;
const encoder = new TextEncoder();
const emptyUsage = (): Usage => ({ input: 0, output: 0, cached: 0, cacheWrite: 0, reasoning: 0 });
const obj = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const str = (v: unknown): string => typeof v === 'string' ? v : '';
const num = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
const index = (v: unknown): number => Number.isSafeInteger(v) && Number(v) >= 0 ? Number(v) : 0;
const toolName = (name: string, names: Record<string, string>): string => Object.hasOwn(names, name) ? names[name]! : name;

function writeUsage(u: Usage, protocol: WireProtocol): Obj {
  if (protocol === 'anthropic-messages') return {
    input_tokens: Math.max(0, u.input - u.cached - u.cacheWrite), output_tokens: u.output,
    cache_read_input_tokens: u.cached, cache_creation_input_tokens: u.cacheWrite,
  };
  const inDetails = { cached_tokens: u.cached, ...(u.cacheWrite ? { cache_creation_tokens: u.cacheWrite } : {}) };
  if (protocol === 'openai-chat-completions') return {
    prompt_tokens: u.input, completion_tokens: u.output, total_tokens: u.input + u.output,
    prompt_tokens_details: inDetails, completion_tokens_details: { reasoning_tokens: u.reasoning },
  };
  return { input_tokens: u.input, output_tokens: u.output, total_tokens: u.input + u.output,
    input_tokens_details: inDetails, output_tokens_details: { reasoning_tokens: u.reasoning } };
}

function stopReason(value: unknown, protocol: WireProtocol, hasTools: boolean, snapshot?: Obj): string {
  const reason = str(value);
  if (protocol === 'anthropic-messages') return reason || (hasTools ? 'tool_use' : 'end_turn');
  if (protocol === 'openai-chat-completions') {
    if (reason === 'length') return 'max_tokens';
    if (reason === 'tool_calls' || reason === 'function_call') return 'tool_use';
    if (reason === 'content_filter') return 'refusal';
    return hasTools ? 'tool_use' : 'end_turn';
  }
  const incomplete = str(obj(snapshot?.incomplete_details).reason);
  if (incomplete === 'max_output_tokens') return 'max_tokens';
  if (incomplete === 'content_filter') return 'refusal';
  return hasTools ? 'tool_use' : 'end_turn';
}
function isError(v: Obj): boolean {
  return v.type === 'error' || (v.error !== undefined && v.error !== null) || v.status === 'failed' || v.status === 'cancelled';
}

/** Only protocol-defined names are changed; inputs, outputs, and arbitrary name strings stay intact. */
function renameTools(v: Obj, protocol: WireProtocol, names: Record<string, string>): Obj {
  const rename = (target: Obj): void => { if (typeof target.name === 'string') target.name = toolName(target.name, names); };
  if (protocol === 'anthropic-messages') {
    for (const raw of list(v.content)) { const b = obj(raw); if (b.type === 'tool_use' || b.type === 'server_tool_use') rename(b); }
    const block = obj(v.content_block);
    if (block.type === 'tool_use' || block.type === 'server_tool_use') rename(block);
    if (v.type === 'message_start') renameTools(obj(v.message), protocol, names);
    for (const raw of list(v.tools)) rename(obj(raw));
  } else if (protocol === 'openai-responses') {
    for (const raw of list(v.output)) { const item = obj(raw); if (item.type === 'function_call' || item.type === 'custom_tool_call') rename(item); }
    const item = obj(v.item);
    if (item.type === 'function_call' || item.type === 'custom_tool_call') rename(item);
    if (str(v.type).startsWith('response.')) renameTools(obj(v.response), protocol, names);
    for (const raw of list(v.tools)) { const tool = obj(raw); if (tool.type === 'function' || tool.type === 'custom') rename(tool); }
  } else {
    for (const raw of list(v.choices)) {
      const choice = obj(raw);
      for (const message of [obj(choice.message), obj(choice.delta)]) {
        for (const call of list(message.tool_calls)) rename(obj(obj(call).function));
        if (message.function_call !== undefined) rename(obj(message.function_call));
      }
    }
    for (const raw of list(v.tools)) { const tool = obj(raw); if (tool.type === 'function') rename(obj(tool.function)); }
    for (const raw of list(v.functions)) rename(obj(raw));
  }
  return v;
}
function jsonInput(args: string): unknown {
  if (!args.trim()) return {};
  try { return JSON.parse(args); } catch { throw new TypeError('Invalid upstream function-call JSON arguments'); }
}
function anthropicBlock(b: Block, names: Record<string, string>): Obj {
  if (b.kind === 'tool') return { type: 'tool_use', id: b.id, name: toolName(b.name ?? '', names), input: jsonInput(b.args ?? '') };
  if (b.kind === 'thinking') return { type: 'thinking', thinking: b.text ?? '', signature: b.signature ?? '' };
  return { type: 'text', text: b.text ?? '' };
}
function responsesItem(b: Block, names: Record<string, string>, status: string): Obj {
  if (b.kind === 'tool') return { type: 'function_call', id: 'fc_' + b.id, call_id: b.id, name: toolName(b.name ?? '', names), arguments: b.args || '{}', status };
  if (b.kind === 'thinking') return { type: 'reasoning', id: b.id, summary: [{ type: 'summary_text', text: b.text ?? '' }], ...(b.encrypted ? { encrypted_content: b.encrypted } : {}) };
  return { type: 'message', id: b.id, role: 'assistant', status, content: [{ type: 'output_text', text: b.text ?? '', annotations: [], logprobs: [] }] };
}
function responseEnvelope(meta: Meta, blocks: Block[], usage: Usage | null, stop: string, names: Record<string, string>, status = 'completed'): Obj {
  const incomplete = stop === 'max_tokens' || stop === 'refusal';
  return { id: meta.id ?? 'response_bridge', object: 'response', created_at: meta.created ?? 0, model: meta.model ?? '',
    status: status === 'in_progress' ? status : incomplete ? 'incomplete' : status,
    output: blocks.map(b => responsesItem(b, names, status === 'in_progress' ? status : 'completed')),
    error: null, incomplete_details: incomplete ? { reason: stop === 'max_tokens' ? 'max_output_tokens' : 'content_filter' } : null,
    usage: usage ? writeUsage(usage, 'openai-responses') : null };
}
function readJsonBlocks(v: Obj, protocol: WireProtocol): Block[] {
  const blocks: Block[] = [];
  const add = (b: Omit<Block, 'key'>): void => {
    const i = blocks.length;
    if (i >= MAX_BLOCKS) throw new RangeError('Too many upstream response content blocks');
    blocks.push({ ...b, key: 'json:' + i, id: b.id || 'item_bridge_' + i });
  };
  if (protocol === 'anthropic-messages') {
    for (const raw of list(v.content)) {
      const b = obj(raw);
      if (b.type === 'text') add({ kind: 'text', text: str(b.text) });
      if (b.type === 'thinking') add({ kind: 'thinking', text: str(b.thinking), signature: str(b.signature) });
      if (b.type === 'tool_use' || b.type === 'server_tool_use') add({ kind: 'tool', id: str(b.id), name: str(b.name), args: JSON.stringify(b.input ?? {}) });
    }
  } else if (protocol === 'openai-responses') {
    for (const raw of list(v.output)) {
      const item = obj(raw);
      if (item.type === 'function_call') add({ kind: 'tool', id: str(item.call_id) || str(item.id), name: str(item.name), args: str(item.arguments) || '{}' });
      if (item.type === 'message') for (const rawPart of list(item.content)) {
        const part = obj(rawPart);
        if (part.type === 'output_text' || part.type === 'text' || part.type === 'refusal') add({ kind: 'text', id: str(item.id) + '_' + blocks.length, text: str(part.text) || str(part.refusal) });
      }
      if (item.type === 'reasoning') {
        const parts = list(item.summary).length ? list(item.summary) : list(item.content);
        if (!parts.length && typeof item.encrypted_content === 'string') add({ kind: 'thinking', id: str(item.id), text: '', encrypted: item.encrypted_content });
        for (const part of parts) add({ kind: 'thinking', id: str(item.id) + '_' + blocks.length, text: str(obj(part).text), encrypted: str(item.encrypted_content) });
      }
    }
  } else {
    const message = obj(obj(list(v.choices)[0]).message);
    if (typeof message.content === 'string') add({ kind: 'text', text: message.content });
    else for (const part of list(message.content)) if (obj(part).type === 'text') add({ kind: 'text', text: str(obj(part).text) });
    if (typeof message.reasoning_content === 'string') add({ kind: 'thinking', text: message.reasoning_content, signature: str(message.reasoning_signature) });
    for (const raw of list(message.tool_calls)) {
      const call = obj(raw), fn = obj(call.function);
      if (call.type === 'function' || call.type === undefined) add({ kind: 'tool', id: str(call.id), name: str(fn.name), args: str(fn.arguments) || '{}' });
    }
    if (message.function_call !== undefined) { const fn = obj(message.function_call); add({ kind: 'tool', name: str(fn.name), args: str(fn.arguments) || '{}' }); }
  }
  return blocks;
}
function bridgeJson(v: Obj, result: TransformResult): Obj {
  const source = result.targetProtocol, target = result.originalProtocol;
  if (isError(v)) return v;
  if (source === target) return renameTools(v, target, result.toolNames);
  const recognized = source === 'anthropic-messages' ? Array.isArray(v.content) && (v.type === 'message' || v.role === 'assistant') : source === 'openai-responses' ? Array.isArray(v.output) : Array.isArray(v.choices);
  if (!recognized) return v;
  const blocks = readJsonBlocks(v, source), usage = mergeUsage(emptyUsage(), readUsage(v.usage, source));
  const meta: Meta = { id: str(v.id), model: str(v.model), created: num(v.created_at) ?? num(v.created) ?? 0 };
  const stop = stopReason(source === 'openai-chat-completions' ? obj(list(v.choices)[0]).finish_reason : v.stop_reason, source, blocks.some(b => b.kind === 'tool'), v);
  if (target === 'anthropic-messages') return { id: meta.id, type: 'message', role: 'assistant', model: meta.model, content: blocks.map(b => anthropicBlock(b, result.toolNames)), stop_reason: stop, stop_sequence: v.stop_sequence ?? null, usage: writeUsage(usage, target) };
  if (target === 'openai-responses') return responseEnvelope(meta, blocks, usage, stop, result.toolNames);
  const tools = blocks.filter(b => b.kind === 'tool'), reasoning = blocks.filter(b => b.kind === 'thinking').map(b => b.text ?? '').join('');
  return { id: meta.id, object: 'chat.completion', created: meta.created, model: meta.model,
    choices: [{ index: 0, message: { role: 'assistant', content: blocks.filter(b => b.kind === 'text').map(b => b.text ?? '').join('') || (tools.length ? null : ''),
      ...(reasoning ? { reasoning_content: reasoning } : {}), ...(tools.length ? { tool_calls: tools.map(b => ({ id: b.id, type: 'function', function: { name: toolName(b.name ?? '', result.toolNames), arguments: b.args || '{}' } })) } : {}) },
      finish_reason: stop === 'max_tokens' ? 'length' : stop === 'tool_use' ? 'tool_calls' : stop === 'refusal' ? 'content_filter' : 'stop', logprobs: null }], usage: writeUsage(usage, target) };
}

/** Incremental line reader: split UTF-8/CRLF, multiline data, and unterminated EOF frames. */
class SseDecoder {
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });
  private text = ''; private position = 0; private line = ''; private lines: string[] = [];
  private eventSize = 0; private skipLF = false; private eof = false;
  constructor(private readonly reader: ReadableStreamDefaultReader<Uint8Array>) {}
  private takeLine(): SseEvent | undefined {
    const line = this.line; this.line = '';
    if (line !== '') { this.lines.push(line); return undefined; }
    const lines = this.lines; this.lines = []; this.eventSize = 0;
    let event: string | undefined, id: string | undefined, retry: string | undefined;
    const data: string[] = [];
    for (const entry of lines) {
      if (entry.startsWith(':')) continue;
      const colon = entry.indexOf(':'), field = colon < 0 ? entry : entry.slice(0, colon);
      let value = colon < 0 ? '' : entry.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'data') data.push(value);
      if (field === 'event') event = value;
      if (field === 'id' && !value.includes('\0')) id = value;
      if (field === 'retry' && /^\d+$/.test(value)) retry = value;
    }
    return data.length ? { event, data: data.join('\n'), id, retry } : undefined;
  }
  async next(): Promise<SseEvent | null> {
    for (;;) {
      while (this.position < this.text.length) {
        const char = this.text[this.position++]!;
        if (this.skipLF) { this.skipLF = false; if (char === '\n') continue; }
        if (++this.eventSize > MAX_EVENT_CHARS) throw new RangeError('Upstream SSE event exceeds 1048576 characters');
        if (char === '\r' || char === '\n') { if (char === '\r') this.skipLF = true; const event = this.takeLine(); if (event) return event; }
        else this.line += char;
      }
      this.text = ''; this.position = 0;
      if (this.eof) { if (this.line) this.takeLine(); return this.takeLine() ?? null; }
      const chunk = await this.reader.read();
      if (chunk.done) { this.eof = true; this.text = this.decoder.decode(); }
      else this.text = this.decoder.decode(chunk.value, { stream: true });
    }
  }
}
type SeenBlock = { block: Block; textLength: number; argLength: number; ended: boolean };

/** Source adapters retain metadata/lengths, not streamed text or argument transcripts. */
class SourceEvents {
  readonly blocks = new Map<string, SeenBlock>();
  private readonly items = new Map<number, Obj>();
  private readonly itemIndices = new Map<string, number>();
  private started = false; done = false; private stop: string | undefined; private stopSequence: string | null | undefined;
  constructor(private readonly protocol: WireProtocol) {}
  private start(v: Obj, events: Event[]): void {
    if (this.started) return;
    this.started = true;
    events.push({ type: 'start', id: str(v.id), model: str(v.model), created: num(v.created_at) ?? num(v.created), usage: readUsage(v.usage, this.protocol) });
  }
  private add(b: Block, events: Event[]): SeenBlock {
    const previous = this.blocks.get(b.key); if (previous) return previous;
    if (this.blocks.size >= MAX_BLOCKS) throw new RangeError('Too many upstream response content blocks');
    const seen: SeenBlock = { block: { ...b, text: undefined, args: undefined }, textLength: b.text?.length ?? 0, argLength: b.args?.length ?? 0, ended: false };
    this.blocks.set(b.key, seen); events.push({ type: 'block', ...b }); return seen;
  }
  private delta(key: string, fields: Pick<Block, 'text' | 'args' | 'signature'>, events: Event[]): void {
    const seen = this.blocks.get(key);
    if (!seen) throw new TypeError('Missing upstream content-block metadata: ' + key);
    if (seen.ended) { if (!fields.text && !fields.args && !fields.signature) return; throw new TypeError('Upstream delta after content-block termination: ' + key); }
    seen.textLength += fields.text?.length ?? 0; seen.argLength += fields.args?.length ?? 0;
    events.push({ type: 'delta', key, ...fields });
  }
  private full(key: string, fields: Pick<Block, 'text' | 'args'>, events: Event[]): void {
    const seen = this.blocks.get(key); if (!seen) throw new TypeError('Missing upstream content-block metadata: ' + key);
    const text = fields.text === undefined ? '' : fields.text.slice(seen.textLength), args = fields.args === undefined ? '' : fields.args.slice(seen.argLength);
    if (text || args) this.delta(key, { ...(text ? { text } : {}), ...(args ? { args } : {}) }, events);
  }
  private end(key: string, events: Event[]): void {
    const seen = this.blocks.get(key); if (!seen || seen.ended) return;
    if (seen.block.kind === 'tool' && seen.argLength === 0) this.delta(key, { args: '{}' }, events);
    seen.ended = true; events.push({ type: 'end', key });
  }
  finish(): Event[] {
    if (this.done) return []; this.done = true;
    if (!this.started && !this.blocks.size) return [];
    const events: Event[] = [];
    for (const key of this.blocks.keys()) this.end(key, events);
    events.push({ type: 'finish', stop: this.stop ?? (Array.from(this.blocks.values()).some(v => v.block.kind === 'tool') ? 'tool_use' : 'end_turn'), stopSequence: this.stopSequence });
    return events;
  }
  private responseIndex(data: Obj): number { return data.output_index !== undefined ? index(data.output_index) : this.itemIndices.get(str(data.item_id)) ?? 0; }
  private responseItem(item: Obj, outputIndex: number, complete: boolean, events: Event[]): void {
    // Retain metadata only: completed output snapshots can be large and have already been consumed.
    const metadata = { type: item.type, id: item.id, call_id: item.call_id, name: item.name, encrypted_content: item.encrypted_content };
    this.items.set(outputIndex, metadata);
    if (str(item.id)) this.itemIndices.set(str(item.id), outputIndex);
    if (item.type === 'function_call') {
      const key = 'r:' + outputIndex;
      this.add({ key, kind: 'tool', id: str(item.call_id) || str(item.id), name: str(item.name) }, events);
      this.full(key, { args: str(item.arguments) }, events);
      if (complete) this.end(key, events);
    } else if (item.type === 'message' || item.type === 'reasoning') {
      const thinking = item.type === 'reasoning', parts = thinking ? (list(item.summary).length ? list(item.summary) : list(item.content)) : list(item.content);
      parts.forEach((raw, partIndex) => {
        const part = obj(raw);
        if (!thinking && part.type !== 'output_text' && part.type !== 'text' && part.type !== 'refusal') return;
        const key = 'r:' + outputIndex + ':' + partIndex + (thinking ? ':thinking' : ':text');
        this.add({ key, kind: thinking ? 'thinking' : 'text', id: str(item.id) + '_' + partIndex, encrypted: str(item.encrypted_content) }, events);
        this.full(key, { text: str(part.text) || str(part.refusal) }, events); if (complete) this.end(key, events);
      });
      if (thinking && !parts.length && typeof item.encrypted_content === 'string') {
        const key = 'r:' + outputIndex + ':0:thinking'; this.add({ key, kind: 'thinking', id: str(item.id), encrypted: item.encrypted_content }, events); if (complete) this.end(key, events);
      }
    }
  }
  consume(frame: SseEvent): Event[] {
    if (this.done) return []; if (frame.data.trim() === '[DONE]') return this.finish();
    let data: Obj;
    try { const parsed: unknown = JSON.parse(frame.data); if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError(); data = obj(parsed); }
    catch { throw new TypeError('Invalid upstream SSE JSON event'); }
    const type = str(data.type) || frame.event || '', events: Event[] = [];
    if (type === 'error' || type === 'response.failed' || (isError(data) && type !== 'response.completed')) {
      this.done = true; const error = obj(data.error !== undefined ? data.error : obj(data.response).error);
      events.push({ type: 'error', error: Object.keys(error).length ? error : data }); return events;
    }
    if (this.protocol === 'anthropic-messages') {
      if (type === 'message_start') this.start(obj(data.message), events);
      else if (type === 'content_block_start') {
        const b = obj(data.content_block), key = 'a:' + index(data.index);
        if (b.type === 'text') this.add({ key, kind: 'text', text: str(b.text) }, events);
        else if (b.type === 'thinking') this.add({ key, kind: 'thinking', text: str(b.thinking), signature: str(b.signature) }, events);
        else if (b.type === 'tool_use' || b.type === 'server_tool_use') this.add({ key, kind: 'tool', id: str(b.id), name: str(b.name), args: b.input !== undefined && Object.keys(obj(b.input)).length ? JSON.stringify(b.input) : '' }, events);
      } else if (type === 'content_block_delta') {
        const delta = obj(data.delta), key = 'a:' + index(data.index);
        if (delta.type === 'text_delta' || delta.type === 'thinking_delta') this.delta(key, { text: str(delta.text) || str(delta.thinking) }, events);
        if (delta.type === 'input_json_delta') this.delta(key, { args: str(delta.partial_json) }, events);
        if (delta.type === 'signature_delta') this.delta(key, { signature: str(delta.signature) }, events);
      } else if (type === 'content_block_stop') this.end('a:' + index(data.index), events);
      else if (type === 'message_delta') {
        const delta = obj(data.delta);
        if (delta.stop_reason !== undefined && delta.stop_reason !== null) this.stop = str(delta.stop_reason);
        if (delta.stop_sequence !== undefined) this.stopSequence = delta.stop_sequence === null ? null : str(delta.stop_sequence);
        events.push({ type: 'usage', usage: readUsage(data.usage, this.protocol), stop: this.stop, stopSequence: this.stopSequence });
      } else if (type === 'message_stop') events.push(...this.finish());
    } else if (this.protocol === 'openai-responses') {
      if (type === 'response.created' || type === 'response.in_progress') this.start(obj(data.response), events);
      else if (type === 'response.output_item.added' || type === 'response.output_item.done') this.responseItem(obj(data.item), this.responseIndex(data), type.endsWith('.done'), events);
      else if (type === 'response.function_call_arguments.delta' || type === 'response.function_call_arguments.done') {
        const i = this.responseIndex(data), key = 'r:' + i;
        if (!this.blocks.has(key)) { const item = this.items.get(i); if (!item || item.type !== 'function_call') throw new TypeError('Missing upstream function-call metadata: ' + key); this.responseItem(item, i, false, events); }
        if (type.endsWith('.delta')) this.delta(key, { args: str(data.delta) }, events); else this.full(key, { args: str(data.arguments) }, events);
      } else if (/^response\.(output_text|refusal|reasoning_summary_text|reasoning_text)\.(delta|done)$/.test(type)
        || type === 'response.content_part.added' || type === 'response.content_part.done' || type === 'response.reasoning_summary_part.added' || type === 'response.reasoning_summary_part.done') {
        const i = this.responseIndex(data), thinking = type.includes('reasoning'), partIndex = thinking ? index(data.summary_index ?? data.content_index) : index(data.content_index);
        const key = 'r:' + i + ':' + partIndex + (thinking ? ':thinking' : ':text'), item = this.items.get(i) ?? {}, part = obj(data.part);
        this.add({ key, kind: thinking ? 'thinking' : 'text', id: (str(data.item_id) || str(item.id) || 'item_bridge_' + i) + '_' + partIndex, encrypted: str(item.encrypted_content) }, events);
        if (type.endsWith('.delta')) this.delta(key, { text: str(data.delta) }, events);
        else this.full(key, { text: str(data.text) || str(data.refusal) || str(part.text) || str(part.refusal) }, events);
        if (type.endsWith('_part.done') || type === 'response.content_part.done') this.end(key, events);
      } else if (type === 'response.completed' || type === 'response.incomplete') {
        const response = obj(data.response);
        if (isError(response)) { this.done = true; events.push({ type: 'error', error: obj(response.error) }); return events; }
        this.start(response, events); list(response.output).forEach((raw, i) => this.responseItem(obj(raw), i, true, events));
        events.push({ type: 'usage', usage: readUsage(response.usage, this.protocol) });
        this.stop = stopReason(undefined, this.protocol, Array.from(this.blocks.values()).some(v => v.block.kind === 'tool'), response); events.push(...this.finish());
      }
    } else {
      this.start(data, events);
      if (data.usage !== undefined) events.push({ type: 'usage', usage: readUsage(data.usage, this.protocol) });
      for (const raw of list(data.choices)) {
        const choice = obj(raw), c = index(choice.index), delta = obj(choice.delta);
        if (typeof delta.content === 'string') { const key = 'c:' + c + ':text'; this.add({ key, kind: 'text' }, events); this.delta(key, { text: delta.content }, events); }
        if (typeof delta.reasoning_content === 'string') { const key = 'c:' + c + ':thinking'; this.add({ key, kind: 'thinking' }, events); this.delta(key, { text: delta.reasoning_content }, events); }
        if (typeof delta.reasoning_signature === 'string') { const key = 'c:' + c + ':thinking'; this.add({ key, kind: 'thinking' }, events); this.delta(key, { signature: delta.reasoning_signature }, events); }
        const calls = list(delta.tool_calls); if (delta.function_call !== undefined) calls.push({ index: 0, function: delta.function_call });
        for (const rawCall of calls) {
          const call = obj(rawCall), fn = obj(call.function), key = 'c:' + c + ':tool:' + index(call.index);
          if (!this.blocks.has(key) && !str(fn.name)) throw new TypeError('Missing upstream function-call name: ' + key);
          this.add({ key, kind: 'tool', id: str(call.id), name: str(fn.name) }, events);
          if (typeof fn.arguments === 'string') this.delta(key, { args: fn.arguments }, events);
        }
        if (choice.finish_reason !== undefined && choice.finish_reason !== null) this.stop = stopReason(choice.finish_reason, this.protocol, false);
      }
    }
    return events;
  }
}
type OutputBlock = Block & { index: number; toolIndex: number; length: number; ended: boolean };

class TargetEvents {
  private readonly blocks = new Map<string, OutputBlock>();
  private usage = emptyUsage(); private meta: Meta; private started = false; private sequence = 0;
  private toolCount = 0; private stop: string | undefined; private stopSequence: string | null = null;
  // Responses done/completion events require snapshots. Only that target retains bounded logical
  // output; Anthropic/Chat never accumulate streamed text/argument transcripts.
  private retained = 0;
  constructor(private readonly protocol: WireProtocol, private readonly names: Record<string, string>, model: string) { this.meta = { id: 'response_bridge', model, created: 0 }; }
  private frame(type: string | undefined, value: Obj): string {
    if (this.protocol === 'openai-responses') value.sequence_number = this.sequence++;
    const data = JSON.stringify(value);
    if (data.length > MAX_EVENT_CHARS) throw new RangeError('Translated SSE event exceeds 1048576 characters');
    return (type ? 'event: ' + type + '\n' : '') + 'data: ' + data + '\n\n';
  }
  private chat(delta: Obj, finish: string | null = null, usage = false): string {
    return this.frame(undefined, { id: this.meta.id, object: 'chat.completion.chunk', created: this.meta.created, model: this.meta.model,
      choices: usage ? [] : [{ index: 0, delta, finish_reason: finish, logprobs: null }], ...(usage ? { usage: writeUsage(this.usage, this.protocol) } : {}) });
  }
  private start(frames: string[]): void {
    if (this.started) return; this.started = true;
    if (this.protocol === 'anthropic-messages') frames.push(this.frame('message_start', { type: 'message_start', message: { id: this.meta.id, type: 'message', role: 'assistant', model: this.meta.model, content: [], stop_reason: null, stop_sequence: null, usage: writeUsage(this.usage, this.protocol) } }));
    else if (this.protocol === 'openai-responses') frames.push(this.frame('response.created', { type: 'response.created', response: responseEnvelope(this.meta, [], null, 'end_turn', this.names, 'in_progress') }));
    else frames.push(this.chat({ role: 'assistant', content: '' }));
  }
  private delta(b: OutputBlock, event: Pick<Block, 'text' | 'args' | 'signature'>, frames: string[]): void {
    const text = event.text ?? '', args = event.args ?? '', signature = event.signature ?? ''; b.length += args.length;
    if (this.protocol === 'openai-responses') {
      this.retained += text.length + args.length;
      if (this.retained > MAX_EVENT_CHARS / 2) throw new RangeError('Responses terminal snapshot exceeds bounded 524288-character state');
      b.text = (b.text ?? '') + text; b.args = (b.args ?? '') + args;
    }
    if (this.protocol === 'anthropic-messages') {
      if (text) frames.push(this.frame('content_block_delta', { type: 'content_block_delta', index: b.index, delta: b.kind === 'thinking' ? { type: 'thinking_delta', thinking: text } : { type: 'text_delta', text } }));
      if (args) frames.push(this.frame('content_block_delta', { type: 'content_block_delta', index: b.index, delta: { type: 'input_json_delta', partial_json: args } }));
      if (signature) frames.push(this.frame('content_block_delta', { type: 'content_block_delta', index: b.index, delta: { type: 'signature_delta', signature } }));
    } else if (this.protocol === 'openai-chat-completions') {
      if (text) frames.push(this.chat(b.kind === 'thinking' ? { reasoning_content: text } : { content: text }));
      if (args) frames.push(this.chat({ tool_calls: [{ index: b.toolIndex, function: { arguments: args } }] }));
      if (signature) frames.push(this.chat({ reasoning_signature: signature }));
    } else {
      if (text) { const type = b.kind === 'thinking' ? 'response.reasoning_summary_text.delta' : 'response.output_text.delta'; frames.push(this.frame(type, { type, item_id: b.id, output_index: b.index, ...(b.kind === 'thinking' ? { summary_index: 0 } : { content_index: 0, logprobs: [] }), delta: text })); }
      if (args) frames.push(this.frame('response.function_call_arguments.delta', { type: 'response.function_call_arguments.delta', item_id: 'fc_' + b.id, output_index: b.index, delta: args }));
    }
  }
  private end(b: OutputBlock, frames: string[]): void {
    if (b.ended) return;
    if (b.kind === 'tool' && b.length === 0) this.delta(b, { args: '{}' }, frames); b.ended = true;
    if (this.protocol === 'anthropic-messages') frames.push(this.frame('content_block_stop', { type: 'content_block_stop', index: b.index }));
    else if (this.protocol === 'openai-responses') {
      const item = responsesItem(b, this.names, 'completed');
      if (b.kind === 'tool') frames.push(this.frame('response.function_call_arguments.done', { type: 'response.function_call_arguments.done', item_id: item.id, output_index: b.index, arguments: b.args || '{}' }));
      else if (b.kind === 'thinking') {
        frames.push(this.frame('response.reasoning_summary_text.done', { type: 'response.reasoning_summary_text.done', item_id: item.id, output_index: b.index, summary_index: 0, text: b.text ?? '' }));
        frames.push(this.frame('response.reasoning_summary_part.done', { type: 'response.reasoning_summary_part.done', item_id: item.id, output_index: b.index, summary_index: 0, part: { type: 'summary_text', text: b.text ?? '' } }));
      } else {
        frames.push(this.frame('response.output_text.done', { type: 'response.output_text.done', item_id: item.id, output_index: b.index, content_index: 0, text: b.text ?? '', logprobs: [] }));
        frames.push(this.frame('response.content_part.done', { type: 'response.content_part.done', item_id: item.id, output_index: b.index, content_index: 0, part: obj(list(item.content)[0]) }));
      }
      frames.push(this.frame('response.output_item.done', { type: 'response.output_item.done', output_index: b.index, item }));
    }
  }
  emit(events: Event[]): string[] {
    const frames: string[] = [];
    for (const event of events) {
      if (event.type === 'start') {
        if (event.id) this.meta.id = event.id; if (event.model) this.meta.model = event.model; if (event.created !== undefined) this.meta.created = event.created;
        this.usage = mergeUsage(this.usage, event.usage); this.start(frames);
      } else if (event.type === 'error') {
        const error = event.error;
        if (this.protocol === 'anthropic-messages') frames.push(this.frame('error', { type: 'error', error: { ...error, type: str(error.type) || str(error.code) || 'api_error', message: str(error.message) || 'Upstream protocol error' } }));
        else if (this.protocol === 'openai-responses') frames.push(this.frame('error', { ...error, type: 'error', code: str(error.code) || str(error.type) || 'api_error', message: str(error.message) || 'Upstream protocol error' }));
        else { frames.push(this.frame(undefined, { error })); frames.push('data: [DONE]\n\n'); }
      } else {
        this.start(frames);
        if (event.type === 'block') {
          if (this.blocks.has(event.key)) continue;
          const b: OutputBlock = { ...event, text: '', args: '', id: event.id || 'item_bridge_' + this.blocks.size, index: this.blocks.size, toolIndex: event.kind === 'tool' ? this.toolCount++ : -1, length: 0, ended: false };
          this.blocks.set(event.key, b);
          if (this.protocol === 'anthropic-messages') frames.push(this.frame('content_block_start', { type: 'content_block_start', index: b.index, content_block: b.kind === 'tool' ? { type: 'tool_use', id: b.id, name: toolName(b.name ?? '', this.names), input: {} } : b.kind === 'thinking' ? { type: 'thinking', thinking: '', signature: '' } : { type: 'text', text: '' } }));
          else if (this.protocol === 'openai-chat-completions') { if (b.kind === 'tool') frames.push(this.chat({ tool_calls: [{ index: b.toolIndex, id: b.id, type: 'function', function: { name: toolName(b.name ?? '', this.names), arguments: '' } }] })); }
          else {
            const item = responsesItem(b, this.names, 'in_progress');
            if (b.kind === 'tool') item.arguments = ''; if (b.kind === 'text') item.content = []; if (b.kind === 'thinking') item.summary = [];
            frames.push(this.frame('response.output_item.added', { type: 'response.output_item.added', output_index: b.index, item }));
            if (b.kind === 'text') frames.push(this.frame('response.content_part.added', { type: 'response.content_part.added', item_id: item.id, output_index: b.index, content_index: 0, part: { type: 'output_text', text: '', annotations: [], logprobs: [] } }));
            if (b.kind === 'thinking') frames.push(this.frame('response.reasoning_summary_part.added', { type: 'response.reasoning_summary_part.added', item_id: item.id, output_index: b.index, summary_index: 0, part: { type: 'summary_text', text: '' } }));
          }
          this.delta(b, event, frames);
        } else if (event.type === 'delta') { const b = this.blocks.get(event.key); if (!b) throw new TypeError('Missing translated content-block metadata'); this.delta(b, event, frames); }
        else if (event.type === 'end') { const b = this.blocks.get(event.key); if (b) this.end(b, frames); }
        else if (event.type === 'usage') { this.usage = mergeUsage(this.usage, event.usage); if (event.stop) this.stop = event.stop; if (event.stopSequence !== undefined) this.stopSequence = event.stopSequence; }
        else if (event.type === 'finish') {
          for (const b of this.blocks.values()) this.end(b, frames);
          const stop = event.stop || this.stop || (this.toolCount ? 'tool_use' : 'end_turn'), stopSequence = event.stopSequence ?? this.stopSequence;
          if (this.protocol === 'anthropic-messages') {
            frames.push(this.frame('message_delta', { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: stopSequence }, usage: writeUsage(this.usage, this.protocol) }));
            frames.push(this.frame('message_stop', { type: 'message_stop' }));
          } else if (this.protocol === 'openai-chat-completions') {
            frames.push(this.chat({}, stop === 'max_tokens' ? 'length' : stop === 'tool_use' ? 'tool_calls' : stop === 'refusal' ? 'content_filter' : 'stop')); frames.push(this.chat({}, null, true)); frames.push('data: [DONE]\n\n');
          } else {
            const response = responseEnvelope(this.meta, Array.from(this.blocks.values()), this.usage, stop, this.names), type = response.status === 'incomplete' ? 'response.incomplete' : 'response.completed';
            frames.push(this.frame(type, { type, response }));
          }
        }
      }
    }
    return frames;
  }
}
function cleanHeaders(response: Response): Headers { const headers = new Headers(response.headers); headers.delete('content-length'); headers.delete('content-encoding'); return headers; }
function wrapSse(response: Response, result: TransformResult): ReadableStream<Uint8Array> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined, decoder: SseDecoder | undefined;
  const source = new SourceEvents(result.targetProtocol), target = new TargetEvents(result.originalProtocol, result.toolNames, str(result.body.model)), same = result.originalProtocol === result.targetProtocol;
  let frames: string[] = [], done = false, cancelled = false, eof = false, cleanup: Promise<void> | undefined;
  const getReader = (): ReadableStreamDefaultReader<Uint8Array> => reader ??= response.body!.getReader();
  const stop = (reason?: unknown): Promise<void> => cleanup ??= (async () => { const input = getReader(); try { if (!eof) await input.cancel(reason); } finally { input.releaseLock(); } })();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        decoder ??= new SseDecoder(getReader());
        while (!frames.length && !done && !cancelled) {
          const frame = await decoder.next(); if (cancelled) return;
          if (frame === null) { eof = true; done = true; if (!same) frames.push(...target.emit(source.finish())); }
          else if (same) {
            if (frame.data.trim() === '[DONE]') { frames.push('data: [DONE]\n\n'); done = true; }
            else {
              let parsed: unknown;
              try { parsed = JSON.parse(frame.data); } catch { throw new TypeError('Invalid upstream SSE JSON event'); }
              const value = obj(parsed), data = JSON.stringify(isError(value) ? parsed : parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? renameTools(value, result.originalProtocol, result.toolNames) : parsed);
              const translated = (frame.event ? 'event: ' + frame.event + '\n' : '') + (frame.id !== undefined ? 'id: ' + frame.id + '\n' : '') + (frame.retry !== undefined ? 'retry: ' + frame.retry + '\n' : '') + 'data: ' + data + '\n\n';
              if (translated.length > MAX_EVENT_CHARS) throw new RangeError('Translated SSE event exceeds 1048576 characters');
              frames.push(translated);
              const type = str(value.type) || frame.event;
              if (type === 'message_stop' || type === 'response.completed' || type === 'response.incomplete' || type === 'response.failed' || type === 'error' || isError(value)) done = true;
            }
          } else { frames.push(...target.emit(source.consume(frame))); done = source.done; }
        }
        if (cancelled) return;
        if (frames.length) controller.enqueue(encoder.encode(frames.shift()!));
        if (done && !frames.length) { controller.close(); await stop().catch(() => {}); }
      } catch (error) { done = true; frames = []; if (!cancelled) controller.error(error); await stop(error).catch(() => {}); }
    },
    async cancel(reason) { cancelled = true; done = true; frames = []; await stop(reason); },
  }, { highWaterMark: 0 });
}
function wrapJson(response: Response, result: TransformResult): ReadableStream<Uint8Array> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined, cancelled = false, finished = false;
  const input = (): ReadableStreamDefaultReader<Uint8Array> => reader ??= response.body!.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (finished || cancelled) return; finished = true;
      const chunks: Uint8Array[] = []; let length = 0;
      try {
        for (;;) { const chunk = await input().read(); if (cancelled) return; if (chunk.done) break; chunks.push(chunk.value); length += chunk.value.byteLength; }
        const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        let value: unknown;
        try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { controller.enqueue(bytes); controller.close(); return; }
        if (value !== null && typeof value === 'object' && !Array.isArray(value) && !isError(obj(value))) controller.enqueue(encoder.encode(JSON.stringify(bridgeJson(obj(value), result)))); else controller.enqueue(bytes);
        controller.close();
      } catch (error) { if (!cancelled) { controller.error(error); await input().cancel(error).catch(() => {}); } }
      finally { if (!cancelled) reader?.releaseLock(); }
    },
    async cancel(reason) { cancelled = true; try { await input().cancel(reason); } finally { reader?.releaseLock(); } },
  }, { highWaterMark: 0 });
}
/** Synchronous fetch seam: provider response -> original caller protocol, with no eager reads. */
export function bridgeResponse(response: Response, result: TransformResult): Response {
  if (!response.ok || !response.body || result.originalProtocol === result.targetProtocol && Object.keys(result.toolNames).length === 0) return response;
  const type = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase(), sse = type === 'text/event-stream', json = type === 'application/json' || type.endsWith('+json');
  if (!sse && !json) return response;
  return new Response(sse ? wrapSse(response, result) : wrapJson(response, result), { status: response.status, statusText: response.statusText, headers: cleanHeaders(response) });
}
