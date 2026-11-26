import type { PanelState, ProfileOverrides, ProviderRule } from '../types.js';
import type { ClaudeBillingControls } from './billing.js';
import { CODEX_PROMPT_SHA256, CODEX_UPSTREAM_INSTRUCTIONS } from './codex-prompt.js';
import { validateProfileOverrides } from './overrides.js';

export interface ProfileEvidence {
  kind: 'public-source' | 'reference-specification';
  captureVerified: false;
  description: string;
  sources: readonly string[];
  commit?: string;
  sha256?: string;
}
interface CommonProfile {
  id: string; label: string; version: string; evidence: ProfileEvidence;
  extraHeaders: Readonly<Record<string, string>>;
}
export interface ClaudeProfile extends CommonProfile {
  client: 'claude-code'; mode: 'source-api-key' | 'compatibility';
  runtimeVersion: string; sdkVersion: string;
  beta: readonly string[]; betaPolicy: 'source-agentic' | 'fixed';
  betaMarkers: { cli: string; interleaved: string; scope: string; context1m: string };
  identity: string; metadataFormat: 'legacy' | 'json';
  accountPolicy: 'empty-unless-supplied' | 'context-uuid';
  entrypoint: string; os: string; arch: string; maxTokens: number; apiVersion: string;
  billing: ClaudeBillingControls;
  cache: { type: 'ephemeral'; ttl?: '1h'; maxBreakpoints: number; placement: 'source-org' | 'compatibility-system' };
  headers: { app: string; sessionRequestIds: boolean; timeoutSeconds?: number; acceptJson?: boolean; dangerouslyAllowBrowser?: boolean };
}
export interface CodexProfile extends CommonProfile {
  client: 'codex'; originator: string; instructions: string;
  os: string; osVersion: string; arch: string; terminal: string;
  betaFeatures: string;
}
export type ClientProfile = ClaudeProfile | CodexProfile;

function stainlessOS(value: string): string {
  const os = value.toLowerCase();
  if (os.includes('ios')) return 'iOS';
  const known: Record<string,string> = {android:'Android',darwin:'MacOS',win32:'Windows',freebsd:'FreeBSD',openbsd:'OpenBSD',linux:'Linux'};
  return known[os] ?? (os ? 'Other:' + os : 'Unknown');
}
function stainlessArch(value: string): string {
  if (value === 'x32' || value === 'arm') return value;
  if (value === 'x86_64' || value === 'x64') return 'x64';
  if (value === 'aarch64' || value === 'arm64') return 'arm64';
  return value ? 'other:' + value : 'unknown';
}

