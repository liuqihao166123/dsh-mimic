# FINGERPRINT.md — 版本对齐与常量清单

本文件记录当前实现**对齐到哪个客户端版本**、每个版本相关常量**在哪个文件哪一行**、以及哪些常量**必须成组一起修改**。

> 纪律：任何一处版本漂移都会直接暴露伪装。升级目标客户端版本时，按本文件"升级流程"逐条改完，再跑 `pnpm test`。
> 自动化守卫见 `test/core.test.ts:34`（`resolved overrides keep UA and billing versions coherent`）与 `test/core.test.ts:182`（`UA SDK runtime beta API session and entrypoint header drift fails atomically`）。

---

## 1. 当前对齐目标

| 客户端 | profile id | 版本 | 分支 | 目标协议 | 证据级别 | captureVerified |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `claude-code/2.1.63-source` | 2.1.63 | 交互式 CLI / 一方 API-key / agentic | `anthropic-messages` | public-source | false |
| Claude Code | `claude-code/2.1.63` | 2.1.63 | 兼容规格（UUID + system 1h） | `anthropic-messages` | reference-specification | false |
| Codex CLI | `codex-cli/0.107.0` | 0.107.0 | 公开 GPT-5.2 Codex 模板 + 0.169 抓包校准 | `openai-responses` | public-source + capture | true |

**唯一运行时版本源**：`src/core/profiles.ts:49-116`（`PROFILES` 常量表）。`profiles/*.json` 是证据记录，不是第二配置源。

---

## 2. Claude Code 2.1.63

### 2.1 单一版本字符串

`src/core/profiles.ts:51` — `version: '2.1.63'`

这一个字符串同时驱动三处对外可见的输出，改动即三处同步：

| 输出去向 | 生成位置 |
| --- | --- |
| `User-Agent: claude-cli/2.1.63 (external, cli)` | `src/core/transform.ts:75` |
| `x-anthropic-billing-header: cc_version=2.1.63.<3hex>` | `src/core/billing.ts`（`constructClaudeBillingHeader`） |
| 监听面板展示 | `src/host/listener.ts` |

### 2.2 必须同版本修改的常量清单

| # | 常量 | 位置 | 作用 | 漂移后果 |
| --- | --- | --- | --- | --- |
| 1 | `version: '2.1.63'` | `src/core/profiles.ts:51` | UA + 计费块版本 | UA 与体不一致，立即被识破 |
| 2 | `sdkVersion: '0.74.0'` | `src/core/profiles.ts:53` | `x-stainless-package-version`（`transform.ts:87`） | 头内 SDK 与 UA 版本不匹配 |
| 3 | `runtimeVersion` | `src/core/profiles.ts:53` | `x-stainless-runtime-version`（`transform.ts:89`） | 运行时版本与 UA runtime 声明冲突 |
| 4 | `beta: [...]` | `src/core/profiles.ts:54` | `anthropic-beta` 头 | beta 列表过期 → 降级/拒绝 |
| 5 | `betaMarkers` | `src/core/profiles.ts:55` | 按模型分支选择 beta | 模型标记与实际 beta 不一致 |
| 6 | `identity` | `src/core/profiles.ts:56` | `system[1]` 身份语 | 身份文本与目标版本不符 |
| 7 | `entrypoint: 'cli'` | `src/core/profiles.ts:59` | UA 的 `(external, cli)` 段 | 写成 `sdk-cli` 即暴露 |
| 8 | `billing{salt,sampleIndices,suffixLength,initialCch}` | `src/core/profiles.ts:60` | 计费块 `cc_version` 后缀与 `cch` | 后缀算法与版本不符 |
| 9 | `cache{type,maxBreakpoints,placement}` | `src/core/profiles.ts:61` | `cache_control` 断点 | 断点数量/位置与真实请求不同 |
| 10 | `headers{app,sessionRequestIds,acceptJson,dangerouslyAllowBrowser}` | `src/core/profiles.ts:62` | `x-app` / session 头 / Accept / browser-access | 头集合形态偏离 |
| 11 | 日期载体正则 `CARRIER` | `src/core/dates.ts` | system 日期归一化（擦除隐写信标） | 日期隐写残留 → 被识别为代理 |

