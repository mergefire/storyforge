# StoryForge Windows 客户端实施规划

> 技术路线：Tauri 2 + React/Vite + WebView2 + Dexie/IndexedDB + Rust 原生能力边界  
> 目标顺序：Windows 作者自用验证 → 封闭测试 → 公开稳定发布  
> 评估依据：[WINDOWS-DESKTOP-CLIENT-ASSESSMENT.md](./WINDOWS-DESKTOP-CLIENT-ASSESSMENT.md)

---

## 0. 文档状态与权威关系

| 字段 | 内容 |
| --- | --- |
| 规划日期 | 2026-07-14 |
| 技术路线 | 已由用户确认 |
| 当前状态 | 规划完成，尚未开始产品代码实施 |
| 第一平台 | Windows 10/11 x64 |
| 第一验证人 | 项目作者本人 |
| 数据迁移责任 | Codex 开发迁移工具、执行首次迁移并出具验证结果 |
| 首版数据库 | 继续使用 Dexie/IndexedDB，不迁 SQLite |
| 账号/云同步 | 不在首版范围内 |
| 功能等价红线 | 当前生产版全部可达的用户功能必须在 Windows 客户端保持等价；未逐项验收不得发布 |

本文件是 Windows 客户端专项施工规划，但不得覆盖仓库宪法和主蓝图：

1. [CLAUDE.md](../CLAUDE.md) 仍是项目宪法。
2. [MASTER-BLUEPRINT.md](./MASTER-BLUEPRINT.md) 仍是唯一施工权威。
3. 开始编码前，必须先执行任务 D0.1：把本规划的任务编号、依赖关系和完成判据纳入 MASTER-BLUEPRINT，并完成 Claude 审查。
4. 未完成 D0.1 前，本文件只用于评审、排期和准备，不授权绕过主蓝图直接施工。
5. 所有代码改动走非 main 分支和 PR；建议分支名为 refactor/phase-desktop-task-N。

---

## 1. 最终目标

### 1.1 作者自用版目标

作者能够在独立 Windows 客户端中完成以下工作：

- 使用当前生产版全部可达的用户功能；不得因为客户端化而隐藏、禁用、删除或弱化任何现有功能。
- 打开、编辑、自动保存和恢复现有项目。
- 与浏览器中的视频网站同时运行，不再占用浏览器标签页或主窗口。
- 使用现有 AI、Embedding、导入、导出和自动备份能力。
- 一次性把旧 Chrome/Edge 网页版数据完整迁入客户端。
- 迁移由 Codex 操作；作者只在浏览器或 Windows 强制要求时确认一次授权。
- 迁移失败时旧浏览器数据完全不受影响，客户端不会展示半导入数据。

### 1.2 公开稳定版目标

在自用版稳定后，提供：

- Windows x64 NSIS 安装包。
- Windows Authenticode 代码签名。
- Tauri Updater 独立更新签名。
- 可恢复的自动更新、脱敏诊断和公开迁移说明。
- Windows 10/11 安装、升级、卸载、恢复测试记录。

### 1.3 首版明确不做

- macOS、Linux、Windows ARM64 原生包。
- SQLite 改造。
- 账号体系、实时云同步、多设备冲突合并。
- 浏览器扩展。
- 直接复制 Chrome/Edge LevelDB 或复用浏览器 profile。
- 同时发布 portable、MSI、NSIS 多种载体。
- 复活“本地服务器 + 自动打开浏览器”的旧 exe。
- 让桌面 WebView 加载线上 Vercel UI 或远程脚本。

### 1.4 功能等价红线（不可降级）

“客户端化”只允许改变承载方式，不允许改变产品能力。作者自用版、beta 和 stable 都受以下红线约束：

1. **当前功能的定义**：以 D0.5 冻结 commit 中生产构建实际可达的路由、侧栏模块、面板、对话框、快捷键和后台任务为准；代码事实优先于可能滞后的功能说明。
2. **等价的定义**：入口可达、操作可完成、数据语义一致、保存后可重开、错误与取消可恢复、相关导入/导出/AI/备份链路仍可用。仅“页面能打开”不算等价。
3. **完成的定义**：功能等价清单中的每个动作均有 Windows 客户端证据，状态为 PASS；不得存在 UNKNOWN、BLOCKED 或未经作者明确批准的范围变更。
4. **Web 不回归**：共享前端改造必须继续通过当前生产 `web-tab` 回归；不能为了桌面版破坏现有网页版。D0.4～D1 的 installed PWA 实测仅为可选补充，不替代 Web 证据，也不因缺失而阻塞开发。
5. **用户不补工程缺口**：不得把缺失功能改写成“回浏览器完成”“手工搬文件”“手工改库”或“先用命令行代替”。旧数据迁移由 Codex 执行；用户只处理操作系统或第三方服务无法代理的授权确认。

允许的差异仅限于具有同等或更强结果的桌面适配：

- 浏览器下载改为原生“另存为”，File System Access 改为原生文件/目录选择。
- 浏览器打开外链改为系统默认浏览器。
- PWA 安装和 Service Worker 更新改为 NSIS 安装与签名更新器。
- API Key、GitHub PAT、目录授权等不可安全搬运的凭据可要求一次重新授权，但配置项、连接测试和后续能力必须保留；Codex 负责其余迁移步骤。
- Web 的代理/直连实现控件可由 Rust 网络 broker 的自动路由替代，但现有 Provider、自定义端点、localhost Ollama/LM Studio 和连接测试不能减少。
- 窗口标题栏、系统菜单和少量布局可按 Windows 习惯调整，但不得减少内容、动作、快捷键或数据。

REAUTHORIZE 是唯一授权例外，不是延期功能的口子。首次迁移应自动带入项目数据、Prompt/Workflow、主题、排版和全部非密配置；浏览器 origin 下无法可靠迁移的 FileSystemDirectoryHandle、AI API Key 和 GitHub PAT，允许用户在引导中重新选择/录入一次。用户跳过时可稍后补做，不能阻塞打开项目；完成授权后不得每次启动反复询问。

以下情况一律视为功能丢失并阻断 G2/stable：

- 隐藏或禁用现有按钮、模块、AI 动作、导入格式、导出格式或备份目标。
- 只保留查看而失去新增、编辑、删除、排序、筛选、关联、恢复等现有操作。
- 数据可显示但无法继续编辑，或重启后丢失格式、关联、附件、主键、版本记录。
- 桌面版必须同时启动浏览器、Vite、Node 本地服务或网页版才能完成现有业务流程。
- 用文档说明、人工脚本或“后续版本补齐”替代当前可用功能。

---

## 2. 已锁定的架构决策

### 2.1 应用形态

- 客户端使用 Tauri 2。
- React UI 随安装包本地发布，断网也能启动。
- Windows 使用系统 WebView2。
- Electron 只作为回退方案，不并行维护。

### 2.2 数据形态

- 业务数据继续由 Dexie/IndexedDB 管理。
- 正式 app identifier 和 WebView2 User Data Folder 一旦进入真实数据阶段就冻结。
- 开发 profile 与正式 profile 必须隔离。
- 所有项目表生命周期继续由 PROJECT_TABLES 派生。
- AI 读继续走 CONTEXT_SOURCES/assembleContext。
- AI 写继续走 FIELD_REGISTRY/AdoptionSchema/adopt。
- Rust 不直接读写 StoryForge 业务表，也不维护第二份表清单。

### 2.3 原生能力边界

React WebView 被视为不可信展示层；Rust 是权限与系统副作用边界：

~~~text
React / WebView2
  │ 只调用窄类型 RuntimeAdapter
  ▼
Tauri IPC
  │
  ▼
Rust Core
  ├─ AI / Embedding / GitHub 受控网络出口
  ├─ Windows Credential Manager
  ├─ 原生文件选择与原子备份
  ├─ 更新器与恢复点
  └─ 脱敏诊断日志
~~~

不得提供以下万能接口：

- 任意 URL + 任意 Header 的 http_request。
- 任意绝对路径的 read_file/write_file。
- 向 WebView 返回明文密钥的 get_secret。
- shell execute 或任意进程启动。

### 2.4 首次迁移形态

- 新建独立 FullMigrationArchive 协议，不复用现有项目 JSON 充当全量迁移。
- 旧网页通过正常 IndexedDB API 导出，不直接读取浏览器数据库文件。
- 首次只允许迁入空客户端库，保留原始主键。
- Codex 负责操作导出、导入和验证。
- 文件迁移是首版可靠主路径；一键 loopback 交接属于后续增强，不阻塞作者自用。

---

## 3. 目标目录与边界

目录名称在 D0.2 复核仓库现有约定后冻结，建议结构如下：

~~~text
src/
  runtime/
    contract.ts
    index.ts
    target.ts
    web/
    tauri/
  lib/
    migration/
      archive-types.ts
      value-codec.ts
      canonical-hash.ts
      profile-export.ts
      profile-import.ts
      profile-verify.ts
      migration-journal.ts
  components/
    migration/
  pages/
    MigrationExportPage.tsx

src-tauri/
  Cargo.toml
  build.rs
  tauri.conf.json
  capabilities/
    main.json
  permissions/
  src/
    main.rs
    lib.rs
    commands/
    security/
    migration/
    diagnostics/

tests/
  migration/
  desktop-contract/

.github/workflows/
  desktop-ci.yml
  desktop-release.yml
~~~

边界规则：

- 只有 src/runtime/tauri 可以在前端导入 Tauri API。
- src/components、stores 和注册表不得散落 window.__TAURI__ 判断。
- main.rs 保持薄入口；命令注册、插件和状态放在 lib.rs。
- 每条跨栈链路必须能追踪：

~~~text
UI 调用者
→ TypeScript RuntimeAdapter
→ Tauri command / Channel
→ Rust handler
→ 文件、网络、凭据或更新副作用
→ 结构化结果
→ UI 状态
~~~

---

## 4. 阶段依赖与里程碑

~~~mermaid
flowchart LR
  D0["D0 治理、契约与基线"] --> D1["D1 Tauri Vertical Slice"]
  D1 --> G1{"G1 WebView2 Go / No-Go"}
  G1 -->|"Go"| D2["D2 全量迁移协议"]
  G1 -->|"Go"| D3["D3 原生运行时能力"]
  G1 -->|"No-Go"| E["单独评估 Electron 回退"]
  D2 --> D4["D4 作者真实数据迁移与自用"]
  D3 --> D4
  D4 --> G2{"G2 自用稳定门"}
  G2 --> D5["D5 封闭测试与公开发布"]
~~~

| 阶段 | 主要产物 | 估算开发量 |
| --- | --- | ---: |
| D0 | 主蓝图纳入、身份冻结、契约、功能等价清单与基线 | 2–3 天 |
| D1 | 可离线运行的 Tauri vertical slice | 3–5 天 |
| D2 | 全量迁移包、导出器、导入器、验证器 | 8–12 天 |
| D3 | AI、凭据、文件、日志原生适配 | 5–8 天 |
| D4 | 真实迁移、作者自用、恢复演练 | 2–4 天工程量 + 7–14 天观察 |
| D5 | Windows CI、签名更新、公开发布 QA | 5–10 天 |

安全作者自用版按约 3–4 周等效开发量规划；公开稳定版再增加约 1–2 周和必要观察期。工期不包含账号/云同步。

---

## 5. 功能等价契约与初始矩阵

本节是 D0.5 的输入契约。表中是根据当前路由、侧栏模块和主要面板形成的初始基线；D0.5 必须在冻结 commit 上生成动作级清单并补齐遗漏，不能把本表当作少盘点功能的上限。

### 5.1 实现类别与验收状态

实现类别只说明“怎么实现”，不代表已经通过：

| 类别 | 含义 | 是否允许能力下降 |
| --- | --- | --- |
| SHARED | React/Dexie 业务代码由 Web 与 Desktop 共享 | 否 |
| ADAPTED | UI 不变或近似不变，浏览器 API 经 RuntimeAdapter 换成原生实现 | 否 |
| REAUTHORIZE | 数据与功能迁移，但受安全边界限制需要一次重新授权或录入凭据 | 否；只允许授权动作不同 |
| DESKTOP_REPLACEMENT | PWA/浏览器承载能力由 Windows 等价能力替换 | 否；替代结果必须等价或更强 |

每一项只能处于以下验收状态之一：

| 状态 | 含义 | 对闸门的影响 |
| --- | --- | --- |
| BASELINED | 已冻结入口和动作，尚未完成客户端验证 | 阻断 G2/stable |
| IMPLEMENTED | 已实现但证据未完整 | 阻断 G2/stable |
| PARTIAL | 仅部分子动作或部分数据通过 | 阻断 G1（若属兼容缺口）/G2/stable |
| PASS | 动作、数据、失败路径和持久化证据完整 | 可通过 |
| UNKNOWN | 尚未确认是否可达、如何实现或如何验证 | 阻断 G1/G2/stable |
| BLOCKED | 已知缺失、不兼容或行为退化 | 阻断 G1/G2/stable |
| APPROVED_SCOPE_CHANGE | 作者明确改变产品范围，并已同步 MASTER-BLUEPRINT | 在原“零功能丢失”目标下仍阻断；只有作者明确修改目标后才可解除 |

