# Client profiles and protocol conversion

Version controls live together in [the runtime catalog](../src/core/profiles.ts). These JSON documents are evidence records, not another runtime configuration source. The host presents three catalog entries: the default Claude SOURCE profile, an explicit Claude compatibility profile, and Codex.

## Claude Code 2.1.63 — SOURCE interactive CLI (default)

[Source profile](claude-code-2.1.63-source.json) is **public-source, captureVerified:false**. Selecting Claude Code without a profile picks the interactive CLI branch: classic CLI identity, entrypoint cli, and UA claude-cli/2.1.63 (external, cli). Headless --print/non-TTY startup instead uses sdk-cli with the Agent SDK identity; that is a distinct source branch, not the default simulated here.

The exact [public npm artifact](https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-2.1.63.tgz) was inspected by the calibration task. Its cli.js SHA256 is 12809142119cce671afbd9d422b524778de786752aeef2ba1f70879b5d4dce0d (11,978,841 bytes). [Compact source findings and capture state](../evidence/claude-release/source-findings.json) preserve snippets, bounds and counter-evidence. SDK 0.74.0 is shipped; OS/architecture/Node version follow the actual host process rather than a fixed Node version belonging to Claude.

- Billing system[0] mirrors IF5/Y28/ez1: SHA256(59cf53e54c78 + first user text UTF-16 code units [4,7,20], missing as 0 + version).slice(0,3) becomes cc_version=2.1.63.SUFFIX. The constructor emits cch=00000. A final transport checksum/hash rewrite was not measured, so no system-JSON hash is fabricated or called official.
- Identity system[1] is the interactive CLI identity. The ordinary source branch joins the remaining nonempty system text with two LF separators into one main block. Billing has no cache slot; identity and main receive {type:ephemeral} without explicit ttl in the selected API-key branch. Extra system-block fields that merging would discard produce an atomic UNMERGEABLE_SYSTEM_BLOCK error.
- Legacy user_id keeps the account segment even when empty: user_DEVICE_account__session_SESSION. Existing valid identities and explicit private account/device overrides are retained. Device/session are supplied by the host; non-UUID fallback derives a stable simulator UUIDv5 and is not presented as official randomUUID first-start behavior.
- SDK defaults include Accept application/json, x-app cli, retry 0 and anthropic-dangerous-direct-browser-access true. No session/request extension headers or helper-method header are added in this source profile. The signal-only main path does not imply a per-request timeout header; SDK client timeout and HTTP timeout header are different.
- Betas follow the selected first-party/agentic model branch. OAuth, custom environment, global cache, hosted tools, feature-dependent context management and native binary transport are not inferred. Original request generation controls are retained; 32,000 max_tokens is an API fallback rather than a measured fingerprint.

The isolated official CLI startup produced spawn EPERM before any /v1/messages request (zero messages observed). SOURCE means selected published-source behavior, **not** an official packet-capture-verified complete client. Native TLS/HTTP behavior, final cch, full body equivalence and gateway acceptance remain unmeasured.

## Claude Code 2.1.63 — requested compatibility profile

[Compatibility profile](claude-code-2.1.63.json), id claude-code/2.1.63, is **reference-specification, captureVerified:false**. It separately preserves the requested Windows/x64 Node v22.16.0, account UUID, session/request extension headers, fixed reference betas and up to four system cache breakpoints with the valid Anthropic shape {type:ephemeral,ttl:1h}. Unlike the SOURCE profile, billing itself can receive a compatibility cache slot and original system block boundaries remain distinct. SDK 0.74.0 and the three-hex cc_version suffix are corrected to public source. The combined 1h/UUID tuple is not labelled as a same-version capture.

Only recognized complete system date-carrier lines are normalized. User text and tool arguments/results are never normalized or globally renamed. Existing metadata keys survive except identity user_id. Existing valid account/session UUIDs are retained; explicit private account/device overrides take precedence. Those IDs persist across client switching but Codex never consumes or injects them.

Structured overrides are independently validated by the core and host. extraHeaders are exact assertions of canonical generated identity values, not arbitrary overwrites of UA/SDK/runtime/beta/session. Wrong-client, helper/unknown, inconsistent and private-name suffixes fail before transmission; errors omit values. Configured provider credentials remain unchanged, including SDK-prefixed credentials.

Tool definitions, tool_choice and tool_use names have repeated leading proxy_ prefixes structurally removed. Collisions fail before mutation. No fake or sentinel tools are added. TransformResult.toolNames maps outgoing names to host originals; the host reverses response names.

## Codex CLI 0.107.0

[Codex evidence profile](codex-cli-0.107.0.json) is **public-source, captureVerified:false**. Tag rust-v0.107.0 resolves to [commit 19f8797c0f62abecb347e817aac36d18c5fc554e](https://github.com/openai/codex/tree/19f8797c0f62abecb347e817aac36d18c5fc554e). The complete [public GPT-5.2 Codex prompt](https://raw.githubusercontent.com/openai/codex/19f8797c0f62abecb347e817aac36d18c5fc554e/codex-rs/core/gpt-5.2-codex_prompt.md) is preserved verbatim in [the prompt artifact](codex-0.107.0.prompt.md) and embedded in [a generated constant](../src/core/codex-prompt.ts), with no runtime filesystem access.

- SHA256 1b3dd697043a7f613c691a3721a450251626685b3e97ac3ad3d35ea62758a31e; 7,589 UTF-8 bytes and 7,563 JavaScript characters.
- [Public Rust client headers](https://raw.githubusercontent.com/openai/codex/19f8797c0f62abecb347e817aac36d18c5fc554e/codex-rs/core/src/default_client.rs) supply originator codex_cli_rs and UA originator/version (OS version; architecture) terminal. Windows 10.0.26100/x86_64/unknown terminal are explicit fixture values.
- This is a complete model-specific public template, not a fabricated approximately-20K string or private credentials/cache extraction.

The target is OpenAI Responses. instructions is injected on every request. Original instructions and internal base_instructions are preserved as developer input; base_instructions is never emitted as an unsupported Responses API field. Existing metadata stays; session_id/source/cwd defaults are only added if absent. User/tools/results are semantically retained. Native input strings stay strings unless original instructions require prepended developer input.

## Conversion contracts

The host selects provider/rule, matches endpoints and translates responses/SSE to originalProtocol. No application, dependency, configuration or credential files are patched. Cross conversion emits real target API structures for text, developer instructions, function calls/results, image URLs/base64 and portable PDF bytes. JSON schema/common generation controls map to actual target fields; reasoning effort/budget mappings are reference approximations, not token equivalence.

Stateful Responses previous_response_id/conversation, hosted-tool traces, signed/encrypted reasoning, nonportable file IDs, missing call IDs and unsupported controls fail with ProtocolConversionError rather than losing data. Responses has no stop/stop_sequences/top_k. Open json_object is not turned into an invalid Anthropic schema. Default/standard_only tiers use target enums; unsupported tiers fail. No tools means no tool_choice or fabricated sentinel, and forced choices without tools fail. Nullable source metadata is accepted.

none/model mismatch returns changed:false by descriptor copying without reading body/header/override getters or replacing references. Active operations clone input and return atomically. A WeakMap retains originalProtocol, original instructions and reverse names through retries/profile switches. Serialized native replays avoid duplicate injection; serialized cross results still need host-maintained originalProtocol/toolNames. The [core regressions](../test/core.test.ts) run with node:test via the lead's compiled TypeScript runner.
