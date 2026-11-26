import z from '@deepseek-ai/schemastery';
import type { HostContext } from './host/contracts.js';
export declare const name = "dsh-mimic";
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    config: z<any, any, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    config: z<any, any, "volatile-defined">;
}>>, "plain">;
export interface Options {
    config?: unknown;
}
export declare function apply(ctx: HostContext, options?: Options): void;
declare const _default: {
    name: string;
    inject: string[];
    Config: z<Schemastery.ObjectS<NoInfer<{
        config: z<any, any, "volatile-defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        config: z<any, any, "volatile-defined">;
    }>>, "plain">;
    apply: typeof apply;
};
export default _default;
