---
name: "StoryForge / 故事熔炉"
description: "本地优先、作者可控，覆盖从世界观到正文的长篇 AI 创作工作台。"
colors:
  primary: "#965A3A"
  primary-hover: "#85492F"
  primary-muted: "#D3A47C"
  primary-soft: "#965A3A1F"
  canvas: "#F4EFE7"
  surface: "#E9E0D4"
  surface-elevated: "#FFFDF8"
  hover: "#362D240D"
  ink: "#2B2620"
  ink-secondary: "#6A5B4B"
  ink-muted: "#9A8A78"
  on-primary: "#FFFFFF"
  border: "#362D2424"
  border-hover: "#362D2442"
  border-subtle: "#362D2412"
  editor-page: "#FFFDF8"
  selection-bg: "#A66A4A38"
  selection-ink: "#1E1711"
  success: "#15803D"
  warning: "#B45309"
  error: "#B91C1C"
  info: "#1D4ED8"
  jade-accent: "#65BFA8"
  slate-accent: "#3F6F96"
  forge-accent: "#D97757"
  scroll-accent: "#7B3A1A"
  paper-accent: "#A04E35"
typography:
  display:
    fontFamily: '"Source Serif 4", "Songti SC", "Noto Serif CJK SC", Georgia, serif'
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.6px"
  headline:
    fontFamily: '"Source Serif 4", "Songti SC", "Noto Serif CJK SC", Georgia, serif'
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.025em"
  title:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  manuscript:
    fontFamily: '"Source Serif 4", "Songti SC", "Noto Serif CJK SC", Georgia, serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 2.2
    letterSpacing: "0.01em"
  body:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  mono:
    fontFamily: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  tight: "6px"
  sm: "8px"
  control-x: "10px"
  md: "12px"
  lg: "16px"
  card: "20px"
  section: "24px"
  manuscript: "32px"
  page: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
    height: "32px"
  input:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  chip-selected:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  work-surface:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "24px 32px"
  manuscript-page:
    backgroundColor: "{colors.editor-page}"
    textColor: "{colors.selection-ink}"
    typography: "{typography.manuscript}"
    rounded: "{rounded.2xl}"
    padding: "32px"
---

# Design System: StoryForge / 故事熔炉

## Overview

**Creative North Star: “作者主导的长篇创作编辑室”**

StoryForge 是服务长篇创作全过程的专业编辑环境，不是只围绕正文排布的码字器。世界观、角色、故事设计、大纲、章节正文和一致性检查都是核心创作对象。用户进入任一工作区后，当前对象必须获得视觉与交互主权；AI 以按需打开的辅助工作面参与，而不是包围或挤压创作对象。

界面同时具有专业工具的结构稳定性、文学创作所需的阅读节奏，以及作者能够理解和撤销 AI 行为的可信感。组件采用“有触感的创作工坊”气质：操作紧凑、状态明确，按下、选择和执行都有即时反馈，但不依赖拟物装饰、夸张阴影或过量动画制造质感。

当前代码包含暖白编辑室、墨玉青、冷灰银蓝、熔炉、古卷、纸与墨六套主题。六主题是现状而非最终决策：暖白编辑室是当前默认基准，其余主题暂作兼容层，后续应通过独立任务评估并收敛。现有响应式行为主要由可折叠侧栏和少量 Tailwind 断点构成，尚不能宣称已经形成完整的桌面窄窗或移动端体系；Tauri 桌面客户端重构必须逐屏验证窗口缩放、键盘操作与文本放大。

本系统明确拒绝黑箱式一键生成、单轮抽卡、只有聊天记录的 ChatGPT 仿制品、包围创作对象的 AI 控制台，以及任何未经预览便覆盖或在失败后丢失作者输入的行为。

**Key Characteristics:**

- 当前创作对象是唯一主舞台。
- 同一时间最多显示一个 AI 辅助工作面。
- 专业结构承载复杂能力，文学排版服务长文本。
- 明度分层优先，阴影仅属于真实浮层。
- 交互有触感，但能力强大而不外露。
- AI 上下文、进度、结果用途和数据去向透明。
- 新功能必须满足 WCAG 2.2 AA，旧界面通过审计逐步补齐。
- 六主题是当前兼容事实，不是继续扩张主题的许可。

## Colors

默认暖白编辑室以窑火陶棕、暖白稿纸和炭墨构成。它不是仿古纸张主题：暖色负责长期使用时的稳定感，清晰的中性色对比负责专业性，陶棕只承担需要用户注意和确认的关键状态。

### Primary