### 2.3 头层生成规则（`src/core/transform.ts:72-90`）

- `:72` 先删除 `anthropic-dangerous-direct-browser-access`，`:85` 再按 profile 重设 → 保证不会残留多余值。
- `:75` `user-agent`：`claude-cli/<version> (external, <entrypoint>)`
- `:85` `anthropic-dangerous-direct-browser-access: true`（当 `headers.dangerouslyAllowBrowser`）
- `:86` `x-stainless-timeout`（仅当 `headers.timeoutSeconds` 有值；source 分支不设）
- `:87` `x-stainless-lang: js` + `x-stainless-package-version: <sdkVersion>`
- `:88` `x-stainless-os` / `x-stainless-arch`
- `:89` `x-stainless-runtime: node` / `x-stainless-runtime-version: <runtimeVersion>`
- `:90` `x-stainless-retry-count: 0`
- `X-Stainless-Helper-Method` 不发送（真实客户端不发送）。

### 2.4 体层结构（`claudeBody()`）

1. `system[0]` — 计费归因块：`x-anthropic-billing-header: cc_version=<version>.<suffix>; cc_entrypoint=<entrypoint>; cch=00000;`
   - suffix = `sha256(salt + 首条 user 首个 text block 的 UTF-16 code unit [4,7,20] + version).slice(0,3)`，缺失字符以 `'0'` 代替（`src/core/billing.ts`）
2. `system[1]` — 身份语：`You are Claude Code, Anthropic's official CLI for Claude.`
3. `cache_control` — source 分支 `{type:'ephemeral'}` 无显式 ttl，最多 2 个断点，billing 块不参与；兼容分支 `{type:'ephemeral',ttl:'1h'}` 最多 4 个断点。
4. `metadata.user_id` — `user_DEVICE_account_ACCOUNT_session_SESSION`，account 段不得缺失。

### 2.5 兼容 profile 的独立常量（`src/core/profiles.ts:80-99`）

| 常量 | 值 | 位置 |
| --- | --- | --- |
| `runtimeVersion` | `v22.16.0` | `:83` |
| `os` / `arch` | `Windows` / `x64` | `:83` |
| `maxTokens` | `4096` | `:83` |
| `beta`（fixed） | `claude-code-20250219`, `context-management-2025-06-27`, `prompt-caching-scope-2026-01-05` | `:84` |
| `accountPolicy` | `context-uuid` | `:85` |
| `cache` | `{type:'ephemeral',ttl:'1h',maxBreakpoints:4,placement:'compatibility-system'}` | `:86` |
| `sessionRequestIds` | `true` | `:87` |

两个 Claude profile **共享**同一 `version / sdkVersion / identity / billing / entrypoint`，因此升级 2.1.63 → 新版本时两者一起改。

---

## 3. Codex CLI 0.107.0

### 3.1 版本与身份常量

| # | 常量 | 位置 | 作用 |
| --- | --- | --- | --- |
| 1 | `version: '0.107.0'` | `src/core/profiles.ts:101` | UA 版本段 |
| 2 | `originator: 'codex_cli_rs'` | `src/core/profiles.ts:103` | `originator` 头 + UA 前缀 |
| 3 | `instructions: CODEX_UPSTREAM_INSTRUCTIONS` | `src/core/profiles.ts:103` | 请求体 `instructions` 全文模板 |
| 4 | `os / osVersion / arch / terminal` | `src/core/profiles.ts:104` | UA 的 `(OS osVersion; arch) terminal` 段 |
| 5 | `CODEX_PROMPT_SHA256` | `src/core/codex-prompt.ts` | 模板完整性校验（被 `core.test.ts:31` 断言） |
| 6 | 模板正文 | `src/core/codex-prompt.ts` / `profiles/codex-0.107.0.prompt.md` | 与 SHA 必须同时改 |
| 7 | `betaFeatures: 'remote_compaction_v2'` | `src/core/profiles.ts:104` | `x-codex-beta-features` 头值；relay 判定“官方 Codex”的关键头之一（见 3.4） |

