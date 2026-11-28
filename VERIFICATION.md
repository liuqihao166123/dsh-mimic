# VERIFICATION.md — 验证与验收

本文件说明**如何证明插件真的在伪装**，以及当前仓库自带的自动化覆盖到了什么程度。

---

## 1. 一键自动化验证

```bash
pnpm run typecheck     # tsc --noEmit
pnpm run build         # 生成 dist/（宿主 ESM + 浏览器 ModuleLoader bundle）
pnpm test              # 构建 + 5 个测试文件
pnpm run test:runtime  # 真实抽取的 Cordis / LlmRuntime 兼容性
pnpm run pack          # 生成 release/*.tgz
```

### 当前基线（2026-11-25，node v24.22.0 / pnpm 11.28.9）

| 检查 | 结果 |
| --- | --- |
| `pnpm run typecheck` | 通过，无错误 |
| `pnpm run build` | `Built host ESM and browser ModuleLoader bundle (5 local modules).` |
| `pnpm test` | **179 / 179 通过**，0 失败，约 484ms |
| `pnpm run test:runtime` | **9 / 9 通过**，用实际抽取的 Cordis 4.1.0 与 LlmRuntime 0.2.2-rc.5 跑通挂载 |

复现命令必须包含构建步骤：`pnpm test` 自带 `node scripts/build.mjs`，直接 `node --test build/...` 会用到过期产物。

---

## 2. 测试矩阵

| 文件 | 覆盖 |
| --- | --- |
| `test/core.test.ts` | 档案固定、Codex 模板 SHA256 与字节数、版本一致性、`none`/模型不匹配零副作用、Claude 头体完整结构、metadata 保留、日期归一化、cache 断点上限、工具名结构化剥离与冲突、三协议互转、Codex 模板注入、跨协议图片/PDF、错误路径、extraHeaders 断言、SOURCE 与兼容 profile 分支差异 |
| `test/host.test.ts` | 配置与 revision 冲突、provider 发现、协议路由、作用域短路、原子变换、async generator 作用域、transport lease 引用计数、监听脱敏、RPC HTTP 端点、**本地捕获端点端到端** |
| `test/client.test.ts` | 设置面板槽位注册、供应商选择、模型 ID 解析、脱敏投影、脏状态与草稿、RPC 同源与修订、监听投影脱敏 |
| `test/response.test.ts` | 三协议 JSON / SSE 回译、并行工具分片、usage/stop/cache、UTF-8/CRLF/EOF、取消传播、事件大小上限、终态快照预算 |
| `test/bundle.test.ts` | 编译产物能被 ModuleLoader 加载、默认 apply 注册、无槽位时不伪造 DOM |
| `test/listener-privacy.test.mjs` | 监听日志不改变出站请求、id 本地化、同一脱敏常量 |
| `test/runtime.test.ts` | 真实 Cordis / LlmRuntime 兼容性 |

---

## 3. 契约测试：未配置供应商零影响

验收口径是**逐字节一致**，不是"看起来没变"：

| 断言 | 位置 |
| --- | --- |
| `none` 不读取会抛错的 body/header getter | `test/core.test.ts:41`、`:210` |
| `none` 保持 wire 引用、URL、method、body/header 完整字节 | `test/core.test.ts:45` |
| 模型不匹配同样不触发 getter | `test/core.test.ts:49` |
| 活动供应商变换后，其他供应商仍为 `none` 不变 | `test/core.test.ts:287` |
| 作用域外与 `none` 调用原样透传，不触碰 getter | `test/host.test.ts:122` |
| 已启用但非生成端点 / base 不匹配时，不读 body 与头 | `test/host.test.ts:132` |

实现依据：`src/core/transform.ts` 在 `none` / 模型不匹配时按 descriptor 复制，不读 getter、不替换引用（`transformRequest` 返回 `changed: false`）。

---

## 4. 集成测试：本地捕获端点

`test/host.test.ts:231` — `local capture endpoint verifies Claude, Codex, and byte-identical native provider requests`：
起一个本地 HTTP 捕获端点作为上游，挂载真实 transport，发出三类请求，逐项核对收到的头与体（Claude 伪装 / Codex 伪装 / 原生供应商字节一致）。

