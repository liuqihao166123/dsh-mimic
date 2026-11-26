import assert from 'node:assert/strict';
import test from 'node:test';
import { RequestListener } from '../src/host/listener.ts';

const privateHeaders = {
  authorization: ['Bearer', 'UNIT_TEST_NOT_A_CREDENTIAL'].join(' '),
  'x-api-key': 'FIXTURE_KEY_VALUE',
  'session_id': 'FIXTURE_SESSION_VALUE',
  'x-claude-code-session-id': 'FIXTURE_CLI_SESSION_VALUE',
  'x-client-request-id': 'FIXTURE_CLIENT_REQUEST_VALUE',
  'x-codex-account-id': 'FIXTURE_ACCOUNT_VALUE',
  'x-stainless-device-id': 'FIXTURE_DEVICE_VALUE',
};
const protocol = 'openai-responses';
function fixture() {
  const url = 'https://api.example.invalid/v1/responses?test=FIXTURE_QUERY_VALUE';
  const result = {
    url, method: 'POST', changed: false, profile: 'diagnostic-fixture',
    originalProtocol: protocol, targetProtocol: protocol, toolNames: {},
    headers: new Headers({ ...privateHeaders, 'User-Agent': 'test-client/1.0', 'Content-Type': 'application/json', 'X-Stainless-Retry-Count': '1' }),
    body: {
      model: 'fixture-model', input: 'FIXTURE_MESSAGE_VALUE',
      metadata: { session_id: 'FIXTURE_BODY_SESSION_VALUE', requestId: 805451713, account_uuid: 'FIXTURE_BODY_ACCOUNT_VALUE' },
    },
  };
  const context = {
    identity: { url, protocol, providerId: 'fixture-provider', modelId: 'fixture-model', sessionId: 'FIXTURE_INTERNAL_SESSION', requestId: 'FIXTURE_INTERNAL_REQUEST' },
    rule: { client: 'codex' }, deviceId: 'unused-device', accountId: 'unused-account',
  };
  const listener = new RequestListener();
  listener.configure({ enabled: true, maxEntries: 2 });
  return { result, context, listener };
}

test('listener masks private headers and body identifiers before serialization', () => {
  const { result, context, listener } = fixture();
  listener.record(result, context);
  const payload = JSON.stringify({ ok: true, entries: listener.list() });
  const [entry] = JSON.parse(payload).entries;
  for (const name of Object.keys(privateHeaders)) assert.equal(entry.headers[name], '[redacted]', name);
  for (const value of [...Object.values(privateHeaders), 'FIXTURE_QUERY_VALUE', 'FIXTURE_MESSAGE_VALUE', 'FIXTURE_BODY_SESSION_VALUE', '805451713', 'FIXTURE_BODY_ACCOUNT_VALUE']) {
    assert.ok(!payload.includes(value), 'private fixture value in serialized diagnostic');
  }
  assert.equal(entry.headers['user-agent'], 'test-client/1.0');
  assert.equal(entry.headers['content-type'], 'application/json');
  assert.equal(entry.headers['x-stainless-retry-count'], '1');
  assert.equal(entry.body.model, 'fixture-model');
});

test('listener entry ids are local, independent of outbound request ids', () => {
  const { result, context, listener } = fixture();
  const a = listener.record(result, context);
  const b = listener.record(result, context);
  assert.notEqual(a.id, b.id);
  for (const { id } of listener.list()) {
    assert.equal(typeof id, 'string');
    assert.notEqual(id, context.identity.requestId);
  }
  assert.ok(!JSON.stringify(listener.list()).includes(context.identity.requestId));
});

test('logging does not change outbound headers, body or identity', () => {
  const { result, context, listener } = fixture();
  const before = { headers: [...result.headers], body: structuredClone(result.body), context: structuredClone(context) };
  listener.record(result, context);
  assert.deepEqual([...result.headers], before.headers);
  assert.deepEqual(result.body, before.body);
  assert.deepEqual(context, before.context);
});

test('private body content uses the same constant mask for different text and metadata', () => {
  const { result, context, listener } = fixture();
  const withText = (text, numericMetadata) => ({
    ...result, body: {
      model: 'fixture-model',
      system: [{ type: 'text', text }],
      input: [
        { role: 'user', content: [{ type: 'input_text', text }] },
        { type: 'function_call', arguments: JSON.stringify({ text }) },
        { type: 'function_call_output', output: { text } },
      ],
      metadata: { customMetric: numericMetadata, internalLabel: text },
    },
  });
  listener.record(withText('test text A', 50021), context);
  listener.record(withText('different, longer test text B', 80672), context);
  const [second, first] = listener.list();
  assert.equal(first.body.system[0].text, '[redacted]');
  assert.deepEqual(first.body, second.body);
  assert.deepEqual(first.body, {
    model: 'fixture-model',
    system: [{ type: 'text', text: '[redacted]' }],
    input: [
      { role: 'user', content: [{ type: 'input_text', text: '[redacted]' }] },
      { type: 'function_call', arguments: '[redacted]' },
      { type: 'function_call_output', output: '[redacted]' },
    ],
    metadata: '[redacted]',
  });
});
