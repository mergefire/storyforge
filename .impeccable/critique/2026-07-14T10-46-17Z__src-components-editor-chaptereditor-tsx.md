Method: dual-agent (A: /root/impeccable_assessment_a_retry · B: /root/impeccable_assessment_b)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 2/4 | 保存、生成、分块与结果状态可能同时争夺注意力 |
| 2 | Match System / Real World | 2/4 | “上下文、记忆、范围”仍偏系统术语，不是作者语言 |
| 3 | User Control and Freedom | 1/4 | 取消、撤销、并发任务及冲突回退边界未定义 |
| 4 | Consistency and Standards | 2/4 | 共享动作内核正确，但顶部、选区栏、检查器仍像三套入口 |
| 5 | Error Prevention | 1/4 | hash 能发现过期，尚未形成安全采纳与防覆盖交互 |
| 6 | Recognition Rather Than Recall | 1/4 | 5 个页签、6 个快捷动作及“更多”要求记忆能力分布 |
| 7 | Flexibility and Efficiency | 2/4 | 有快捷入口，但缺键盘流、新手默认路径与批处理 |
| 8 | Aesthetic and Minimalist Design | 0/4 | 三栏、顶栏、浮栏与底部抽屉会让正文失去视觉主权 |
| 9 | Error Recovery | 1/4 | 部分失败、重复生成、分块重试及版本恢复方案不足 |
| 10 | Help and Documentation | 2/4 | 处理范围、资料来源与记忆写入规则需要就地解释 |
| **Total** | | **14/40** | **Poor · 需结构性修正后再落地** |

## Anti-Patterns Verdict

**LLM assessment**：中高 AI-slop 风险。底层状态机、选区 hash、分块与上下文候选是可靠工程，但 UI 把几乎所有 AI 能力同时显性化，容易从“写作台”滑成“AI 控制室”。真正成熟的产品应让工具消失进写作，而不是让作者持续配置系统。

**Deterministic scan**：对 `ChapterEditor.tsx`、`FloatingToolbar.tsx`、`ReviewPanel.tsx`、`RichEditor.tsx`、`ChaptersListPanel.tsx` 扫描结果为 0 findings。它说明当前源码未命中 Impeccable 的静态反模式规则，但不能证明拟议的多工作面布局合理；方案尚未实现，检测器无法扫描线框中的认知负荷。

**Visual overlays**：未执行。仓库低内存策略禁用 browser/CDP，本轮用户未显式要求浏览器控制，因此没有可靠的用户可见 overlay。

## Overall Impression

上一版抓对了“统一动作内核”和“正文应成为中心”，但视觉方案没有贯彻自己的原则。最大机会不是把右栏和结果抽屉设计得更漂亮，而是删除一个工作面：默认只显示章节导航 + 正文；辅助面按需出现；结果直接接管辅助面。

## What's Working

- AI 结果与正文分离，避免直接覆盖，方向正确。
- 所有入口共享动作状态机、选区快照和 hash，为一致交互提供可靠基础。
- 窄屏改为 sheet，而不是强塞三栏，是正确的响应式起点。

## Priority Issues

### [P0] 辅助工作面叠层失控

**Why it matters**：常驻检查器、选区浮栏、底部结果抽屉和移动 sheet 会互相遮挡、抢焦点；作者在处理结果时仍被另一套工具导航干扰。

**Fix**：任一时刻只允许一个辅助面。桌面端右侧辅助面默认收起；运行 AI 后，该区域从配置态切换成进度/结果态。不要再增加独立底部抽屉。移动端使用一个全高 sheet，同样在配置态与结果态之间切换。

**Suggested command**：`$impeccable distill`、`$impeccable adapt`

### [P0] 动作入口仍然重复

**Why it matters**：顶部生成/续写、选区 6 项、右侧指令器和检查器形成多套入口，用户仍会问“从哪里点有什么区别”。

**Fix**：顶部只保留生成/续写；选区栏最多 4 项：润色、扩写、更自然、更多。检查与自定义改写进入“更多”，所有入口最终打开同一个动作配置面。

**Suggested command**：`$impeccable clarify`、`$impeccable distill`

### [P1] 正文仍未获得视觉主权

**Why it matters**：现有左侧章节树已经占宽，再常驻右栏会把稿纸压成配置面板；用户感觉自己在操作 AI，而不是写小说。

**Fix**：正文保持 65–75ch 舒适行长和明确最小宽度。右栏默认关闭；仅在宽屏且用户主动 pin 时常驻。章纲只以一行“本章目标”出现，展开后进入辅助面。

**Suggested command**：`$impeccable layout`、`$impeccable distill`

### [P1] 采纳与恢复模型不够可信

**Why it matters**：过期选区、分块部分失败、正文已变化、重复扣费等情况会直接损害作者对工具的信任。

**Fix**：不可变任务快照；逐段 diff；清楚标注成功/失败块；允许单段/全部采纳；冲突时禁止覆盖并给出重新定位；每次采纳形成一步可撤销版本。

**Suggested command**：`$impeccable harden`

### [P2] 系统术语与 AI 味过重

**Why it matters**：“上下文、记忆、范围、去 AI 味”暴露实现机制，迫使作者翻译系统概念。

**Fix**：改用作者目标语言：“AI 参考资料”“章节承接”“处理这段/整章”“写得更自然”。技术诊断放入高级详情，不占默认界面。

**Suggested command**：`$impeccable clarify`、`$impeccable polish`

## Cognitive Load

8 项中失败 6 项：单一焦点、信息分块、视觉层级、最小选择、工作记忆、渐进披露。主要原因是同时存在至少 5 个注意焦点、右侧 5 页签形成第二套信息架构、选区/章节/全文范围需要用户自行记忆。

修正版应把右侧一级导航压到 3 组：`计划`、`检查`、`资料`。记忆并入资料，笔记并入计划；AI 配置和结果不是页签，而是当前任务的两个阶段。

## Emotional Journey

拟议版本：进入时专业可控 → 写作时被周边控件包围 → 选择操作时兴奋 → 配范围/资料时犹豫 → 分块等待时焦虑 → 对比采纳时疲劳 → 保存后担心是否覆盖原文。

修正版目标：进入即写 → 需要时召出工具 → 明确看到 AI 正处理哪一段 → 用证据化 diff 做一次决定 → 采纳后可撤销并回到干净稿纸。

## Persona Red Flags

**Alex（高频作者）**：缺键盘优先流；工具面抢焦点；没有快速重复上次动作、逐块接受和版本回退。

**Jordan（第一次使用 AI 写作工具）**：不理解“上下文/记忆”；无法预判“检查器”和“更多”的内容；五个页签导致探索成本过高。

**Sam（键盘/读屏用户）**：浮栏、sheet、结果抽屉叠层会破坏焦点顺序；异步分块进度与选区过期需要 `aria-live`；所有关闭动作必须支持 Esc 且焦点返回原文。

## Minor Observations

- 顶栏的字数、状态、保存态不能与两个主按钮同权重。
- 浮栏不得遮住选中文字或下一行，需碰撞检测。
- 移动端软键盘与 sheet 必须共享可视高度，避免输入框被遮住。
- “创作/上下文/记忆”辨识度低，合并后更符合作者心智模型。
- 动效只表达辅助面切换和任务状态，控制在 150–250ms，并支持 reduced motion。

## Questions to Consider

- 第一成功指标究竟是“不中断地写”，还是“更频繁地调用 AI”？
- AI 结果出现时，作者还需要同时看检查器导航吗？
- AI 修改默认应该逐段采纳，还是整章采纳后依赖撤销？