`test/host.test.ts:250` — `local HTTP capture validates the source-default CLI layout separately from the compatibility profile`：
把 source 默认 CLI 布局与兼容 profile 分开验证，确保两个分支不会互相污染。

---

## 5. 手工端到端验收

### 5.1 起捕获端点

```js
// capture.mjs — 打印上游实际收到的头与体
import { createServer } from 'node:http';
createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    console.log('URL   ', req.method, req.url);
    console.log('HEADER', JSON.stringify(req.headers, null, 2));
    console.log('BODY  ', body.slice(0, 4000));
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
}).listen(8899, () => console.log('capture on :8899'));
```

### 5.2 挂载插件

用 `--patch` 覆盖层挂载本工程（`scripts/install-dev.sh` 有参考），或用 `pnpm run pack` 产出的 tarball 安装。

### 5.3 配三个供应商

在插件设置里给三个供应商分别选：`claude-code`、`codex`、`none`，base URL 全部指向 `http://127.0.0.1:8899`。然后在原对话框依次选这三个供应商的模型各发一条消息。

### 5.4 逐项核对

**伪装为 Claude Code：**

- [ ] `user-agent` = `claude-cli/2.1.63 (external, cli)`（是 `cli`，不是 `sdk-cli`）
- [ ] `x-stainless-runtime` = `node`，`x-stainless-runtime-version` 与 UA 声明的 runtime 一致
- [ ] `x-stainless-lang` = `js`，`x-stainless-package-version` = `0.74.0`
- [ ] `x-stainless-os` / `x-stainless-arch` 与 profile 一致
- [ ] `x-stainless-retry-count` = `0`
- [ ] `anthropic-beta` 与目标版本 beta 列表一致
- [ ] **不存在** `x-stainless-helper-method`
- [ ] `body.system[0]` 含 `x-anthropic-billing-header: cc_version=2.1.63.<3hex>; cc_entrypoint=cli; cch=00000;`
- [ ] `body.system[1]` = `You are Claude Code, Anthropic's official CLI for Claude.`
- [ ] 每个 system block 的 `cache_control.ttl` 符合所选分支（source 无 ttl / 兼容 `"1h"`）
- [ ] `body.metadata.user_id` 形如 `user_<hex>_account_<uuid>_session_<uuid>`，account 段存在
- [ ] 工具名无 `proxy_` 前缀

**伪装为 Codex：**

- [ ] `originator` = `codex_cli_rs`
- [ ] `user-agent` 以 `codex` 形态匹配 `originator/0.107.0 (Windows 10.0.26100; x86_64) unknown`
- [ ] `body.instructions` 存在且长度与模板一致（约 7.5K 字符）
- [ ] `body.instructions` 每次请求都携带（无会话缓存依赖）
- [ ] `body.base_instructions` **不出现**（已降级为 developer input）
- [ ] `body.metadata` 原有键保留，缺失时才补 `session_id` / `source` / `cwd`

**未配置供应商（`none`）：**

- [ ] 请求与未安装插件时**逐字节一致**（头顺序、头值、body 字节全同）

### 5.5 与真实客户端 diff

条件允许时，用真实 Claude Code / Codex 客户端对同一捕获端点各发一次，把插件输出与真实输出做 diff —— 而不是只对着文档字段表打勾。这是唯一能证明"整包形态一致"的方式。

---

## 6. 必检失败路径

| 场景 | 期望 |
| --- | --- |
| 畸形 JSON body | 不部分转发，整体失败（`host.test.ts:141`） |
| 工具名冲突 | 变更前失败，原 body/头不动（`core.test.ts:86`） |
| 有状态 Responses / 不透明推理 | 显式 `ProtocolConversionError`，不丢历史（`core.test.ts:109`） |
| 非可移植 file_id | 显式错误（`core.test.ts:143`） |
| 版本漂移 | 原子失败（`core.test.ts:182`） |
| 私有 extraHeader | 拒绝且不回显值（`core.test.ts:191`） |
| revision 冲突 | 409，保留当前配置（`host.test.ts:79`） |
| 跨站 / 超限 RPC | 拒绝且不泄露宿主异常（`host.test.ts:213`） |

