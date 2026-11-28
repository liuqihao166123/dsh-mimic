import assert from 'node:assert/strict';
import test from 'node:test';
import { UsageCollector, extractUsage, readUsage, mergeUsage } from '../src/host/usage.js';
import type { UsageObservation, UsageSample } from '../src/host/usage.js';
import type { WireProtocol } from '../src/types.js';

const encoder = new TextEncoder();
const sample = (prompt: number, cached: number, written = 0, cacheReported = true): UsageSample => ({ prompt, cached, written, cacheReported });
function collect(value: unknown, protocol: WireProtocol = 'openai-responses'): UsageObservation {
  const collector = new UsageCollector(protocol, 'application/json');
  collector.push(encoder.encode(JSON.stringify(value))); return collector.finish();
}
function frame(type: string, value: Record<string, unknown> = {}, newline = '\n'): string {
  return 'event: ' + type + newline + 'data: ' + JSON.stringify({ type, ...value }) + newline + newline;
}
function stream(text: string, protocol: WireProtocol, chunk = 13): UsageObservation {
  const bytes = encoder.encode(text), collector = new UsageCollector(protocol, 'text/event-stream; charset=utf-8');
  for (let i = 0; i < bytes.length; i += chunk) collector.push(bytes.subarray(i, i + chunk));
  return collector.finish();
}