不得为当前可达功能使用 N/A。浏览器机制本身不适用于桌面时，必须使用 DESKTOP_REPLACEMENT 并验收替代结果。

### 5.2 证据代码与覆盖规则

| 证据 | 最低要求 |
| --- | --- |
| NAV | 从真实入口进入、返回、刷新/重启后仍能定位；持久化的旧 module id 也能恢复 |
| ACT | 对该入口内每个可达动作逐项执行；包括新增、编辑、删除、排序、筛选、搜索、关联、批量操作、取消和撤销中实际存在的部分 |
| DATA | 用冻结夹具核对业务字段、富文本、引用、主键、关系和 Blob；不能只核对成功提示 |
| RESTART | 保存后退出真实客户端，再启动并核对 |
| AI | 真实或受控 Provider 的流式首块、完成、取消、超时、断流、结构化输出、审阅与采纳链路 |
| FILE | 文件类型、内容、中文路径、大文件、取消、权限拒绝、磁盘满与原子写入 |
| RECOVERY | 失败注入后可重试、恢复且不破坏源数据或最后健康状态 |
| WEB | 同一共享改动通过当前生产 `web-tab` 功能与构建回归；D0.4～D1 的 installed PWA 实测为可选补充 |
| REAL | 在 production desktop build、正式 profile 策略和真实 WebView2 中执行，不以浏览器开发服务器代替 |

覆盖规则：

1. D0.5 以 src/main.tsx 为生产启动根，联合扫描 src/App.tsx、src/components/layout/sidebar-tree.ts、Sidebar 的展示归一、WorkspacePage 的真实模块分派、SettingsPage、DataManagementPanel、后台 hooks 和生成版 AI manual，生成动作级 manifest；不得执行应用模块来“发现”入口。
2. 每个生产可达路由、SidebarModule、对话框动作和后台任务必须映射到一个 FP ID；一个聚合行只有在其 manifest 子动作全部 PASS 后才能 PASS。
3. 开发专用、测试专用或仅存在于历史文档且生产构建不可达的入口不属于当前产品基线，但排除理由必须记录。
4. CI 比较代码扫描结果与 manifest；新增入口或动作而未登记 FP ID 时失败，删除入口或动作时必须有作者批准的范围变更。
5. 矩阵证据记录 commit、客户端版本、系统、夹具、步骤、结果、截图/日志位置和验证人。

当前代码复核基数为 3 个生产 URL 路由、36 个可见 Sidebar leaf，以及 8 个非可见 `SidebarModule`：其中 `story-core`、`backup`、`detailed-outline`、`editor` 出现在 `LEGACY_ALIASES`，`geography`、`power-system`、`master-studies`、`data-management` 只存在于 Workspace 分派。`LEGACY_ALIASES` 当前仅归一 Sidebar 的高亮/展开展示，不会重写 `activeModule` 或 Workspace 分派；检查器必须单独记录 alias 与真实 dispatch 是否等价。以上数量只是当前复核结果，D0.5 必须在冻结 commit 上动态重算，不能硬编码 `3/36/4/4`，数量变化本身也不能被忽略。已知不属于当前功能基线的例子包括：DEV-only NS0 评估面板、明确不可用的 3D 地图 Labs、尚未实现的语言/备份策略设置占位、历史指南中的 HTML/EPUB 导出与 DiffViewer。它们的排除不影响当前“项目参考上传 EPUB”必须实测的要求。

### 5.3 应用壳、项目与系统交互

| FP ID | 当前能力/入口 | Windows 客户端等价要求 | 类别 | 最低证据 | 最早验证门 |
| --- | --- | --- | --- | --- | --- |
| FP-APP-01 | / 首页：欢迎引导、项目列表、创建/打开/两次点击删除，名称、多题材、写作状态、简介、目标字数及文件夹恢复入口 | 所有现有项目生命周期动作、危险确认和提示保持一致，旧项目直接可见 | SHARED/ADAPTED | NAV+ACT+FILE+DATA+RECOVERY+RESTART+REAL | G1 |
| FP-APP-02 | /workspace/:projectId 工作区、树形侧栏、展开/折叠、模块切换 | 所有当前叶子模块可进入；选择、展开状态和旧 module id 行为不退化 | SHARED | NAV+ACT+RESTART+REAL | G1 |
| FP-APP-03 | /settings 与工作区内设置入口 | 两个现有入口均可达，返回路径和当前项目上下文一致 | SHARED | NAV+ACT+REAL | G1 |
| FP-APP-04 | 对话框、Toast、加载、空态、错误态和取消 | 业务结果、阻塞关系、键盘焦点和恢复动作保持可用 | SHARED | ACT+RECOVERY+REAL | G2 |
| FP-APP-05 | 键盘快捷键、拖放及编辑器选择行为 | 当前快捷键和编辑行为在 WebView2 中不冲突、不失效 | SHARED/ADAPTED | ACT+DATA+REAL | G1 |
| FP-APP-06 | 外部链接与 GitHub 等站外入口 | 只在系统默认浏览器打开受允许 URL，不丢入口、不在 WebView 内任意导航 | ADAPTED | ACT+RECOVERY+REAL | G1 |
| FP-APP-07 | PWA 离线启动、安装和更新承载能力 | 本地 UI 断网启动；由 NSIS 和签名 updater 提供安装/更新/恢复 | DESKTOP_REPLACEMENT | RESTART+RECOVERY+REAL | G1/D5 |
| FP-APP-08 | 剪贴板写入：地图图片 Prompt、Workflow 输出及扫描发现的其他现有入口 | 所有现有复制动作成功且保留原反馈；不因此授予 renderer 剪贴板读取权 | ADAPTED | ACT+REAL | G1 |
| FP-APP-09 | 六套主题 warm/jade/slate/forge/scroll/paper 与编辑器排版偏好 | 主题及字体、字号、行高、段距即时生效并跨重启保持，旧偏好映射有效 | SHARED | ACT+DATA+RESTART+REAL | G1 |
| FP-APP-10 | 工作区右侧属性面板 | 当前章/大纲字数、角色、关系、地理、伏笔等已有模块统计与提示保留，并随模块/数据更新 | SHARED | NAV+ACT+DATA+REAL | G2 |
| FP-APP-11 | ErrorBoundary、连接日志与诊断反馈 | 保留现有错误/连接信息并提供可操作恢复；公开版用应用内脱敏诊断替代 F12，默认不记录 key、PAT、Prompt 或正文片段 | ADAPTED | ACT+RECOVERY+REAL | G2/D5 |

### 5.4 项目信息、世界观与多世界

| FP ID | 当前模块 | Windows 客户端等价要求 | 类别 | 最低证据 | 最早验证门 |
| --- | --- | --- | --- | --- | --- |
| FP-PROJ-01 | info 项目概况 | 名称、多题材、简介、目标字数等当前字段及保存保留；多世界开关仍在项目概况且遵守先备份/事务迁移 | SHARED | NAV+ACT+DATA+RECOVERY+RESTART | G2 |
| FP-PROJ-02 | inspiration 灵感反推 | 现有输入、AI 生成、结果审阅/采纳、保存及 Markdown 导出保留 | SHARED/ADAPTED | NAV+ACT+AI+FILE+DATA | G2 |
| FP-PROJ-03 | references 项目参考 | 参考资料新增、编辑、危险删除及分析块级联、直接上传、浅层/深层分析、引用等当前动作保留；UI 宣称的 EPUB 必须用真实 EPUB fixture 通过，不能以 file.text 假通过 | SHARED/ADAPTED | NAV+ACT+FILE+AI+DATA+RECOVERY | G2 |
| FP-WORLD-01 | world-overview 世界总览与多世界管理 | 仅启用多世界时显示；世界及关系/通道 CRUD、AI 推荐逐个采纳、类型/图标/描述/顺序/穿越规则、AI 扩写、关系图四种布局和穿越总览保留；启用/删除遵守备份与注册表事务语义 | SHARED/ADAPTED | NAV+ACT+AI+DATA+RECOVERY+RESTART | G1 |
| FP-WORLD-02 | world-rules 真实与幻想/世界规则 | 字段编辑、规则管理和现有 AI 动作保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA | G2 |
| FP-WORLD-03 | worldview-origin 世界起源 | 世界来源、力量体系、神明信仰、结构拆分、内嵌 Codex 词条/搜索及生成/追问/采纳/保存保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA | G2 |
| FP-WORLD-04 | worldview-natural 自然环境 | 当前地理/环境条目、知识检索、生成/采纳和保存保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA | G2 |
| FP-WORLD-05 | worldview-humanity 人文环境 | 当前人文条目、知识检索、生成/采纳和保存保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA | G2 |
| FP-WORLD-06 | history 历史年表 | 时间轴/关键词/概览、世界与类别/时代筛选、事件/关键词 CRUD、史实锚点/区间/定稿/创作思路/章节关联，以及历史考据与头脑风暴 Agent 的结果采纳/保存保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA+RESTART | G2 |
| FP-WORLD-07 | world-map 世界地图 | 地图、节点/区域、选择、编辑、缩放/画布、持久化及 5 倍分辨率高清 PNG 导出保留 | SHARED/ADAPTED | NAV+ACT+FILE+DATA+RESTART+REAL | G1 |
| FP-WORLD-08 | story-design 故事设计 | 现有故事核心/设计字段、AI 动作、采纳和保存保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA | G2 |

### 5.5 角色与关系

| FP ID | 当前模块 | Windows 客户端等价要求 | 类别 | 最低证据 | 最早验证门 |
| --- | --- | --- | --- | --- | --- |
| FP-CHAR-01 | characters 角色生成 | 手工/AI 创建、生成模式、审阅、采纳和保存保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA | G2 |
| FP-CHAR-02 | characters-main 主要角色 | 当前字段、补充信息、状态、筛选和编辑动作保留 | SHARED | NAV+ACT+DATA+RESTART | G2 |
| FP-CHAR-03 | characters-minor 次要角色 | 当前字段、补充信息、状态、筛选和编辑动作保留 | SHARED | NAV+ACT+DATA+RESTART | G2 |
| FP-CHAR-04 | characters-npc NPC | 当前字段、补充信息、状态、筛选和编辑动作保留 | SHARED | NAV+ACT+DATA+RESTART | G2 |
| FP-CHAR-05 | characters-extra 路人角色 | 当前字段、补充信息、状态、筛选和编辑动作保留 | SHARED | NAV+ACT+DATA+RESTART | G2 |
| FP-CHAR-06 | relations 角色关系图 | 力导向图/列表、关系 CRUD、方向性/类型/标签/描述、图布局/缩放，以及 AI 从大纲/正文提取、重复标记和勾选采纳保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA+RESTART+REAL | G1 |

### 5.6 创作、编辑与校验

| FP ID | 当前模块 | Windows 客户端等价要求 | 类别 | 最低证据 | 最早验证门 |
| --- | --- | --- | --- | --- | --- |
| FP-WRITE-01 | rules 创作规则 | 规则增删改、排序/启停及当前 AI 辅助动作保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA | G2 |
| FP-WRITE-02 | outline 大纲 | 大纲树、卷章管理、拖排/批量、AI 卷章生成、输出与预览等当前动作保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA+RESTART | G1 |
| FP-WRITE-03 | character-driven-plot 角色驱动情节 | 角色选择、情节生成、审阅/采纳和保存保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA | G2 |
| FP-WRITE-04 | story-arc 故事弧 | 弧线创建、编辑、删除、节点/角色关联和可视化保留 | SHARED | NAV+ACT+DATA+RESTART | G1 |
| FP-WRITE-05 | chapters-list 章节列表 | 章节新增、打开、排序、状态/字数、删除和批量动作保留 | SHARED | NAV+ACT+DATA+RESTART | G2 |
| FP-WRITE-06 | 章节编辑器、详细大纲、场景与情绪节拍 | 富文本/结构编辑、显式保存、未保存离开提醒、状态/上下文/状态卡选择、工具栏、便签/章节备注、场景细纲、情绪节拍保留 | SHARED/ADAPTED | NAV+ACT+DATA+RECOVERY+RESTART+REAL | G1 |
| FP-WRITE-07 | foreshadow 伏笔管理 | 列表/看板、状态、关联、增删改和 AI 建议保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA | G2 |
| FP-WRITE-08 | style-learning 风格学习 | 样本导入、分析、结果展示、应用和保存等当前动作保留 | SHARED/ADAPTED | NAV+ACT+FILE+AI+DATA | G2 |
| FP-WRITE-09 | locations 地点库 | 地点树、标签、增删改、移动/关联和保存保留 | SHARED | NAV+ACT+DATA+RESTART | G2 |
| FP-WRITE-10 | state-table 状态表 | 状态卡、查看/筛选、事件时间线、差异、AI 提取/审阅及当前状态聚合 TXT 导出保留 | SHARED/ADAPTED | NAV+ACT+FILE+AI+DATA | G2 |
| FP-WRITE-11 | inventory 库存/物品 | 手工流水、AI 批量扫描已写章节与进度、按物品聚合数量/获得/消耗、展开编辑和删除保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA+RESTART | G2 |
| FP-WRITE-12 | fact-library 事实库 | 事实新增、编辑、删除、搜索/筛选、来源/引用、事实/派生记忆 Markdown 导出和候选 diff JSON 导入保留；导入只能进入 candidate，不能绕过审阅成为 Canon | SHARED/ADAPTED | NAV+ACT+FILE+DATA+RESTART | G2 |
| FP-WRITE-13 | story-timeline 故事时间线 | 手工事件、AI 扫描正文与进度、重要性/标题编辑、来源章节跳转、删除及时间线交互保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA+RESTART | G1 |
| FP-WRITE-14 | scene-verify 场景校验 | 选择范围、执行校验、结果定位、审阅/处理和保存保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA | G2 |
| FP-WRITE-15 | 章节 AI、审校、抽取与记忆子流程 | 生成/续写/扩写/润色/去 AI 味/自定义指令，选区六操作，一致性 Fast Guard/Deep Audit、审校/去 AI 味/追读力报告及改全文，状态/事实抽取审核、历史影响、章节记忆和正文进展对账/更新章纲全部保留 | SHARED/ADAPTED | NAV+ACT+AI+DATA+RECOVERY+RESTART | G2 |

