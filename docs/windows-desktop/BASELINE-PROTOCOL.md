# Windows 客户端 Web 参考基线协议（D0.4）

> 协议版本：`d0.4-v2`
> 当前状态：**协议及 empty/small 可重建夹具已落地，生产 `web-tab` 完整实测尚未完成；installed PWA 仅为可选补充**
> 夹具 source commit：`e62ae88`（2026-07-15）；105 test files / 414 tests PASS，其中 410 个为项目原有用例、4 个为 D0.4 新增用例
> 适用对象：`web-tab`、`installed-pwa`、`tauri-dev`、`desktop-production`

## 1. 目标与边界

本协议冻结 StoryForge Windows 客户端的对照口径。当前生产 `web-tab` 是 D0.4、D0.5、D1 以及后续 Tauri + WebView2 候选的**唯一必需参考基线**。D1、D4 只能用相同语义的项目数据、相同操作脚本和同一参考环境与该基线比较，避免“桌面版能打开”被误当成功能、性能或安全达标。

`installed-pwa` 只用于补充观察独立窗口、Service Worker 与安装态差异；未安装、未测或采集受阻均不得单独阻塞 D0.4、D0.5 或 D1，也不得替代 `web-tab` 证据。该放宽只移除 PWA 作为必需参考的地位，不减少功能、数据哈希、性能、恢复、安全、夹具或报告完整性要求。

协议版本采用只读历史兼容策略：既有 `.qa-reports/**` 中的 `d0.4-v1` 报告原样保留，不得静默改写版本或字段来冒充 v2，也不得计入 `d0.4-v2` 的聚合、比较或 Go / No-Go 裁决。新采集器只生成 `d0.4-v2` 报告；任何需要进入 v2 裁决的 v1 场景都必须按本协议重新采集。

D0.4 只建立可复现协议、固定夹具规格、结果格式和无浏览器静态采集器。它**不等于完成基线实测**，也不授权把任何未采集指标写成估计值。

本轮不新增 AI 上下文源、业务字段或持久化表。夹具覆盖范围必须从
`src/lib/registry/project-tables.ts#PROJECT_TABLES` 动态派生，禁止维护第二份表名清单。

## 2. 状态词与裁决规则

### 2.1 采集状态

每个场景必须使用下列状态之一：

- `MEASURED`：满足本协议的环境、轮次、样本、原始数据和完整性要求。
- `NOT_MEASURED`：尚未执行；必须填写 `reasonCode`，样本数组必须为空，聚合值必须为 `null`。
- `BLOCKED`：已尝试但受可复现的外部条件阻断；必须记录阻断证据，不得用推测值代替。
- `INVALID`：执行过但违反协议或数据损坏；原始数据可保留，不能进入候选裁决。

### 2.2 场景裁决

- `PASS`：仅允许 `MEASURED` 场景产生，并且所有强制阈值通过。
- `FAIL`：仅允许 `MEASURED` 场景产生，并且至少一个强制阈值失败。
- `NOT_EVALUATED`：`NOT_MEASURED`、`BLOCKED`、`INVALID` 的唯一合法裁决。

### 2.3 总体裁决

- `ELIGIBLE_GO`：功能基线门和所有必需性能、安全场景均有效测量并通过。
- `ELIGIBLE_NO_GO`：所有必需证据足以裁决，且至少一项失败。
- `NOT_ELIGIBLE`：任一必需场景未测、阻断、无效或缺少对照数据。

功能一致性、数据完整性和安全失败是硬门槛。可选健康分不得抵消硬门槛；当任一必需场景未测时，`healthScore` 必须为 `null`。

裁决必须由报告内容唯一推出：任一必需功能门/场景为 `NOT_MEASURED`、`BLOCKED` 或 `INVALID` 时只能 `NOT_ELIGIBLE`；全部为 `MEASURED` 且任一 `FAIL` 时只能 `ELIGIBLE_NO_GO`；全部 `PASS` 后仍须完整参考环境、已解析 source commit、全部必需夹具有效，以及生产 `web-tab` 引用报告/证据齐全，才可 `ELIGIBLE_GO`。可选 `installed-pwa` 证据缺失或未测不改变裁决；一旦采集，其失败必须如实记录，但不能替代或放宽任一必需门。

## 3. 四种候选模式

| 模式 | 定义 | 用途 |
| --- | --- | --- |
| `web-tab` | 支持的 Edge / Chrome 普通标签页 | 当前真实用户路径；唯一必需参考基线 |
| `installed-pwa` | 从同一生产构建安装的 PWA 独立窗口 | 可选补充；观察安装态、独立窗口和 Service Worker 差异 |
| `tauri-dev` | 开发构建；只用于诊断 | 不参与发布 Go / No-Go |
| `desktop-production` | 签名候选安装包或等价 release 构建 | D1 / D4 被测对象 |

