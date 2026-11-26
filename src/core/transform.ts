import { createHash } from 'node:crypto';
import type { Json, JsonObject, TransformContext, TransformResult, WireProtocol, WireRequest } from '../types.js';
import { developerMessage, systemBlocks } from './content.js';
import { normalizeSystemDateCarriers } from './dates.js';
import { array, cloneJson, isObject, object, ProtocolConversionError } from './json.js';
import { claudeBetas, resolveProfile } from './profiles.js';
import { constructClaudeBillingHeader } from './billing.js';
import type { ClaudeProfile, ClientProfile, CodexProfile } from './profiles.js';
import { toAnthropic, toResponses } from './protocols.js';
import { clearAnthropicCacheSlots, renameClaudeTools } from './tools.js';
import { assertCanonicalExtraHeaders, isIdentityHeader, isPrivateHeader } from './overrides.js';

export { ProtocolConversionError } from './json.js';

interface OriginalState { url: string; method: string; headers: Headers; body: JsonObject; protocol: WireProtocol }
// No on-wire marker or helper field. Repeated invocation uses the untouched original snapshot.
const originals = new WeakMap<WireRequest, OriginalState>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_NAMESPACE = '6ba7b8109dad11d180b400c04fd430c8';

function uuid(value: string, purpose: string): string {
  if (UUID.test(value)) return value;
  const bytes = createHash('sha1').update(Buffer.from(UUID_NAMESPACE, 'hex')).update('dsh-client-simulator:' + purpose + ':' + value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
}
function deviceHex(value: string): string {
  return /^[a-f0-9]{64}$/i.test(value) ? value : createHash('sha256').update(value).digest('hex');
}
function metadata(body: JsonObject): JsonObject {
  if (body.metadata === undefined || body.metadata === null) body.metadata = {};
  return object(body.metadata, 'metadata');
}
function parsedClaudeIdentity(value: Json | undefined): { device?: string; account?: string; session?: string } {
  if (typeof value !== 'string') return {};
  const legacy = /^user_([a-f0-9]+)_account_([0-9a-f-]*)_session_([0-9a-f-]{36})$/i.exec(value);
  if (legacy && (!legacy[2] || UUID.test(legacy[2])) && UUID.test(legacy[3])) return {device:legacy[1],account:legacy[2],session:legacy[3]};
  try {
    const p: unknown = JSON.parse(value);
    if (!isObject(p)) return {};
    return { device: typeof p.device_id === 'string' ? p.device_id : undefined,
      account: typeof p.account_uuid === 'string' && (!p.account_uuid || UUID.test(p.account_uuid)) ? p.account_uuid : undefined,
      session: typeof p.session_id === 'string' && UUID.test(p.session_id) ? p.session_id : undefined };
  } catch { return {}; }
}
function claudeIds(body: JsonObject, context: TransformContext, profile: ClaudeProfile): { device: string; account: string; session: string; request: string } {
  const existing = parsedClaudeIdentity(isObject(body.metadata) ? body.metadata.user_id : undefined), o = context.rule.overrides;
  const supplied = o?.accountId ?? existing.account;
  const account = supplied ? uuid(supplied, 'account') : profile.accountPolicy === 'context-uuid' ? uuid(context.accountId, 'account') : '';
  return { device: deviceHex(o?.deviceId ?? existing.device ?? context.deviceId), account,
    session: uuid(existing.session ?? context.identity.sessionId, 'session'),
    request: uuid(context.identity.requestId, 'request') };
}
function canonicalUrl(url: string, source: WireProtocol, target: WireProtocol): string {
  if (source === target) return url;
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new ProtocolConversionError('INVALID_API_URL', 'request URL must be absolute'); }
  if (!/\/(?:chat\/completions|messages|responses)\/?$/.test(parsed.pathname)) throw new ProtocolConversionError('UNRECOGNIZED_API_ENDPOINT', parsed.pathname);
  const endpoint = target === 'anthropic-messages' ? '/messages' : '/responses';
  parsed.pathname = parsed.pathname.replace(/\/(?:chat\/completions|messages|responses)\/?$/, endpoint);
  if (target !== 'anthropic-messages') parsed.searchParams.delete('beta');
  return parsed.toString();
}
function headersFor(original: Headers, profile: ClientProfile, session: string, request: string, model: string): Headers {
  const headers = new Headers(original);
  for (const name of [...headers.keys()]) {
    // Preserve configured provider credentials even under an SDK-family prefix.
    if (isIdentityHeader(name) && !isPrivateHeader(name)) headers.delete(name);
  }
  headers.delete('content-length'); headers.delete('content-encoding');
  headers.delete('anthropic-dangerous-direct-browser-access');
  headers.set('content-type', 'application/json');
  if (profile.client === 'claude-code') {
    headers.set('user-agent', 'claude-cli/' + profile.version + ' (external, ' + profile.entrypoint + ')');
    headers.set('anthropic-version', profile.apiVersion);
    const betas = claudeBetas(profile, model);
    if (betas.length) headers.set('anthropic-beta', betas.join(','));
    headers.set('x-app', profile.headers.app);
    if (profile.headers.sessionRequestIds) {
      headers.set('x-claude-code-session-id', session);
      headers.set('x-client-request-id', request);
    }
    if (profile.headers.acceptJson) headers.set('accept', 'application/json');
    if (profile.headers.dangerouslyAllowBrowser) headers.set('anthropic-dangerous-direct-browser-access', 'true');
    if (profile.headers.timeoutSeconds !== undefined) headers.set('x-stainless-timeout', String(profile.headers.timeoutSeconds));
    headers.set('x-stainless-lang', 'js'); headers.set('x-stainless-package-version', profile.sdkVersion);
    headers.set('x-stainless-os', profile.os); headers.set('x-stainless-arch', profile.arch);
    headers.set('x-stainless-runtime', 'node'); headers.set('x-stainless-runtime-version', profile.runtimeVersion);
    headers.set('x-stainless-retry-count', '0');
  } else {
    headers.delete('anthropic-version');
    headers.set('originator', profile.originator);
    headers.set('user-agent', profile.originator + '/' + profile.version + ' (' + profile.os + ' ' + profile.osVersion + '; ' + profile.arch + ') ' + profile.terminal);
    headers.set('session_id', session);
    // Codex 0.169 also emits x-codex-* control headers; relays key "official Codex client" off
    // their presence, so a disguise without one is rejected as a non-Codex client.
    headers.set('session-id', session);
    headers.set('thread-id', session);
    headers.set('x-client-request-id', request);
    headers.set('x-codex-beta-features', profile.betaFeatures);
    headers.set('x-codex-window-id', session + ':0');
  }
  // Exact, case-insensitive-name assertions prevent UA/SDK/runtime/beta/session drift.
  // A helper or wrong-client header has no canonical value and fails explicitly.
  assertCanonicalExtraHeaders(headers, profile.extraHeaders);
  return headers;
}
function claudeBody(body: JsonObject, profile: ClaudeProfile, ids: ReturnType<typeof claudeIds>): Record<string, string> {
  let blocks = systemBlocks(body.system);
  // Recognize only a complete generated identity prefix on a serialized/replayed output.
  if (blocks.length >= 2 && /^x-anthropic-billing-header: cc_version=[^;]+; cc_entrypoint=[^;]+; cch=[a-f0-9]+;?$/.test(String(blocks[0].text)) && blocks[1].text === profile.identity) blocks = blocks.slice(2);
  for (const block of blocks) block.text = normalizeSystemDateCarriers(String(block.text));
  const billing = constructClaudeBillingHeader(body, profile.version, profile.entrypoint, profile.billing);
  if (profile.cache.placement === 'source-org') {
    // pd8's ordinary branch joins main system text, while billing stays uncached.
    if (blocks.some(block => Object.keys(block).some(key => !['type','text','cache_control'].includes(key))))
      throw new ProtocolConversionError('UNMERGEABLE_SYSTEM_BLOCK', 'source system grouping would discard non-text block fields');
    const main = blocks.map(block => String(block.text)).filter(Boolean).join('\n\n');
    blocks = main ? [{type:'text',text:main}] : [];
  }
  body.system = [{type:'text',text:billing},{type:'text',text:profile.identity},...blocks];
  if (body.max_tokens === undefined) body.max_tokens = profile.maxTokens;
  clearAnthropicCacheSlots(body);
  const system = array(body.system, 'system');
  const eligible = system.map((b,index) => isObject(b) && typeof b.text === 'string' && b.text.length && (profile.cache.placement !== 'source-org' || index !== 0) ? index : -1).filter(index => index >= 0);
  const max = Math.max(0, Math.min(4, profile.cache.maxBreakpoints));
  const indices = eligible.length <= max ? eligible : [...eligible.slice(0, Math.max(0, max - 1)), eligible[eligible.length - 1]];
  if (max) for (const index of indices) object(system[index], 'system block').cache_control = { type: profile.cache.type, ...(profile.cache.ttl ? {ttl:profile.cache.ttl} : {}) };
  const meta = metadata(body);
  meta.user_id = profile.metadataFormat === 'json' ? JSON.stringify({device_id:ids.device,account_uuid:ids.account,session_id:ids.session}) : 'user_' + ids.device + '_account_' + ids.account + '_session_' + ids.session;
  return renameClaudeTools(body);
}
function codexBody(body: JsonObject, profile: CodexProfile, context: TransformContext, session: string): void {
  const originalInstructions = body.instructions, legacyInstructions = body.base_instructions;
  if (originalInstructions !== undefined && originalInstructions !== null && typeof originalInstructions !== 'string') throw new ProtocolConversionError('INVALID_INSTRUCTIONS', 'Responses instructions must be text');
  if (legacyInstructions !== undefined && legacyInstructions !== null && typeof legacyInstructions !== 'string') throw new ProtocolConversionError('INVALID_INSTRUCTIONS', 'base_instructions must be text');
  const prefix: Json[] = [];
  if (typeof originalInstructions === 'string' && originalInstructions !== profile.instructions) prefix.push(developerMessage([{type:'text',text:originalInstructions}]));
  if (typeof legacyInstructions === 'string' && legacyInstructions !== profile.instructions && legacyInstructions !== originalInstructions) prefix.push(developerMessage([{type:'text',text:legacyInstructions}]));
  if (prefix.length) {
    const input = typeof body.input === 'string' ? [{role:'user',content:body.input}] : body.input === undefined ? [] : array(body.input, 'input');
    body.input = [...prefix, ...input];
  }
  delete body.base_instructions;
  body.instructions = profile.instructions;
  const meta = metadata(body);
  // Existing business metadata is retained verbatim, including existing source/session/cwd values.
  if (meta.session_id === undefined) meta.session_id = session;
  if (meta.source === undefined) meta.source = profile.originator;
  if (context.identity.cwd !== undefined && meta.cwd === undefined) meta.cwd = context.identity.cwd;
}
function untouched(input: WireRequest, protocol: WireProtocol): TransformResult {
  // Descriptor copying never evaluates a body/header getter, and retains those references exactly.
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const values: Record<string, unknown> = { changed:false, originalProtocol:protocol, targetProtocol:protocol, toolNames:{}, profile:'none' };
  for (const [key,value] of Object.entries(values)) descriptors[key] = {value,enumerable:true,writable:true,configurable:true};
  return Object.create(Object.getPrototypeOf(input), descriptors) as TransformResult;
}

