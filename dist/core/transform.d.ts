import type { TransformContext, TransformResult, WireRequest } from '../types.js';
export { ProtocolConversionError } from './json.js';
/** Provider selection is the host's responsibility; this function acts only on the supplied rule. */
export declare function transformRequest(input: WireRequest, context: TransformContext): TransformResult;