`web-tab` 必须绑定当前生产构建及可解析源提交。若采集 `installed-pwa`，它必须与 `web-tab` 来自同一构建产物和同一源提交。桌面候选必须记录壳、WebView2、前端资源和迁移器版本。

## 4. 参考环境冻结

每次执行前保存 `environment.json`，至少包括：

- 协议版本、报告 ID、模式、源提交（由调用方显式传入；采集器不运行 Git）。
- Windows edition / version / build / architecture。
- CPU 型号与逻辑处理器数、物理内存、GPU 与驱动。
- Edge、Chrome、WebView2 Runtime 的精确版本；没有安装时记录 `NOT_INSTALLED`。
- Node、npm、Rust（若存在）的版本，仅作为工具链事实。
- 物理显示器分辨率、缩放比例、刷新率；远程或虚拟显示适配器必须单独标记。
- 电源模式、是否接通交流电、候选实际使用的 GPU。
- 视频源 ID、文件 SHA-256、编码、分辨率、帧率、时长。
- 浏览器/壳配置、扩展状态、网络条件及性能采样工具版本。

仍未冻结的字段必须写 `NOT_MEASURED` 或 `UNRESOLVED`，不得从硬件名称猜测。当前参考机草案见
`REFERENCE-ENVIRONMENT.md`。

## 5. 固定夹具与数据断言

机器可读规格为 `baseline-fixtures.json`。所有实现必须遵守：

1. 固定 UTF-8、UTC 时间、随机种子和稳定 ID；禁止使用当前时间或系统随机数。
2. 表覆盖从 `PROJECT_TABLES` 读取；规格文件不得出现手写 `tableNames`。
   注册表源码指纹必须先把 CRLF/CR 规范化为 LF，再计算 UTF-8 SHA-256，禁止同一提交因 worktree 换行策略产生不同指纹。
3. 每个已生成夹具保存生成器版本、源提交、字节数、逐文件 SHA-256 和逻辑计数。
4. 导出→清库→导入后，规范化业务 JSON 的 SHA-256 必须相同。
5. 外键/跨表引用、主键唯一性、项目归属与 Blob 字节哈希必须逐项断言。
6. 设备运行时元数据、密钥、真实用户内容不得进入可提交夹具。

固定夹具：

- `empty-v1`：空数据库和首次启动边界。
- `small-v1`：1 项目、2 世界组、2 世界观、10 章，覆盖跨世界引用、日常编辑和导入导出。
- `large-synthetic-v1`：确定性合成大项目，10 卷 × 100 章，并覆盖注册表声明的各类项目数据。
- `blob-ladder-v1`：10 MiB、100 MiB、500 MiB、1 GiB 的确定性二进制阶梯。
- `legacy-matrix-v1`：各受支持历史 schema / 导出版本的最小兼容矩阵。
- `real-anonymized-v1`：仅本机保存的匿名真实项目；仓库只记录计数与哈希，当前默认 `NOT_AVAILABLE`。

当前已落地确定性内存夹具验证器：

```powershell
npm.cmd run check:desktop-fixtures
```

它先从真实 Dexie schema 重建并逐字节核对已提交的 `empty-v1`、`small-v1` 与严格 manifest，再从 `PROJECT_TABLES` 动态证明全部 42 个项目表恰好覆盖一次，并验证稳定 ID、固定时钟、精确正文长度、canonicalizer 的确定性/敏感性/危险键边界，以及 `small-v1` 的 10 章导出/清库/导入路径。两端数据先经过真实 JSON stringify/parse 产物边界；树表导出再稳定为父先顺序，防止清库导入后运输序号漂移。canonicalizer 会先验证完整输入图，再排除规格声明的根级/行级运行时路径；往返比较先精确验证目标项目名等于源名追加一次 `（导入）`，再还原该目标投影。源名本来带后缀时必须匹配双后缀；任何其他字段、嵌套同名时间字段、数组位置或引用变化都会使业务 hash 不等，Blob 与 JSON 不支持的值在排除前失败关闭。当前 `small-v1` 的规范化 source/re-export SHA-256 已相等。该命令仍不能代替生产 `web-tab`、真实浏览器 profile、重启或性能证据。

