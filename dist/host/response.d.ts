import type { TransformResult } from '../types.js';
/** Synchronous fetch seam: provider response -> original caller protocol, with no eager reads. */
export declare function bridgeResponse(response: Response, result: TransformResult): Response;
