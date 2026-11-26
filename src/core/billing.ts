import { createHash } from 'node:crypto';
import type { JsonObject } from '../types.js';
import { array, isObject } from './json.js';

/** Version-suffix inputs are pinned by the selected profile, not inferred from body serialization. */
export interface ClaudeBillingControls {
  salt: string;
  sampleIndices: readonly number[];
  suffixLength: number;
  /** ez1's source-construction placeholder, not a capture-verified final transport checksum. */
  initialCch: string;
}

/** Mirrors IF5: the first user message, then its first text block only. */
export function firstAnthropicUserText(body: JsonObject): string {
  const first = array(body.messages, 'messages').find(value => isObject(value) && value.role === 'user');
  if (!isObject(first)) return '';
  if (typeof first.content === 'string') return first.content;
  if (!Array.isArray(first.content)) return '';
  const block = first.content.find(value => isObject(value) && value.type === 'text');
  return isObject(block) && typeof block.text === 'string' ? block.text : '';
}

/** Mirrors Y28: JavaScript UTF-16 indexing, missing characters become literal "0". */
export function claudeVersionSuffix(firstUserText: string, version: string, controls: ClaudeBillingControls): string {
  const sample = controls.sampleIndices.map(index => firstUserText[index] || '0').join('');
  return createHash('sha256').update(controls.salt + sample + version).digest('hex').slice(0, controls.suffixLength);
}

/** Mirrors ez1's known construction stage. No unobserved final-cch engine is fabricated. */
export function constructClaudeBillingHeader(body: JsonObject, version: string, entrypoint: string, controls: ClaudeBillingControls): string {
  const suffix = claudeVersionSuffix(firstAnthropicUserText(body), version, controls);
  return 'x-anthropic-billing-header: cc_version=' + version + '.' + suffix + '; cc_entrypoint=' + entrypoint + '; cch=' + controls.initialCch + ';';
}
