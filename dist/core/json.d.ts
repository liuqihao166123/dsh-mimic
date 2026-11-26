import type { Json, JsonObject } from '../types.js';
export declare class ProtocolConversionError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function isObject(value: unknown): value is JsonObject;
export declare function cloneJson<T extends Json>(value: T): T;
export declare function object(value: Json | undefined, field: string): JsonObject;
export declare function array(value: Json | undefined, field: string): Json[];
export declare function text(value: Json | undefined, field: string): string;
export declare function parseToolArguments(value: Json | undefined): JsonObject;
export declare function copyFields(source: JsonObject, target: JsonObject, fields: readonly string[]): void;
