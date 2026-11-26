export class ProtocolConversionError extends Error {
    code;
    constructor(code, message) {
        super(code + ': ' + message);
        this.name = 'ProtocolConversionError';
        this.code = code;
    }
}
export function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function cloneJson(value) {
    if (Array.isArray(value))
        return value.map(v => cloneJson(v));
    if (isObject(value))
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cloneJson(v)]));
    return value;
}
export function object(value, field) {
    if (!isObject(value))
        throw new ProtocolConversionError('INVALID_OBJECT', field + ' must be an object');
    return value;
}
export function array(value, field) {
    if (!Array.isArray(value))
        throw new ProtocolConversionError('INVALID_ARRAY', field + ' must be an array');
    return value;
}
export function text(value, field) {
    if (typeof value !== 'string')
        throw new ProtocolConversionError('INVALID_TEXT', field + ' must be a string');
    return value;
}
export function parseToolArguments(value) {
    if (isObject(value))
        return cloneJson(value);
    if (typeof value !== 'string')
        throw new ProtocolConversionError('INVALID_TOOL_ARGUMENTS', 'function arguments must be JSON object text');
    let parsed;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        throw new ProtocolConversionError('INVALID_TOOL_ARGUMENTS', 'function arguments are not valid JSON');
    }
    if (!isObject(parsed))
        throw new ProtocolConversionError('INVALID_TOOL_ARGUMENTS', 'function arguments must decode to an object');
    return parsed;
}
export function copyFields(source, target, fields) {
    for (const key of fields)
        if (source[key] !== undefined)
            target[key] = cloneJson(source[key]);
}
//# sourceMappingURL=json.js.map