### 5.7 AI、Embedding、提示词与统计

| FP ID | 当前能力/入口 | Windows 客户端等价要求 | 类别 | 最低证据 | 最早验证门 |
| --- | --- | --- | --- | --- | --- |
| FP-AI-01 | 全部现有 AI 生成按钮与统一输出层 | Prompt 参数、上下文/Token 预览、Provider/模型选择、流式输出、停止、重试、追问、删除轮次、接受写入、超时、错误展示和用量记录保留 | ADAPTED | AI+DATA+RECOVERY+REAL+WEB | G1 |
| FP-AI-02 | prompts 提示词模板、类型/题材包与管理 | 搜索/分类/题材包、系统模板只读与克隆、用户模板 CRUD/激活、变量/参数、正反例、实时预览及单个/全部导入导出保留 | SHARED/ADAPTED | NAV+ACT+FILE+DATA+RESTART | G2 |
| FP-AI-03 | Prompt workflow/runner 与历史验证等现有工作流 | Workflow 新建/编辑/复制/导入导出、步骤增删排序、input mapping、auto-save target、pause-after，以及运行时暂停/继续/重试/跳过/终止、用户输入、输出编辑/复制/保存全部保留 | SHARED/ADAPTED | NAV+ACT+FILE+AI+DATA+RECOVERY | G2 |
| FP-AI-04 | 上下文装配、预算、结构化输出、审阅与采纳 | CONTEXT_SOURCES/FIELD_REGISTRY 路径、引用、截断提示和 adoption 语义不变 | SHARED/ADAPTED | AI+DATA+RECOVERY+WEB | G1 |
| FP-AI-05 | Embedding、知识检索与索引 | 配置、索引/重建、检索、取消、错误和持久化保留 | ADAPTED | ACT+AI+DATA+RESTART | G1 |
| FP-AI-06 | usage-stats 使用统计 | 请求、Token、成本/模型、项目/全局、汇率等当前维度与筛选/清理动作保留，并纳入全量资料迁移 | SHARED | NAV+ACT+DATA+RESTART | G2 |

### 5.8 数据、备份、设置与兼容入口

| FP ID | 当前能力/入口 | Windows 客户端等价要求 | 类别 | 最低证据 | 最早验证门 |
| --- | --- | --- | --- | --- | --- |
| FP-DATA-01 | Dexie 自动保存、重开与项目隔离 | 所有 PROJECT_TABLES 数据、关系、主键、富文本和 Blob 可持续编辑且重启不丢 | SHARED | DATA+RESTART+RECOVERY+REAL | G1 |
| FP-DATA-02 | version-history 版本历史/快照 | 手动快照备注、列表/查看/恢复为新项目/删除保留；手动快照不受自动上限清理，自动快照每项目仅保留最新 20 个 | SHARED | NAV+ACT+DATA+RECOVERY+RESTART | G2 |
| FP-DATA-03 | import-doc 文档导入 | 粘贴文本及 TXT≤5MB、MD≤5MB、CSV≤2MB、PDF≤20MB、DOCX≤10MB 保留；DOC 明确拒绝。切块/成本时间/分卷预览、当前项目/项目参考/目标世界、浅/深分析、活动记录和报告保留 | SHARED/ADAPTED | NAV+ACT+FILE+AI+DATA+RECOVERY | G1 |
| FP-DATA-04 | export 数据管理：项目可移植导入导出 | 当前项目 JSON v4 导出（嵌套引用 marker=`export-index-v1`）、v1/v2/v3 导入兼容及 Markdown/TXT 正文导出保留；v4 重映射登记的 ID/FK 与嵌套引用并创建新项目，绝不覆盖当前项目；旧 v1-v3 嵌套 raw IDs 原样保留且不得猜测为 v4 序号 | ADAPTED | NAV+ACT+FILE+DATA+RECOVERY | G1 |
| FP-DATA-05 | 本地自动快照与恢复 | 5 分钟自动、最多 20 个自动快照，以及手动创建、列表、恢复为新项目、删除等现有行为保留 | SHARED/ADAPTED | ACT+DATA+RECOVERY+RESTART | G1 |
| FP-DATA-06 | 文件夹绑定、自动备份与首页恢复 | 改为原生目录选择和原子写入；记住目录、立即保存、进入即写、每 5 分钟写入、失效后重新绑定、解绑保留；首页枚举 storyforge-*.json，跳过坏文件并逐个恢复为新项目 | ADAPTED/REAUTHORIZE | ACT+FILE+DATA+RECOVERY+REAL | G1 |
| FP-DATA-07 | GitHub Gist 云备份 | PAT 验证、记住/仅会话、连接/断开、创建/更新私密 Gist、列表、revision 回溯、恢复为新项目及每 10 分钟自动备份保留；PAT 可一次重授权 | ADAPTED/REAUTHORIZE | ACT+DATA+RECOVERY+REAL | G2 |
| FP-DATA-08 | 旧浏览器完整资料迁移 | Codex 执行项目表、快照、未完成导入及原文 Blob、Prompt/Workflow、AI 用量、非密设置、偏好和草稿的全量导出/导入/逐项 hash 验证与回执；源数据不变，可重建缓存有恢复动作 | ADAPTED | FILE+DATA+RECOVERY+REAL | G2 |
| FP-DATA-09 | 文档导入中断续跑与解析结果复用 | 每块即时持久化、单块至多 3 次尝试、暂停/恢复/取消/失败块重试保留；强杀后从原文继续且已完成块不重复调用 AI；解析一次可多次落地，完成/放弃后清理 Blob | SHARED/ADAPTED | ACT+FILE+AI+DATA+RECOVERY+RESTART | G1 |
| FP-DATA-10 | 辅助文件往返 | Prompt 单个/全部 JSON、Workflow 全部 JSON、事实候选 diff JSON、事实 Markdown、状态 TXT、灵感 Markdown、地图 PNG 等扫描发现的全部现有格式保留 | ADAPTED | NAV+ACT+FILE+DATA | G2 |
| FP-DATA-11 | 项目/世界/参考等危险删除与迁移 | 二次确认、取消零变化、必要时先成功备份、按 PROJECT_TABLES 事务级联；删除/恢复不伤及其他项目，恢复入口默认创建新项目 | SHARED/ADAPTED | ACT+FILE+DATA+RECOVERY+RESTART | G1 |
| FP-DATA-12 | Dexie v1→当前 schema 与旧项目修复 | 真实旧库和旧 JSON 兼容升级；会重塑数据的迁移先生成恢复锚点，角色轴/旧物品势力/状态卡/脏大纲等历史迁移语义保留 | SHARED | DATA+RECOVERY+RESTART+REAL | G1 |
| FP-DATA-13 | localStorage/sessionStorage 中的用户可见状态 | 灵感草稿、场景校验草稿、主题、排版、模型非密配置/预设、引导状态等自动迁入并重开保持；会话 secret 不迁，持久 secret 走一次重授权 | ADAPTED/REAUTHORIZE | DATA+RESTART+REAL | G2 |
| FP-DATA-14 | retrievalChunks、narrativeSummaryNodes 等派生缓存 | 允许不搬原缓存，但目标端可自动/显式重建，Embedding/检索/摘要恢复可用且不污染正文 | ADAPTED | ACT+AI+DATA+RECOVERY | G2 |
| FP-SET-01 | settings：AI Provider、模型、自定义端点与连接测试 | DeepSeek/Qwen/Doubao/MiniMax/GLM/Wenxin/Gemini/Poe/OpenAI/Kimi/Claude/NVIDIA/ModelScope/Agnes/LongCat/Ollama/Custom，以及 localhost LM Studio、key/baseUrl/model/temperature/maxTokens/contextWindow、记住/仅会话、预设 CRUD/切换、测试连接和连接日志全部保留；secret 只进 Credential Manager/进程内会话 | ADAPTED/REAUTHORIZE | NAV+ACT+AI+DATA+RECOVERY+RESTART+REAL | G1 |
| FP-SET-02 | Embedding 设置 | 默认关闭语义、当前预设/端点/模型/Key、开启/测试、重建关键词块、章→卷→全书摘要树、向量幂等续跑/换模型补嵌，以及失败回退关键词不阻断保留 | ADAPTED/REAUTHORIZE | NAV+ACT+AI+DATA+RECOVERY+RESTART | G1 |
| FP-SET-03 | GitHub/Gist、备份和其他当前集成设置 | 配置字段、启停、测试和状态展示保留，敏感项可一次重授权 | ADAPTED/REAUTHORIZE | NAV+ACT+RECOVERY+REAL | G2 |
| FP-SET-04 | 欢迎引导与重置入口 | 当前引导、重置和再次打开行为保留 | SHARED | NAV+ACT+RESTART | G2 |
| FP-COMPAT-01 | 非可见兼容模块：alias-map 组 story-core、backup、detailed-outline、editor；dispatch-only 组 geography、power-system、master-studies、data-management | 保留冻结 commit 的真实 Workspace 分派语义，不白屏、不丢上下文；分别验证两组，并记录 Sidebar 展示归一与真实 dispatch 的差异，不能把 `LEGACY_ALIASES` 当作完整路由重定向表 | SHARED | NAV+DATA+RESTART | G1 |

### 5.9 数据语义硬门

- 当前项目 JSON 只能称为“项目可移植备份”。在它仍不包含快照、未完成导入/原文 Blob、全局 Prompt/Workflow、AI 用量、凭据、文件夹绑定、偏好和草稿时，UI 不得称其为“完整应用备份”；完整资料迁移使用 FullMigrationArchive。
- JSON、快照、Gist、Gist revision 和本地文件夹恢复默认都创建新项目，不覆盖当前项目。未来若新增覆盖恢复，必须是独立危险入口和单事务操作。
- 活动工作区每 5 分钟创建自动快照且每项目只保留最新 20 个自动快照；手动快照不参与清理。绑定目录进入即写并每 5 分钟写；Gist 在启用且连接时每 10 分钟写。
- 删除项目、删除世界、删除项目参考和启用多世界等危险动作，在取消时必须数据库零变化；“先备份”必须确认有效文件写入成功后才能继续，级联和迁移必须单事务。
- 文档导入强杀恢复后不得重复已完成 AI 调用；保存的原文 Blob 仅在完成或明确放弃后清理。
- 所有恢复、迁移和导入验收都核对表记录、树结构、外键、富文本、Blob 和 hash，不能只看项目数量或成功提示。

### 5.10 通过规则

- G1 前：每个 FP 行已 BASELINED；所有生产可达的纯前端面板完成真实 WebView2 render smoke；依赖浏览器 API/Worker/画布/编辑器/流式/文件的行已有代表性探针，且无 UNKNOWN/BLOCKED/兼容性 PARTIAL。
- G2 前：上表及 D0.5 动作级 manifest 全部 PASS，包含作者真实数据；不接受以“自用暂时不用”为理由跳项。
- beta/stable 前：在发布矩阵上重复全部高风险和受系统影响的动作；所有行仍为 PASS，并完成 Web/PWA 回归。
- 任何新增功能都必须同步 manifest 和对应 FP 行；桌面版不能永远晚于 Web 版，发布时两端共享功能基线必须一致。