当前项目 JSON 导出格式为 `version: 4`，并用精确 marker `nestedRefEncoding: "export-index-v1"` 声明嵌套数字是目标表的导出序号。`small-v1` 已确定性验证 `detailedOutlines` 的角色/场景角色/伏笔数组、`creativeRules[].citedReferenceIds[]` 与 `codexEntries[].refs.*[]` 在清库导入后全部解析到新主键，`dangling=[]`，`referenceRemapStatus=PASS`；规范化往返业务 hash 也为 `PASS`。旧 `version: 1/2/3` 仍可导入，但其嵌套数字只能按历史 raw database ID 原样保留；没有 v4 marker 时不得猜测或按导出序号解释。`empty-v1` / `small-v1` 当前状态为 `GENERATED_VALID`，文件、原始字节 SHA-256、业务 hash、逐表计数与断言记录在已提交的严格 manifest 中。

尚未生成并通过上述断言的 large/blob/legacy/real 夹具，其状态仍只能是 `NOT_GENERATED` 或 `NOT_AVAILABLE`。

## 6. 运行纪律

### 6.1 通用

- 同一项目、章节、脚本至少执行 3 个独立轮次。
- 计时使用单调时钟；墙钟仅用于关联日志。
- 每轮记录候选进程 PID、父 PID、可执行路径、启动参数、配置、配置目录/浏览器 profile、动态调试端口和原因。
- 每个并行实例使用独立 profile 和动态空闲端口。
- 仅清理由本轮记录启动的进程树，并验证端口关闭；禁止广泛终止浏览器、WebView2 或 Node。
- 记录所有预热、舍弃样本和异常值原因；不得静默删除样本。
- 禁止在测量期间更新浏览器、WebView2、应用、驱动或夹具。

### 6.2 冷启动与热启动

- 冷启动：候选及其受控子进程已退出，候选 profile 首次打开或按场景恢复到固定快照；不得声称清空 Windows 文件缓存，除非确有可审计步骤。
- 热启动：完成一次不计分预热后，在同一冻结环境和 profile 上重启候选。
- 每种模式、每种启动类型至少 4 个独立轮次 × 50 次有效启动，共 200 个样本，才能声明本协议要求的 p95。轮次之间必须重建对应的冷/热启动前置状态。
- 起点为进程创建时间；终点为主编辑区可见、可输入且固定项目状态已加载的应用标记。

### 6.3 统计规则

- 原始样本逐条写入 `samples.ndjson`，单位写入字段名或 `unit`。
- `p50`、均值、标准差至少需要 30 个有效样本。
- `p95` 至少需要 200 个有效样本；这是发布硬门采用的严谨口径，不使用 100 个样本的较宽松经验值。
- `p99` 至少需要 1000 个有效样本。
- 样本不足时对应聚合值必须为 `null`，并记录 `INSUFFICIENT_SAMPLES`。
- 30 分钟内存和 10 分钟视频场景按“独立会话”汇总，不得把同一会话内的高频采样伪装成独立重复。
- 内存、视频和 Blob 可先做每候选 3 次完整独立会话/轮次，只能报告 `min` / `max` 与逐轮证据；未达到 30 次时 `p50` / 均值 / 标准差必须为 `null`，未达到 200/1000 次时 p95/p99 也必须为 `null`。
- 一个已记录的硬失败（例如崩溃、OOM、哈希不一致或数据丢失）可在未采满统计样本时判 `FAIL`，但不能反向用少量成功样本判 `PASS`。

### 6.4 PASS 所需聚合

| 场景 | PASS 最低样本 | 必须非空的聚合 | 说明 |
| --- | ---: | --- | --- |
| `PERF-START-COLD`、`PERF-START-WARM`、`PERF-OPEN-LARGE`、`PERF-EDITOR-TYPE`、`PERF-SAVE`、`PERF-AI-STREAM`、`PERF-CANVAS` | 200 | `p95` | 至少跨 3 个独立轮次；启动按 4×50 执行。p99 只有达到 1000 时才可填写 |
| `PERF-MEM-30`、三个 `PERF-VIDEO-*`、四个 `PERF-BLOB-*` | 3 个独立会话/轮次 | `min`、`max` | PASS 同时依赖阈值证据、完整性/哈希和逐轮原始数据；3 次不能声明 p50/p95/p99 |

上表只定义当前协议的最低 PASS 证据。任何聚合字段只要被填写，就仍须满足 30/200/1000 的全局样本门；不需要或样本不足的聚合保持 `null`。

## 7. 必需功能基线门

D0.4 不复制专项规划 §5 的聚合 FP 矩阵，也不抢先建立 D0.5 的动作级事实源。报告必须引用：

- 当前人工基线：`docs/WINDOWS-DESKTOP-IMPLEMENTATION-PLAN.md` §5；
- D0.5 计划事实源：`docs/windows-desktop/feature-parity-baseline.json`。

