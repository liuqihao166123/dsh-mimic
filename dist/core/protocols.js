import { array, cloneJson, copyFields, isObject, object, parseToolArguments, ProtocolConversionError, text } from './json.js';
import { appendAnthropicMessage, developerMessage, systemBlocks, toAnthropicContent, toResponsesContent, toolResultOutput } from './content.js';
const COMMON = ['model', 'stream', 'temperature', 'top_p', 'metadata', 'tools', 'tool_choice', 'service_tier'];
const INPUT_KEYS = {
    'openai-chat-completions': [...COMMON, 'messages', 'max_tokens', 'max_completion_tokens', 'parallel_tool_calls', 'response_format', 'reasoning_effort', 'stream_options', 'store', 'user', 'safety_identifier', 'functions', 'function_call', 'stop'],
    'openai-responses': [...COMMON, 'input', 'instructions', 'base_instructions', 'max_output_tokens', 'parallel_tool_calls', 'text', 'reasoning', 'store', 'include', 'prompt_cache_key', 'prompt_cache_retention', 'safety_identifier', 'user', 'previous_response_id', 'conversation', 'truncation', 'background', 'stream_options'],
    'anthropic-messages': [...COMMON, 'messages', 'system', 'max_tokens', 'stop_sequences', 'top_k', 'thinking', 'output_config', 'cache_control', 'context_management', 'container'],
};
function validateCrossFields(body, protocol) {
    for (const [key, value] of Object.entries(body)) {
        if (INPUT_KEYS[protocol].includes(key))
            continue;
        if ((key === 'frequency_penalty' || key === 'presence_penalty') && value === 0)
            continue;
        if (key === 'n' && value === 1)
            continue;
        if (key === 'logprobs' && value === false)
            continue;
        if (key === 'logit_bias' && isObject(value) && !Object.keys(value).length)
            continue;
        throw new ProtocolConversionError('UNSUPPORTED_BODY_FIELD', protocol + '.' + key + ' has no implemented canonical conversion');
    }
}
function copyCommon(body) {
    const output = {};
    copyFields(body, output, ['model', 'stream', 'temperature', 'top_p', 'metadata', 'service_tier']);
    if (output.metadata !== undefined && output.metadata !== null && !isObject(output.metadata))
        throw new ProtocolConversionError('INVALID_METADATA', 'metadata must be an object');
    return output;
}
function isNonempty(value) {
    return value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
}
function responseFormat(body) {
    const raw = isObject(body.text) ? body.text.format : body.response_format;
    if (raw === undefined)
        return undefined;
    const f = object(raw, 'response format');
    if (f.type === 'text')
        return undefined;
    if (f.type === 'json_object')
        throw new ProtocolConversionError('UNSUPPORTED_RESPONSE_FORMAT', 'Anthropic structured output needs an explicit JSON schema, not open-ended json_object mode');
    if (f.type === 'json_schema') {
        const inner = isObject(f.json_schema) ? f.json_schema : f;
        return { type: 'json_schema', schema: cloneJson(object(inner.schema, 'response format schema')) };
    }
    throw new ProtocolConversionError('UNSUPPORTED_RESPONSE_FORMAT', String(f.type));
}
function anthropicToolChoice(choice, parallel) {
    let output;
    if (choice === 'auto')
        output = { type: 'auto' };
    else if (choice === 'none')
        output = { type: 'none' };
    else if (choice === 'required')
        output = { type: 'any' };
    else if (isObject(choice)) {
        if (choice.type === 'function') {
            const f = isObject(choice.function) ? choice.function : choice;
            output = { type: 'tool', name: text(f.name, 'tool_choice.name') };
        }
        else
            throw new ProtocolConversionError('UNSUPPORTED_TOOL_CHOICE', String(choice.type));
    }
    else if (choice !== undefined && choice !== null)
        throw new ProtocolConversionError('INVALID_TOOL_CHOICE', 'unknown tool choice');
    if (typeof parallel === 'boolean')
        output = { ...(output ?? { type: 'auto' }), disable_parallel_tool_use: !parallel };
    return output;
}
function responsesToolChoice(choice) {
    if (choice === undefined || choice === null)
        return undefined;
    if (typeof choice === 'string')
        return choice;
    const c = object(choice, 'tool_choice');
    if (c.type === 'auto')
        return 'auto';
    if (c.type === 'none')
        return 'none';
    if (c.type === 'any')
        return 'required';
    if (c.type === 'tool')
        return { type: 'function', name: text(c.name, 'tool_choice.name') };
    if (c.type === 'function') {
        const f = isObject(c.function) ? c.function : c;
        return { type: 'function', name: text(f.name, 'tool_choice.name') };
    }
    throw new ProtocolConversionError('UNSUPPORTED_TOOL_CHOICE', String(c.type));
}
function anthropicTools(body) {
    const declarations = body.tools ?? (Array.isArray(body.functions) ? body.functions.map(f => ({ type: 'function', function: f })) : undefined);
    if (declarations === undefined)
        return undefined;
    return array(declarations, 'tools').map(item => {
        const tool = object(item, 'tool');
        if (tool.type !== 'function')
            throw new ProtocolConversionError('UNSUPPORTED_TOOL_TYPE', 'Anthropic conversion supports function tools, not ' + String(tool.type));
        const f = isObject(tool.function) ? tool.function : tool;
        const output = { name: text(f.name, 'tool.name'), input_schema: cloneJson(object(f.parameters ?? { type: 'object', properties: {} }, 'tool.parameters')) };
        if (typeof f.description === 'string')
            output.description = f.description;
        return output;
    });
}
function responsesTools(body, source) {
    const declarations = body.tools ?? (Array.isArray(body.functions) ? body.functions.map(f => ({ type: 'function', function: f })) : undefined);
    if (declarations === undefined)
        return undefined;
    return array(declarations, 'tools').map(item => {
        const tool = object(item, 'tool');
        if (source === 'anthropic-messages') {
            if (tool.type !== undefined && tool.type !== 'custom')
                throw new ProtocolConversionError('UNSUPPORTED_TOOL_TYPE', 'Anthropic server tools are not portable');
            const output = { type: 'function', name: text(tool.name, 'tool.name'), parameters: cloneJson(object(tool.input_schema, 'tool.input_schema')) };
            if (typeof tool.description === 'string')
                output.description = tool.description;
            return output;
        }
        if (tool.type !== 'function')
            throw new ProtocolConversionError('UNSUPPORTED_TOOL_TYPE', 'chat conversion supports function tools only');
        const f = object(tool.function, 'tool.function');
        const output = { type: 'function', name: text(f.name, 'tool.name'), parameters: cloneJson(object(f.parameters ?? { type: 'object', properties: {} }, 'tool.parameters')) };
        copyFields(f, output, ['description', 'strict']);
        return output;
    });
}
function applyAnthropicReasoning(body, output) {
    const reasoning = isObject(body.reasoning) ? body.reasoning.effort : body.reasoning_effort;
    if (reasoning === undefined || reasoning === 'none' || reasoning === 'minimal')
        return;
    if (reasoning !== 'low' && reasoning !== 'medium' && reasoning !== 'high' && reasoning !== 'xhigh')
        throw new ProtocolConversionError('UNSUPPORTED_REASONING', String(reasoning));
    const max = typeof output.max_tokens === 'number' ? output.max_tokens : 4096;
    if (max <= 1024)
        throw new ProtocolConversionError('INVALID_THINKING_BUDGET', 'enabled thinking requires max_tokens > 1024');
    const requested = reasoning === 'low' ? 1024 : reasoning === 'medium' ? 2048 : 8192;
    output.thinking = { type: 'enabled', budget_tokens: Math.min(requested, max - 1) };
    // Anthropic enabled thinking requires the default temperature and no top_p override.
    if (output.temperature !== undefined && output.temperature !== 1)
        throw new ProtocolConversionError('THINKING_TEMPERATURE_CONFLICT', 'temperature must be 1 with Anthropic enabled thinking');
    if (output.top_p !== undefined)
        throw new ProtocolConversionError('THINKING_TOP_P_CONFLICT', 'top_p is not portable with enabled thinking');
}
function applyResponsesReasoning(body, output) {
    if (typeof body.reasoning_effort === 'string')
        output.reasoning = { effort: body.reasoning_effort };
    if (isObject(body.thinking) && body.thinking.type !== 'disabled') {
        const budget = typeof body.thinking.budget_tokens === 'number' ? body.thinking.budget_tokens : 8192;
        output.reasoning = { effort: budget <= 1024 ? 'low' : budget <= 4096 ? 'medium' : 'high' };
    }
    if (isObject(body.output_config) && typeof body.output_config.effort === 'string') {
        const effort = body.output_config.effort;
        output.reasoning = { effort: effort === 'max' ? 'high' : effort };
    }
}
function chatToAnthropic(body, system, messages) {
    for (const raw of array(body.messages, 'messages')) {
        const m = object(raw, 'message'), role = text(m.role, 'message.role');
        if (role === 'system' || role === 'developer') {
            for (const b of toAnthropicContent(m.content, 'message.content')) {
                const p = object(b, 'system content');
                if (p.type !== 'text')
                    throw new ProtocolConversionError('INVALID_SYSTEM_CONTENT', 'system/developer content must be text');
                system.push(p);
            }
            continue;
        }
        if (role === 'tool' || role === 'function') {
            if (role === 'function')
                throw new ProtocolConversionError('LEGACY_FUNCTION_RESULT', 'legacy function results need an explicit tool-call ID');
            const content = typeof m.content === 'string' ? m.content : toAnthropicContent(m.content, 'tool.content');
            appendAnthropicMessage(messages, 'user', [{ type: 'tool_result', tool_use_id: text(m.tool_call_id, 'tool_call_id'), content }]);
            continue;
        }
        if (role !== 'user' && role !== 'assistant')
            throw new ProtocolConversionError('UNSUPPORTED_ROLE', role);
        const blocks = toAnthropicContent(m.content, 'message.content');
        if (typeof m.refusal === 'string' && !blocks.length)
            blocks.push({ type: 'text', text: m.refusal });
        if (m.function_call !== undefined)
            throw new ProtocolConversionError('LEGACY_FUNCTION_CALL', 'legacy function_call needs an explicit tool-call ID');
        if (Array.isArray(m.tool_calls))
            for (const rawCall of m.tool_calls) {
                const call = object(rawCall, 'tool_call');
                if (call.type !== 'function')
                    throw new ProtocolConversionError('UNSUPPORTED_TOOL_CALL', String(call.type));
                const f = object(call.function, 'tool_call.function');
                blocks.push({ type: 'tool_use', id: text(call.id, 'tool_call.id'), name: text(f.name, 'tool_call.name'), input: parseToolArguments(f.arguments) });
            }
        appendAnthropicMessage(messages, role, blocks);
    }
}
function responsesToAnthropic(body, system, messages) {
    if (typeof body.instructions === 'string')
        system.push({ type: 'text', text: body.instructions });
    if (typeof body.base_instructions === 'string')
        system.push({ type: 'text', text: body.base_instructions });
    if (typeof body.input === 'string') {
        appendAnthropicMessage(messages, 'user', [{ type: 'text', text: body.input }]);
        return;
    }
    for (const raw of array(body.input, 'input')) {
        const item = object(raw, 'input item');
        if (item.type === 'function_call') {
            appendAnthropicMessage(messages, 'assistant', [{ type: 'tool_use', id: text(item.call_id, 'function_call.call_id'), name: text(item.name, 'function_call.name'), input: parseToolArguments(item.arguments) }]);
        }
        else if (item.type === 'function_call_output') {
            const content = typeof item.output === 'string' ? item.output : toAnthropicContent(item.output, 'function_call_output.output');
            appendAnthropicMessage(messages, 'user', [{ type: 'tool_result', tool_use_id: text(item.call_id, 'function_call_output.call_id'), content }]);
        }
        else if (item.type === undefined || item.type === 'message') {
            const role = text(item.role, 'input.role');
            const blocks = toAnthropicContent(item.content, 'input.content');
            if (role === 'system' || role === 'developer') {
                for (const block of blocks) {
                    const b = object(block, 'system block');
                    if (b.type !== 'text')
                        throw new ProtocolConversionError('INVALID_SYSTEM_CONTENT', 'system/developer content must be text');
                    system.push(b);
                }
            }
            else if (role === 'user' || role === 'assistant')
                appendAnthropicMessage(messages, role, blocks);
            else
                throw new ProtocolConversionError('UNSUPPORTED_ROLE', role);
        }
        else {
            // Opaque reasoning, item references and hosted-tool traces cannot be fabricated across APIs.
            throw new ProtocolConversionError('NONPORTABLE_INPUT_ITEM', String(item.type));
        }
    }
}
export function toAnthropic(body, source, defaultMaxTokens) {
    if (source === 'anthropic-messages')
        return cloneJson(body);
    validateCrossFields(body, source);
    if (isNonempty(body.previous_response_id) || isNonempty(body.conversation))
        throw new ProtocolConversionError('STATEFUL_CONVERSION', 'Anthropic conversion requires full stateless history, not a Responses reference');
    if (isNonempty(body.stop)) {
        // Messages supports stop_sequences, so chat stop strings remain an exact equivalent here.
    }
    const output = copyCommon(body), system = [], messages = [];
    const max = body.max_output_tokens ?? body.max_completion_tokens ?? body.max_tokens ?? defaultMaxTokens;
    if (typeof max !== 'number' || !Number.isInteger(max) || max <= 0)
        throw new ProtocolConversionError('INVALID_MAX_TOKENS', 'max_tokens must be a positive integer');
    output.max_tokens = max;
    if (source === 'openai-chat-completions')
        chatToAnthropic(body, system, messages);
    else
        responsesToAnthropic(body, system, messages);
    output.system = system;
    output.messages = messages;
    const tools = anthropicTools(body);
    if (tools !== undefined)
        output.tools = tools;
    const choice = anthropicToolChoice(body.tool_choice, body.parallel_tool_calls);
    if (choice !== undefined && tools?.length)
        output.tool_choice = choice;
    else if (choice?.type === 'tool' || choice?.type === 'any')
        throw new ProtocolConversionError('TOOL_CHOICE_WITHOUT_TOOLS', 'forced tool choice needs declared function tools');
    if (body.service_tier === 'default')
        output.service_tier = 'standard_only';
    else if (body.service_tier !== undefined && body.service_tier !== 'auto')
        throw new ProtocolConversionError('UNSUPPORTED_SERVICE_TIER', 'Messages has no ' + String(body.service_tier) + ' tier');
    if (typeof body.stop === 'string')
        output.stop_sequences = [body.stop];
    else if (Array.isArray(body.stop))
        output.stop_sequences = cloneJson(body.stop);
    const format = responseFormat(body);
    if (format)
        output.output_config = { format };
    applyAnthropicReasoning(body, output);
    return output;
}
function chatToResponses(body) {
    const input = [];
    for (const raw of array(body.messages, 'messages')) {
        const m = object(raw, 'message'), role = text(m.role, 'message.role');
        if (role === 'tool') {
            input.push({ type: 'function_call_output', call_id: text(m.tool_call_id, 'tool_call_id'), output: typeof m.content === 'string' ? m.content : toResponsesContent(m.content ?? '', 'tool.content') });
            continue;
        }
        if (!['system', 'developer', 'user', 'assistant'].includes(role))
            throw new ProtocolConversionError('UNSUPPORTED_ROLE', role);
        const content = toResponsesContent(m.content, 'message.content');
        if (typeof m.refusal === 'string' && !content.length)
            content.push({ type: 'input_text', text: m.refusal });
        if (content.length)
            input.push({ role: role === 'system' ? 'developer' : role, content });
        if (m.function_call !== undefined)
            throw new ProtocolConversionError('LEGACY_FUNCTION_CALL', 'legacy calls need explicit call IDs');
        if (Array.isArray(m.tool_calls))
            for (const rawCall of m.tool_calls) {
                const call = object(rawCall, 'tool_call'), f = object(call.function, 'tool_call.function');
                if (call.type !== 'function')
                    throw new ProtocolConversionError('UNSUPPORTED_TOOL_CALL', String(call.type));
                const args = typeof f.arguments === 'string' ? f.arguments : JSON.stringify(parseToolArguments(f.arguments));
                input.push({ type: 'function_call', call_id: text(call.id, 'tool_call.id'), name: text(f.name, 'tool_call.name'), arguments: args });
            }
    }
    return input;
}
function anthropicToResponses(body) {
    const input = [], system = systemBlocks(body.system);
    if (system.length)
        input.push(developerMessage(system));
    for (const raw of array(body.messages, 'messages')) {
        const m = object(raw, 'message'), role = text(m.role, 'message.role');
        if (role !== 'user' && role !== 'assistant')
            throw new ProtocolConversionError('UNSUPPORTED_ROLE', role);
        if (typeof m.content === 'string') {
            input.push({ role, content: m.content });
            continue;
        }
        let pending = [];
        const flush = () => { if (pending.length)
            input.push({ role, content: pending }); pending = []; };
        for (const rawBlock of array(m.content, 'message.content')) {
            const b = object(rawBlock, 'content block');
            if (b.type === 'tool_use') {
                flush();
                input.push({ type: 'function_call', call_id: text(b.id, 'tool_use.id'), name: text(b.name, 'tool_use.name'), arguments: JSON.stringify(object(b.input, 'tool_use.input')) });
            }
            else if (b.type === 'tool_result') {
                flush();
                input.push({ type: 'function_call_output', call_id: text(b.tool_use_id, 'tool_result.tool_use_id'), output: toolResultOutput(b) });
            }
            else if (b.type === 'thinking' || b.type === 'redacted_thinking' || b.type === 'server_tool_use') {
                throw new ProtocolConversionError('NONPORTABLE_CONTENT_BLOCK', String(b.type) + ' carries provider-specific state');
            }
            else
                pending.push(...toResponsesContent([b], 'message.content'));
        }
        flush();
    }
    return input;
}
export function toResponses(body, source) {
    if (source === 'openai-responses')
        return cloneJson(body);
    validateCrossFields(body, source);
    if (isNonempty(body.stop) || isNonempty(body.stop_sequences))
        throw new ProtocolConversionError('UNSUPPORTED_STOP', 'Responses has no stop/stop_sequences request parameter');
    if (body.top_k !== undefined)
        throw new ProtocolConversionError('UNSUPPORTED_TOP_K', 'Responses has no top_k request parameter');
    if (isNonempty(body.context_management) || isNonempty(body.container))
        throw new ProtocolConversionError('NONPORTABLE_CONTEXT', 'provider context/container state is not portable');
    const output = copyCommon(body);
    if (source === 'anthropic-messages' && body.service_tier === 'standard_only')
        output.service_tier = 'default';
    const max = body.max_completion_tokens ?? body.max_tokens;
    if (max !== undefined)
        output.max_output_tokens = cloneJson(max);
    output.input = source === 'anthropic-messages' ? anthropicToResponses(body) : chatToResponses(body);
    const tools = responsesTools(body, source);
    if (tools !== undefined)
        output.tools = tools;
    const choice = responsesToolChoice(body.tool_choice);
    if (choice !== undefined)
        output.tool_choice = choice;
    if (typeof body.parallel_tool_calls === 'boolean')
        output.parallel_tool_calls = body.parallel_tool_calls;
    if (isObject(body.tool_choice) && typeof body.tool_choice.disable_parallel_tool_use === 'boolean')
        output.parallel_tool_calls = !body.tool_choice.disable_parallel_tool_use;
    if (typeof body.store === 'boolean')
        output.store = body.store;
    if (typeof body.safety_identifier === 'string')
        output.safety_identifier = body.safety_identifier;
    else if (typeof body.user === 'string')
        output.safety_identifier = body.user;
    const format = source === 'anthropic-messages' && isObject(body.output_config) ? body.output_config.format : body.response_format;
    if (isObject(format) && format.type === 'json_schema') {
        const f = isObject(format.json_schema) ? format.json_schema : format;
        output.text = { format: { type: 'json_schema', name: typeof f.name === 'string' ? f.name : 'response', schema: cloneJson(object(f.schema, 'response format schema')), strict: typeof f.strict === 'boolean' ? f.strict : false } };
    }
    else if (isObject(format) && format.type === 'json_object')
        output.text = { format: { type: 'json_object' } };
    else if (format !== undefined && (!isObject(format) || format.type !== 'text'))
        throw new ProtocolConversionError('UNSUPPORTED_RESPONSE_FORMAT', 'unrecognized structured output format');
    applyResponsesReasoning(body, output);
    return output;
}
//# sourceMappingURL=protocols.js.map