beta/stable 的 PWA 回归是 D4/D5 发布阶段的独立质量要求，不把 installed PWA 重新变成 D0.4、D0.5 或 D1 的必需参考基线。

---

## 6. D0 · 治理、契约与基线

### D0.1 · 纳入唯一施工权威

**位置**

- docs/MASTER-BLUEPRINT.md
- docs/ROADMAP.md
- docs/COLLAB-WORKFLOW.md（仅在流程确需补充时）

**前置**

- 本规划已由用户确认。
- Claude 完成对本规划的审查。

**改法**

1. 在 MASTER-BLUEPRINT 增加 Windows Desktop 专项 Phase，引用本文件。
2. 把第 1.4 节功能零丢失红线、第 5 节矩阵、D0.5 自动覆盖检查及 G1/G2/stable 的 100% PASS 条件写入主蓝图，不得只引用一句“保持兼容”。
3. 登记 D0–D5 依赖、停止信号和阶段完成记录位置。
4. 在 ROADMAP 标记当前阶段，不把“已规划”写成“已完成”。
5. 明确每个任务单独分支、PR 和验证证据。

**验证**

- 文档链接有效。
- MASTER-BLUEPRINT 与本规划的任务 ID、顺序、完成判据一致。
- MASTER-BLUEPRINT 明确“当前生产可达功能全部等价、动作级清单 100% PASS 才能发布”，没有把红线降成建议项。
- 不存在第二套相互冲突的桌面施工清单。

**完成判据**

桌面任务正式进入唯一施工权威，后续 Agent 能按 ID 接手。

---

### D0.2 · 冻结应用身份与支持范围

**位置**

- 新增桌面决策记录。
- 后续 src-tauri/tauri.conf.json。

**前置**

- D0.1 已 PASS。
- 读取 package.json、PWA manifest、README 的现有品牌与公开仓库事实。
- 作者已确认首个 D4.1 自用候选使用 `CN=StoryForge Self-Use` 本机自签名 Authenticode 证书、仅供作者本人；正式 publisher/受公共信任证书 Subject 延后到 D5.2，不是 D0.2 的完成依赖。

**改法**

1. 在 [`windows-desktop/APP-IDENTITY-DECISION.md`](./windows-desktop/APP-IDENTITY-DECISION.md) 冻结：
   - productName。
   - 产品显示名与主窗口标题。
   - 正式 identifier。
   - 开发 identifier。
   - 主窗口 label。
   - Windows 10 build 19045 / Windows 11 x64 首发支持边界。
   - 正式 UDF/dataDirectory 策略。
2. 开发构建只使用假数据和开发 profile。
3. 在真实数据迁移前切换并冻结正式 identifier；进入真实数据后不得改名。
4. 自用、beta、stable 使用同一正式数据身份，避免公开发布前再次迁库。
5. CDP 调试端口和调试 profile 严格遵守 AGENTS.md：动态端口、独立 profile、记录 PID、按记录清理。
6. 身份变更和版本回滚只走应用层备份/FullMigrationArchive；禁止复制或修改 WebView2 UDF/LevelDB 文件。

**D0.2 静态验证**

- 决议与 package.json、PWA manifest、README 的品牌和仓库命名空间一致。
- 开发/正式 identifier 合法且不同；self-use/beta/stable 没有第二正式数据身份。
- productName、displayName、identifier、label、dataDirectory、支持边界、升级不可变项和回滚规则均有唯一值。
- 首个 self-use 候选明确为仅作者机器信任的本机自签名版本，私钥不得导出或进入仓库/artifact；未配置 Tauri Updater 签名时不得启用自动更新，self-use artifact 不得进入 beta/stable。
- 正式 Authenticode publisher/证书 Subject 无占位或猜测，并明确登记为 D5.2 的公开发布前置。

**D1.3 延后运行验证（失败会重开 D0.2，并阻止 G1/真实数据）**

- 开发版与正式版 profile 互不可见。
- 同 identifier 覆盖升级后 Dexie 数据仍在。
- 修改 identifier/dataDirectory 的测试能明确表现为另一个空 profile；恢复原身份后原数据重新出现，不会被误诊为数据丢失。
- 卸载/重装保留数据，UDF 不可写、磁盘不足和 WebView2 缺失路径安全失败。

**完成判据**

应用身份、UDF、支持矩阵、回滚策略及作者自用本机自签名边界形成不可随意修改的决议；本次决议提交、静态验证和独立审查闭环后 D0.2 可标 PASS。受公共信任的正式证书 Subject 在 D5.2 冻结，不反向阻塞 D0.2。运行时验证由 D1.3 补交，避免 D0.2 与 D1 的依赖循环；失败时必须重开本任务。

---

### D0.3 · 定义 RuntimeAdapter 契约

**位置**

- 新建 src/runtime/contract.ts。
- 新建 src/runtime/web/。
- 新建 src/runtime/tauri/。

**前置**

- 盘点浏览器专属能力：AI/Embedding HTTP 与流式响应、GitHub/Gist、文件、目录备份、外链、剪贴板、凭据、存储持久性、PWA/Service Worker 分发、更新、诊断。
- 盘点已持久化的相对 Vite proxy `baseUrl`；桌面实现必须用精确 alias 映射到受控 origin，不能把请求发往 Tauri 自身 origin。
- 逐项回答 CLAUDE.md 四问。

**改法**

定义最小业务接口：

~~~ts
interface RuntimeAdapter {
  kind: 'web' | 'tauri'
  ai: AiTransport
  gist: GistTransport
  files: FileTransport
  secrets: SecretStore
  clipboard: ClipboardTransport
  external: ExternalLink
  durability: DataDurability
  distribution: DistributionRuntime
  updates: AppUpdate
  diagnostics: Diagnostics
}
~~~

要求：

- Web 实现包装现有浏览器能力和 Vite proxy。
- Tauri 实现通过窄类型 command/channel 调用 Rust。
- AI 只允许固定 chat/embedding POST；GitHub/Gist 使用独立 fixed-host broker。禁止暴露任意 URL、method、header、路径、shell 或动态 command-name 接口。
- 使用一个构建时 runtime target 选择实现。
- 业务组件不得直接访问 Tauri 插件。
- Rust 不访问 Dexie 业务数据；需要项目数据时由注册表派生的 TypeScript 层提供最小 DTO。
- Prompt/body 构造、SSE 解析、业务重试、usage 记账和 adopt 留在共享 TypeScript；Tauri Channel 只传原始字节，AbortSignal 必须能取消真实底层请求。
- SecretStore 只提供 set/delete/exists，网络请求只传 credentialId，不提供读取明文 secret 的接口；preset/Gist 删除时同步删除对应凭据。
- 文件公开接口使用 purpose union；目录持久授权只向业务层暴露 bindingId，禁止 `readFile(path)` / `writeFile(path)` 这类绝对路径万能接口。

**验证**

- Fake RuntimeAdapter 可在 Vitest 中覆盖成功、用户取消、Abort、超时、权限拒绝和磁盘错误。
- 覆盖中文 UTF-8 跨 chunk、真实 abort、proxy alias、Gist fixed-host、文件取消/原子写失败和 secret canary。
- 架构检查禁止业务目录导入 Tauri API，并阻断残留的直接 fetch、File System Access、clipboard、Service Worker 和万能 IPC。
- Web adapter 接入后当前生产 `web-tab` 行为、Web/PWA 构建契约和 npm run ci 不回归；installed PWA 动态实测为可选补充。

**完成判据**

所有已盘点 browser-only 调用都有唯一 owner；业务目录零直接 fetch/File System Access/clipboard/Service Worker/Tauri import，且不存在万能 IPC 或散落运行时判断。

---

### D0.4 · 建立功能、性能和安全基线

**位置**

- docs 或专用 benchmark/QA 报告目录。
- 后续 .qa-reports/windows-desktop/。

**前置**

- 固定参考 Windows 机器、Edge/Chrome、WebView2、显卡驱动和测试项目夹具。

**改法**

以当前生产 `web-tab` 记录唯一必需参考基线；installed PWA 只在不拖延主线时采集为补充观察：

- 冷启动、热启动和打开最大项目耗时。
- 编辑器输入延迟、自动保存耗时和长任务。
- 30 分钟内存增长。
- 1080p60 视频单独播放与视频 + Web 的 dropped frames；视频 + installed PWA 为可选补充。
- AI 流式首 chunk、取消和持续输出。
- 10MB、100MB、500MB、1GB Blob/迁移档位。
- 在冻结夹具上记录功能结果、规范化业务数据 hash、浏览器关闭后重开持久化和失败恢复。

未安装、未测或无法自动化 installed PWA 不阻塞 D0.4 PASS、D0.5 开始或 D1 推进；它也不能替代生产 `web-tab` 的任一必需证据。除移除 PWA 的必需参考地位外，D0.4 的夹具、功能、性能、恢复、安全、原始样本和报告完整性要求均不放宽。

同时冻结最坏安全场景：

- 迁移或更新导致手稿不可用。
- WebView XSS 调用高权限原生命令。
- 密钥或正文进入日志、迁移包、诊断包。
- 更新签名私钥泄露或遗失。

**验证**

- `npm.cmd run check:desktop-baseline` 校验协议、Schema、样例与裁决边界。
- `npm.cmd run check:desktop-fixtures` 先从真实 Dexie schema 重建并逐字节核对已提交的 `empty-v1` / `small-v1` 与严格 manifest，再校验确定性 ID/正文、canonicalizer 边界、42 表注册表覆盖、主键重映射、导出导入语义引用与规范化 source/re-export 业务 hash 等值；该命令不替代真实浏览器证据。
- 同一项目、章节和操作脚本至少运行三轮。
- 记录环境、PID/进程树和原始指标。
- 不使用“感觉更轻”作为结果。

**完成判据**

D0.4 协议规定的夹具、生产 `web-tab` 功能/规范化数据 hash/性能/恢复/安全与报告证据完整；D1/D4 的 Tauri + WebView2 候选能与该固定基线逐项比较，并有明确 Go/No-Go 数据。当前 `empty-v1` / `small-v1` 可重建文件与严格 manifest 已生成并校验，`small-v1` 嵌套引用与规范化往返业务 hash 均已 PASS；large/blob/legacy 完整夹具与动态实测仍未齐，不得标 PASS。

---

### D0.5 · 冻结动作级功能基线与自动覆盖检查

**位置**

- 新建 docs/windows-desktop/feature-parity-baseline.json。
- 新建 docs/windows-desktop/FEATURE-PARITY-REPORT.md。
- 新建 scripts/check-desktop-parity.mjs。
- package.json 新增 check:desktop-parity，并纳入 npm run ci。

**前置**

- D0.1–D0.4 完成。
- 冻结待客户端化的生产版 commit。
- 第 5 节初始矩阵已完成代码复核。

**改法**

1. 使用 TypeScript compiler API 做静态 AST 扫描，不执行应用模块；扫描并登记：
   - 以 src/main.tsx 为根可达的启动动作，以及 src/App.tsx 的生产路由。
   - src/components/layout/sidebar-tree.ts 的每个叶子 SidebarModule。
   - SidebarModule 联合、Sidebar 展示 alias-map、WorkspacePage 的真实模块分派与 lazy panel；动态分类 visible、alias-map、dispatch-only，并记录 aliasDispatchDivergence。
   - SettingsPage、DataManagementPanel、导入/导出/版本历史对话框。
   - 自动保存、本地快照、文件夹备份、Gist 备份等后台 hooks。
   - 所有生产可达按钮、菜单、快捷键、拖放区、文件格式、AI 动作和错误恢复动作。
2. 每个动作记录 actionId、FP ID、源码入口、前置数据、Web 预期、Desktop 预期、实现类别、风险、证据要求和当前状态。
3. 对仅开发可达、测试专用或历史文档残留项记录排除理由；“尚未盘点”不能作为排除理由。
4. 建立静态覆盖检查：
   - 新增路由、SidebarModule、Workspace 分支或显式 feature action 未登记时失败。
   - manifest 指向不存在的入口时失败。
   - 当前可达动作被删除但没有 APPROVED_SCOPE_CHANGE 记录时失败。
   - 可见 module 无 Workspace 分派、非可见 module 未分类、alias 环/目标缺失或 alias 与真实 dispatch 差异未登记时失败。
   - UNKNOWN/BLOCKED 不能通过阶段闸门。
   - 当前路由、leaf 或兼容 module 的数量只能用于报告，不得硬编码为通过条件。
5. 把冻结 Web 夹具、最大项目、含 Blob 项目和真实数据匿名验证摘要绑定到 baselineVersion 和 sourceCommit。
6. 由 Claude 复核“是否漏功能”，Codex 修正清单；分歧升级给作者决定产品范围。

**验证**