// Every version/algorithm/cache/header decision is owned by a central profile.
const CLAUDE_SOURCE: ClaudeProfile = {
  id: 'claude-code/2.1.63-source', client: 'claude-code', version: '2.1.63', mode:'source-api-key',
  label: 'Claude Code 2.1.63 · published-source interactive CLI / API-key',
  runtimeVersion: process.version, sdkVersion:'0.74.0',
  beta: ['claude-code-20250219','interleaved-thinking-2025-05-14','prompt-caching-scope-2026-01-05'], betaPolicy:'source-agentic',
  betaMarkers: {cli:'claude-code-20250219',interleaved:'interleaved-thinking-2025-05-14',scope:'prompt-caching-scope-2026-01-05',context1m:'context-1m-2025-08-07'},
  identity: "You are Claude Code, Anthropic's official CLI for Claude.",
  metadataFormat:'legacy', accountPolicy:'empty-unless-supplied',
  // XCz(false) selects cli for the interactive branch; headless XCz(true) is sdk-cli.
  entrypoint:'cli', os:stainlessOS(process.platform), arch:stainlessArch(process.arch), maxTokens:32000, apiVersion:'2023-06-01',
  billing:{salt:'59cf53e54c78',sampleIndices:[4,7,20],suffixLength:3,initialCch:'00000'},
  cache:{type:'ephemeral',maxBreakpoints:2,placement:'source-org'},
  headers:{app:'cli',sessionRequestIds:false,acceptJson:true,dangerouslyAllowBrowser:true}, extraHeaders:{},
  evidence:{
    kind:'public-source',captureVerified:false,sha256:'12809142119cce671afbd9d422b524778de786752aeef2ba1f70879b5d4dce0d',
    description:'Published 2.1.63 cli.js source: SDK 0.74.0, interactive CLI identity/entrypoint, IF5/Y28 version suffix, legacy user_id with empty no-OAuth account, org cache blocks without API-key ttl. Headless SDK identity/sdk-cli is a distinct source branch. cch=00000 is only the known source-construction placeholder; final transport is unverified. No packet capture or gateway acceptance is claimed.',
    sources:[
      'https://registry.npmjs.org/@anthropic-ai%2Fclaude-code/2.1.63',
      'https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-2.1.63.tgz',
      'evidence/claude-release/source-findings.json',
      'evidence/claude-release/source-identity-origins.json',
      'evidence/claude-release/source-excerpts.json',
      'evidence/claude-release/source-line-889.json',
      'evidence/claude-release/artifact-project/node_modules/.pnpm/@anthropic-ai+claude-code@2.1.63/node_modules/@anthropic-ai/claude-code/cli.js#L331',
      'evidence/claude-release/artifact-project/node_modules/.pnpm/@anthropic-ai+claude-code@2.1.63/node_modules/@anthropic-ai/claude-code/cli.js#L498',
      'evidence/claude-release/artifact-project/node_modules/.pnpm/@anthropic-ai+claude-code@2.1.63/node_modules/@anthropic-ai/claude-code/cli.js#L6105',
      'evidence/claude-release/artifact-project/node_modules/.pnpm/@anthropic-ai+claude-code@2.1.63/node_modules/@anthropic-ai/claude-code/cli.js#L6110',
    ],
  },
};
const CLAUDE_COMPATIBILITY: ClaudeProfile = {
  ...CLAUDE_SOURCE,id:'claude-code/2.1.63',mode:'compatibility',
  label:'Claude Code 2.1.63 · compatibility: UUID / system TTL 1h',
  runtimeVersion:'v22.16.0',os:'Windows',arch:'x64',maxTokens:4096,
  beta:['claude-code-20250219','context-management-2025-06-27','prompt-caching-scope-2026-01-05'],betaPolicy:'fixed',
  identity:"You are Claude Code, Anthropic's official CLI for Claude.",accountPolicy:'context-uuid',
  cache:{type:'ephemeral',ttl:'1h',maxBreakpoints:4,placement:'compatibility-system'},
  headers:{app:'cli',sessionRequestIds:true},
  evidence:{
    kind:'reference-specification',captureVerified:false,
    description:'Explicit compatibility specification: classic CLI identity, Windows/x64 Node v22.16.0, legacy account UUID, session/request extension headers and up to four system cache slots with 1h TTL. SDK 0.74.0 and version suffix were corrected from published source; this combined tuple is not a capture-verified tuple. Final cch transport remains unverified.',
    sources:[
      'https://registry.npmjs.org/@anthropic-ai%2Fclaude-code/2.1.63',
      'https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-2.1.63.tgz',
      'https://platform.claude.com/docs/en/api/messages',
      'https://platform.claude.com/docs/en/build-with-claude/prompt-caching',
      '../AGENTS.md#5',
    ],
  },
};
const CODEX: CodexProfile = {
  id:'codex-cli/0.107.0',client:'codex',version:'0.107.0',
  label:'Codex CLI 0.107.0 · pinned public GPT-5.2 Codex template',
  originator:'codex_cli_rs',instructions:CODEX_UPSTREAM_INSTRUCTIONS,
  os:'Windows',osVersion:'10.0.26100',arch:'x86_64',terminal:'unknown',extraHeaders:{},betaFeatures:'remote_compaction_v2',
  evidence:{
    kind:'public-source',captureVerified:false,
    description:'Complete public gpt-5.2-codex_prompt.md and Rust originator/UA format pinned to rust-v0.107.0. OS/terminal are reference fixture values; this is not an observed full client capture.',
    commit:'19f8797c0f62abecb347e817aac36d18c5fc554e',sha256:CODEX_PROMPT_SHA256,
    sources:[
      'https://github.com/openai/codex/tree/19f8797c0f62abecb347e817aac36d18c5fc554e',
      'https://raw.githubusercontent.com/openai/codex/19f8797c0f62abecb347e817aac36d18c5fc554e/codex-rs/core/gpt-5.2-codex_prompt.md',
      'https://raw.githubusercontent.com/openai/codex/19f8797c0f62abecb347e817aac36d18c5fc554e/codex-rs/core/src/default_client.rs',
    ],
  },
};
const PROFILES: readonly ClientProfile[] = [CLAUDE_SOURCE,CLAUDE_COMPATIBILITY,CODEX];

/** Replays the selected first-party API-key/agentic beta branch; feature-flag betas are not invented. */
export function claudeBetas(profile: ClaudeProfile, model: string): string[] {
  if (profile.betaPolicy === 'fixed') return [...profile.beta];
  const {cli,interleaved,scope,context1m} = profile.betaMarkers, beta:string[]=[];
  if (!model.includes('haiku')) beta.push(cli);
  if (/\[1m\]/i.test(model)) beta.push(context1m);
  if (!model.includes('claude-3-')) beta.push(interleaved);
  beta.push(scope);
  if (!beta.includes(cli)) beta.push(cli);
  return beta;
}
export function listProfiles(): PanelState['profiles'] {
  return PROFILES.map(p=>({id:p.id,client:p.client,version:p.version,label:p.label,
    evidence:p.evidence.description+(p.evidence.commit?' Commit: '+p.evidence.commit:'')}));
}
/** Validate independent callers too; overriding a source profile is an explicit custom specification. */
export function resolveProfile(rule: ProviderRule): ClientProfile {
  const base=PROFILES.find(p=>p.client===rule.client&&(!rule.profile||p.id===rule.profile));
  if (!base) throw new Error('UNKNOWN_CLIENT_PROFILE: '+rule.client+'/'+(rule.profile??'default'));
  validateProfileOverrides(rule.overrides,base.client);
  const o:ProfileOverrides=rule.overrides??{}, common={...base,version:o.version??base.version,extraHeaders:{...base.extraHeaders,...o.extraHeaders}};
  if (base.client==='claude-code') return {...base,...common,client:'claude-code',
    runtimeVersion:o.runtimeVersion??base.runtimeVersion,sdkVersion:o.sdkVersion??base.sdkVersion,
    beta:[...(o.beta??base.beta)],betaPolicy:o.beta===undefined?base.betaPolicy:'fixed',betaMarkers:{...base.betaMarkers},
    identity:o.identity??base.identity,metadataFormat:o.metadataFormat??base.metadataFormat,
    cache:{...base.cache},headers:{...base.headers},billing:{...base.billing,sampleIndices:[...base.billing.sampleIndices]}};
  return {...base,...common,client:'codex',originator:o.originator??base.originator,instructions:o.instructions??base.instructions};
}