test('Responses and Chat use standard cache details and total input as denominator (75%)', () => {
  for (const [protocol, usage] of [
    ['openai-responses', { input_tokens: 1000, input_tokens_details: { cached_tokens: 750 } }],
    ['openai-chat-completions', { prompt_tokens: 1000, prompt_tokens_details: { cached_tokens: 750 } }],
  ] as const) {
    const result = collect({ usage }, protocol);
    assert.deepEqual(result, { sample: sample(1000, 750), state: 'complete', malformed: false, limitExceeded: false });
    assert.equal(result.sample!.cached / result.sample!.prompt, 0.75);
  }
});
test('Claude denominator includes uncached, read and written input (980/992)', () => {
  assert.deepEqual(collect({ usage: { input_tokens: 10, cache_read_input_tokens: 980, cache_creation_input_tokens: 2 } }, 'anthropic-messages').sample, sample(992, 980, 2));
});
test('Claude zero uncached input still reports all cached input', () => {
  assert.deepEqual(collect({ usage: { input_tokens: 0, cache_read_input_tokens: 980 } }, 'anthropic-messages').sample, sample(980, 980));
});
test('Claude pure cache writes keep the total while cache read remains unknown', () => {
  assert.deepEqual(collect({ usage: { input_tokens: 0, cache_creation_input_tokens: 980 } }, 'anthropic-messages').sample, sample(980, 0, 980, false));
});
test('unknown cache field differs from explicit zero and top-level fallback is supported', () => {
  assert.deepEqual(collect({ usage: { input_tokens: 10 } }).sample, sample(10, 0, 0, false));
  assert.deepEqual(collect({ usage: { input_tokens: 10, input_tokens_details: { cached_tokens: 0 } } }).sample, sample(10, 0));
  assert.deepEqual(collect({ usage: { input_tokens: 10, cached_tokens: 4 } }).sample, sample(10, 4));
  assert.deepEqual(collect({ usage: { input_tokens: 10, cached_tokens: 8, input_tokens_details: { cached_tokens: 0 } } }).sample, sample(10, 0));
});
test('only finite, nonnegative safe integer token fields enter samples', () => {
  for (const invalid of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '10', null, true]) {
    assert.equal(collect({ usage: { input_tokens: invalid, cached_tokens: 0 } }).sample, undefined);
    assert.deepEqual(collect({ usage: { input_tokens: 10, cached_tokens: invalid } }).sample, sample(10, 0, 0, false));
  }
  assert.deepEqual(readUsage({ input_tokens: Infinity, cached_tokens: NaN }, 'openai-responses'), {});
  assert.equal(collect({ usage: { input_tokens: Number.MAX_SAFE_INTEGER, cache_read_input_tokens: 1 } }, 'anthropic-messages').sample, undefined);
});
test('Claude later partial snapshots overwrite counters and recalculate once', () => {
  const text = frame('message_start', { message: { usage: { input_tokens: 8, cache_read_input_tokens: 980, cache_creation_input_tokens: 2 } } })
    + frame('message_delta', { usage: { cache_read_input_tokens: 4, output_tokens: 9 } }) + frame('message_stop');
  assert.deepEqual(stream(text, 'anthropic-messages').sample, sample(14, 4, 2));
  assert.equal(stream(text, 'anthropic-messages').state, 'complete');
  const empty = { input: 0, output: 0, cached: 0, cacheWrite: 0, reasoning: 0 };
  const first = mergeUsage(empty, readUsage({ input_tokens: 8, cache_read_input_tokens: 980, cache_creation_input_tokens: 2 }, 'anthropic-messages'));
  assert.equal(mergeUsage(first, readUsage({ cache_read_input_tokens: 4 }, 'anthropic-messages')).input, 14);
});
test('streaming snapshots replace rather than sum or take a maximum frame', () => {
  const text = frame('response.created', { response: { usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 75 } } } })
    + frame('response.completed', { response: { usage: { input_tokens: 20, input_tokens_details: { cached_tokens: 4 } } } });
  assert.deepEqual(stream(text, 'openai-responses').sample, sample(20, 4));
});
test('JSON only reads root usage and never samples nested tool or content objects', () => {
  const fake = { input_tokens: 1000, input_tokens_details: { cached_tokens: 999 } };
  const value = { output: [{ arguments: { usage: fake }, content: [{ usage: fake }] }], message: { usage: fake }, 'response.usage': fake, metadata: { usage: fake } };
  assert.equal(collect(value).sample, undefined);
  assert.deepEqual(collect({ ...value, usage: { input_tokens: 10, cached_tokens: 2 } }).sample, sample(10, 2));
  assert.equal(collect({ output: [{ usage: { prompt_tokens: 99, cached_tokens: 98 } }] }, 'openai-chat-completions').sample, undefined);
});
test('SSE observes only each selected protocol usage paths', () => {
  const fake = { input_tokens: 999, prompt_tokens: 999, cached_tokens: 998 };
  const responses = frame('response.completed', { usage: fake, message: { usage: fake }, item: { usage: fake }, 'response.usage': fake });
  assert.equal(stream(responses, 'openai-responses').sample, undefined);
  const anthropic = frame('message_stop', { delta: { usage: { input_tokens: 999, cache_read_input_tokens: 998 } }, response: { usage: fake } });
  assert.equal(stream(anthropic, 'anthropic-messages').sample, undefined);
  const chat = 'data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ function: { arguments: JSON.stringify({ usage: fake }) } }], usage: fake } }], message: { usage: fake } }) + '\n\ndata: [DONE]\n\n';
  assert.equal(stream(chat, 'openai-chat-completions').sample, undefined);
});
test('split UTF-8, CRLF, multiline SSE data, comments and unterminated EOF frame', () => {
  const text = ':心跳\r\nevent: response.completed\r\ndata: {"type":"response.completed","response":{\r\ndata: "output":[{"text":"🧠你好"}],"usage":{"input_tokens":100,"input_tokens_details":{"cached_tokens":75}}}}';
  assert.deepEqual(stream(text, 'openai-responses', 1), { sample: sample(100, 75), state: 'complete', malformed: false, limitExceeded: false });
});
test('JSON large content is discarded incrementally and usage after 4 MiB is read', () => {
  const collector = new UsageCollector('openai-responses', 'application/json');
  collector.push(encoder.encode('{"output":[{"content":"'));
  const part = encoder.encode('x'.repeat(64 * 1024));
  for (let i = 0; i < 81; i++) collector.push(part);
  collector.push(encoder.encode('"}],"usage":{"input_tokens":1000,"input_tokens_details":{"cached_tokens":750}}}'));
  assert.deepEqual(collector.finish(), { sample: sample(1000, 750), state: 'complete', malformed: false, limitExceeded: false });
});
test('SSE total body above 4 MiB still observes its trailing usage event', () => {
  const collector = new UsageCollector('openai-responses', 'text/event-stream');
  const delta = encoder.encode(frame('response.output_text.delta', { delta: '🧠'.repeat(20000) }));
  for (let i = 0; i < 65; i++) collector.push(delta);
  collector.push(encoder.encode(frame('response.completed', { response: { usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 750 } } } })));
  assert.deepEqual(collector.finish(), { sample: sample(1000, 750), state: 'complete', malformed: false, limitExceeded: false });
});
test('JSON usage object limit is reported and does not invent a zero sample', () => {
  const result = collect({ usage: { input_tokens: 100, padding: 'x'.repeat(70 * 1024), cached_tokens: 75 } });
  assert.equal(result.limitExceeded, true); assert.equal(result.sample, undefined); assert.equal(result.malformed, false);
});
test('SSE event limit is reported and framing resumes for a later usage event', () => {
  const text = frame('response.output_text.delta', { delta: 'x'.repeat(1024 * 1024) })
    + frame('response.completed', { response: { usage: { input_tokens: 100, cached_tokens: 75 } } });
  const result = stream(text, 'openai-responses', 8191);
  assert.equal(result.limitExceeded, true); assert.equal(result.malformed, false); assert.deepEqual(result.sample, sample(100, 75));
});
test('excessive nesting is bounded and reported', () => {
  const collector = new UsageCollector('openai-responses', 'application/json');
  collector.push(encoder.encode('{"output":' + '['.repeat(140) + '0' + ']'.repeat(140) + '}'));
  assert.equal(collector.finish().limitExceeded, true);
});
test('valid JSON keys with escapes resolve while dotted key impostors do not', () => {
  const collector = new UsageCollector('openai-responses', 'application/json');
  collector.push(encoder.encode('{"us\\u0061ge":{"input_tokens":8,"cached_tokens":4}}'));
  assert.deepEqual(collector.finish().sample, sample(8, 4));
  assert.equal(stream(frame('response.completed', { 'response.usage': { input_tokens: 8, cached_tokens: 4 } }), 'openai-responses').sample, undefined);
});
test('duplicate envelope properties follow JSON last-property-wins semantics', () => {
  const json = new UsageCollector('openai-responses', 'application/json');
  json.push(encoder.encode('{"usage":{"input_tokens":100,"cached_tokens":75},"usage":null}'));
  assert.equal(json.finish().sample, undefined);
  const text = 'event: response.completed\ndata: {"response":{"usage":{"input_tokens":100,"cached_tokens":75}},"response":{}}\n\n';
  assert.equal(stream(text, 'openai-responses').sample, undefined);
  assert.equal(collect({ error: 'x'.repeat(1000) }).state, 'failed');
});
test('malformed JSON is signalled without retaining a sample from an invalid envelope', () => {
  for (const text of ['{"usage":{"input_tokens":10}} trailing', '{"usage":{"input_tokens":10},}', '{"usage":{"input_tokens":10}', '{"x":"bad\\q"}', '{"x":01}', '{"x":[1,]}', '']) {
    const collector = new UsageCollector('openai-responses', 'application/json'); collector.push(encoder.encode(text));
    const result = collector.finish(); assert.equal(result.malformed, true, text); assert.equal(result.sample, undefined, text);
  }
});
test('malformed event does not prevent later valid SSE sampling', () => {
  const result = stream('data: {oops}\n\n' + frame('response.completed', { response: { usage: { input_tokens: 10, cached_tokens: 5 } } }), 'openai-responses');
  assert.equal(result.malformed, true); assert.deepEqual(result.sample, sample(10, 5));
});
test('bad UTF-8 is reported as malformed', () => {
  const collector = new UsageCollector('openai-responses', 'application/json'); collector.push(Uint8Array.of(0xff));
  assert.equal(collector.finish().malformed, true);
});
test('failed/cancelled/incomplete business states stay distinct and can keep valid usage', () => {
  for (const state of ['failed', 'cancelled', 'incomplete'] as const) {
    assert.equal(collect({ status: state, usage: { input_tokens: 10, cached_tokens: 5 } }).state, state);
    const result = stream(frame('response.' + state, { response: { status: state, usage: { input_tokens: 10, cached_tokens: 5 } } }), 'openai-responses');
    assert.equal(result.state, state); assert.deepEqual(result.sample, sample(10, 5));
  }
  assert.equal(collect({ error: { message: 'upstream error' } }).state, 'failed');
  assert.equal(stream(frame('error', { error: { message: 'upstream error' } }), 'anthropic-messages').state, 'failed');
  assert.equal(stream('data: {"error":{"message":"upstream error"}}\n\ndata: [DONE]\n\n', 'openai-chat-completions').state, 'failed');
});
test('SSE missing protocol terminal marker remains incomplete even with usage', () => {
  assert.equal(stream(frame('response.created', { response: { usage: { input_tokens: 10, cached_tokens: 5 } } }), 'openai-responses').state, 'incomplete');
  assert.equal(stream(frame('message_delta', { usage: { input_tokens: 10, cache_read_input_tokens: 5 } }), 'anthropic-messages').state, 'incomplete');
  const chat = 'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"cached_tokens":5}}\n\n';
  assert.equal(stream(chat, 'openai-chat-completions').state, 'incomplete');
  assert.equal(stream(chat + 'data: [DONE]\n\n', 'openai-chat-completions').state, 'complete');
});
test('finish is idempotent and returned observations do not expose mutable internal samples', () => {
  const collector = new UsageCollector('openai-responses', 'application/json'); collector.push(encoder.encode('{"usage":{"input_tokens":10,"cached_tokens":5}}'));
  const first = collector.finish(); first.sample!.cached = 99; collector.push(encoder.encode('garbage'));
  assert.deepEqual(collector.finish().sample, sample(10, 5));
});
test('legacy extractUsage detects protocol from actual usage and supports explicit protocol', () => {
  assert.deepEqual(extractUsage('{"usage":{"prompt_tokens":100,"prompt_tokens_details":{"cached_tokens":75}}}'), sample(100, 75));
  assert.deepEqual(extractUsage('{"usage":{"input_tokens":10,"cache_read_input_tokens":980,"cache_creation_input_tokens":2}}'), sample(992, 980, 2));
  assert.deepEqual(extractUsage(frame('response.completed', { response: { usage: { input_tokens: 100, cached_tokens: 75 } } }), 'openai-responses'), sample(100, 75));
  assert.equal(extractUsage('{"arguments":{"usage":{"prompt_tokens":100,"cached_tokens":75}}}'), undefined);
});
