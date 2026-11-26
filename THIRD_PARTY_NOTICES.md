# Third-party notices

## dsh-client-masquerade — design reference

This project uses the publicly reviewed project as a design/reference starting point. The provider-scoped engine, configuration, browser panel and response bridge were implemented in this project; the reference installation-patch programs are not included or executed.

- Project: https://github.com/ymh0000123/dsh-client-masquerade
- Reviewed commit: b7e01f6fa148772635df90660add9d34f97e785f
- Original copyright: Copyright (c) 2026 ymh0000123
- Original licence: MIT

The following original notice is retained for attribution:

> Copyright (c) 2026 ymh0000123
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## OpenAI Codex — pinned prompt

The complete model-specific prompt in [codex-0.107.0.prompt.md](<profiles/codex-0.107.0.prompt.md>) and its generated TypeScript constant come from the OpenAI Codex project:

- Project: https://github.com/openai/codex
- Commit: 19f8797c0f62abecb347e817aac36d18c5fc554e
- Source: https://raw.githubusercontent.com/openai/codex/19f8797c0f62abecb347e817aac36d18c5fc554e/codex-rs/core/gpt-5.2-codex_prompt.md
- SHA-256: 1b3dd697043a7f613c691a3721a450251626685b3e97ac3ad3d35ea62758a31e
- Licence: Apache-2.0. The upstream licence and copyright notice are retained alongside this document.

The pinned model prompt is unchanged. The embedding as a TypeScript string and the wire integration are local packaging changes; this does not imply that the model router of every Codex build selects this prompt for every model.

## Claude Code — source calibration only

Official npm @anthropic-ai/claude-code@2.1.63 was inspected in an isolated evidence directory. Claude Code executables, native modules, the complete CLI bundle and npm dependency tree are excluded from the deliverables. Only public attribution, limited technical observations, hashes and independently implemented protocol constructors are retained.

Source registry: https://registry.npmjs.org/@anthropic-ai%2Fclaude-code/2.1.63

No claim of affiliation with or endorsement by OpenAI, Anthropic or DeepSeek is made.

## Runtime/build dependencies

The package declares fixed versions of @deepseek-ai/schemastery (3.19.0) and @deepseek-ai/cosmokit (1.9.0). Development uses TypeScript 5.9.3 and @types/node / @types/react. These packages are resolved by the package manager under their own published licences; their dependency trees are not copied into the source ZIP. React is provided by DSH's browser host.
