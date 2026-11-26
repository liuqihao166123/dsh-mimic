import type { JsonObject } from '../types.js';
/** Version-suffix inputs are pinned by the selected profile, not inferred from body serialization. */
export interface ClaudeBillingControls {
    salt: string;
    sampleIndices: readonly number[];
    suffixLength: number;
    /** ez1's source-construction placeholder, not a capture-verified final transport checksum. */
    initialCch: string;
}
/** Mirrors IF5: the first user message, then its first text block only. */
export declare function firstAnthropicUserText(body: JsonObject): string;
/** Mirrors Y28: JavaScript UTF-16 indexing, missing characters become literal "0". */
export declare function claudeVersionSuffix(firstUserText: string, version: string, controls: ClaudeBillingControls): string;
/** Mirrors ez1's known construction stage. No unobserved final-cch engine is fabricated. */
export declare function constructClaudeBillingHeader(body: JsonObject, version: string, entrypoint: string, controls: ClaudeBillingControls): string;