---

## 7. 未验证项（验收时不得计入通过）

- 最终 `cch` 传输层重写/哈希：本实现只发构造期占位 `cch=00000`，未宣称最终值。
- 原生二进制 TLS/HTTP 指纹未测量。
- 官方客户端隔离启动在发出请求前 `spawn EPERM`，观测到 0 条 `/v1/messages` —— 所以 `captureVerified` 全为 `false`。
- 上游网关是否接受未验证。
- Codex 端无完整客户端抓包；OS/terminal 为 fixture 值。

这些限制与 `FINGERPRINT.md` 第 6 节、`profiles/*.json` 的 `evidence.notVerified` 保持一致。
## Client UI 槽位（左侧栏入口）
- 客户端现在注册三类槽位（见 src/client/slots.ts 的 registerClientUi）：settings.section（id=PANEL_ID，order 40，落在设置页）、main（key=PANEL_ID，主区面板）、sidebar.panellist（id=PANEL_ID，order 30，左侧栏图标行 + label）。旧版只有 settings.section，所以左侧栏看不到入口。
- 契约测试：test/client.test.ts 断言注入顺序 ['settings.section','main','sidebar.panellist'] 及描述符（settings id=PANEL_ID/order40；main key=PANEL_ID；sidebar id=PANEL_ID/order30）；test/bundle.test.ts 断言三条 registration、清理函数、以及 render 元素（ProviderClientPanel×2、SidebarIcon，props.size===16）。
- 运行态验证：DSH 桌面左侧栏出现「供应商客户端模拟」项，点击后主区正常渲染面板（已识别 7 个供应商、出站接入已就绪）。HMR 现场生效，无需重启。

## 冷启动入口消失：根因与验证（2026-11-26）

现象：运行期改文件后左栏能出现「供应商客户端模拟」，但每次完全重启后入口消失，宿主 API 正常。

排查路径（可在 DevTools Console 复现，`ctrl+shift+i` 打开，需先输入 `allow pasting`）：

1. `JSON.stringify((__DSH_BOOT__.entries||[]).filter(e=>/provider/.test(e.id)))`
   → 条目在 boot graph 里（说明宿主组合正常、包解析正常）。
2. `document.querySelectorAll('style[data-plugin]')` / 左栏无 row，且控制台只有一条
   `web boot: warning: 1 entry did not activate — dsh-provider-client-simulator: loading`。
3. 在 bundle 尾部包一层 `apply` 探针后重载，得到真实异常：
   `[pcs] apply threw Error: cannot get property "slots" without inject`。

结论：客户端插件没有声明 cordis 服务依赖 `inject = ['slots']`。cordis 的 Context 属性代理
对未声明的服务读取直接抛错 → fiber 停在 `loading` → 三个 slot 一个都没注册 → 左栏无入口。
运行期之所以"看得见"，是因为 HMR 走 `rebuilt()` 旁路，且旧包里带 50ms×120 次的重试逻辑
偶尔能在别的时机注册成功；冷启动必然是 apply 抛错。

修复（`src/client/index.ts` 与 `src/client/slots.ts`）：

- 导出 `inject = ['slots']`，并放进 `export default { name, inject, apply }`；
- 去掉自旋重试：服务就绪由 cordis 的 inject 保证，拿不到 slots 说明该外壳没有插槽服务，保持惰性即可；
- `package.json` 的 `dsh.client.inject` 保持 `[]`（不引用不存在的 `dsh-client-ui-slots`）。

验证状态：

| 项 | 结果 |
| --- | --- |
| `pnpm run typecheck` | 通过 |
| `pnpm run test`（主套件 180 用例） | 180/180 |
| `pnpm run test:runtime` | 9/9 |
| 契约测试断言 `inject === ['slots']` | `test/bundle.test.ts` 已加 |
| 运行期（HMR 重载新 dist 后） | 左栏出现「供应商客户端模拟」，点击后主区渲染面板（已配置供应商 7 / 出站接入 已就绪） |
| 冷启动 | 需要在安装后完全退出 DSH 再打开一次确认（本机 HMR 已能复现修复效果，冷启动路径等价） |