在相同 `small-v1` / `large-synthetic-v1` 夹具上，生产 `web-tab` 必须验证入口可达、动作完成、业务数据语义、规范化数据哈希、浏览器关闭后重开持久化和失败恢复。D0.5 动作清单未冻结前，`actionCount` 必须为 `null`；未完成 `web-tab` 基线时，功能状态必须为 `NOT_MEASURED`，总体不得为 `ELIGIBLE_GO`。

若采集 `installed-pwa`，应复用同一夹具和操作脚本并单独报告，但它是补充证据。后续 `tauri-dev` / `desktop-production` 必须逐项与冻结的 `web-tab` 参考报告比较；任一功能缺失、隐藏、置灰、要求回浏览器、业务语义或规范化数据哈希不一致、重启持久化不同、失败恢复退化，均直接使候选总体裁决失败。

聚合功能基线不能代替 D0.5 的逐 actionId 证明。后续候选的任一功能缺失、隐藏、置灰、要求回浏览器或持久化语义不同，均直接使总体裁决失败；性能分和健康分不能抵消。

## 8. 必需性能场景

| ID | 固定操作 | 强制输出 |
| --- | --- | --- |
| `PERF-START-COLD` | 冷启动并打开 `small-v1` 最近项目 | 端到端毫秒、成功率 |
| `PERF-START-WARM` | 热启动并打开相同项目 | 端到端毫秒、成功率 |
| `PERF-OPEN-LARGE` | 从项目列表打开 `large-synthetic-v1` 固定章节 | 可交互时间、长任务、错误 |
| `PERF-EDITOR-TYPE` | 固定 1000 次输入/撤销脚本 | 输入到绘制延迟、长任务、内容哈希 |
| `PERF-SAVE` | 固定编辑后等待自动保存并重启核对 | 保存确认延迟、100% 内容一致性 |
| `PERF-AI-STREAM` | 固定本地 mock 流：首块、持续输出、取消 | 首块/取消延迟、输出哈希、错误 |
| `PERF-MEM-30` | 5m 空闲 + 20m 固定编辑 + 5m 空闲 | private bytes / working set 曲线与恢复 |
| `PERF-VIDEO-IDLE` | 固定视频播放 10m，无编辑 | 总帧、丢帧率、CPU/GPU |
| `PERF-VIDEO-EDIT` | 同视频 + 固定编辑脚本 | 同上及相对 idle 差值 |
| `PERF-VIDEO-AI` | 同视频 + mock AI 流 | 同上及相对 idle 差值 |
| `PERF-BLOB-10M` | 导入、保存、重启、导出 10 MiB Blob | 耗时、峰值内存、字节哈希 |
| `PERF-BLOB-100M` | 同上，100 MiB | 同上 |
| `PERF-BLOB-500M` | 同上，500 MiB | 同上 |
| `PERF-BLOB-1G` | 同上，1 GiB | 同上 |
| `PERF-CANVAS` | 固定图谱画布平移/缩放/选中脚本 | 帧时间、输入丢失、黑屏 |

### 8.1 冻结阈值

这些阈值在生产 `web-tab` 实测前被冻结；如需变更必须提升协议版本并说明原因，不能为某个候选追改：

- 冷启动：参考机 p95 ≤ 3000 ms，且桌面候选不高于 `web-tab` p95 的 120%。
- 热启动和打开大项目：桌面候选 p95 不高于 `web-tab` p95 的 120%。
- 编辑输入：p95 < 100 ms，固定脚本后文本规范化哈希完全一致，无未解释长任务。
- 自动保存：固定更改 100% 落盘，重启后哈希一致；数据丢失一次即失败。
- AI mock：输出哈希一致；取消 p95 ≤ 250 ms；首块 p95 不高于 `web-tab` 的 120%。
- 内存：最后 15 分钟 private-bytes 线性斜率 ≤ 2 MiB/min；结束后 5 分钟空闲值须回到工作负载前基线的 `max(15%, 128 MiB)` 范围内。
- 视频：编辑或 AI 场景的丢帧率相对 idle 增量 ≤ 1.0 个百分点，且无持续音画失步。
- Blob：所有尺寸均不得 OOM/崩溃，导入导出字节 SHA-256 完全相同。
- Canvas：无黑屏、输入丢失或状态错乱；60 Hz 参考显示器帧时间 p95 ≤ 16.7 ms。若显示器刷新率不同，必须同时报告绝对值和按刷新周期归一化结果。

## 9. 必需安全场景

