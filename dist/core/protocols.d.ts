import type { JsonObject, WireProtocol } from '../types.js';
export declare function toAnthropic(body: JsonObject, source: WireProtocol, defaultMaxTokens: number): JsonObject;
export declare function toResponses(body: JsonObject, source: WireProtocol): JsonObject;
