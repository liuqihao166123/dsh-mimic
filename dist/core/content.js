import { array, cloneJson, object, ProtocolConversionError, text } from './json.js';
function imageSource(url) {
    const match = /^data:(image\/(?:png|jpeg|gif|webp));base64,([\s\S]*)$/i.exec(url);
    if (match)
        return { type: 'base64', media_type: match[1].toLowerCase(), data: match[2] };
    if (/^https?:\/\//i.test(url))
        return { type: 'url', url };
    throw new ProtocolConversionError('UNSUPPORTED_IMAGE', 'image must be an HTTP(S) URL or a supported base64 data URL');
}
export function toAnthropicContent(value, field) {
    if (typeof value === 'string')
        return [{ type: 'text', text: value }];
    if (value === null || value === undefined)
        return [];
    return array(value, field).map((part, index) => {
        const p = object(part, field + '[' + index + ']');
        if (p.type === 'text' || p.type === 'input_text' || p.type === 'output_text') {
            return { type: 'text', text: text(p.text, field + '.text') };
        }
        if (p.type === 'refusal')
            return { type: 'text', text: text(p.refusal, field + '.refusal') };
        if (p.type === 'image_url') {
            const image = typeof p.image_url === 'string' ? p.image_url : text(object(p.image_url, 'image_url').url, 'image_url.url');
            return { type: 'image', source: imageSource(image) };
        }
        if (p.type === 'input_image') {
            if (p.file_id !== undefined)
                throw new ProtocolConversionError('NONPORTABLE_FILE_ID', 'Responses input_image.file_id needs public image content for Anthropic');
            return { type: 'image', source: imageSource(text(p.image_url, 'input_image.image_url')) };
        }
        if (p.type === 'input_file') {
            if (p.file_id !== undefined)
                throw new ProtocolConversionError('NONPORTABLE_FILE_ID', 'Responses input_file.file_id is not portable');
            const data = text(p.file_data, 'input_file.file_data');
            const match = /^data:application\/pdf;base64,([\s\S]*)$/.exec(data);
            if (!match)
                throw new ProtocolConversionError('UNSUPPORTED_DOCUMENT', 'portable input_file requires a PDF base64 data URL');
            const block = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: match[1] } };
            if (typeof p.filename === 'string')
                block.title = p.filename;
            return block;
        }
        throw new ProtocolConversionError('UNSUPPORTED_CONTENT', 'no Anthropic representation for content type ' + String(p.type));
    });
}
export function toResponsesContent(value, field) {
    if (typeof value === 'string')
        return [{ type: 'input_text', text: value }];
    if (value === null || value === undefined)
        return [];
    return array(value, field).map((part, index) => {
        const p = object(part, field + '[' + index + ']');
        if (p.type === 'text' || p.type === 'input_text' || p.type === 'output_text') {
            return { type: 'input_text', text: text(p.text, field + '.text') };
        }
        if (p.type === 'refusal')
            return { type: 'input_text', text: text(p.refusal, field + '.refusal') };
        if (p.type === 'image_url') {
            const image = typeof p.image_url === 'string' ? { url: p.image_url } : object(p.image_url, 'image_url');
            const block = { type: 'input_image', image_url: text(image.url, 'image_url.url') };
            if (typeof image.detail === 'string')
                block.detail = image.detail;
            return block;
        }
        if (p.type === 'input_image' || p.type === 'input_file')
            return cloneJson(p);
        if (p.type === 'image') {
            const source = object(p.source, 'image.source');
            if (source.type === 'url')
                return { type: 'input_image', image_url: text(source.url, 'image.source.url') };
            if (source.type === 'base64')
                return { type: 'input_image', image_url: 'data:' + text(source.media_type, 'image.media_type') + ';base64,' + text(source.data, 'image.data') };
            throw new ProtocolConversionError('UNSUPPORTED_IMAGE', 'unknown Anthropic image source');
        }
        if (p.type === 'document') {
            const source = object(p.source, 'document.source');
            if (source.type === 'base64' && source.media_type === 'application/pdf') {
                return { type: 'input_file', filename: typeof p.title === 'string' ? p.title : 'document.pdf', file_data: 'data:application/pdf;base64,' + text(source.data, 'document.data') };
            }
            if (source.type === 'text')
                return { type: 'input_text', text: text(source.data, 'document.data') };
            throw new ProtocolConversionError('UNSUPPORTED_DOCUMENT', 'document source requires portable PDF bytes or text');
        }
        throw new ProtocolConversionError('UNSUPPORTED_CONTENT', 'no Responses representation for content type ' + String(p.type));
    });
}
export function systemBlocks(value, field = 'system') {
    if (value === undefined || value === null)
        return [];
    if (typeof value === 'string')
        return [{ type: 'text', text: value }];
    return array(value, field).map((part, index) => {
        const p = object(part, field + '[' + index + ']');
        if (p.type !== 'text' || typeof p.text !== 'string')
            throw new ProtocolConversionError('INVALID_SYSTEM_BLOCK', 'system blocks must be text blocks');
        return cloneJson(p);
    });
}
export function developerMessage(blocks) {
    return { role: 'developer', content: blocks.map(b => ({ type: 'input_text', text: text(b.text, 'system.text') })) };
}
export function appendAnthropicMessage(messages, role, blocks) {
    if (!blocks.length)
        return;
    // The Messages API permits consecutive same-role messages; preserve boundaries and order.
    messages.push({ role, content: blocks });
}
export function toolResultOutput(block) {
    if (block.is_error === true) {
        // Responses has no is_error member. A JSON output string preserves the complete error result.
        return JSON.stringify({ content: block.content ?? '', is_error: true });
    }
    if (typeof block.content === 'string')
        return block.content;
    return toResponsesContent(block.content ?? '', 'tool_result.content');
}
//# sourceMappingURL=content.js.map