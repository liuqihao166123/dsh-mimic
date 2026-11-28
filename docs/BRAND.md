# DSH Mimic 品牌资源

DSH Mimic 的标志以原创几何字母 **M** 表达「同一路径，切换身份」。Teal 主轨从左侧入口经过中央折点，深蓝目标轨在右侧承接并到达出口；两个颜色共用连续的中心线，表示身份交接。图形独立绘制，未使用 Claude、Codex 或 DSH 的现成标志。

![DSH Mimic 彩色标志](../assets/logo.svg)

## 资源

| 资源 | 用途 |
| --- | --- |
| [logo.svg](../assets/logo.svg) | 64×64 彩色方形图标；浅 teal 圆角底，适合插件元信息和面板标题。 |
| [logo-monochrome.svg](../assets/logo-monochrome.svg) | 无底 `currentColor` 单色标志；适合侧栏、紧凑按钮和深浅主题。 |
| [brand.ts](../src/client/brand.ts) | 导出 `LOGO_DATA_URI` 与 `MONO_LOGO_DATA_URI` 两个字符串；UTF-8 SVG 经 `encodeURIComponent` 编码，无资源请求、DOM 或 Node 依赖。 |

图形已能与宿主现有标题文字组合，暂不另附字标，以保留宿主字体和排版的一致性。SVG 与 TypeScript 中的内嵌版本应同步更新。

## 几何与颜色

- 画布为 `viewBox="0 0 32 32"`，主轨为 `M6 26V6L16 18L21 12`，目标轨为 `M21 12L26 6V26`。
- 两轨均用 `4` 单位实线、圆端和圆角；图形包围盒为 `(4,4)` 到 `(28,28)`，留白对称。
- 缩至 **16×16** 时线宽为 **2px**，两侧纵轨的边缘落在整数像素上；没有微小文字、装饰点或细线。最小推荐显示尺寸为 16px。
- 彩色底板圆角为 `8` 单位。单色版移除底板，保留完全相同的两条路径。

| 颜色 | 值 | 角色 |
| --- | --- | --- |
| Teal | `#0D9488` | 主路径，品牌主色。 |
| 深蓝 | `#17324D` | 右上转折与目标出口，表达交接。 |
| 浅 teal | `#E8F6F3` | 彩色方形底板，为深蓝细节提供稳定的明亮背景。 |
| 继承文字色 | `currentColor` | 单色版全部可见路径；由使用位置的宿主主题决定。 |

## 接入

彩色资源可直接用于图片元素；旁边已有文字名称时，将图片视为装饰元素。独立使用时提供 `alt="DSH Mimic"`。

```ts
import { LOGO_DATA_URI, MONO_LOGO_DATA_URI } from './brand.js';

const headerImage = { src: LOGO_DATA_URI, width: 32, height: 32, alt: 'DSH Mimic' };
```

`<img>` 内的 SVG 是独立文档，其 `currentColor` 不继承图片父元素的 `color`。侧栏应把单色 URI 用作 **CSS mask**，并由 `backgroundColor: 'currentColor'` 继承宿主的文字色。以下样式适用于 React；图标旁已有标题时给承载元素设置 `aria-hidden`。

```ts
const sidebarMarkStyle = {
  display: 'inline-block',
  width: 16,
  height: 16,
  flexShrink: 0,
  backgroundColor: 'currentColor',
  maskImage: `url("${MONO_LOGO_DATA_URI}")`,
  maskPosition: 'center',
  maskSize: 'contain',
  maskRepeat: 'no-repeat',
  WebkitMaskImage: `url("${MONO_LOGO_DATA_URI}")`,
  WebkitMaskPosition: 'center',
  WebkitMaskSize: 'contain',
  WebkitMaskRepeat: 'no-repeat',
};
```

另一种接入方式是直接内联单色 SVG，由外层文字色控制路径。保留正方形比例；默认留白已包含在画布内，无需额外描边或阴影。

## 交付约束与核对

资源采用纯 SVG 几何，无外链、嵌入图片、字体、脚本、滤镜或第三方图形素材。彩色版只使用表中三种固定色；单色版只有 `currentColor` 可见路径。检查应覆盖 XML 解析、两条路径的一致性、URI 解码后与 SVG 文件逐字相同，以及 16px 尺寸下的线宽与对齐。无需浏览器即可完成这些资源核对。

本次交付已通过 SVG XML 与元素白名单检查、双路径几何一致性检查、`currentColor` 检查、品牌模块独立 TypeScript `--noEmit` 检查和两个 URI 的解码核对。逐字比较前统一使用 LF 换行：JavaScript 模板字符串会把 Windows 的 CRLF 归一为 LF；此差异不影响 SVG 内容。彩色与单色 URI 长度分别为 654、559 字符。