- npm run check:desktop-parity 通过。
- 人为增加一个未登记侧栏模块、路由和动作时检查分别失败。
- 人为增加未分类非可见 module、缺少 Workspace 分派、alias 环/无目标及未登记 alias/dispatch divergence 时检查分别失败。
- 人为删除一个 manifest 行或改成 UNKNOWN/BLOCKED 时闸门检查失败。
- 第 5 节每个聚合 FP 行至少有一个 actionId，所有实际侧栏叶子都有唯一映射。
- manifest、人工报告和源码扫描数量一致；排除项都有生产不可达证据。

**完成判据**

动作级功能基线已绑定冻结 commit，可自动发现新增/删除入口；后续任何“客户端已完成”声明都必须引用该清单的逐项 PASS 证据。

---

## 7. D1 · Tauri Vertical Slice

### D1.1 · 建立正式 Tauri 2 壳

**位置**

- 新建正式 src-tauri/。
- package.json。
- vite.config.ts。

**前置**

- D0 全部完成。
- 不直接扩写 tmp/tauri-poc。

**改法**

1. 建立 Tauri 2 Rust 工程。
2. main.rs 只调用 lib::run()。
3. 配置 beforeDevCommand、beforeBuildCommand 和 frontendDist。
4. Web 与 desktop 使用独立输出目录，避免混入 PWA 文件。
5. 第一版 capability 只开放 core 最小能力。
6. 配置非空 CSP；不复制 PoC 的 csp: null。
7. 增加桌面开发、构建和信息检查脚本。

**验证**

- 无 Vite/Node 服务时，打包程序可以离线打开首页。
- React lazy chunks、CSS、字体和 pdf.js worker 均能加载。
- Web 构建产物不受影响。
- cargo fmt、cargo clippy、cargo test 和桌面 build 通过。

**完成判据**

正式 Tauri 壳可重复构建，且不依赖 tmp/tauri-poc 或线上 UI。

---

### D1.2 · 条件化 base、router、PWA 与 Service Worker

**位置**

- vite.config.ts。
- src/main.tsx。
- src/lib/pwa/register-service-worker.ts。
- index.html。

**前置**

- D1.1 完成。

**改法**

- Web/PWA 保留 /storyforge/、BrowserRouter 和 Service Worker。
- Desktop 使用相对资源 base，并优先使用 HashRouter。
- Desktop 构建完全禁用 VitePWA 和 Service Worker 注册。
- Desktop 不执行 Web 本地开发环境的 Cache/SW 清理逻辑。
- 移除桌面所需路径中的 /storyforge/ 硬编码。
- 将远程字体改为本地打包字体。

**验证**

- 首页、设置页、项目页直接启动与重启都不白屏。
- Desktop 不请求 /storyforge/assets 或 /storyforge/sw.js。
- Web manifest、Service Worker 构建契约和线上 `web-tab` 路由不回归；installed PWA 安装态 smoke 在 D1 为可选补充，不阻塞 D1。

**完成判据**

Web 和 Desktop 两种构建各自正确，且只由单一 runtime target 控制差异。

---

### D1.3 · 验证 Dexie/WebView2 数据持久化

**位置**

- src/lib/db/schema.ts。
- src/lib/db/ensure-schema.ts。
- Tauri UDF 配置。

**前置**

- D1.2 完成。
- 只使用合成夹具，不使用真实用户库。

**改法**

1. 在开发 profile 创建假项目。
2. 覆盖项目创建、章节编辑、自动保存、关闭、重启和覆盖升级。
3. 验证 schema upgrade fixtures。
4. 确认桌面启动顺序不会在迁移检查前 seed 用户 Prompt/Workflow。
5. 不改变现有 Dexie 数据模型，不引入 SQLite。
6. 补交 D0.2 的运行验证：dev/stable 双向哨兵隔离、同正式身份覆盖升级、测试 identifier/dataDirectory 空 profile 与恢复原身份。
7. 验证卸载/重装默认保留正式 UDF，以及 UDF 不可写、磁盘不足、WebView2 缺失时不激活半初始化库。

**验证**

- 重启和覆盖安装后数据仍在。
- REQUIRED_TABLES、PROJECT_TABLES 和 Dexie 双向一致。
- 生产路径不因 schema 检测异常删除数据库。
- D0.2 身份矩阵的运行验证全部通过；任一失败立即重开 D0.2，并阻止 G1 和真实数据迁移。

**完成判据**

WebView2 内 Dexie 能稳定承担现有业务数据，UDF 身份明确，且 D0.2 延后运行验证有可复现证据。

---

### D1.4 · 验证 IPC、流式和文件最短闭环

**位置**

- src/runtime/tauri/。
- src-tauri/src/commands/。
- src-tauri/capabilities/main.json。

**前置**

- D0.3 RuntimeAdapter 契约完成。

**改法**

建立不接真实密钥和真实用户数据的最短闭环：

- request/response command。
- Rust → React typed Channel 流。
- 用户取消后 Rust 任务真正停止。
- 原生打开/保存对话框。
- 受控外链交给系统浏览器。
- 结构化、脱敏错误。

**验证**

- 流数据按任意字节边界拆分时中文不乱码。
- 文件选择取消被当作正常结果。
- 未授权 command、越权路径和非法 URL 被拒绝。
- capability 中不存在 shell execute、任意 HTTP 或全盘 FS。

**完成判据**

UI → Adapter → IPC → Rust → 副作用 → UI 的整条链路可测试且权限最小。

---

### D1.5 · G1：WebView2 Go/No-Go

**位置**

- D0.4 对应的 benchmark/QA 报告。
- docs/windows-desktop/FEATURE-PARITY-REPORT.md。

**前置**

- D0.5、D1.1–D1.4 完成。

**验证**

- 最大假项目打开、编辑、自动保存和重启。
- 使用冻结夹具依次进入每个生产路由和 SidebarModule，验证 lazy chunk、面板渲染、返回和旧 module id 恢复。
- 粘贴文本及 TXT/MD/CSV/PDF/DOCX 导入、暂停续跑、lazy chunks、画布和编辑器。
- mock AI 流式、断流、取消。
- 对第 5 节每个 ADAPTED/REAUTHORIZE/DESKTOP_REPLACEMENT 行运行最短能力探针；尚未在 D1 完整实现的行也必须证明存在可行的 RuntimeAdapter/IPC 路径。
- Edge 播放 1080p60 视频，同时进行空闲、编辑和流式操作。
- 按 D0.4 `d0.4-v2` 对同一夹具逐项比较 WebView2 与冻结生产 `web-tab` 的功能结果、规范化数据 hash、性能、重启/失败恢复和安全证据；installed PWA 缺失不阻塞 G1。

**建议门槛**

- 冷启动到可交互不超过 3 秒；若参考机器较慢，以生产 `web-tab` 基线 + 20% 为上限。
- 编辑输入响应 p95 小于 100ms。
- 视频 dropped frames 相对“仅视频”增加不超过 1 个百分点。
- 30 分钟稳定负载无持续内存增长，停止任务后工作集能够回落。
- 不出现 WebView2/GPU 黑屏、崩溃或关键 Web API 不兼容。
- 动作级 manifest 覆盖率 100%；所有 FP 行均已分类并有可行性证据，不存在 UNKNOWN/BLOCKED/兼容性 PARTIAL。

**No-Go 条件**

- 必需编辑器、Worker、流式或文件能力出现无法绕过的 WebView2 缺陷。
- 任一当前功能只能隐藏、置灰、回浏览器完成或依赖 Vite/Node/手工代理。
- 任一生产入口未登记、没有 Desktop 实现路径，或无法给出可执行验收方法。
- 性能在完成一次针对性优化后仍明显劣于冻结的生产 `web-tab` 必需基线；若有 installed PWA 样本，仅作为补充对照单列。
- 修复核心兼容问题预计超过切换 Electron 的成本。

**完成判据**

形成逐 FP 行的书面 Go/No-Go 记录。G1 是“全功能可实现性”闸门，不等同于全部功能已经完成；只有覆盖率 100%、无 UNKNOWN/BLOCKED 且整体为 Go，才能进入真实迁移与原生能力施工。No-Go 必须另开 Electron 评估，不得私自双栈并行。

---

## 8. D2 · FullMigrationArchive

### D2.1 · 冻结迁移数据分类

**位置**

- src/lib/registry/types.ts。
- src/lib/registry/project-tables.ts。
- 新增非 Dexie 设置迁移允许列表。

**前置**

- D1 通过 G1。
- 当前 ProjectExportData 继续保留为“项目分享/普通备份”协议。

**改法**

在 PROJECT_TABLES 的 TableSpec 中增加迁移元数据，不另写第二份表名清单。建议表达：

~~~ts
type MigrationPolicy =
  | 'required'
  | 'optional-history'
  | 'operational'
  | 'omit-and-rebuild'

interface TableMigrationSpec {
  policy: MigrationPolicy
  binaryFields?: string[]
  recordFilterId?: string
  recoveryAction?: string
}
~~~

至少完成以下分类：

| 类别 | 处理 |
| --- | --- |
| 项目、正文、大纲、角色、世界观、词条、事实账本等 | 必迁，保留原始主键 |
| snapshots、用户 Prompt、用户 Workflow | 必迁用户历史；系统 seed 不重复迁 |
| importSessions/jobs/logs/files | 保留数据；未完成任务导入后进入暂停/待复核，不自动续跑 |
| aiUsageLog | 可选历史，默认纳入作者全量迁移 |
| 灵感草稿、场景校验草稿、主题、排版、欢迎引导、AI/Embedding 非密配置与预设 | 必迁用户可见状态，保持项目动态键和引用 |
| retrievalChunks、narrativeSummaryNodes | 不搬，manifest 明确登记并在目标端重建 |
| FileSystemDirectoryHandle | 不可迁，只记录“需重新授权” |
| API Key、Embedding Key、GitHub PAT | 永不进入普通迁移包 |

对 localStorage/sessionStorage 做完整盘点：

- 建立非敏感设置允许列表。
- 未登记键默认不迁移。
- 动态项目键依赖原项目 ID，因此首次迁移必须保留主键。
- 对每个未迁键记录“非用户状态 / 可重建 / 设备绑定 / secret”理由；不能以“在 localStorage”作为省略理由。

**验证**

- PROJECT_TABLES 与 Dexie 双向覆盖。
- 每张表都有明确迁移 policy。
- 新增表而未登记迁移 policy 时 CI 失败。
- 迁移代码不存在硬编码全表数组。

**完成判据**

新增 Dexie 表时，schema、类型和 PROJECT_TABLES 更新后，全量迁移自动感知。

---

### D2.2 · 定义迁移包和类型保真协议

**位置**

- src/lib/migration/archive-types.ts。
- src/lib/migration/value-codec.ts。
- src/lib/migration/canonical-hash.ts。

**前置**

- D2.1 完成。

**改法**

定义扩展名 .storyforge-migrate。内部使用可流式读取的 ZIP64 或经容量 PoC 证明等价的容器：

~~~text
manifest.json
tables/<table>.ndjson
blobs/importFiles/<primary-key>-<sha256>.bin
settings/preferences.json
reports/source-audit.json
checksums.sha256
~~~

manifest 至少包含：

~~~ts
interface MigrationManifest {
  format: 'storyforge-profile-migration'
  formatVersion: 1
  exportId: string
  exportedAt: string
  source: {
    appVersion: string
    schemaVersion: number
    dbName: string
    origin: string
  }
  tables: Array<{
    name: string
    policy: string
    keyPath: string | string[]
    count: number
    bytes: number
    sha256: string
  }>
  blobs: Array<{
    table: string
    primaryKey: string | number
    field: string
    file: string
    size: number
    sha256: string
    mimeType?: string
  }>
  omissions: Array<{
    resource: string
    reason: 'rebuildable' | 'device-bound' | 'secret'
    recoveryAction: string
  }>
  contentDigest: string
}
~~~

协议要求：

- 表记录采用确定性规范序列化。
- 明确定义 undefined、Date、ArrayBuffer、TypedArray、Blob、NaN/Infinity 和不支持值的处理；不得被 JSON.stringify 静默删除。
- Blob 独立存储，不转 Base64 塞进大 JSON。
- contentDigest 基于按路径排序的 payload path、size、SHA-256 计算，避免自包含哈希循环。
- 解压必须防 Zip Slip、重复路径、超大压缩比和路径穿越。
- 未知格式版本默认拒绝，不做猜测性导入。

**属性测试**

迁移序列化必须先写性质，再写实现：

- decode(encode(x)) 与合法输入 x 语义相等。
- canonical(canonical(x)) 等于 canonical(x)。
- 相同数据重复编码得到相同内容哈希。
- 任意 payload 字节改变都会导致验证失败。
- 解码器对任意非法输入不 panic、不执行内容、不越界写文件。

TypeScript 候选使用 fast-check，Rust 解析器候选使用 proptest；新增依赖前先做维护性、许可证和供应链检查。

**验证**

