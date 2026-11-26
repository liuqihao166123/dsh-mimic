import assert from 'node:assert/strict';
import test from 'node:test';
import { bridgeResponse } from '../src/host/response.js';
import type { TransformResult, WireProtocol } from '../src/types.js';

type Obj = Record<string, unknown>;
const enc = new TextEncoder();
const o = (value: unknown): Obj => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {};
const a = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const s = (value: unknown): string => typeof value === 'string' ? value : '';
const names = { OutA: 'original_a', OutB: 'original_b' };
function result(source: WireProtocol, target: WireProtocol, toolNames: Record<string, string> = names): TransformResult {
  return { changed: true, url: 'https://fixture.invalid/v1/messages', method: 'POST', headers: new Headers(), body: { model: 'fixture-model', stream: true }, originalProtocol: target, targetProtocol: source, toolNames, profile: 'fixture' };
}
function frame(type: string, fields: Obj = {}, nl = '\n'): string {
  return 'event: ' + type + nl + 'data: ' + JSON.stringify({ type, ...fields }) + nl + nl;
}
function memory(parts: (string | Uint8Array)[], contentType = 'text/event-stream', status = 200) {
  let pulls = 0, cancellations = 0, reason: unknown;
  const pending = [...parts];
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { pulls++; const part = pending.shift(); if (part === undefined) controller.close(); else controller.enqueue(typeof part === 'string' ? enc.encode(part) : part); },
    cancel(value) { cancellations++; reason = value; },
  }, { highWaterMark: 0 });
  return { response: new Response(stream, { status, headers: { 'content-type': contentType, 'x-fixture': 'preserved' } }),
    pulls: () => pulls, cancellations: () => cancellations, reason: () => reason };
}
function parsed(text: string): Obj[] {
  const events: Obj[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (data && data !== '[DONE]') events.push(o(JSON.parse(data)));
  }
  return events;
}
function chatText(events: Obj[], field = 'content'): string {
  return events.map(event => s(o(o(a(event.choices)[0]).delta)[field])).join('');
}
function chatTools(events: Obj[]): Map<number, { id: string; name: string; arguments: string }> {
  const tools = new Map<number, { id: string; name: string; arguments: string }>();
  for (const event of events) for (const choice of a(event.choices)) for (const raw of a(o(o(choice).delta).tool_calls)) {
    const call = o(raw), i = Number(call.index), fn = o(call.function);
    const tool = tools.get(i) ?? { id: '', name: '', arguments: '' };
    tool.id += s(call.id); tool.name += s(fn.name); tool.arguments += s(fn.arguments); tools.set(i, tool);
  }
  return tools;
}
function anthText(events: Obj[], type = 'text_delta'): string {
  return events.filter(event => event.type === 'content_block_delta' && o(event.delta).type === type).map(event => s(o(event.delta)[type === 'thinking_delta' ? 'thinking' : 'text'])).join('');
}
function anthTools(events: Obj[]) {
  const tools = new Map<number, { id: string; name: string; arguments: string }>();
  for (const event of events) {
    const b = o(event.content_block), i = Number(event.index);
    if (event.type === 'content_block_start' && b.type === 'tool_use') tools.set(i, { id: s(b.id), name: s(b.name), arguments: '' });
    if (event.type === 'content_block_delta' && o(event.delta).type === 'input_json_delta') tools.get(i)!.arguments += s(o(event.delta).partial_json);
  }
  return Array.from(tools.values());
}
function anthropicFrames(stop = 'tool_use'): string[] {
  return [
    frame('message_start', { message: { id: 'msg_fixture', model: 'fixture-model', usage: { input_tokens: 10, cache_read_input_tokens: 3, cache_creation_input_tokens: 2, output_tokens: 0 } } }),
    frame('content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '' } }),
    frame('content_block_delta', { index: 0, delta: { type: 'thinking_delta', thinking: 'plan🧠' } }),
    frame('content_block_delta', { index: 0, delta: { type: 'signature_delta', signature: 'signature-fixture' } }),
    frame('content_block_stop', { index: 0 }),
    frame('content_block_start', { index: 1, content_block: { type: 'text', text: '' } }),
    frame('content_block_delta', { index: 1, delta: { type: 'text_delta', text: 'hello🌍' } }),
    frame('content_block_stop', { index: 1 }),
    frame('content_block_start', { index: 2, content_block: { type: 'tool_use', id: 't1', name: 'OutA', input: {} } }),
    frame('content_block_start', { index: 3, content_block: { type: 'tool_use', id: 't2', name: 'OutB', input: {} } }),
    frame('content_block_delta', { index: 2, delta: { type: 'input_json_delta', partial_json: '{"name":"OutA",' } }),
    frame('content_block_delta', { index: 3, delta: { type: 'input_json_delta', partial_json: '{"n":' } }),
    frame('content_block_delta', { index: 2, delta: { type: 'input_json_delta', partial_json: '"path":"x"}' } }),
    frame('content_block_delta', { index: 3, delta: { type: 'input_json_delta', partial_json: '2}' } }),
    frame('content_block_stop', { index: 2 }), frame('content_block_stop', { index: 3 }),
    frame('message_delta', { delta: { stop_reason: stop, stop_sequence: stop === 'stop_sequence' ? 'END' : null }, usage: { output_tokens: 9 } }),
    frame('message_stop'),
  ];
}
const responseOutput: Obj[] = [
  { type: 'reasoning', id: 'rs0', summary: [{ type: 'summary_text', text: 'chain' }] },
  { type: 'message', id: 'm0', role: 'assistant', content: [{ type: 'output_text', text: 'hello', annotations: [] }] },
  { type: 'function_call', id: 'fc0', call_id: 't1', name: 'OutA', arguments: '{"name":"OutA"}' },
  { type: 'function_call', id: 'fc1', call_id: 't2', name: 'OutB', arguments: '{"n":2}' },
];
const responseUsage = { input_tokens: 21, output_tokens: 8, total_tokens: 29, input_tokens_details: { cached_tokens: 4 }, output_tokens_details: { reasoning_tokens: 2 } };
function responsesFrames(terminal = true): string[] {
  const frames = [frame('response.created', { response: { id: 'resp_fixture', model: 'fixture-model', created_at: 100, output: [], usage: null } }),
    frame('response.output_item.added', { output_index: 0, item: { type: 'reasoning', id: 'rs0', summary: [] } }),
    frame('response.reasoning_summary_part.added', { output_index: 0, summary_index: 0, part: { type: 'summary_text', text: '' } }),
    frame('response.reasoning_summary_text.delta', { output_index: 0, summary_index: 0, delta: 'chain' }),
    frame('response.reasoning_summary_text.done', { output_index: 0, summary_index: 0, text: 'chain' }),
    frame('response.reasoning_summary_part.done', { output_index: 0, summary_index: 0, part: { type: 'summary_text', text: 'chain' } }),
    frame('response.output_item.done', { output_index: 0, item: responseOutput[0] }),
    frame('response.output_item.added', { output_index: 1, item: { type: 'message', id: 'm0', content: [] } }),
    frame('response.content_part.added', { output_index: 1, content_index: 0, part: { type: 'output_text', text: '' } }),
    frame('response.output_text.delta', { item_id: 'm0', content_index: 0, delta: 'hello' }),
    frame('response.output_text.done', { output_index: 1, content_index: 0, text: 'hello' }),
    frame('response.content_part.done', { output_index: 1, content_index: 0, part: { type: 'output_text', text: 'hello' } }),
    frame('response.output_item.done', { output_index: 1, item: responseOutput[1] }),
    frame('response.output_item.added', { output_index: 2, item: { ...responseOutput[2], arguments: '' } }),
    frame('response.output_item.added', { output_index: 3, item: { ...responseOutput[3], arguments: '' } }),
    frame('response.function_call_arguments.delta', { item_id: 'fc0', delta: '{"name":' }),
    frame('response.function_call_arguments.delta', { item_id: 'fc1', delta: '{"n":' }),
    frame('response.function_call_arguments.delta', { item_id: 'fc0', delta: '"OutA"}' }),
    frame('response.function_call_arguments.delta', { item_id: 'fc1', delta: '2}' }),
    frame('response.function_call_arguments.done', { output_index: 2, arguments: '{"name":"OutA"}' }),
    frame('response.function_call_arguments.done', { output_index: 3, arguments: '{"n":2}' }),
    frame('response.output_item.done', { output_index: 2, item: responseOutput[2] }),
    frame('response.output_item.done', { output_index: 3, item: responseOutput[3] }),
  ];
  if (terminal) frames.push(frame('response.completed', { response: { id: 'resp_fixture', model: 'fixture-model', created_at: 100, status: 'completed', output: responseOutput, usage: responseUsage } }));
  return frames;
}
const anthropicJson = { id: 'msg_json', type: 'message', role: 'assistant', model: 'fixture-model', content: [
  { type: 'thinking', thinking: 'plan', signature: 'sig' }, { type: 'text', text: 'OutA text' },
  { type: 'tool_use', id: 't1', name: 'OutA', input: { name: 'OutA', nested: { name: 'OutB' } } },
  { type: 'tool_use', id: 't2', name: 'OutB', input: { n: 2 } },
], stop_reason: 'tool_use', stop_sequence: null, usage: { input_tokens: 10, cache_read_input_tokens: 3, cache_creation_input_tokens: 2, output_tokens: 9 } };
const responsesJson = { id: 'resp_json', object: 'response', status: 'completed', model: 'fixture-model', output: responseOutput, usage: responseUsage };
const chatJson = { id: 'chat_json', object: 'chat.completion', model: 'fixture-model', created: 100,
  choices: [{ index: 0, message: { role: 'assistant', content: 'hello', reasoning_content: 'chain', tool_calls: [{ id: 't1', type: 'function', function: { name: 'OutA', arguments: '{"name":"OutA"}' } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 21, completion_tokens: 8, prompt_tokens_details: { cached_tokens: 4 } } };
function jsonResponse(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } }); }

for (const target of ['openai-responses', 'openai-chat-completions'] as const) test('Anthropic JSON -> ' + target + ': text/thinking, parallel tools and usage', async () => {
  const body = o(await bridgeResponse(jsonResponse(anthropicJson), result('anthropic-messages', target)).json());
  assert.equal(o(body.usage)[target === 'openai-responses' ? 'input_tokens' : 'prompt_tokens'], 15);
  assert.equal(o(body.usage)[target === 'openai-responses' ? 'output_tokens' : 'completion_tokens'], 9);
  if (target === 'openai-responses') {
    const output = a(body.output).map(o); assert.equal(output[0]!.type, 'reasoning'); assert.equal(o(a(output[0]!.summary)[0]).text, 'plan');
    assert.deepEqual(output.filter(v => v.type === 'function_call').map(v => v.name), ['original_a', 'original_b']);
    assert.deepEqual(JSON.parse(s(output[2]!.arguments)), { name: 'OutA', nested: { name: 'OutB' } });
  } else {
    const choice = o(a(body.choices)[0]), message = o(choice.message); assert.equal(message.content, 'OutA text'); assert.equal(message.reasoning_content, 'plan');
    assert.equal(choice.finish_reason, 'tool_calls'); assert.deepEqual(a(message.tool_calls).map(v => o(o(v).function).name), ['original_a', 'original_b']);
  }
});
for (const source of ['openai-responses', 'openai-chat-completions'] as const) test(source + ' JSON -> Anthropic: tool input remains literal, cache/stop counts', async () => {
  const body = o(await bridgeResponse(jsonResponse(source === 'openai-responses' ? responsesJson : chatJson), result(source, 'anthropic-messages')).json());
  assert.equal(body.type, 'message'); assert.equal(body.stop_reason, 'tool_use'); assert.equal(o(body.usage).input_tokens, 17); assert.equal(o(body.usage).cache_read_input_tokens, 4);
  const tools = a(body.content).map(o).filter(v => v.type === 'tool_use'); assert.equal(tools[0]!.name, 'original_a'); assert.deepEqual(tools[0]!.input, { name: 'OutA' });
});
test('Responses JSON -> Chat and Chat JSON -> Responses preserve ordinary text and stops', async () => {
  const chat = o(await bridgeResponse(jsonResponse(responsesJson), result('openai-responses', 'openai-chat-completions')).json());
  assert.equal(o(o(a(chat.choices)[0]).message).content, 'hello');
  const response = o(await bridgeResponse(jsonResponse(chatJson), result('openai-chat-completions', 'openai-responses')).json());
  assert.equal(response.status, 'completed'); assert.equal(a(response.output).map(o).find(v => v.type === 'function_call')!.name, 'original_a');
});
test('JSON max-token and stop-sequence semantics are translated', async () => {
  const incomplete = o(await bridgeResponse(jsonResponse({ ...responsesJson, status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }), result('openai-responses', 'anthropic-messages')).json());
  assert.equal(incomplete.stop_reason, 'max_tokens');
  const response = o(await bridgeResponse(jsonResponse({ ...anthropicJson, stop_reason: 'max_tokens' }), result('anthropic-messages', 'openai-responses')).json());
  assert.equal(response.status, 'incomplete'); assert.equal(o(response.incomplete_details).reason, 'max_output_tokens');
  const stop = o(await bridgeResponse(jsonResponse({ ...anthropicJson, stop_reason: 'stop_sequence', stop_sequence: 'END' }), result('anthropic-messages', 'anthropic-messages')).json());
  assert.equal(stop.stop_sequence, 'END');
});
for (const protocol of ['anthropic-messages', 'openai-responses', 'openai-chat-completions'] as const) test('same-protocol ' + protocol + ' only renames tool positions and definitions', async () => {
  const value = protocol === 'anthropic-messages' ? { ...anthropicJson, name: 'OutA', metadata: { name: 'OutA' }, tools: [{ name: 'OutA', input_schema: { properties: { name: { const: 'OutA' } } } }] }
    : protocol === 'openai-responses' ? { ...responsesJson, name: 'OutA', metadata: { name: 'OutA' }, tools: [{ type: 'function', name: 'OutA', parameters: { name: 'OutA' } }] }
    : { ...chatJson, name: 'OutA', metadata: { name: 'OutA' }, tools: [{ type: 'function', function: { name: 'OutA', parameters: { name: 'OutA' } } }] };
  const body = o(await bridgeResponse(jsonResponse(value), result(protocol, protocol)).json());
  assert.equal(body.name, 'OutA'); assert.deepEqual(body.metadata, { name: 'OutA' });
  const tool = o(a(body.tools)[0]); assert.equal(protocol === 'openai-chat-completions' ? o(tool.function).name : tool.name, 'original_a');
  if (protocol === 'anthropic-messages') assert.deepEqual(o(a(body.content)[2]).input, { name: 'OutA', nested: { name: 'OutB' } });
  if (protocol === 'openai-responses') assert.equal(o(a(body.output)[2]).arguments, '{"name":"OutA"}');
  if (protocol === 'openai-chat-completions') assert.equal(o(o(a(o(o(a(body.choices)[0]).message).tool_calls)[0]).function).arguments, '{"name":"OutA"}');
});
test('non-2xx, bodyless, no-op, binary and text responses stay untouched and unread', async () => {
  for (const [status, type] of [[429, 'application/json'], [200, 'text/plain'], [200, 'application/octet-stream']] as const) {
    const input = memory(['literal'], type, status); assert.equal(bridgeResponse(input.response, result('anthropic-messages', 'openai-responses')), input.response); assert.equal(input.pulls(), 0);
  }
  const input = memory(['literal']); assert.equal(bridgeResponse(input.response, result('anthropic-messages', 'anthropic-messages', {})), input.response); assert.equal(input.pulls(), 0);
  const empty = new Response(null, { status: 204 }); assert.equal(bridgeResponse(empty, result('anthropic-messages', 'openai-responses')), empty);
});
test('JSON errors, invalid JSON, scalar JSON and binary mislabelled as JSON keep original bytes', async () => {
  for (const value of ['  {"type":"error","error":{"message":"OutA","name":"OutA"}}\n', 'not JSON', '"OutA"']) {
    const input = memory([value], 'application/json'); assert.equal(await bridgeResponse(input.response, result('anthropic-messages', 'openai-responses')).text(), value);
  }
  const bytes = Uint8Array.of(0xff, 0, 0x80); const input = memory([bytes], 'application/json');
  assert.deepEqual(new Uint8Array(await bridgeResponse(input.response, result('anthropic-messages', 'openai-responses')).arrayBuffer()), bytes);
});
test('new response preserves status/statusText/headers but strips stale length and encoding', async () => {
  const response = new Response(JSON.stringify(anthropicJson), { status: 201, statusText: 'Created Fixture', headers: { 'content-type': 'application/json; charset=utf-8', 'content-length': '999', 'content-encoding': 'gzip', 'x-fixture': 'yes' } });
  const converted = bridgeResponse(response, result('anthropic-messages', 'openai-responses'));
  assert.equal(converted.status, 201); assert.equal(converted.statusText, 'Created Fixture'); assert.equal(converted.headers.get('x-fixture'), 'yes');
  assert.equal(converted.headers.get('content-length'), null); assert.equal(converted.headers.get('content-encoding'), null); await converted.json();
});
for (const target of ['openai-chat-completions', 'openai-responses'] as const) test('Anthropic SSE -> ' + target + ': parallel fragmented tools, thinking, usage, terminal events', async () => {
  const text = await bridgeResponse(memory(anthropicFrames()).response, result('anthropic-messages', target)).text(), events = parsed(text);
  if (target === 'openai-chat-completions') {
    assert.equal(chatText(events), 'hello🌍'); assert.equal(chatText(events, 'reasoning_content'), 'plan🧠');
    const tools = chatTools(events); assert.equal(tools.size, 2); assert.equal(tools.get(0)!.name, 'original_a'); assert.equal(tools.get(1)!.name, 'original_b');
    assert.deepEqual(JSON.parse(tools.get(0)!.arguments), { name: 'OutA', path: 'x' }); assert.deepEqual(JSON.parse(tools.get(1)!.arguments), { n: 2 });
    assert.equal(o(a(events.find(event => o(a(event.choices)[0]).finish_reason !== null && a(event.choices).length > 0)!.choices)[0]).finish_reason, 'tool_calls');
    assert.equal(o(events.find(event => event.usage !== undefined)!.usage).prompt_tokens, 15); assert.ok(text.endsWith('data: [DONE]\n\n'));
  } else {
    assert.equal(events[0]!.type, 'response.created'); const done = events.find(event => event.type === 'response.completed')!;
    const output = a(o(done.response).output).map(o); assert.equal(o(a(output[0]!.summary)[0]).text, 'plan🧠'); assert.equal(o(a(output[1]!.content)[0]).text, 'hello🌍');
    assert.deepEqual(output.filter(v => v.type === 'function_call').map(v => v.name), ['original_a', 'original_b']); assert.deepEqual(JSON.parse(s(output[2]!.arguments)), { name: 'OutA', path: 'x' });
    assert.equal(o(o(done.response).usage).input_tokens, 15); assert.equal(o(o(done.response).usage).output_tokens, 9);
    assert.deepEqual(events.map(event => event.sequence_number), events.map((_, i) => i));
  }
});
for (const target of ['anthropic-messages', 'openai-chat-completions'] as const) test('Responses SSE -> ' + target + ': completed snapshots never replay deltas', async () => {
  const events = parsed(await bridgeResponse(memory(responsesFrames()).response, result('openai-responses', target)).text());
  if (target === 'anthropic-messages') {
    assert.equal(anthText(events), 'hello'); assert.equal(anthText(events, 'thinking_delta'), 'chain'); const tools = anthTools(events);
    assert.equal(tools.length, 2); assert.deepEqual(tools.map(tool => tool.name), ['original_a', 'original_b']); assert.deepEqual(JSON.parse(tools[0]!.arguments), { name: 'OutA' });
    const terminal = events.find(event => event.type === 'message_delta')!; assert.equal(o(terminal.delta).stop_reason, 'tool_use'); assert.equal(o(terminal.usage).input_tokens, 17); assert.equal(o(terminal.usage).output_tokens, 8);
    assert.equal(events.at(-1)!.type, 'message_stop');
  } else { assert.equal(chatText(events), 'hello'); assert.equal(chatText(events, 'reasoning_content'), 'chain'); assert.equal(chatTools(events).get(0)!.arguments, '{"name":"OutA"}'); }
});
test('SSE handles chunk-split UTF-8, CRLF, multiline JSON data and EOF frame remainder', async () => {
  const frames = anthropicFrames();
  frames[0] = 'event: message_start\r\ndata: {"type":"message_start",\r\ndata: "message":{"id":"msg_fixture","model":"fixture-model","usage":{"input_tokens":10}}}\r\n\r\n';
  const text = frames.map(v => v.replace(/(?<!\r)\n/g, '\r\n')).join('').replace(/\r\n\r\n$/, '');
  const bytes = enc.encode(text), parts = Array.from(bytes, byte => Uint8Array.of(byte));
  const events = parsed(await bridgeResponse(memory(parts).response, result('anthropic-messages', 'openai-chat-completions')).text()); assert.equal(chatText(events), 'hello🌍'); assert.equal(chatText(events, 'reasoning_content'), 'plan🧠');
});
test('same-protocol SSE preserves event id/retry and never rewrites tool arguments or text', async () => {
  const first = 'event: response.output_item.added\nid: fixture-id\nretry: 250\ndata: ' + JSON.stringify({ type: 'response.output_item.added', item: responseOutput[2] }) + '\n\n';
  const input = memory([first, frame('response.completed', { response: responsesJson })]);
  const text = await bridgeResponse(input.response, result('openai-responses', 'openai-responses')).text(); const events = parsed(text);
  assert.ok(text.includes('id: fixture-id\nretry: 250\n')); assert.equal(o(events[0]!.item).name, 'original_a'); assert.equal(o(events[0]!.item).arguments, '{"name":"OutA"}');
  assert.equal(o(a(o(events[1]!.response).output)[1]).type, 'message');
});
test('clean EOF or [DONE] synthesizes normal termination without invented tool calls', async () => {
  for (const ending of ['', 'data: [DONE]\n\n']) {
    const input = memory([frame('message_start', { message: { id: 'm', usage: { input_tokens: 1 } } }), frame('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }), frame('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'end' } }), ending]);
    const events = parsed(await bridgeResponse(input.response, result('anthropic-messages', 'openai-responses')).text());
    assert.equal(events.at(-1)!.type, 'response.completed'); assert.equal(a(o(events.at(-1)!.response).output).map(o).filter(v => v.type === 'function_call').length, 0);
  }
});
test('completion-only Responses SSE emits real content and tools from the terminal snapshot', async () => {
  const input = memory([frame('response.completed', { response: responsesJson })]); const events = parsed(await bridgeResponse(input.response, result('openai-responses', 'anthropic-messages')).text());
  assert.equal(anthText(events), 'hello'); assert.equal(anthText(events, 'thinking_delta'), 'chain'); assert.equal(anthTools(events).length, 2); assert.equal(events.at(-1)!.type, 'message_stop');
});
test('pull-based bridge reads no upstream data until requested and propagates cancellation reason', async () => {
  const input = memory(anthropicFrames()); const output = bridgeResponse(input.response, result('anthropic-messages', 'openai-responses'));
  assert.equal(input.pulls(), 0); const reader = output.body!.getReader(); assert.equal(input.pulls(), 0);
  const first = await reader.read(); assert.ok(new TextDecoder().decode(first.value).includes('response.created')); assert.equal(input.pulls(), 1);
  await Promise.resolve(); assert.equal(input.pulls(), 1); const reason = { code: 'fixture-cancel' }; await reader.cancel(reason); assert.equal(input.cancellations(), 1); assert.equal(input.reason(), reason);
});
test('cancellation before first read cancels an untouched upstream reader', async () => {
  const input = memory(anthropicFrames()); await bridgeResponse(input.response, result('anthropic-messages', 'openai-responses')).body!.cancel('before-read');
  assert.equal(input.pulls(), 0); assert.equal(input.cancellations(), 1); assert.equal(input.reason(), 'before-read');
});
test('JSON wrapper is lazy and cancellation is passed through', async () => {
  const input = memory([JSON.stringify(anthropicJson)], 'application/json'); const output = bridgeResponse(input.response, result('anthropic-messages', 'openai-responses'));
  assert.equal(input.pulls(), 0); await output.body!.cancel('json-cancel'); assert.equal(input.cancellations(), 1); assert.equal(input.reason(), 'json-cancel');
});
test('protocol error events preserve detail and terminate without successful completion', async () => {
  for (const target of ['anthropic-messages', 'openai-chat-completions', 'openai-responses'] as const) {
    const input = memory([frame('error', { error: { type: 'overloaded_error', message: 'OutA unavailable', code: 'busy' } }), ...anthropicFrames()]);
    const events = parsed(await bridgeResponse(input.response, result('anthropic-messages', target)).text());
    const error = events.find(event => event.type === 'error' || event.error !== undefined)!;
    assert.equal(target === 'openai-responses' ? error.message : o(error.error).message, 'OutA unavailable'); assert.equal(events.some(event => event.type === 'response.completed' || event.type === 'message_stop'), false);
    assert.equal(input.cancellations(), 1);
  }
});
test('malformed SSE JSON/UTF-8 and absent tool metadata error the stream and cancel upstream', async () => {
  for (const payload of ['data: {bad}\n\n', Uint8Array.of(0xff), frame('response.function_call_arguments.delta', { output_index: 7, delta: '{}' })]) {
    const input = memory([payload]); await assert.rejects(bridgeResponse(input.response, result('openai-responses', 'anthropic-messages')).text()); assert.equal(input.cancellations(), 1);
  }
});
test('an individual oversized SSE event is bounded, but a large network chunk of small events is valid', async () => {
  const large = memory(['data: ' + 'x'.repeat(1024 * 1024 + 1) + '\n\n']);
  await assert.rejects(bridgeResponse(large.response, result('anthropic-messages', 'openai-chat-completions')).text(), /event exceeds/); assert.equal(large.cancellations(), 1);
  const text = 'x'.repeat(16 * 1024), parts = [frame('message_start', { message: { id: 'large' } }), frame('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })];
  for (let i = 0; i < 80; i++) parts.push(frame('content_block_delta', { index: 0, delta: { type: 'text_delta', text } }));
  parts.push(frame('message_stop')); const input = memory([parts.join('')]);
  const events = parsed(await bridgeResponse(input.response, result('anthropic-messages', 'openai-chat-completions')).text()); assert.equal(chatText(events).length, 80 * text.length);
});
test('Responses terminal snapshot has a bounded retention budget and errors rather than truncating', async () => {
  const input = memory([frame('message_start', { message: { id: 'large' } }), frame('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }), frame('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'x'.repeat(524289) } })]);
  await assert.rejects(bridgeResponse(input.response, result('anthropic-messages', 'openai-responses')).text(), /bounded 524288/); assert.equal(input.cancellations(), 1);
});
test('invalid non-stream tool arguments are surfaced instead of creating empty tool inputs', async () => {
  const value = { ...responsesJson, output: [{ type: 'function_call', id: 'f', call_id: 't', name: 'OutA', arguments: '{bad}' }] };
  await assert.rejects(bridgeResponse(jsonResponse(value), result('openai-responses', 'anthropic-messages')).text(), /function-call JSON/);
});
function chatFrames(): string[] {
  const chunk = (delta: Obj, finish: string | null = null): string => 'data: ' + JSON.stringify({ id: 'chat_stream_fixture', object: 'chat.completion.chunk', created: 101, model: 'fixture-model', choices: [{ index: 0, delta, finish_reason: finish }] }) + '\n\n';
  return [
    chunk({ role: 'assistant', reasoning_content: 'chain', reasoning_signature: 'chat-signature' }), chunk({ content: 'hello' }),
    chunk({ tool_calls: [{ index: 0, id: 't1', type: 'function', function: { name: 'OutA', arguments: '{"name":' } }, { index: 1, id: 't2', type: 'function', function: { name: 'OutB', arguments: '{"n":' } }] }),
    chunk({ tool_calls: [{ index: 1, function: { arguments: '2}' } }, { index: 0, function: { arguments: '"OutA"}' } }] }), chunk({}, 'tool_calls'),
    'data: ' + JSON.stringify({ id: 'chat_stream_fixture', object: 'chat.completion.chunk', created: 101, model: 'fixture-model', choices: [], usage: { prompt_tokens: 21, completion_tokens: 8, prompt_tokens_details: { cached_tokens: 4 }, completion_tokens_details: { reasoning_tokens: 2 } } }) + '\n\n', 'data: [DONE]\n\n',
  ];
}
for (const target of ['anthropic-messages', 'openai-responses'] as const) test('Chat SSE -> ' + target + ': streamed signatures, parallel arguments, usage and DONE', async () => {
  const events = parsed(await bridgeResponse(memory(chatFrames()).response, result('openai-chat-completions', target)).text());
  if (target === 'anthropic-messages') {
    assert.equal(anthText(events), 'hello'); assert.equal(anthText(events, 'thinking_delta'), 'chain');
    assert.equal(o(events.find(event => o(event.delta).type === 'signature_delta')!.delta).signature, 'chat-signature');
    assert.deepEqual(anthTools(events).map(tool => [tool.id, tool.name, JSON.parse(tool.arguments)]), [['t1', 'original_a', { name: 'OutA' }], ['t2', 'original_b', { n: 2 }]]);
    const terminal = events.find(event => event.type === 'message_delta')!; assert.equal(o(terminal.delta).stop_reason, 'tool_use'); assert.equal(o(terminal.usage).input_tokens, 17); assert.equal(o(terminal.usage).output_tokens, 8);
  } else {
    const done = o(events.at(-1)!.response), output = a(done.output).map(o); assert.equal(events.at(-1)!.type, 'response.completed'); assert.equal(done.created_at, 101);
    assert.equal(o(a(output.find(item => item.type === 'message')!.content)[0]).text, 'hello'); assert.equal(o(a(output.find(item => item.type === 'reasoning')!.summary)[0]).text, 'chain');
    assert.deepEqual(output.filter(item => item.type === 'function_call').map(item => [item.call_id, item.name, JSON.parse(s(item.arguments))]), [['t1', 'original_a', { name: 'OutA' }], ['t2', 'original_b', { n: 2 }]]);
    assert.equal(o(done.usage).input_tokens, 21); assert.equal(o(o(done.usage).output_tokens_details).reasoning_tokens, 2);
  }
});
test('partial Anthropic usage snapshots retain earlier cache counts and accept later cache updates', async () => {
  const parts = [frame('message_start', { message: { id: 'usage_partial', usage: { input_tokens: 10, cache_read_input_tokens: 3, cache_creation_input_tokens: 2 } } }),
    frame('message_delta', { usage: { input_tokens: 10, output_tokens: 5 } }), frame('message_delta', { usage: { cache_read_input_tokens: 4 } }), frame('message_stop')];
  for (const target of ['openai-chat-completions', 'openai-responses'] as const) {
    const events = parsed(await bridgeResponse(memory(parts).response, result('anthropic-messages', target)).text());
    const usage = target === 'openai-chat-completions' ? o(events.find(event => event.usage !== undefined)!.usage) : o(o(events.at(-1)!.response).usage);
    assert.equal(usage[target === 'openai-chat-completions' ? 'prompt_tokens' : 'input_tokens'], 16); assert.equal(usage.total_tokens, 21);
    const details = o(usage[target === 'openai-chat-completions' ? 'prompt_tokens_details' : 'input_tokens_details']); assert.equal(details.cached_tokens, 4); assert.equal(details.cache_creation_tokens, 2);
  }
});
test('same-protocol name expansion obeys the translated single-event bound', async () => {
  const input = memory([frame('content_block_start', { index: 0, content_block: { type: 'tool_use', id: 't1', name: 'OutA', input: {} } })]);
  await assert.rejects(bridgeResponse(input.response, result('anthropic-messages', 'anthropic-messages', { OutA: 'x'.repeat(1024 * 1024) })).text(), /Translated SSE event exceeds/);
  assert.equal(input.cancellations(), 1);
});
test('cancellation with an upstream read in flight resolves pending reads and releases input locks', async () => {
  for (const contentType of ['text/event-stream', 'application/json']) {
    let entered!: () => void, release!: () => void, cancellations = 0, cancelledReason: unknown;
    const begun = new Promise<void>(resolve => { entered = resolve; }), blocked = new Promise<void>(resolve => { release = resolve; });
    const stream = new ReadableStream<Uint8Array>({ pull() { entered(); return blocked; }, cancel(reason) { cancellations++; cancelledReason = reason; } }, { highWaterMark: 0 });
    const input = new Response(stream, { headers: { 'content-type': contentType } }), reader = bridgeResponse(input, result('anthropic-messages', 'openai-responses')).body!.getReader();
    const pending = reader.read(); await begun; const reason = { code: 'pending-cancel', contentType }; await reader.cancel(reason); release();
    assert.equal((await pending).done, true); assert.equal(cancellations, 1); assert.equal(cancelledReason, reason); assert.equal(input.body!.locked, false);
  }
});
test('SSE max-token stops map to Responses incomplete and Chat length without discarding real tools', async () => {
  for (const target of ['openai-responses', 'openai-chat-completions'] as const) {
    const events = parsed(await bridgeResponse(memory(anthropicFrames('max_tokens')).response, result('anthropic-messages', target)).text());
    if (target === 'openai-responses') { assert.equal(events.at(-1)!.type, 'response.incomplete'); assert.equal(o(o(events.at(-1)!.response).incomplete_details).reason, 'max_output_tokens'); }
    else { assert.equal(events.some(event => o(a(event.choices)[0]).finish_reason === 'length'), true); assert.equal(chatTools(events).size, 2); }
  }
  const incomplete = { ...responsesJson, status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } };
  const events = parsed(await bridgeResponse(memory([...responsesFrames(false), frame('response.incomplete', { response: incomplete })]).response, result('openai-responses', 'anthropic-messages')).text());
  assert.equal(o(events.find(event => event.type === 'message_delta')!.delta).stop_reason, 'max_tokens');
});
test('same-protocol Anthropic and Chat SSE rename only call metadata, never fragmented arguments', async () => {
  const anth = parsed(await bridgeResponse(memory(anthropicFrames()).response, result('anthropic-messages', 'anthropic-messages')).text());
  assert.equal(anthText(anth), 'hello🌍'); assert.deepEqual(anthTools(anth).map(tool => [tool.name, JSON.parse(tool.arguments)]), [['original_a', { name: 'OutA', path: 'x' }], ['original_b', { n: 2 }]]);
  const chat = parsed(await bridgeResponse(memory(chatFrames()).response, result('openai-chat-completions', 'openai-chat-completions')).text());
  assert.equal(chatText(chat), 'hello'); assert.deepEqual(Array.from(chatTools(chat).values()).map(tool => [tool.name, JSON.parse(tool.arguments)]), [['original_a', { name: 'OutA' }], ['original_b', { n: 2 }]]);
});
test('independent response rounds isolate tool mappings, argument fragments and call indices', async () => {
  for (const suffix of ['first', 'second']) {
    const events = parsed(await bridgeResponse(memory(anthropicFrames()).response, result('anthropic-messages', 'openai-chat-completions', { OutA: 'a_' + suffix, OutB: 'b_' + suffix })).text());
    const tools = chatTools(events); assert.equal(tools.size, 2); assert.equal(tools.get(0)!.name, 'a_' + suffix); assert.equal(tools.get(1)!.name, 'b_' + suffix); assert.deepEqual(JSON.parse(tools.get(0)!.arguments), { name: 'OutA', path: 'x' });
  }
});