/** Provider selection is the host's responsibility; this function acts only on the supplied rule. */
export function transformRequest(input: WireRequest, context: TransformContext): TransformResult {
  if (context.rule.client === 'none') return untouched(input, context.identity.protocol);
  if (context.rule.modelIds?.length && !context.rule.modelIds.includes(context.identity.modelId)) return untouched(input, context.identity.protocol);
  const profile = resolveProfile(context.rule);
  const prior = originals.get(input);
  const source: OriginalState = prior ?? {url:input.url,method:input.method,headers:new Headers(input.headers),body:cloneJson(object(input.body,'body')),protocol:context.identity.protocol};
  const target: WireProtocol = profile.client === 'claude-code' ? 'anthropic-messages' : 'openai-responses';
  const body = profile.client === 'claude-code' ? toAnthropic(source.body,source.protocol,profile.maxTokens) : toResponses(source.body,source.protocol);
  let session: string, request: string, toolNames: Record<string,string> = {};
  if (profile.client === 'claude-code') {
    const ids = claudeIds(body,context,profile); session = ids.session; request = ids.request;
    toolNames = claudeBody(body,profile,ids);
  } else {
    session = uuid(context.identity.sessionId,'session'); request = uuid(context.identity.requestId,'request');
    codexBody(body,profile,context,session);
  }
  const url = canonicalUrl(source.url,source.protocol,target);
  const headers = headersFor(source.headers,profile,session,request,typeof body.model === 'string' ? body.model : context.identity.modelId);
  const result: TransformResult = {url,method:source.method,headers,body,changed:true,originalProtocol:source.protocol,targetProtocol:target,toolNames,profile:profile.id};
  originals.set(result,source);
  return result;
}
