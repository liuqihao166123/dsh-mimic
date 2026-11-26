# DSH 供应商客户端模拟插件

给 DeepSeek Harness（DSH）加一个左侧栏面板：选中一个**已配置供应商**、选一个要模拟的客户端（**Claude Code / Codex / None**），点保存即生效。之后在原对话框里用该供应商的模型发消息，插件会在出站请求上同时改写**请求头**和**请求体**指纹。

- **一次只模拟一个供应商**：保存新的供应商时，原来那个自动恢复为不模拟。
- **不改官方配置**：插件用自己的设置命名空间，不写 `llm-pi-ai` 等官方适配器的内部配置。
- **官方供应商不列**：`llm-deepseek*` 适配器（DeepSeek 官方 / 官方账号）本身不需要伪装，面板里不显示。
- **保存即生效，没有草稿**：面板只区分「未保存 / 已生效」。

## 安装

环境：Node.js **22.17.0+**。本工程验证于 DSH LLM/settings/webServer `0.2.2-rc.5`、Cordis `4.1.0`。

### 方式一：安装打包好的 tgz（推荐）

从 [Releases](https://github.com/liuqihao166123/dsh-provider-client-simulator/releases/latest) 下载 `dsh-provider-client-simulator-0.1.5.tgz`，打开 DSH **插件 → 添加插件 → 安装现有插件**，包来源填 tgz 的**完整绝对路径**：

```text
<下载目录>/dsh-provider-client-simulator-0.1.5.tgz
```

装好后到左侧栏点「供应商客户端模拟」即可。若宿主提示需要重启，重启**正在使用的那个 DSH 实例**（另开一个服务器不会更新原有 GUI）。

### 方式二：从源码构建

```bash
pnpm install --ignore-scripts
pnpm run typecheck
pnpm test
pnpm run build
pnpm pack --pack-destination ./release
```

运行时依赖只有 `schemastery 3.19.0` 与 `cosmokit 1.9.0`。

## 使用

1. 在 DSH 原有「模型 / 供应商」设置里配置好供应商与模型。
2. 打开左侧栏「供应商客户端模拟」，`1 选择供应商` 选中目标供应商（列表只含第三方、已配置的供应商）。
3. `2 选择模拟客户端` 选 `Claude Code` 或 `Codex`；需要原样请求就选 `None`。
4. 点「保存」。顶部「当前模拟」会显示「供应商 · 客户端」，页脚显示版本号和已连接供应商数量。

## 模拟内容

- **Claude Code**：`User-Agent`（`claude-cli/<version> (external, cli)`）、`X-Stainless-*`、`Anthropic-Beta`、`X-App`、会话/请求标识；请求体 `system[0]` 计费归因块、`system[1]` 客户端标识、`cache_control` 断点、`metadata.user_id`（`user_<hex>_account_<uuid>_session_<uuid>`），以及结构性工具名映射。版本、Stainless runtime 版本、计费块 `cc_version` 必须同版本，任一漂移都会被网关识别。
- **Codex**：`originator` / `User-Agent`（`codex_*`）、`session-id` / `thread-id` / `x-client-request-id` / `x-codex-beta-features` / `x-codex-window-id` 等头，以及 `instructions`（约 20K 字符的系统提示词，每次请求都带、可整体替换）。
- **日期隐写擦除**：真实 Claude Code 在非官方 base URL 下会把日期信息以隐写方式嵌入 system prompt，作为「是否经过代理」的信标，插件会对这段日期载体做归一化。
- **None / 未配置供应商**：不读也不改 body/headers，不转换协议，原始 `fetch` 参数保持逐字节一致。

版本、证据等级（源码证据 / 兼容档案 / 实机抓包）见 [FINGERPRINT.md](FINGERPRINT.md)，测试矩阵与核对清单见 [VERIFICATION.md](VERIFICATION.md)。

## 为什么换协议也能在原聊天界面用

宿主在 `llm/stream` waterfall 里给出真实 provider/model/sessionId；插件用请求级 `AsyncLocalStorage` 绑定工厂创建与异步迭代（`next`/`return`/`throw`），在出站 `fetch` 上做头体变换，因此并发供应商、嵌套 None 请求不会串味。

原适配器的响应解析仍按原协议进行，插件负责把服务端 JSON/SSE 回译成原协议：文本增量、工具参数分片、用量、停止原因、取消都保留。只在工具定义 / tool choice / 调用与返回等结构位置映射工具名，用户文本和工具结果里的同名字符串不会被全局替换。

支持的原协议：Anthropic Messages、OpenAI Chat Completions、OpenAI Responses。只处理生成 POST 端点；模型发现、上传、OAuth 等外部 `fetch` 直接走原调用。没有无损表达的 hosted tools / 状态引用 / opaque reasoning 会在出站前返回结构化错误，而不是丢字段硬发。

## 出站请求监听

面板底部「出站请求监听」（折叠）可开启进程内有界环形队列：默认 50 条、上限 500。展示供应商、模型、目标协议、白名单技术头、报文结构与状态码；认证值、会话/请求标识、消息文本、元数据、工具参数与结果在生成日志时即脱敏，不保留长度或哈希。默认关闭，不写磁盘。

## 工程结构

```text
src/index.ts             宿主生命周期、依赖注入、独立配置命名空间
src/core/                档案常量、日期归一化、工具映射、三协议请求转换
src/host/                配置/RPC、供应商发现、传输隔离、SSE/JSON 回译、监听
src/client/              侧边栏图标 + React 面板 + 纯状态模型（无宿主依赖）
profiles/                版本档案与来源摘要
scripts/build.mjs        TypeScript 编译 + 浏览器 ModuleLoader 单文件 bundle
cordis.patch.yml         可安装 bundle 的标准挂载配置
test/                    契约 / 集成 / 响应回译 / 真实 Cordis 运行时测试
```

## 测试

```bash
pnpm test          # 离线契约与集成测试（183 项）
pnpm run test:runtime  # 真实提取的 Cordis/DSH LLM 运行时兼容套件（10 项）
```

`test:runtime` 需要已提取的 DSH 运行目录，可用 `DSH_RUNTIME_MODULE_ROOT` 指定；它使用真实 Cordis/LLM 模块和本地响应，不发起真实上游模型调用。

## 常见问题

- **左侧栏没入口**：客户端半侧必须声明 `export const inject = ['slots']`（cordis 在未声明时读取 `ctx.slots` 会抛 `cannot get property "slots" without inject`，fiber 停在 loading，所有 slot 注册被静默丢弃）；确认插件已启用并刷新/重启。
- **供应商列表为空**：先到 DSH 模型设置注册供应商；面板只显示运行时已注册、可配置的第三方供应商。
- **不生效**：核对对话框选的供应商 ID、是否保存、是否选了 None；显示名称不是路由依据。
- **转换报错**：先给该供应商保存 None 恢复原请求，再看面板状态与脱敏监听定位。

停用/卸载会撤销 hook、恢复自有 `fetch` 包装并清空监听；官方供应商配置保持原样。本包无 postinstall，安装期不修改全局配置。

## 说明

本项目用于在自己的 DSH 上调整**出站请求的客户端身份字段**，便于使用只对官方 CLI 开放的第三方网关。上游网关的实际识别规则由其自行决定，本仓库的测试记录不等于任何第三方的验收结论。请只在你有权使用的供应商与账号上使用。

## 许可证

MIT，见 [LICENSE](LICENSE)。Codex 相关提示词模板另附 [LICENSE.codex](LICENSE.codex) 与 [NOTICE.codex](NOTICE.codex)。