- **窑火陶棕** (`colors.primary`)：主要动作、当前选择、明确焦点和关键 AI 进度。它不是通用装饰色。
- **窑火深棕** (`colors.primary-hover`)：主要动作的悬停与按压反馈。
- **窑火余温** (`colors.primary-muted`, `colors.primary-soft`)：选中背景、轻量提示和非阻断式 AI 状态。

### Neutral

- **暖白底台** (`colors.canvas`)：应用最外层背景。
- **浅陶工作面** (`colors.surface`)：侧栏、工具区域和次级常驻区域。
- **暖白稿纸** (`colors.surface-elevated`, `colors.editor-page`)：当前创作对象和需要最高可读性的内容区域。
- **炭墨** (`colors.ink`)：主要文字和需要持续阅读的内容。
- **焦褐副墨** (`colors.ink-secondary`)：说明、元数据和非主导内容。
- **灰褐注记** (`colors.ink-muted`)：低优先级信息；不得用于必须阅读的正文、占位符或错误说明。
- **细墨边界** (`colors.border`, `colors.border-subtle`, `colors.border-hover`)：结构分隔和交互边界。

### Semantic

- **完成绿** (`colors.success`)：成功、已保存和检查通过，并始终配合文字或图标。
- **提醒棕** (`colors.warning`)：需要作者确认但尚未造成损坏的状态。
- **错误红** (`colors.error`)：失败、冲突和可能丢失内容的风险。
- **说明蓝** (`colors.info`)：中性说明、来源和外部服务信息。

### Theme Compatibility

墨玉青、冷灰银蓝、熔炉、古卷和纸与墨目前分别以 `colors.jade-accent`、`colors.slate-accent`、`colors.forge-accent`、`colors.scroll-accent`、`colors.paper-accent` 为颜色锚点。它们必须复用相同语义角色，不能在组件内硬编码为新的功能颜色。每套主题都必须单独验证正文、占位符、主按钮、选区和状态色对比度；默认主题的白色主按钮文字不能被机械复制到所有替代主题。

**“一屏一强调”规则。** 窑火陶棕只用于当前主动作、选择状态、焦点与关键 AI 进度；同一视区不得让多个彩色动作互相竞争。

**“主题收敛”规则。** 六主题是当前代码事实，不是新增页面可任意扩张的许可；新设计必须以暖白编辑室为基准，其他主题仅做兼容适配，直至通过独立任务收敛。

**“对比度是门槛”规则。** 普通文字至少达到 4.5:1，大号文字至少达到 3:1；占位符、禁用说明和辅助状态不能因“低调”而低于可读标准。

## Typography

**Display Font:** Source Serif 4，中文回退至 Songti SC / Noto Serif CJK SC。  
**Body Font:** Inter，中文回退至系统无衬线字体。  
**Label/Mono Font:** JetBrains Mono 仅用于数字、版本和诊断数据。

衬线字体赋予章节、稿件和长篇资料明确的阅读节奏；无衬线字体负责导航、表单、状态和高频操作。二者以用途区分，而不是把所有页面文学化。等宽字体是数据工具，不是品牌字体。

### Hierarchy

- **Display** (`typography.display`)：首页、项目仪式和极少数最高层标题；不得进入普通卡片。
- **Headline** (`typography.headline`)：章节标题或当前创作对象的最高层标题。
- **Title** (`typography.title`)：工作区标题、面板主标题和重要对象名称。
- **Manuscript** (`typography.manuscript`)：正文和连续长文本；正文段落保留当前首行缩进与段距偏好。
- **Body** (`typography.body`)：说明、属性值、检查结果和常规界面内容。
- **Label** (`typography.label`)：按钮、字段标签和紧凑元数据。使用正常大小写，不把全大写宽字距小眉题扩展为默认层级。
- **Mono** (`typography.mono`)：字数、版本号、Token、时间戳和诊断信息。

长文本容器必须控制在 `65–75ch`。标题允许更短，但字距不得小于 `-0.04em`；`h1–h3` 使用平衡换行，连续长文使用更自然的段落换行。现有正文允许用户通过持久化偏好覆盖字体、字号、行距和段距。

**“两种声音”规则。** 衬线负责作品内容与少量仪式标题，无衬线负责工具交互；禁止在同一层级混用两套相似字体制造虚假层次。

**“创作内容优先”规则。** 正文和其他连续长文本使用 65–75ch 的阅读宽度；结构化设定可以更紧凑，但当前对象名称、内容与操作层级必须清楚。

## Elevation

StoryForge 以背景明度和细边界构造常驻层级：`canvas → surface → surface-elevated`。常驻面板、卡片和编辑器不因“需要高级感”而增加阴影。阴影表示对象真正离开文档流，只允许用于弹窗、菜单、浮动工具条、拖拽对象和需要覆盖其他内容的临时工作面。

### Shadow Vocabulary

