import { createHash } from 'node:crypto';
import { array, isObject } from './json.js';
/** Mirrors IF5: the first user message, then its first text block only. */
export function firstAnthropicUserText(body) {
    const first = array(body.messages, 'messages').find(value => isObject(value) && value.role === 'user');
    if (!isObject(first))
        return '';
    if (typeof first.content === 'string')
        return first.content;
    if (!Array.isArray(first.content))
        return '';
    const block = first.content.find(value => isObject(value) && value.type === 'text');
    return isObject(block) && typeof block.text === 'string' ? block.text : '';
}
/** Mirrors Y28: JavaScript UTF-16 indexing, missing characters become literal "0". */
export function claudeVersionSuffix(firstUserText, version, controls) {
    const sample = controls.sampleIndices.map(index => firstUserText[index] || '0').join('');
    return createHash('sha256').update(controls.salt + sample + version).digest('hex').slice(0, controls.suffixLength);
}
/** Mirrors ez1's known construction stage. No unobserved final-cch engine is fabricated. */
export function constructClaudeBillingHeader(body, version, entrypoint, controls) {
    const suffix = claudeVersionSuffix(firstAnthropicUserText(body), version, controls);
    return 'x-anthropic-billing-header: cc_version=' + version + '.' + suffix + '; cc_entrypoint=' + entrypoint + '; cch=' + controls.initialCch + ';';
}
//# sourceMappingURL=billing.js.map