- 空库、小库、深层 JSON、Unicode、极限数字、Blob 等夹具往返。
- 修改任意表、Blob、manifest 或路径后必须拒绝。
- 10MB、100MB、500MB、1GB 包验证内存不会随完整包线性翻倍。

**完成判据**

迁移包能独立回答来源版本、数据范围、遗漏原因、计数和完整性。

---

### D2.3 · 实现旧网页全量导出器

**位置**

- src/lib/migration/profile-export.ts。
- src/pages/MigrationExportPage.tsx。
- Web RuntimeAdapter 文件输出实现。

**前置**

- D2.2 完成。
- 生产旧 origin 仍可访问。

**改法**

1. 新增同源迁移页，由旧网页正常读取自己的 IndexedDB。
2. 导出前执行：
   - ensureSchema 只读健康检查。
   - PROJECT_TABLES 完整性检查。
   - 项目、表、Blob 数量和预计大小统计。
   - navigator.storage.estimate。
   - 检测其它 StoryForge 标签页是否仍在写入。
3. 在一致性读取窗口导出整个工作区，不逐项目调用普通 ProjectExportData。
4. 导出前后生成源审计摘要，确认源库计数和哈希未变化。
5. 大包优先流式写入用户选定文件；无法流式时按容量阈值阻止内存爆炸。
6. 页面明确显示：
   - 检测到的项目数量与名称。
   - 数据与 Blob 大小。
   - 可重建和不可迁项。
   - “不会删除浏览器数据”。

**验证**

- Chrome 和 Edge 正确 profile 都能导出。
- 其它标签页持续写入时不得生成“成功”包。
- 导出前后源库权威表计数和哈希不变。
- 包中不出现测试 API Key/PAT。

**完成判据**

旧网页能生成包含全部不可重建用户数据和 Blob 的可验证迁移包，且源库零修改。

---

### D2.4 · 实现客户端首次导入状态机

**位置**

- src/lib/migration/profile-import.ts。
- src/lib/migration/migration-journal.ts。
- src/components/migration/FirstRunMigration.tsx。
- src-tauri/src/migration/。

**前置**

- D2.3 完成。
- 客户端继续使用当前 Dexie schema。

**改法**

启动状态机：

~~~text
uninitialized
→ awaiting-choice
→ archive-received
→ archive-verified
→ importing
→ data-verified
→ activated

任意中间状态 → failed → clean-target-and-retry
~~~

规则：

1. journal 存在 Tauri AppData，不依赖尚未激活的业务 DB。
2. 仅在客户端项目、用户模板和完成标记均为空时允许原主键导入。
3. Rust 先流式解包到独立 staging 目录并验证全部哈希。
4. 目标磁盘可用空间至少满足解压、目标库和恢复余量；建议按解压后体积 2–3 倍预检。
5. TypeScript 通过 Dexie 分批 bulkPut 显式主键。
6. 迁移验证完成前禁止进入工作区，Prompt/Workflow seed 也不得抢先执行。
7. 可重建缓存进入后台重建队列，不阻塞激活。
8. 失败时只清理未激活的客户端新库和 staging；不触碰源浏览器或迁移包。
9. 客户端已有数据时立即停止，不隐式覆盖、不自动合并。

由于 IndexedDB 不适合跨巨大 Blob 维持一个长事务，首版“全有或全无”采用：

- 目标必须为空。
- journal 记录阶段。
- 未通过验证的库永不激活。
- 失败后关闭并删除未激活目标库，再安全重试。

**验证**

- 在每张表、每个批次、每个 Blob 和每个 journal 状态模拟进程终止。
- 重启后能识别未完成迁移并安全清理/重试。
- 导入后新增 autoIncrement 记录不会覆盖旧主键。
- 失败时 UI 看不到半成品项目。

**完成判据**

迁移只有“完整激活”或“保持未迁移”两种可见结果。

---

### D2.5 · 实现源—目标验证器与 MigrationReceipt

**位置**

- src/lib/migration/profile-verify.ts。
- tests/migration/。

**前置**

- D2.4 完成。

**改法**

验证至少覆盖：

- 每张权威表行数和规范内容 SHA-256。
- 每个 Blob 字节数和 SHA-256。
- 每章正文逐字哈希。
- outline parent、chapter → outline、world portal、worldGroup 归属。
- detailedOutline 的角色数组、scenes JSON 和 foreshadow 引用。
- characterRelations。
- temporalFacts 全部实体、章节和自引用。
- chapter 内 continuityHandoff.chapterId 等 self ID。
- 项目数、章节数、总字数摘要。
- omittedAsRebuildable 项有明确重建队列。
- 客户端重启后关键哈希再次一致。

生成不含正文和密钥的 MigrationReceipt：

~~~ts
interface MigrationReceipt {
  exportId: string
  archiveSha256: string
  sourceAppVersion: string
  sourceSchemaVersion: number
  targetAppVersion: string
  importedAt: string
  tableResults: unknown[]
  blobResults: unknown[]
  rebuildQueue: string[]
  integrityErrors: unknown[]
  status: 'verified' | 'failed'
}
~~~

**验证**

- 删除一条关系、修改一个正文字符、替换一个 Blob 都能定位具体表和键。
- 已知 detailedOutlines 数组/JSON 引用缺陷有独立反例。
- receipt 和日志不包含正文、Prompt、API Key 或 PAT。

**完成判据**

只有 receipt.status 为 verified 才允许写入 activated 标记并进入客户端。

---

### D2.6 · 迁移失败注入和旧版本矩阵

**位置**

- tests/migration/。
- tests/regression/。
- Windows E2E 脚本。

**前置**

- D2.1–D2.5 完成。

**验证**

- Chrome、Edge、不同 profile。
- v29/v31/v33/v34/v35/v37 旧库夹具。
- 空库、小项目、多项目、最大项目、含 Blob/快照/自定义模板。
- 浏览器仍写入、错误 profile、传输中断、包截断、包篡改。
- 磁盘满、WebView2 崩溃、进程被杀、单表失败。
- 重复 exportId、客户端已有数据、升级后首次重启。

**核心性质**

- 任意失败后源浏览器库哈希不变。
- 任意未完成 journal 都不能激活目标库。
- 重试不会产生重复项目。
- 同一个 exportId 第二次导入是无副作用拒绝。
- 可重建项省略不会影响创作主路径。

**完成判据**

所有失败最多损失本次迁移时间，不损失源数据，不留下假成功客户端。

---

### D2.7 · 文件主路径与后续一键增强

**前置**

- D2.2–D2.6 全绿。

**首版主路径**

- 旧网页生成一个 .storyforge-migrate。
- 客户端原生文件选择器选择该文件。
- 导入成功后不自动删除文件。
- 普通项目 JSON 与全量迁移包在 UI 中明确区分。

**作者代迁**

- Codex 负责打开正确浏览器 profile、触发导出、选择客户端导入、等待验证并保存 receipt。
- 作者不需要查看或编辑 JSON。
- 作者只需在浏览器/Windows 安全模型要求时解锁 profile、关闭其它编辑页或点击一次授权。
- 实际浏览器/桌面控制前，按 AGENTS.md 仅临时启用所需 MCP，任务完成后恢复低内存配置。

**后续增强，不阻塞首版**

- 客户端随机 loopback 端口 + 256 位一次性 token。
- 只监听 127.0.0.1。
- token 放 URL fragment，短时过期、单次使用。
- 精确 Origin、CORS、Private Network Access、大小限制和重放防护。
- 任一失败自动回退文件路径。

**验证**

- 在无 loopback 增强、无浏览器开发工具的条件下，文件路径独立完成导出、导入、逐表/hash 验证和 receipt 保存。
- 作者无需打开、编辑 JSON 或运行命令；拒绝/取消一次系统授权后可安全重试。
- 普通项目 JSON 与 FullMigrationArchive 在扩展名、文案、导入入口和校验级别上不会混淆。

**完成判据**

文件路径可独立完成同等级全量迁移；一键增强不得成为唯一恢复方式。

---

## 9. D3 · 原生运行时能力

### D3.1 · Rust 流式 AI/Embedding Transport

**位置**

- src/runtime/contract.ts。
- src/runtime/tauri/ai.ts。
- src-tauri/src/commands/ai_stream.rs。
- src-tauri/src/security/endpoint_policy.rs。

**前置**

- D1.4 流式 PoC 通过。
- 现有 TS SSE 解析、重试和取消语义有回归测试。

**改法**

- Rust 使用 reqwest 流式读取并通过 Tauri typed Channel 发送 started/chunk/done/error。
- requestId 映射 cancellation token；取消必须关闭真实网络请求。
- 业务重试只保留一层，避免 Rust 和 TS 双重重试。
- 内置 Provider 使用精确 origin/path policy。
- 自定义 Provider 首次保存或 origin 改变时二次确认。
- 默认仅 HTTPS；HTTP 只允许显式启用的 loopback。
- LAN 模型另设高级开关。
- 拒绝危险协议、URL userinfo、metadata/link-local/multicast。
- 重定向默认禁用；如允许，只能同 origin，跨 origin 不携带 Authorization。
- 限制并发、请求体、响应体、超时和重试次数。
- GitHub/Gist 使用独立固定 host broker，不成为通用代理。

**验证**

- 200、401、429、503、断流、超时、取消。
- 中文跨 chunk 边界。
- OpenAI、DeepSeek 和当前主要 Provider 真实流各一次。
- URL 正规化幂等；任意未批准 origin 必拒绝。
- Authorization 不出现在 renderer、错误和日志。

**完成判据**

打包版所有现有 AI 主路径可真正流式运行，且 renderer 没有任意 Provider 网络能力。

---

### D3.2 · Windows Credential Manager

**位置**

- src/runtime/tauri/secrets.ts。
- src-tauri/src/commands/secrets.rs。
- AI/Gist 配置 store。

**前置**

- D3.1 网络 broker 接口稳定。

**改法**

- Windows 使用 Credential Manager；跨平台以后再映射 Keychain/libsecret。
- JS 只保存 credentialId、provider、model 和 approvedOrigin。
- Rust 只提供 set/delete/exists，不返回 secret。
- 网络请求在 Rust 内按 credentialId 取密钥。
- 清理 Web Storage 中的 AI、Embedding、preset 和 Gist PAT 历史副本。
- 凭据库不可用时 fail closed，不降级明文 localStorage。
- 迁移包、普通导出、日志和诊断包永不包含凭据。

**验证**

- 使用 canary secret 扫描 localStorage、sessionStorage、IndexedDB、迁移包、日志和诊断包，零命中。
- 保存、切换、删除 preset 和断开 GitHub 后凭据生命周期正确。
- 恶意 renderer 无法通过 command 或错误读回密钥。

**完成判据**

WebView 和业务数据库中无长期明文凭据，所有认证由 Rust 注入。

---

### D3.3 · 原生文件与自动备份

**位置**

- src/runtime/web/files.ts。
- src/runtime/tauri/files.ts。
- src-tauri/src/commands/files.rs。
- 现有导入、导出和 folder-backup 调用点。

**前置**

- 项目数据导出/导入仍由 PROJECT_TABLES 生命周期 API 派生。

**改法**

- Web adapter 保持现有 input/Blob/File System Access API。
- Tauri adapter 使用原生打开、保存和目录选择。
- Renderer 只持有 bindingId，Rust 保存用户明确选择的规范化目录。
- 自动备份使用 bindingId + 安全文件名，不能接受任意绝对路径。
- 写文件使用同目录临时文件、flush 和 rename 原子替换。
- 浏览器 FileSystemDirectoryHandle 不迁移，客户端重新授权。
- 文件选择取消不弹错误。

**验证**

- JSON/TXT/MD/PDF/DOCX 导入。
- JSON/Markdown/TXT/PNG 导出。
- 自动备份跨重启保留。
- 路径穿越、非法文件名、只读目录、磁盘满、写入中断。
- 失败后上一份有效备份仍可解析。

**完成判据**

桌面端不依赖 showDirectoryPicker，且任何写入失败都不破坏上一份有效备份。

---

### D3.4 · CSP、Capability 与导航封锁

**位置**

- index.html。
- src-tauri/tauri.conf.json。
- src-tauri/capabilities/main.json。
- 外链 RuntimeAdapter。

**前置**

- 本地 UI、网络 broker、文件 broker 已可用。

**改法**

- script-src 仅 self，不允许 unsafe-inline、unsafe-eval 和第三方脚本。
- 字体本地化。
- frame/object/form/base 默认禁止。
- img 只开放实际需要的 self/data/blob。
- capability 只绑定 main 窗口。
- 禁止远端 WebView capability、shell execute、全盘 FS 和通配 HTTP。
- 阻止 WebView 导航到非应用 origin和任意新窗口。
- 外链经 allowlist 后交给系统浏览器。
- 自定义 Rust command 使用业务动作名和窄 DTO，不暴露底层万能能力。

**验证**

