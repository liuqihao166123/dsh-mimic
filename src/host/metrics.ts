import { isObject } from '../core/json.js';
import type { CacheStat, JsonObject } from '../types.js';

/** One upstream usage snapshot, normalized across the Anthropic and OpenAI families. */
export interface UsageSample { prompt: number; cached: number; written: number }

const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

function readUsage(value: JsonObject): UsageSample | undefined {
  const details = isObject(value.input_tokens_details) ? value.input_tokens_details : {};
  const prompt = number(value.input_tokens) ?? number(value.prompt_tokens);
  const cached = number(value.cache_read_input_tokens) ?? number(details.cached_tokens) ?? number(value.cached_tokens);
  const written = number(value.cache_creation_input_tokens);
  if (prompt === undefined && cached === undefined && written === undefined) return undefined;
  return { prompt: prompt ?? 0, cached: cached ?? 0, written: written ?? 0 };
}

/**
 * Collects every `"usage": {...}` object in a response body with a bounded brace scan, so both
 * SSE frames and plain JSON replies work without buffering the whole stream into memory twice.
 */
export function extractUsage(text: string): UsageSample | undefined {
  function candidates(): JsonObject[] {
    const found: JsonObject[] = [];
    const key = /"usage"\s*:\s*/g;
    let match: RegExpExecArray | null;
    while ((match = key.exec(text)) !== null) {
      const start = match.index + match[0].length;
      if (text[start] !== '{') continue;
      let depth = 0, inString = false, escaped = false;
      const limit = Math.min(text.length, start + 8192);
      for (let i = start; i < limit; i += 1) {
        const ch = text[i]!;
        if (inString) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') inString = false; continue; }
        if (ch === '"') { inString = true; continue; }
        if (ch === '{') { depth += 1; continue; }
        if (ch !== '}') continue;
        depth -= 1;
        if (depth !== 0) continue;
        try {
          const parsed: unknown = JSON.parse(text.slice(start, i + 1));
          if (isObject(parsed)) found.push(parsed);
        } catch { /* a truncated or non-JSON tail is not a usage snapshot */ }
        break;
      }
    }
    return found;
  }
  let best: UsageSample | undefined;
  for (const candidate of candidates()) {
    const sample = readUsage(candidate);
    if (!sample) continue;
    // Later frames carry the complete snapshot; prefer the richest one if several arrive.
    if (!best || sample.prompt + sample.cached >= best.prompt + best.cached) best = sample;
  }
  return best;
}

interface Bucket { requests: number; prompt: number; cached: number }

/** Per-provider cache counters, derived only from upstream usage fields. */
export class CacheMetrics {
  private readonly buckets = new Map<string, Bucket>();
  record(providerId: string, sample: UsageSample): void {
    if (sample.prompt <= 0 && sample.cached <= 0) return;
    const bucket = this.buckets.get(providerId) ?? { requests: 0, prompt: 0, cached: 0 };
    bucket.requests += 1;
    bucket.prompt += sample.prompt;
    bucket.cached += sample.cached;
    this.buckets.set(providerId, bucket);
  }
  ingest(providerId: string, text: string): void {
    const sample = extractUsage(text);
    if (sample) this.record(providerId, sample);
  }
  snapshot(): CacheStat[] {
    return [...this.buckets.entries()].map(([providerId, bucket]) => ({
      providerId, requests: bucket.requests, promptTokens: bucket.prompt, cachedTokens: bucket.cached,
      hitRate: bucket.prompt > 0 ? Math.min(1, bucket.cached / bucket.prompt) : 0,
    }));
  }
  clear(): void { this.buckets.clear(); }
}
