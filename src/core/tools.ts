import type { Json, JsonObject } from '../types.js';
import { isObject, ProtocolConversionError } from './json.js';

/** Reverse mapping: outgoing (Claude) name -> original host name. */
export function renameClaudeTools(body: JsonObject): Record<string, string> {
  const slots: { object: JsonObject; key: string; original: string }[] = [];
  const add = (value: Json | undefined, key: string): void => {
    if (isObject(value) && typeof value[key] === 'string') slots.push({ object: value, key, original: value[key] as string });
  };
  if (Array.isArray(body.tools)) for (const tool of body.tools) add(tool, 'name');
  if (isObject(body.tool_choice) && body.tool_choice.type === 'tool') add(body.tool_choice, 'name');
  if (Array.isArray(body.messages)) for (const message of body.messages) {
    if (!isObject(message) || !Array.isArray(message.content)) continue;
    for (const block of message.content) if (isObject(block) && block.type === 'tool_use') add(block, 'name');
  }
  const targets = new Map<string, string>();
  const reverse: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const slot of slots) {
    const target = slot.original.replace(/^(?:proxy_)+/, '');
    if (!target || !/^[a-zA-Z0-9_-]{1,64}$/.test(target)) {
      throw new ProtocolConversionError('INVALID_TOOL_NAME', slot.original + ' has no valid Anthropic tool name after normalization');
    }
    const prior = targets.get(target);
    if (prior !== undefined && prior !== slot.original) {
      throw new ProtocolConversionError('TOOL_NAME_COLLISION', prior + ' and ' + slot.original + ' both map to ' + target);
    }
    targets.set(target, slot.original);
    if (target !== slot.original) reverse[target] = slot.original;
  }
  // Validate all collisions before mutating even the derived body.
  for (const slot of slots) slot.object[slot.key] = slot.original.replace(/^(?:proxy_)+/, '');
  return reverse;
}

/** Remove only real cache slots, never fields inside tool arguments or tool-output data. */
export function clearAnthropicCacheSlots(body: JsonObject): void {
  delete body.cache_control;
  if (Array.isArray(body.tools)) for (const tool of body.tools) if (isObject(tool)) delete tool.cache_control;
  if (Array.isArray(body.system)) for (const block of body.system) if (isObject(block)) delete block.cache_control;
  const visitBlocks = (blocks: Json | undefined): void => {
    if (!Array.isArray(blocks)) return;
    for (const block of blocks) {
      if (!isObject(block)) continue;
      delete block.cache_control;
      if (block.type === 'tool_result') visitBlocks(block.content);
    }
  };
  if (Array.isArray(body.messages)) for (const message of body.messages) if (isObject(message)) visitBlocks(message.content);
}
