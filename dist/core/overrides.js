import { ProtocolConversionError } from './json.js';
// Match the host boundary, including sensitive suffixes inside SDK-family names.
const IDENTITY_HEADER = /^(user-agent|originator|anthropic-(version|beta|client)|x-app|x-stainless-[a-z-]+|x-(claude-code-session-id|client-request-id|codex-[a-z-]+)|session_id|openai-client)$/i;
const PRIVATE_HEADER = /(?:^|[-_])(auth(?:orization|entication)?|api[-_]?key|token|credential|secret|password|cookie|account(?:[-_]?id)?|device(?:[-_]?id)?)(?:$|[-_])/i;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const RUNTIME_VERSION = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
// Host-private IDs persist across client switches; Codex does not consume them.
const COMMON = new Set(['version', 'extraHeaders', 'accountId', 'deviceId']);
const CLAUDE = new Set(['runtimeVersion', 'sdkVersion', 'beta', 'identity', 'metadataFormat']);
const CODEX = new Set(['originator', 'instructions']);
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function fail(field) {
    throw new ProtocolConversionError('INVALID_PROFILE_OVERRIDES', 'invalid or inactive structured override: ' + field);
}
export function isIdentityHeader(name) { return IDENTITY_HEADER.test(name); }
export function isPrivateHeader(name) { return PRIVATE_HEADER.test(name); }
function extraEntries(value) {
    if (!record(value) || Object.keys(value).length > 64)
        throw new ProtocolConversionError('INVALID_EXTRA_HEADERS', 'identity extraHeaders must be a bounded string record');
    const entries = [];
    for (const [name, val] of Object.entries(value)) {
        if (isPrivateHeader(name))
            throw new ProtocolConversionError('PRIVATE_OVERRIDE_HEADER', 'private fields belong to the configured provider, not extraHeaders: ' + name);
        if (!isIdentityHeader(name) || typeof val !== 'string' || val.length > 4096 || /[\r\n\0]/.test(val) || val.trim() !== val)
            throw new ProtocolConversionError('INVALID_EXTRA_HEADERS', 'invalid identity extraHeader: ' + name);
        entries.push([name, val]);
    }
    return entries;
}
/** Independent core callers receive the same bounds as the host plus profile semantics. */
export function validateProfileOverrides(value, client) {
    if (value === undefined)
        return;
    if (!record(value))
        throw new ProtocolConversionError('INVALID_PROFILE_OVERRIDES', 'overrides must be an object');
    const specific = client === 'claude-code' ? CLAUDE : CODEX;
    for (const [key, val] of Object.entries(value)) {
        if (!COMMON.has(key) && !specific.has(key))
            fail(key);
        if (key === 'extraHeaders') {
            extraEntries(val);
            continue;
        }
        if (key === 'beta') {
            if (!Array.isArray(val) || val.length > 64 || val.some(v => typeof v !== 'string' || !v.length || v.length > 200 || !TOKEN.test(v)) || new Set(val).size !== val.length)
                fail(key);
            continue;
        }
        if (key === 'metadataFormat') {
            if (val !== 'legacy' && val !== 'json')
                fail(key);
            continue;
        }
        const max = key === 'instructions' ? 250000 : 4096;
        if (typeof val !== 'string' || !val.trim().length || val.length > max)
            fail(key);
        if ((key === 'version' || key === 'sdkVersion') && (val.length > 120 || !VERSION.test(val)))
            fail(key);
        if (key === 'runtimeVersion' && (val.length > 120 || !RUNTIME_VERSION.test(val)))
            fail(key);
        if (key === 'originator' && (val.length > 120 || !TOKEN.test(val)))
            fail(key);
    }
}
/** Extra headers assert canonical values; structured fields own fingerprint changes. */
export function assertCanonicalExtraHeaders(canonical, value) {
    for (const [name, val] of extraEntries(value)) {
        const expected = canonical.get(name);
        if (expected === null)
            throw new ProtocolConversionError('UNSUPPORTED_IDENTITY_HEADER', 'profile does not generate identity header: ' + name);
        if (val !== expected)
            throw new ProtocolConversionError('INCONSISTENT_PROFILE_HEADER', 'extraHeader conflicts with the resolved structured profile: ' + name);
    }
}
//# sourceMappingURL=overrides.js.map