所有安全夹具只能使用明显的合成 canary，例如
`STORYFORGE_D04_CANARY_NOT_A_SECRET`，不得使用真实密钥或真实用户正文。

| ID | 最坏情况与通过条件 |
| --- | --- |
| `SEC-DATA-LOSS` | 进程中断、空间不足、导入失败、迁移中断后原数据可恢复；任何不可恢复丢失即失败 |
| `SEC-XSS-IPC` | 富文本/文件名/导入数据中的 XSS 载荷不得获得高权限 IPC 或本地执行能力 |
| `SEC-SECRET` | API 密钥 canary 不得出现在日志、导出、诊断包、崩溃信息或非密钥存储 |
| `SEC-CONTENT` | 正文 canary 不得被非预期写入日志、遥测、诊断包或更新请求 |
| `SEC-URL` | 外部 URL、深链、协议处理只允许显式许可目标；危险 scheme 被拒绝 |
| `SEC-PATH` | 导入/导出和附件路径不能越界、覆盖任意文件或发生 zip-slip |
| `SEC-UPDATE` | 更新包签名必须校验；私钥不在客户端、仓库、构建日志或发布产物中；私钥丢失有轮换/撤销预案 |
| `SEC-UDF` | 用户可控数据文件和诊断包不含可执行载荷自动执行路径，并遵守最小权限 |

每个场景保存输入 canary、预期拒绝/隔离行为、实际结果、日志扫描规则和证据路径。静态检查不等于动态安全通过。

## 10. 报告目录与文件契约

```text
.qa-reports/windows-desktop/<report-id>/
├── environment.json
├── fixture-manifest.json
├── process-record.json
├── samples.ndjson
├── summary.json
└── README.md
```

- `summary.json` 必须符合 `schemas/baseline-report.schema.json`。
- D0.4 参考报告的 `comparison` 必须引用 `web-tab` 报告 ID 和证据；`installed-pwa` 可选。缺少 `web-tab` 时为 `INCOMPLETE`，只缺少 `installed-pwa` 不得据此判为 `INCOMPLETE`。
- D1 / D4 桌面候选报告必须引用同一冻结 `web-tab` 的报告 ID 和证据，并覆盖功能、规范化数据哈希、性能、恢复与安全；缺任一必需维度即为 `INCOMPLETE`。
- `samples.ndjson` 一行一个原始样本；没有应用测量时必须是空文件。
- `process-record.json` 只记录本轮启动的进程；静态采集写 `NO_APPLICATION_LAUNCHED`。
- 截图、视频、系统跟踪或日志若产生，放在报告目录子目录并在摘要中用相对路径引用。
- 报告目录默认忽略提交；去标识化摘要经人工审查后才可进入仓库。

## 11. 静态采集器

```powershell
npm.cmd run check:desktop-baseline
npm.cmd run check:desktop-fixtures
npm.cmd run baseline:collect-static -- --output .qa-reports/windows-desktop/<report-id> --source-commit <commit>
```

前两个命令分别校验报告协议与确定性夹具安全网；只有 `baseline:collect-static` 会创建静态报告目录。静态采集器只读取仓库元数据和本机版本信息：

- 不启动 Edge、Chrome、WebView2、Vite、Tauri 或应用进程。
- 不运行 Git；源提交必须由调用方显式提供，否则记录 `UNRESOLVED`。
- 不读取环境变量值、用户名、主机名、浏览器 profile 或真实项目。
- 所有性能与动态安全场景仍为 `NOT_MEASURED`，总体裁决必为 `NOT_ELIGIBLE`。

## 12. D0.4 完成与 PASS 条件

协议、Schema、固定夹具规格、样例和静态校验通过，只能说明“测量基础设施已建立”。D0.4 只有在以下证据齐全后才能标记 PASS：

1. 参考环境所有强制字段冻结；
2. 必需夹具实际生成并通过哈希、引用和导入导出断言；
3. 生产 `web-tab` 的聚合功能基线和所有必需性能场景按本协议采集；`installed-pwa` 仅为可选补充；
4. 所有必需安全场景有可复核证据；
5. 报告 Schema 校验通过且功能门及必需场景不存在 `NOT_MEASURED` 项。

以上 PASS 条件除移除 installed PWA 的必需参考地位外均未放宽。当前 `empty-v1` / `small-v1` 可交付文件与严格 manifest 已生成并通过可重建、原始字节 hash、主键重映射及规范化往返业务 hash 校验；large/blob/legacy 完整夹具及生产 `web-tab` 的功能、性能、恢复、安全实测仍未齐，因此 D0.4 仍为 **IN PROGRESS / NOT_ELIGIBLE**。