**UA 形态**：`originator/<version> (OS osVersion; arch) terminal` — OS/arch/terminal 是 fixture 值（`Windows` / `10.0.26100` / `x86_64` / `unknown`），不是抓包观测值。

### 3.2 体层结构（`codexBody()`）

- `request.body.instructions` = 完整 20K 级公开模板，**每次请求**都发送（`sendEveryRequest: true`），不依赖会话缓存。
- 原始 `instructions` 与内部 `base_instructions` 降级为 developer input，`base_instructions` **永不**作为 Responses 不支持的字段发出。
- `request.body.input[]` 保留用户/开发者消息；`request.body.metadata` 保留原有键，仅在缺失时补 `session_id` / `source` / `cwd`。
- 现有 `metadata` 键全部保留。

### 3.3 证据锚点

- 版本 tag `rust-v0.107.0` → commit `19f8797c0f62abecb347e817aac36d18c5fc554e`
- 模板：`codex-rs/core/gpt-5.2-codex_prompt.md`，`1b3dd697043a7f613c691a3721a450251626685b3e97ac3ad3d35ea62758a31e`，7589 UTF-8 字节 / 7563 JS 字符
- 头格式来源：`codex-rs/core/src/default_client.rs`

### 3.4 真实 Codex 0.169 抓包与 relay 判别头（2026-11-26 实证）

用本机 `@openai/codex@0.169.0` 对本地抓包端点复现真实请求（body 71667 字节，`/responses`），再把真实头/体复放到千刀公益 relay（`https://api666.zzzcoding.org/responses`）做头消融，结论：

- **relay 的 “Codex official client” 闸门 = 请求中存在任意 `x-codex-*` 头**。`x-codex-beta-features` / `x-codex-window-id` / `x-codex-turn-metadata` 任一即可返回 200；全缺失则 403 `This account only allows Codex official clients`。`x-openai-*` 头与 `originator` 取值都不是关键。
- 真实 0.169 头：`x-codex-beta-features: remote_compaction_v2`、`x-codex-window-id: <sid>:0`、`x-codex-turn-metadata`(JSON)、`x-openai-internal-codex-responses-lite: true`、`session-id`、`thread-id`、`originator: codex_exec`、UA `codex_exec/0.169.0 (Windows 10.0.28000; x86_64) unknown (codex_exec; 0.169.0)`、`accept: text/event-stream`。
- 真实 0.169 体顶层键：model/stream/input/tool_choice/parallel_tool_calls/reasoning/store/include/prompt_cache_key/text/client_metadata（**无顶层 instructions**，指令内嵌 input）；本插件体（含 7563 字符 instructions）本身即被接受，只缺 `x-codex-*` 头。
- 本插件据此在 `src/core/transform.ts` 的 codex 分支强制写入 `session-id`、`thread-id`、`x-client-request-id`、`x-codex-beta-features`、`x-codex-window-id`。
- 拦截必须 `child.on('llm/stream', handler, { global: true })`（`src/index.ts`）：LlmRuntime 位于 host context，context-local 监听不会触发。

---

## 4. 跨客户端共享契约（改一端需复检另一端）

| 契约 | 位置 |
| --- | --- |
| 端点协议探测（`/chat/completions`、`/responses`、`/messages`） | `src/host/transport.ts` |
| 身份头白名单 `IDENTITY_HEADER` | `src/core/overrides.ts:5`、`src/host/config.ts:16`、`src/client/model.ts:41`（三处必须一致） |
| 私有头拒绝 `PRIVATE_HEADER`（auth/token/cookie/account/device） | `src/core/overrides.ts` |
| 监听可见头白名单 `visibleHeaders` | `src/host/listener.ts:5` |
| `none` 短路（不读 getter、不改引用） | `src/core/transform.ts`、`src/index.ts` |
| 工具名 `proxy_` 前缀结构化剥离与反向映射 | `src/core/tools.ts` |