- 恶意 HTML、SVG、javascript URL、iframe 夹具不能执行或导航。
- release runtime 主路径无 CSP script violation。
- 断网启动所有主面板正常。
- capability denylist/snapshot 进入 CI。

**完成判据**

即使 renderer 被注入，也不能任意读盘、执行进程、读取密钥或访问任意网络。

---

### D3.5 · 隐私安全日志与诊断包

**位置**

- src-tauri/src/diagnostics/。
- 设置页诊断 UI。

**前置**

- 网络、迁移和更新流程使用稳定事件类型。

**改法**

- AppData 保存滚动结构化日志，默认 INFO。
- 只记录版本、schema、WebView2、eventId、阶段、耗时、状态码、表计数和 hash 结果。
- 不记录 Prompt、正文、AI 完整回复、Authorization、密钥、导入文件内容、绝对文档路径。
- 诊断包默认只保存在本地，不自动上传；上传必须 opt-in 并可预览。
- 提供导出与清空日志。

**验证**

- canary secret、章节片段、带 query URL 在日志和诊断包中零命中。
- 迁移、更新、启动失败时仍能定位阶段和错误码。
- 日志达到容量上限后正确轮转。

**完成判据**

诊断足以定位问题，同时不会制造第二份手稿或凭据泄露面。

---

## 10. D4 · 作者真实迁移与自用

### D4.1 · 自用候选构建

**前置**

- D2、D3 全部完成。
- npm run ci、npm run lint、Rust 闸门和 Windows smoke 全绿。
- 正式 identifier 已冻结。
- 动作级功能 manifest 中每项至少为 IMPLEMENTED；UNKNOWN、BLOCKED、兼容性 PARTIAL 为零。

**改法**

- 生成 Windows x64 NSIS 候选包。
- 自用阶段使用 `CN=StoryForge Self-Use` 本机自签名 Authenticode 证书：私钥只保留在 `CurrentUser\\My` 且不可导出，公钥证书只加入作者账户的 `CurrentUser\\TrustedPeople`；不得写入仓库、日志或 artifact，并明确仅供作者本人。
- 未配置 Tauri Updater 签名时不得启用自动更新。
- 创建迁移前客户端恢复/清空工具，只能作用于未激活客户端库。

**验证**

- 干净安装、关闭、重启、覆盖安装、卸载重装。
- 安装包及主程序的 `Get-AuthenticodeSignature` 均为 `Valid`，Signer Subject 精确为 `CN=StoryForge Self-Use`；报告只记录证书 thumbprint、artifact SHA-256 和验证结果，不记录私钥。
- 在未信任该自签名证书的环境中不得把候选包判成公共可信；对候选包做字节篡改后签名验证必须失败。
- 安装程序不要求日常管理员权限。
- 无 Vite/Node 服务仍可完整运行。
- 用冻结 baseline 动态列出的全部生产路由、可见侧栏 leaf、alias-map、dispatch-only module 和右侧属性面板逐项进入；不存在空白、占位、置灰或“请用网页版”。

**完成判据**

候选包可重复安装、所有当前功能都有真实实现路径，并具备迁移失败后的安全重试路径。

---

### D4.2 · Codex 执行作者真实数据迁移

**前置**

- 先在复制的真实库夹具上完成一次演练。
- 作者确认实际存有数据的 Chrome/Edge profile。
- 目标盘空间满足预检。

**迁移前**

1. 关闭其它 StoryForge 标签页并暂停编辑。
2. 不清缓存、不卸载浏览器、不删除任何数据。
3. 生成完整迁移包和源审计报告。
4. 迁移包保存在仓库、WebView UDF 和云同步目录之外的用户指定位置。
5. 记录项目数、章节数、总字数、逐表计数、Blob 大小和 archive SHA-256。
6. API Key/PAT 不进入包，Codex 不索取用户密钥。

**执行**

1. Codex 在正确浏览器 profile 触发同源全量导出。
2. Codex 首次打开客户端并选择迁移包。
3. 等待 archive verify → import → data verify。
4. 任何红色校验项都不得强制跳过。
5. 保存 verified MigrationReceipt。

**验证**

1. 核对项目列表。
2. 打开最大项目，检查首章、中间章、末章、大纲、世界组、角色、词条、事实账本、快照、未完成导入/Blob、用户 Prompt/Workflow 和 AI 用量。
3. 核对灵感/场景草稿、主题、排版、引导状态、AI/Embedding 非密配置与预设；只对目录和 secret 做一次重授权。
4. 编辑一章或便签，重启后确认仍存在。
5. 从客户端创建一份新备份，并分别用项目 JSON、快照、Gist/Gist revision 和绑定文件夹在隔离空库完成“创建新项目、不覆盖原项目”的恢复演练。
6. 重建未搬的检索/摘要缓存，并验证 Embedding、检索和摘要功能恢复。
7. 将客户端标记为主写端。

**完成判据**

源—目标计数、正文、引用和 Blob hash 全部一致，receipt 为 verified，客户端重启后复验通过。

---

### D4.3 · 观察期与回滚

**前置**

- D4.2 成功。

**规则**

- 旧浏览器数据和迁移包至少保留 14–30 天。
- 观察期内不要同时在 Web 和 Desktop 编辑同一项目。
- 客户端稳定前不删除网页数据。
- 若需重新迁移，清理未激活/专用测试客户端库后重新导入，禁止直接合并两份分叉数据。
- 失败只清理客户端目标；不得复制/修改 Chrome LevelDB 或 WebView UDF 救急。

**验证**

- 日常编辑与自动保存。
- AI 流式、取消、限流、错误恢复。
- 导入、导出和自动备份。
- 按动作级 manifest 轮转全部低频模块、隐藏子流程、快捷键、分散导出和失败恢复；观察期至少完成一次全量 PASS。
- 睡眠/唤醒、异常关闭、系统重启。
- 与 1080p/4K 视频并行。
- 至少一次候选版本覆盖升级。

**完成判据**

- 连续 7–14 天无数据差异、无阻断级错误。
- 关键操作无需启动浏览器、Vite 或 Node 服务。
- 备份恢复演练成功。
- 动作级 manifest 已在真实数据上全量执行一次且全部 PASS。

---

### D4.4 · G2：进入公开发布判定

**前置**

- D4.1–D4.3 完成。
- MigrationReceipt、自用日志、恢复演练和性能报告齐全。
- 动作级功能 manifest 和逐项证据报告齐全。

**验证**

必须同时满足：

- S1/S2 数据、安全、更新问题为零。
- 第 5 节所有 FP 行及其动作级子项均为 PASS；UNKNOWN、BLOCKED、PARTIAL、IMPLEMENTED、未经作者修改目标的 APPROVED_SCOPE_CHANGE 均为零。
- 每个生产路由、侧栏叶子、对话框动作、快捷键、后台任务和现有文件格式均在真实 production client 中通过，不接受“作者暂时不用”跳项。
- 至少 5 次完整迁移演练零数据差异；作者真实迁移计入其中。
- 迁移中断、磁盘满、篡改、重复导入均安全恢复。
- 真实“Web 导出 → Desktop 导入 → 重启 → 继续编辑 → AI/文件/备份 → 恢复”闭环通过；Prompt/Workflow、主题、排版和非密设置自动迁入。
- 17 个当前 AI Provider 与 Custom/Ollama 通过适配契约测试；至少完成远程 OpenAI-compatible、一个非同构 Provider 和 localhost Ollama/LM Studio 的真实 smoke。
- AI 流式/取消/超时/用量、Embedding 重建/续跑/换模型/关键词降级、Workflow 暂停/继续/重试/跳过/保存和 Gist revision/恢复/自动备份闭环通过。
- FIRST_RUN REAUTHORIZE 只发生于目录、AI Key、GitHub PAT 等外部授权；跳过不阻塞项目，完成后重启不重复询问。
- npm run check:desktop-parity 与 Web/PWA 回归通过。
- 视频并行体验达到 D1.5 门槛。
- 自用观察期完成。
- 所有未解决 S3 有明确接受人、临时措施和目标版本。

未满足任一项时停留在自用版，不公开分发。

**完成判据**

形成书面 Go/No-Go 记录；只有全部条件满足并由作者确认 Go，才能启动 D5。

---

## 11. D5 · 封闭测试与公开发布

### D5.1 · Windows CI 与可重复 NSIS

**位置**

- .github/workflows/desktop-ci.yml。
- .github/workflows/desktop-release.yml。

**前置**

- D4 通过 G2。

**改法**

PR 闸门：

~~~text
npm ci
npm run check:required-tables
npm run check:ai-manual
npm run check:architecture
npm run check:desktop-parity
npx tsc --noEmit
npm run lint
npm run test:coverage
npm run build

cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets
desktop production build
Windows package smoke
~~~

发布要求：

- PR job 不接触签名 secret。
- Tag/手动发布使用受保护 Environment 和人工批准。
- GitHub Actions 最小 permissions，第三方 Action 固定完整 commit SHA。
- package.json、Cargo.toml、tauri.conf 和 tag 版本一致。
- Windows x64、per-user NSIS 作为唯一公开载体。
- 输出 installer、updater artifact、SHA-256、SBOM 和构建元数据。
- 至少保留最近两个稳定版本。

**验证**

- 在干净 windows-latest runner 从锁文件构建、安装并启动 production desktop。
- CI 中任一 TypeScript、Rust、parity、打包或 package smoke 步骤失败时不得生成可发布状态。
- 构建元数据能追溯 source commit、依赖锁、工具链、artifact hash 和 SBOM。

**完成判据**

任意干净 windows-latest runner 能从锁定依赖生成可安装 NSIS，产物可追溯。

---

### D5.2 · 双签名与发布通道

**前置**

- 代码签名证书和更新源确定。
- Tauri updater 私钥已有加密离线备份和恢复演练。

**改法**

两种签名独立处理：

1. Tauri Updater 签名：
   - 公钥编译进客户端。
   - 私钥只在受保护 CI/签名服务。
   - 生产 endpoint 只用 HTTPS。
   - 发布 .sig 和 stable/beta manifest。
2. Windows Authenticode：
   - 最终 EXE/installer 使用 SHA-256 和可信时间戳。
   - 公开发布必须是受信任证书。
   - 构建流水线必须固定签名顺序，Tauri Updater signature 覆盖最终 Authenticode 签名后不再变化的下载字节。

发布采用 beta → stable：

- 构建一次、签名一次。
- beta 观察通过后推广同一 artifact hash，不重新构建 stable。

**验证**

- Get-AuthenticodeSignature 为 Valid。
- 改动 installer 任意字节后 updater signature 失败。
- 错误公钥、缺失签名、HTTP endpoint 均拒绝。
- 签名 secret 不出现在 PR、日志、artifact 或环境转储。

**完成判据**

所有公开安装包有有效 Authenticode，所有自动更新包有有效 Tauri signature。

---

### D5.3 · 更新、恢复点与启动健康标记

**前置**

- D5.2 完成。

**改法**

- 启动进入 healthy 后再检查更新。
- AI、导入、导出、迁移、备份运行时禁止安装/重启。
- 安装前生成并验证完整恢复点。
- 新版本首次启动写 pending-version。
- DB open、注册表检查、主界面渲染成功后写 healthy-version。
- 启动失败进入恢复模式：导出诊断、恢复到新库、暂停更新、获取上一稳定包。
- 不承诺数据库自动降级；紧急回滚使用版本号更高、兼容最新 schema 的前向热修复。
- destructive schema migration 必须先通过真实旧库夹具和恢复演练。

**验证**

- 正常更新、离线、超时、断流、签名错误、错误架构。
- 长任务互锁。
- 更新前后逐表计数、正文 hash 和 Blob hash。
- 在每个迁移阶段杀进程并重启。
- 执行一次“回退代码但版本号更高”的演练。

**完成判据**

安装成功和真正健康可区分；更新失败不会删除或覆盖唯一数据副本。

---

### D5.4 · 系统化 QA 与发布矩阵

**前置**

- 功能冻结。

**QA 模式**

- 每个 PR：Quick smoke，覆盖改动触达的全部 FP action 和固定关键路径；不能用 Quick 声明全功能等价。
- 每个 beta：Full QA，执行动作级 manifest 的每一项，并记录 PASS/失败证据。
- 每个 stable：与上一 stable 做 Regression QA，并与冻结 Web 基线做双端差异检查。
- 报告保存在 .qa-reports/windows-desktop/。

**验证**

**功能等价矩阵**

- 报告必须显示 baselineVersion、sourceCommit、desktopVersion、manifest 总数、PASS 数和非 PASS 明细。
- 每个聚合 FP 行只有在所有 actionId 通过 NAV/ACT/DATA/RESTART 等要求后才可 PASS。
- SHARED 行同时跑 Web/PWA 回归；ADAPTED 行同时跑 Web adapter 与 Tauri adapter 契约。
- REAUTHORIZE 行必须包含首次授权、跳过、稍后补做、重启持久四条路径。
- DESKTOP_REPLACEMENT 行必须验证结果等价，不以“桌面不需要浏览器 API”为由标 N/A。

