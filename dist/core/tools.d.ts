import type { JsonObject } from '../types.js';
/** Reverse mapping: outgoing (Claude) name -> original host name. */
export declare function renameClaudeTools(body: JsonObject): Record<string, string>;
/** Remove only real cache slots, never fields inside tool arguments or tool-output data. */
export declare function clearAnthropicCacheSlots(body: JsonObject): void;
