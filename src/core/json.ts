import type { Json, JsonObject } from '../types.js';

export class ProtocolConversionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(code + ': ' + message); this.name = 'ProtocolConversionError'; this.code = code;
  }
}
export function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function cloneJson<T extends Json>(value: T): T {
  if (Array.isArray(value)) return value.map(v => cloneJson(v)) as T;
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cloneJson(v)])) as T;
  return value;
}
export function object(value: Json | undefined, field: string): JsonObject {
  if (!isObject(value)) throw new ProtocolConversionError('INVALID_OBJECT', field + ' must be an object');
  return value;
}
export function array(value: Json | undefined, field: string): Json[] {
  if (!Array.isArray(value)) throw new ProtocolConversionError('INVALID_ARRAY', field + ' must be an array');
  return value;
}
export function text(value: Json | undefined, field: string): string {
  if (typeof value !== 'string') throw new ProtocolConversionError('INVALID_TEXT', field + ' must be a string');
  return value;
}
export function parseToolArguments(value: Json | undefined): JsonObject {
  if (isObject(value)) return cloneJson(value);
  if (typeof value !== 'string') throw new ProtocolConversionError('INVALID_TOOL_ARGUMENTS', 'function arguments must be JSON object text');
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new ProtocolConversionError('INVALID_TOOL_ARGUMENTS', 'function arguments are not valid JSON'); }
  if (!isObject(parsed)) throw new ProtocolConversionError('INVALID_TOOL_ARGUMENTS', 'function arguments must decode to an object');
  return parsed;
}
export function copyFields(source: JsonObject, target: JsonObject, fields: readonly string[]): void {
  for (const key of fields) if (source[key] !== undefined) target[key] = cloneJson(source[key]);
}