---

## 5. 升级流程（照做即可）

1. **取证据**：新版本 npm tarball / GitHub tag 的 `cli.js` 或 `default_client.rs`；记录 SHA256 与字节数。
2. **改档案**：只改 `src/core/profiles.ts` 对应 profile 的常量块；Codex 同时更新 `src/core/codex-prompt.ts` 与 `profiles/codex-*.prompt.md`。
3. **同步证据 JSON**：`profiles/claude-code-*.json` / `profiles/codex-cli-*.json` 中的 `evidence` 与 `reference` 字段。
4. **校准计费后缀**：若 salt / sampleIndices / suffixLength 变化，改 `profiles.ts:60` 并补 golden vector 到 `test/core.test.ts`。
5. **跑测试**：`pnpm run typecheck && pnpm test`；`core.test.ts:34` / `:182` 会拦住头体版本漂移。
6. **抓包对比**：按 `VERIFICATION.md` 的手工流程，把插件输出与真实客户端输出 diff。
7. **更新本文件**：改第 1 节的版本表与对应常量行号。

---

## 6. 已知未验证（不得宣称）

- Claude 侧最终 `cch` 传输层重写/哈希引擎与种子（本实现只发构造期占位 `cch=00000`）
- 原生二进制 TLS/HTTP 指纹
- 官方运行时默认分支的实际观测（隔离启动在发出任何 `/v1/messages` 前 `spawn EPERM`，观测到 0 条消息）
- 上游公益站/网关是否接受
- Codex 完整客户端抓包，以及当前 model-router 是否选中这个 model-specific 模板
- 兼容 profile 的 runtime/beta/header/cache 组合在真实抓包中的一致性

`captureVerified` 全为 `false`：这些目标按**公开源码**对齐，不是抓包验证过的完整客户端。

## 客户端半侧必须声明 cordis `inject = ["slots"]`（冷启动入口消失的真正原因）

浏览器的插件模块不是"普通 JS 模块"，而是由 cordis 装载的插件对象，装载器取 `entry.default || entry`，
只认它导出的 `{ name, inject, apply }`。**`apply` 里读 `ctx.slots` 时，`slots` 必须在 `inject` 里声明**，
否则 cordis 在属性代理上直接抛：

```
Error: cannot get property "slots" without inject
    at apply (client.js)
```

后果是插件 fiber 永远停在 `loading`，DSH 前端只打一条 warning：

```
web boot: warning: 1 entry did not activate
  dsh-provider-client-simulator: loading
```

—— 左栏没有任何入口，而且**不报红色崩溃、不写日志**，所以此前一直误判成"宿主没加载"。

已对齐的写法（与 `dshmarket/client/client.js:25690` 同形）：

```ts
export const name = PLUGIN_NAME;
export const inject = ['slots'];          // 必须：cordis 服务依赖
export function apply(ctx: ClientContext): void { registerClientUi(ctx, {...}); }
export default { name, inject, apply };   // 装载器取 default，inject 必须在这个对象里
```

配套两条纪律（都已落实）：

1. `package.json` 的 `dsh.client.inject` 只能用**本版本真实存在**的包名。本 DSH 版本没有
   `@deepseek-ai/dsh-client-ui-slots`（asar 内 413 个包名逐条核对过），写它会让客户端 bundle
   在冷启动时因为"依赖永不满足"而不物化 → 改成 `[]`。
2. 客户端 bundle 走 `dsh.client` 声明 + `exports["./client"]`；宿主侧拦截只依赖 `main`，
   两者互不影响 —— 所以"宿主 API 有响应"不能证明"客户端入口已注册"。

## 面板与版本号（0.1.3 起）

面板不展示 profile / 模型覆盖 / 高级覆盖等字段，客户端指纹一律使用该 client 的内置 profile（`profilesForClient` 的第一项）。版本号来自 `PLUGIN_VERSION`，构建时由 package.json version 注入，展示在标题胶囊与页脚；升级版本只需改 package.json。