**Windows 矩阵**

- Windows 10 x64、Windows 11 x64。
- 普通用户权限。
- 已有、缺失或过旧 WebView2。
- 首装、覆盖升级、卸载重装。
- 离线启动、弱网更新、Provider 超时。
- 中文路径、超长路径、磁盘不足。
- 多显示器、100%/150%/200% DPI。
- 空项目、最大项目、含 Blob 的旧浏览器迁移。
- AI 流式、导入、迁移中关闭或更新。
- SmartScreen、Authenticode 和 updater 签名。

**安全审查准备**

- 冻结被审查 commit、文件范围、构建说明和依赖版本。
- Rust/TypeScript 静态分析与依赖漏洞检查。
- Secret scanning、CodeQL 或等价检查。
- Capability、CSP、URL policy、日志脱敏专项材料。
- 架构图、迁移状态机、更新状态机、Actor/Privilege 清单。
- 已接受风险必须有负责人和截止版本。

**完成判据**

- S1/S2 为零。
- 功能等价 manifest 100% PASS，UNKNOWN/BLOCKED/PARTIAL/IMPLEMENTED/未批准范围变更为零。
- Full/Regression 报告可从每个 FP ID 追溯到步骤、环境、结果和证据文件。
- Web/PWA 与 Desktop 同时通过各自适配器回归。
- 所有支持系统都有真实安装记录。
- 数据迁移与更新测试核对正文/hash，而不只是按钮状态。
- Release job 只接受全部闸门通过的 commit。

---

### D5.5 · 公开稳定版准入

**前置**

- D5.1–D5.4 完成。
- beta 产物已完成观察，待推广 stable 的 artifact hash 已冻结。

**准入清单**

必须全部满足：

- [ ] 第 5 节及动作级 manifest 100% PASS，无 UNKNOWN、BLOCKED、PARTIAL 或未批准范围变更。
- [ ] 当前生产版所有路由、侧栏模块、面板动作、快捷键、后台任务、AI/Embedding、导入/导出和备份能力均有真实客户端证据。
- [ ] Web/PWA 全量回归通过，共享前端没有因客户端化退化。
- [ ] 本地 UI 打包，不加载远端应用代码。
- [ ] 最小 capability、严格 CSP、导航封锁完成。
- [ ] WebView 无任意网络、任意文件和 shell 能力。
- [ ] 凭据进入 Windows Credential Manager。
- [ ] 全量迁移与恢复演练通过。
- [ ] Windows CI、NSIS、SBOM 和产物 hash 完成。
- [ ] Authenticode 和 Tauri Updater 双签名有效。
- [ ] beta 观察通过，stable 推广同一 artifact hash。
- [ ] 更新前恢复点、pending/healthy 标记和恢复模式完成。
- [ ] S1/S2 为零，未接受 S3 为零。
- [ ] Privacy Policy、数据存储说明和安全反馈渠道就绪。
- [ ] 明确说明手稿、Gist 和 AI Provider 的数据流向。
- [ ] REAUTHORIZE 仅用于首次目录/API Key/PAT 授权，非密配置自动迁入且不反复询问。
- [ ] 应用内可查看版本、检查更新和导出脱敏诊断包；错误页不要求用户打开 F12。
- [ ] 有暂停更新、撤回 release 和前向热修复手册。

**验证**

- 对待发布的同一 artifact 重新验证 hash、Authenticode、Updater signature、安装、升级、恢复和迁移。
- 逐项链接 FP ID、CI、QA、beta 观察和安全审查证据。
- 确认 stable 过程没有重新构建或替换二进制。

**完成判据**

全部清单有可追溯证据、功能等价 manifest 100% PASS 且无 S1/S2 未解决项，作者批准后方可公开发布 stable。

---

## 12. 全局测试与属性不变量

示例测试负责已知场景；属性测试负责广泛输入域。两者缺一不可。

### 12.1 迁移性质

1. 合法工作区满足 decode(encode(x)) 与 x 语义等价，可重建缓存除外。
2. 规范化和 URL 正规化满足幂等。
3. 相同数据重复导出得到相同 payload hash。
4. 任意 payload 变化都导致完整性校验失败。
5. 任意导入中断都不会激活半成品库。
6. 相同 exportId 重复导入无副作用。
7. 导入后新增主键不与旧主键冲突。
8. 源浏览器数据库在所有成功/失败路径前后不变。

### 12.2 安全性质

1. Renderer 永远不能读回 secret。
2. 任意未批准 origin、私网或危险协议请求都被拒绝。
3. Authorization 不跨 origin redirect。
4. 任意恶意文件路径不能逃出已授权目录。
5. 日志、诊断包、迁移包对 canary secret 和正文片段零命中。
6. 任意未签名或被篡改更新不能安装。

### 12.3 恢复性质

1. 更新失败不影响离线编辑旧数据。
2. 未激活迁移库可以安全清理重试。
3. 已激活数据不得被自动回滚或静默覆盖。
4. 数据库版本不依赖旧二进制降级。
5. 每次 destructive schema 变化前都有已验证恢复点。

### 12.4 功能等价性质

1. 任意生产可达路由、SidebarModule、对话框动作和后台任务都恰好映射到一个 actionId 和 FP ID。
2. 新增可达入口而未更新 manifest 时 CI 必须失败；删除或隐藏已登记入口而无作者批准的范围变更时 CI 必须失败。
3. 对相同冻结夹具执行相同业务动作，生产 `web-tab` 与 Desktop 的持久化业务结果语义及规范化数据 hash 等价；运行时元数据差异除外。
4. 任意成功写操作在真实客户端重启后仍成立；任意失败/取消操作不产生不可见的半成品状态。
5. 一个聚合 FP 行只有在其全部 actionId 通过后才能 PASS；通过比例或健康分数不能抵消一个功能缺失。
6. REAUTHORIZE 只能改变首次外部授权步骤，不能减少数据、配置项、Provider、备份目标或后续能力。
7. Tauri + WebView2 候选必须与冻结的生产 `web-tab` 比较功能、规范化数据 hash、性能、恢复与安全，任一必需维度缺证据或退化均不得通过对应闸门。
8. Desktop 适配不得使同一共享功能的生产 `web-tab` 行为回归；installed PWA 若被采集也不得隐瞒已发现的回归，但其缺失不阻塞 D0.4～D1。

---

## 13. 停止信号

出现以下任一情况必须停止当前任务并回到设计/审查：

- 需要直接复制或修改 Chrome/Edge/WebView2 数据文件。
- 需要绕过 PROJECT_TABLES 手写表清单。
- 需要在 Rust 中直接写 StoryForge 业务表。
- 需要同时迁 SQLite 才能继续。
- 需要给 WebView 任意 HTTP、全盘文件或 shell 权限。
- 需要把 API Key/PAT 返回给 renderer。
- 迁移失败后只能靠人工改库恢复。
- 真实数据即将进入尚未冻结 identifier 的构建。
- 自动更新没有签名、恢复点或失败回滚路径。
- Web 与 Desktop 修复开始形成两套业务实现。
- 任一现有功能需要隐藏、置灰、改成占位、要求回浏览器完成或承诺以后补齐。
- 任一新/旧生产入口没有 actionId/FP ID，或有人试图用 N/A、通过率、总体健康分掩盖缺失项。
- 需要用户手工搬项目、改数据库、运行脚本、启动 Vite/Node/代理来补足客户端能力。
- 功能等价报告仍有 UNKNOWN、BLOCKED、PARTIAL、IMPLEMENTED 或证据缺失，却准备进入 G2/beta/stable。
- 测试只能验证 UI 成功提示，无法核对正文、引用或 hash。

---

## 14. 风险登记

| 风险 | 级别 | 控制 |
| --- | ---: | --- |
| 迁移/更新导致手稿不可用 | S1/S2 | 源数据不动、空目标、journal、hash、恢复点、失败注入 |
| 正式 identifier/UDF 改动 | S2 | D0 冻结；真实数据后禁止修改 |
| XSS 调用高权限 command | S2 | 本地 UI、CSP、窄 command、最小 capability |
| 自定义 Provider 窃取密钥/手稿 | S2 | Rust broker、origin 批准、redirect/私网限制 |
| Web Storage 残留密钥 | S2 | Credential Manager、一次性清理、canary 扫描 |
| 迁移包明文泄露手稿 | S3 | 用户指定安全目录、明确保留/删除、公开版评估可选加密 |
| Updater 私钥泄露 | S1 | 受保护环境、最小权限、离线备份、轮换预案 |
| Updater 私钥遗失 | S2 | 加密离线备份和恢复演练 |
| schema 升级后旧程序不可用 | S2 | 不承诺 DB 降级；前向热修复和恢复档案 |
| Web 与 Desktop 同时编辑分叉 | S2 | 迁移后指定主写端；未做同步前禁止宣称一致 |
| 客户端遗漏低频功能或后台任务 | S2 | D0.5 自动清单、每动作 FP 映射、G2/stable 100% PASS |
| 聚合 smoke 掩盖按钮无行为/数据未保存 | S2 | ACT+DATA+RESTART 证据；一个子项失败即整行失败 |
| 视频并行仍卡顿 | S3 | 固定 benchmark、任务限流、Go/No-Go |
| WebView2 版本差异 | S3 | Windows 10/11 矩阵、最低版本和安装器策略 |

---

## 15. 每个任务的统一交付模板

每个 D-task 的 PR 必须附：

1. 任务 ID 和主蓝图链接。
2. 改动文件列表与明确 out-of-scope。
3. 四问检查结果。
4. 若跨进程，完整 IPC 路径。
5. 新增/扩大 capability 的理由与 scope。
6. 测试命令和结果。
7. 数据迁移/更新任务的失败注入证据。
8. UI 或桌面行为的 Windows smoke 记录。
9. 触达的 FP ID/actionId、改动前后状态、Desktop 证据和对应生产 `web-tab` 回归；installed PWA 按阶段要求或作为补充列出。
10. 风险、回滚方法和未验证项；未验证项不得标 PASS。
11. 对 MASTER-BLUEPRINT、ROADMAP、CHANGELOG 的同步情况。

跨栈任务不得只验证 TypeScript 或只验证 Rust。完成声明前至少通过：

- npm run ci。
- npm run check:desktop-parity。
- npm run lint。
- cargo fmt --check。
- cargo clippy --all-targets --all-features -- -D warnings。
- cargo test --all-targets。
- desktop production build。
- 与任务风险相称的 Windows smoke/E2E。

---

## 16. 开工顺序

推荐严格按以下顺序开始：

1. D0.1：纳入 MASTER-BLUEPRINT 并完成 Claude 审查。
2. D0.2：冻结正式/开发 identity 和 UDF。
3. D0.3：RuntimeAdapter 契约。
4. D0.4：生产 `web-tab` 必需功能/数据 hash/性能/恢复/安全基线；installed PWA 可选补充。
5. D0.5：冻结动作级功能等价 manifest，建立自动覆盖检查。
6. D1：只用假数据完成 Tauri vertical slice 和全功能可实现性探针。
7. G1：逐 FP 行书面决定继续 Tauri 或转 Electron。
8. D2、D3 可在 G1 后并行开发。
9. D4：Codex 执行真实迁移、全清单验收，作者进入观察期。
10. G2：功能等价 100% PASS 后决定是否允许封闭测试和公开发布。
11. D5：CI、双签名、更新、全量功能回归和发布矩阵。

在 D2.5 验证器和 D2.6 失败注入完成前，禁止把真实浏览器数据导入任何正式客户端 profile。

---

## 17. 参考资料

### 项目内

- [CLAUDE.md](../CLAUDE.md)
- [MASTER-BLUEPRINT.md](./MASTER-BLUEPRINT.md)
- [COLLAB-WORKFLOW.md](./COLLAB-WORKFLOW.md)
- [WINDOWS-DESKTOP-CLIENT-ASSESSMENT.md](./WINDOWS-DESKTOP-CLIENT-ASSESSMENT.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)

### 官方技术资料

- [Tauri Architecture](https://v2.tauri.app/concept/architecture/)
- [Tauri + Vite](https://v2.tauri.app/start/frontend/vite/)
- [Tauri Capabilities](https://v2.tauri.app/security/capabilities/)
- [Tauri CSP](https://v2.tauri.app/security/csp/)
- [Tauri Updater](https://v2.tauri.app/plugin/updater/)
- [Microsoft WebView2 User Data Folder](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder)
- [Chromium IndexedDB backing store](https://chromium.googlesource.com/chromium/src/+/master/content/browser/indexed_db/docs/README.md)
- [Electron Process Model（回退评估用）](https://www.electronjs.org/docs/latest/tutorial/process-model)