注意：`location.reload()` 不能用来自测——DSH 的 `dsh-app://app/` 文档会被缓存，
重载后 HTML 里仍是旧 `rev`，bundle URL 会 404（`net::ERR_ABORTED`），看起来像修没生效。
真正的冷启动才会重新生成带新 `rev` 的文档。

## 2026-11-26 极简单供应商面板（0.1.3）

- 面板只保留三块：标题（含版本胶囊 `v<package.json version>`）、`当前模拟` 一条（显示「供应商 + 客户端 · profile」）、`模拟设置`（1 选择供应商 → 2 选择模拟客户端 → 保存）。
- 出站请求监听收进 `<details>` 折叠区（调试用），页脚显示 `v<版本> · 已连接 N 个供应商 · 出站接入 就绪/未就绪 · 最近读取 <时间>`。
- 单供应商不变量：`src/host/config.ts` 在 `saveProvider` 保存非 `none` 规则时把其它供应商全部重置为 `{ client: 'none' }`；`normalizeConfig` 加载时只保留第一个非 `none` 供应商，其余归零 —— 因此任何时刻最多一个供应商在模拟。
- 保存即生效：没有草稿概念，面板只区分「未保存 / 已生效」；点「保存」直接写 settings 文档并立即作用于 `llm/stream`。测试：`test/host.test.ts` 的 `saving a simulating rule resets every other supplier to passthrough`、`loading a config with several simulating suppliers keeps only the first`。
- 版本号单一来源：`src/types.ts` 的 `PLUGIN_VERSION = '__PLUGIN_VERSION__'` 由 `scripts/build.mjs` 用 package.json 的 version 替换（build/src 与 dist 两处都替换）；`test/client.test.ts` 断言其与 package.json 一致。

## 0.3.0 — 按供应商并发上限（2026-11-28）

- 配置项：ProviderRule.concurrency?: number（0 / 缺省 = 不限制，范围 0–64）。校验错误码 INVALID_CONCURRENCY（"并发上限应为 0-64 的整数（0 表示不限制）。"）。
- 生效点：宿主 llm/stream 瀑布处理器，按 equest.provider 计数；src/host/limiter.ts 的 ProviderLimiter.wrap() 在流首次被拉取（首个 
ext()）时才申请槽位，因此排队中的请求不占用上游连接；limit <= 0 时直接 actory()，零开销、不建立任何状态。
- 释放：迭代器 done / throw / return 均释放槽位；释放时把槽位直接移交队首 waiter（active 不会超过 limit）。
- 单供应商不变量兼容：被重置为 { client: 'none' } 的其他供应商会保留自己的 concurrency。
- 面板：3 并发上限 数字输入 + 实时 ctive / limit、排队数；顶部「当前模拟」胶囊追加 · 并发 N。
- 观测：RuntimeState.concurrency 暴露 { providerId, limit, active, queued }[]（仅列出 concurrency > 0 的供应商）。
- 测试：	est/host.test.ts 新增范围校验/重置保留、排队放行两个用例；	est/client.test.ts 新增 draft 往返用例。合计 186 个主套件用例 + 10 个 runtime 用例全部通过。

## 0.3.1 — 并发超限处理可选「直接拒绝」

- 新增 ProviderRule.concurrencyMode?: 'queue' | 'reject'（缺省 queue）。校验错误码 INVALID_CONCURRENCY_MODE。
- src/host/limiter.ts：新增 ConcurrencyLimitError（code = 'CONCURRENCY_LIMIT'，message「该供应商并发上限为 N，当前请求已满，请等当前请求结束后再试。」）；cquire(providerId, limit, mode) 在 mode === 'reject' 且已满时立即抛错，不进入队列；wrap(providerId, limit, mode, factory) 同步透传。
- 适用场景：会话里并行派生子代理时，每个子代理各占一个在途生成槽位；设为 reject 后，超过上限的子代理请求直接失败，而不是静默等待。
- 面板：「3 并发上限」下新增「超出上限时」下拉（排队等待 / 直接拒绝）。
- 测试：	est/host.test.ts 新增 reject 立即失败用例；	est/client.test.ts 新增 mode 往返用例。主套件 188 / runtime 10 全绿。
