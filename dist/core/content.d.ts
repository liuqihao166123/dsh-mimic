import type { Json, JsonObject } from '../types.js';
export declare function toAnthropicContent(value: Json | undefined, field: string): Json[];
export declare function toResponsesContent(value: Json | undefined, field: string): Json[];
export declare function systemBlocks(value: Json | undefined, field?: string): JsonObject[];
export declare function developerMessage(blocks: JsonObject[]): JsonObject;
export declare function appendAnthropicMessage(messages: Json[], role: string, blocks: Json[]): void;
export declare function toolResultOutput(block: JsonObject): Json;
