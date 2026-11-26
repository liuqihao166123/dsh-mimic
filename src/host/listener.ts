import { randomUUID } from 'node:crypto';
import type { Json, JsonObject, ListenerEntry, TransformContext, TransformResult } from '../types.js';

// Only named technical headers may leave the server in a diagnostic. Prefix families may contain opaque identifiers.
const visibleHeaders = /^(?:user-agent|originator|anthropic-version|anthropic-beta|x-app|content-type|x-stainless-(?:arch|lang|os|package-version|retry-count|runtime|runtime-version|timeout))$/i;
const identityField = /^(?:(?:user|session|account|device|(?:client[-_]?)?request|trace|conversation|thread|org|organization|project|turn)[-_]?id|account[-_]?uuid|cwd)$/i;
const sensitive = /authorization|cookie|api[-_]?key|token|secret|password|signature/i;
const REDACTED = '[redacted]';
export function safeUrl(value: string): string {
  try { const u = new URL(value); return u.origin + u.pathname + (u.search ? '?[redacted-query]' : ''); }
  catch { return '[invalid-url]'; }
}
export function summarizeBody(body: JsonObject): JsonObject {
  function walk(v: Json, key = ''): Json {
    if (sensitive.test(key) || identityField.test(key) || /^(?:metadata|arguments|output)$/i.test(key)) return REDACTED;
    if (key.toLowerCase() === 'input' && !Array.isArray(v)) return REDACTED;
    // The field rule is applied to the array itself; its items have no field name.
    if (Array.isArray(v)) return v.map(x => walk(x));
    if (v && typeof v === 'object') {
      const out = Object.create(null) as JsonObject;
      for (const [k, x] of Object.entries(v)) out[k] = walk(x, k);
      return out;
    }
    if (typeof v === 'string') {
      // Retain bounded technical fields only. Never emit a content hash or length.
      return /^(type|role|name|model|ttl|effort|verbosity|service_tier|detail|format|stop_reason)$/.test(key) && v.length < 512 ? v : REDACTED;
    }
    return v;
  }
  return walk(body) as JsonObject;
}
export class RequestListener {
  private entries: ListenerEntry[] = [];
  private enabled = false;
  private limit = 50;
  configure(options: { enabled: boolean; maxEntries: number }): void {
    this.enabled = options.enabled;
    this.limit = Math.min(500, Math.max(1, Math.trunc(options.maxEntries)));
    this.entries.splice(this.limit);
  }
  record(result: TransformResult, context: TransformContext): ListenerEntry | undefined {
    if (!this.enabled || context.rule.client === 'none') return;
    const headers: Record<string, string> = {};
    result.headers.forEach((value, name) => { headers[name] = sensitive.test(name) || !visibleHeaders.test(name) ? REDACTED : value; });
    const entry: ListenerEntry = {
      // The UI key is local to this log entry, never a transport correlation identifier.
      id: randomUUID(), time: new Date().toISOString(), providerId: context.identity.providerId,
      modelId: context.identity.modelId, client: context.rule.client, profile: result.profile,
      url: safeUrl(result.url), protocol: result.originalProtocol, targetProtocol: result.targetProtocol,
      headers, body: summarizeBody(result.body),
    };
    this.entries.unshift(entry); this.entries.splice(this.limit); return entry;
  }
  list(): ListenerEntry[] { return structuredClone(this.entries); }
  clear(): void { this.entries.length = 0; }
}