- **轻浮层** (`0 1px 3px rgba(54, 45, 36, 0.08)`)：紧凑菜单、提示和轻量拖拽状态。
- **标准浮层** (`0 6px 18px rgba(54, 45, 36, 0.10)`)：浮动工具条、弹出选择器和非模态临时面板。
- **高浮层** (`0 16px 44px rgba(54, 45, 36, 0.14)`)：模态对话框。不得用于普通内容卡片。

阴影必须随主题使用现有 `--shadow-sm/md/lg` 语义变量，不能在组件内新增任意黑色阴影。带阴影的浮层不得再叠加装饰性的 1px 边框，避免“宽软阴影 + 细边框”的幽灵卡片。当前源码仍混用 Tailwind 原生大阴影和任意 `z-index`，这些属于迁移债务，不是可复制规范。

**“明度先于阴影”规则。** 常驻区域靠 `canvas → surface → surface-elevated` 的明度关系和必要的 1px 边界分层；阴影只属于弹窗、浮动工具条、菜单和拖拽对象。

**“真实浮起”规则。** 如果一个元素不会覆盖相邻内容、不会随交互临时出现，它就没有资格使用浮层阴影。

## Components

组件应像可靠的创作工具：边界清楚、按压可感、状态可读。触感来自颜色、明度、轻微位移和及时状态变化，不来自夸张圆角、厚重阴影或装饰性纹理。新组件必须提供 `hover`、`active`、`focus-visible`、`disabled` 和运行中状态；现有组件尚未全部达到该要求，应在后续审计中补齐。

### Buttons

- **Shape:** 紧凑的中等圆角（`6–8px`）；标签式状态可使用全圆角。
- **Primary:** 窑火陶棕背景、符合当前主题对比度的前景色，标准内边距 `8px 16px`。每个工作面只允许一个明确主动作。
- **Secondary:** 暖白稿纸背景、焦褐副墨文字、1px 语义边界，紧凑内边距 `6px 12px`。
- **Ghost:** 透明背景，只用于工具栏和低频辅助动作；悬停时使用 `hover` 明度。
- **Hover / Active:** 悬停切换至 `primary-hover` 或 `hover`；按压可使用不超过 `1px` 的短位移。
- **Focus:** 必须提供清晰的 `focus-visible` 轮廓，不能只改变边框颜色。
- **Disabled:** 同时降低视觉权重并保留可读标签；可行动原因必须通过文字解释。

### Chips

- **Style:** 使用 `primary-soft` 背景、`primary` 文字和全圆角，内边距 `4px 10px`。
- **State:** 只承载状态、筛选或对象标签，不伪装成主要按钮。
- **Accessibility:** 选中状态必须通过文字、图标或 `aria-pressed` 表达，不能只靠底色变化。

### Cards / Containers

- **Corner Style:** 普通容器使用 `8–12px`；`16px` 只保留给稿件主工作面等大型独立表面。
- **Background:** 使用 `surface` 或 `surface-elevated`，通过明度区分层级。
- **Shadow Strategy:** 常驻容器无阴影；真实浮层遵循 Elevation。
- **Border:** 需要边界时使用 1px `border`；不要同时叠加宽软阴影。
- **Internal Padding:** 紧凑信息容器使用 `12–16px`，主创作工作面使用 `24–32px`。
- **Nesting:** 禁止用多层卡片表达本可用标题、分隔线或留白解决的层级。

### Inputs / Fields

- **Style:** 高度约 `40px`、圆角 `6–8px`、`surface-elevated` 背景和 1px `border`，水平内边距 `12px`。
- **Focus:** 当前代码常以边界变为 `primary` 表示焦点；新实现还必须增加清晰的 `focus-visible` 轮廓。
- **Error:** 使用 `error`、明确错误文字和字段关联，不能只把边框变红。
- **Disabled / Read-only:** 两者必须视觉与语义不同；只读结果仍应允许复制。
- **Long Form:** 多轮修改意见和作者笔记使用可增长文本域，不能把长输入压入单行控件。

### Navigation

- **Structure:** 左侧导航承载项目与创作模块；当前代码展开宽度为 `224px`、折叠宽度为 `56px`，可选右属性面板为 `240px`。
- **Default:** 无衬线正文尺度，焦褐副墨文字，悬停以轻微明度变化反馈。
- **Active:** 使用 `primary-soft` 完整背景、`primary` 文字和明确的语义选中状态。
- **Legacy:** 当前侧栏用 2px 右侧强调条表示选中；这是待迁移实现，不得扩展为新的彩色侧条组件。
- **Narrow Window:** 当前仅具备侧栏折叠和少量局部响应式隐藏，完整的窄窗或移动端导航尚未完成。不得在没有逐屏验证的情况下宣称支持。

### Manuscript and Structured Work Surfaces

稿件、世界观条目、角色、故事设计和大纲都属于主创作工作面。每个工作面必须让当前对象占据中央可用空间，相关属性和 AI 能力按需展开。

正文稿件使用 `editor-page`、衬线正文、`65–75ch` 行长和用户可覆盖的排版偏好。结构化设定页面可以提高信息密度，但仍必须维持单一视觉主焦点，不得退化为相同卡片组成的仪表盘。

### AI Auxiliary Work Surface

同一时间最多打开一个 AI 辅助工作面。配置、执行和结果是同一任务的连续状态：

`配置 → 执行中 → 结果与差异`

结果在原工作面中替换配置状态，不额外叠加底部抽屉。多轮对话围绕当前对象和当前结果展开，不能取代世界观、大纲或正文等结构化工作区。任何应用操作都必须支持预览、拒绝、撤销，并在原对象已经变化时阻止静默覆盖。

交互状态默认使用 `150ms` 标准过渡，侧栏宽度使用当前 `200ms` 过渡。不得新增编排式动画，直到所有动效都提供 `prefers-reduced-motion` 的无位移或即时替代。

**“有触感但不喧闹”规则。** 关键控件通过明确底色、完整选中面和最多 1px 按压位移反馈状态；常驻面板不得借助阴影、发光或动画争夺当前创作对象的注意力。

**“一个动作一种语义”规则。** 同一个 AI 动作在顶部、选区和辅助工作面中必须保持一致输入、上下文、结果和应用行为；不得复制出行为不同的同名按钮。

## Do's and Don'ts

### Do:

- **Do** 让当前创作对象成为主舞台；无论正文、世界观、角色还是大纲，同一时间最多显示一个 AI 辅助工作面。
- **Do** 使用暖白编辑室的 `canvas → surface → surface-elevated` 明度层级组织常驻区域，默认强调色只占少量关键状态。
- **Do** 将正文和其他长文本控制在 `65–75ch`；正文默认使用 `16px / 2.2` 的衬线排版，并允许用户偏好覆盖。
- **Do** 给按钮、输入框和可选择项目提供明确的 `hover`、`active` 与 `focus-visible` 状态；焦点状态和文字对比度必须达到 WCAG 2.2 AA。
- **Do** 让 AI 上下文、执行进度、结果用途和数据去向可检查；应用内容前必须提供预览、确认与撤销。
- **Do** 保留紧凑且可触知的按压反馈；动效仅使用颜色、轻微位移或短时明度变化，并为 `prefers-reduced-motion` 提供无位移替代。
- **Do** 将现有六主题视为兼容现状，所有新组件先在暖白编辑室完成，再验证其他主题；主题收敛另立任务，不能伪称已完成。
- **Do** 同时使用图标、文字或可读状态说明 AI 运行、完成、失败、保存和警告。
- **Do** 在弹窗或浮层关闭后将焦点恢复到合理触发点，并确保主要流程可完全使用键盘操作。

### Don't:

- **Don't** 制造黑箱式“一键生成小说”。
- **Don't** 让单轮生成后只能反复重新抽卡。
- **Don't** 把整个产品做成只有聊天记录的 ChatGPT 仿制品。
- **Don't** 将 AI 参数、上下文和按钮同时铺满当前创作对象周围，形成控制台式界面。
- **Don't** 未经预览或确认便覆盖作者内容。
- **Don't** 在 AI 失败后丢失原输入、修改意见或已经完成的结果。
- **Don't** 为常驻卡片叠加宽软阴影；阴影只属于真正离开文档流的浮层。
- **Don't** 延续彩色侧边条、渐变分隔线、重复横线纸纹或全大写宽字距小眉题作为默认装饰；这些是现有遗留而非规范。
- **Don't** 把“文学感”翻译成泛黄古卷、伪手稿、装饰性花纹或牺牲可读性的低对比文字。
- **Don't** 使用大于 1px 的 `border-left` 或 `border-right` 作为卡片、列表项、提示框或警告的彩色强调条。
- **Don't** 使用渐变文字、默认玻璃拟态、重复斜纹、装饰性网格背景或相同尺寸的卡片矩阵制造“设计感”。
- **Don't** 使用 `32px` 以上圆角的卡片、面板和输入框，或把非标签控件全部做成药丸形。
- **Don't** 用颜色作为状态的唯一载体，或让焦点、AI 成功、失败与警告没有文字说明。
- **Don't** 使用任意 `z-index: 9999/10000` 扩大战争；新浮层必须进入统一的语义层级。
- **Don't** 宣称移动端或窄窗体验已经系统完成；新增界面必须逐屏验证窗口收缩、200% 文本缩放和键盘流程。
