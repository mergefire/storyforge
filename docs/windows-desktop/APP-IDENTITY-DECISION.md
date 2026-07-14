# StoryForge Windows 应用身份与支持范围决议

> 任务：D0.2  
> 决议版本：D0.2-1  
> 日期：2026-07-14  
> 状态：**IN PROGRESS**；技术身份与支持边界已冻结，仅正式 Authenticode 发布者/证书 Subject 待作者确认

## 1. 决议结论

以下项目自本决议起冻结，可直接作为 D1 的配置输入：

- 正式与开发 `productName`、显示名和窗口标题；
- 正式与开发 Tauri `identifier`；
- 主窗口 `label`；
- WebView2 `dataDirectory` 相对目录；
- Windows 最低支持边界；
- 开发、自用、beta、stable 的数据隔离规则；
- 进入真实数据后的身份不可变项、升级和回滚规则。

D0.2 只剩一个作者决策：**正式 Authenticode 证书的 Subject/法定持有人名称**。Windows installer 的 publisher 显示值必须由该 Subject 派生并与证书一致，不能由实现者猜测。

该未决项阻止 D0.2 标记 `PASS`，但不阻止已经由 D0.1 放行的 D0.3、D0.4 并行开发。确认前只允许开发身份和合成数据；不得把作者真实浏览器数据导入任何桌面 profile。

## 2. 事实依据与命名原则

仓库现有单一事实足以确定技术身份，不需要额外产品命名决策：

- `package.json` 的包名为 `storyforge`；
- PWA manifest 的正式名称为 `故事熔炉 StoryForge`，简称为 `故事熔炉`；
- README 的产品标题为 `StoryForge · 故事熔炉`；
- README 公开仓库与维护者为 `github.com/yuanbw2025/storyforge` 和 `yuanbw2025`。

因此，`io.github.yuanbw2025.storyforge` 是仓库命名空间的技术映射，不声明 `yuanbw2025` 是法定出版主体，也不替代 Authenticode 证书身份。

Tauri `identifier` 会参与 bundle/system 配置和 WebView 数据目录定位；WebView2 的 IndexedDB、localStorage、权限等均位于 UDF。身份或 UDF 变化可能表现为“空应用”，但原数据实际仍在旧 profile。为防止把身份漂移误诊为数据丢失，本决议把开发与正式数据身份彻底分离。

## 3. 冻结身份矩阵

| 字段 | 开发、自动化与合成夹具 | 正式自用、beta、stable |
| --- | --- | --- |
| 产品角色 | 开发身份 | 正式数据身份 |
| Tauri `productName` | `StoryForge Dev` | `StoryForge` |
| 产品显示名 | `故事熔炉 StoryForge Dev` | `故事熔炉 StoryForge` |
| 主窗口标题 | `故事熔炉 StoryForge Dev（仅合成数据）` | `故事熔炉 StoryForge` |
| Tauri `identifier` | `io.github.yuanbw2025.storyforge.dev` | `io.github.yuanbw2025.storyforge` |
| 主窗口 `label` | `main` | `main` |
| 主窗口 `dataDirectory` | `webview-data` | `webview-data` |
| 概念 UDF 位置 | `appDataDir(dev identifier)/main/webview-data` | `appDataDir(stable identifier)/main/webview-data` |
| 并行 CDP/自动化实例 | `webview-data/runs/<run-id>`；每次独立 | 禁止使用正式 profile 调试 |
| Windows 架构 | x64 | x64 |
| 允许的数据 | 假数据、迁移夹具、测试哨兵 | 作者真实数据与未来公开用户数据 |
| 发布通道 | dev/test | self-use → beta → stable；同一数据身份 |
| 项目/发行命名空间 | `github.com/yuanbw2025/storyforge` | `github.com/yuanbw2025/storyforge` |

实际绝对目录由 Tauri 路径解析器按当前 Windows 用户解析，配置、文档、日志和测试均不得写死盘符、用户名或某台机器的 `%APPDATA%` 路径。

`dataDirectory` 的语义固定为相对 `appDataDir()/main` 的 `webview-data`。D1 必须锁定支持 `WindowConfig.dataDirectory` 的 Tauri 2 版本，并在生成的配置 schema 中验证该字段有效；不得因版本不支持而静默退回 exe 邻近目录、临时目录或默认随机目录。

## 4. Windows 支持边界

### 4.1 首版支持

- 最低兼容验证边界：**Windows 10 22H2 x64，build 19045**；
- 正式支持：处于 Microsoft 支持周期内的 Windows 11 x64 版本；
- 必需组件：Microsoft Edge WebView2 Evergreen Runtime；缺失或过旧时由后续安装器流程检测并修复，不允许白屏启动；
- 权限：普通用户、per-user 安装和用户可写的数据目录；业务功能不得要求管理员权限。

Windows 10 22H2 Home/Pro 已于 2025-10-14 结束 Microsoft 常规支持。build 19045 是项目为作者现有环境保留的**技术兼容验证下限**，不等于 StoryForge 能替操作系统提供安全维护，也不应在公开 stable 页面写成仍受 Microsoft 常规支持。作者自用时应使用仍受支持的 Windows 版本或有效 ESU；公开发布前仍须按 D5 在真实 Windows 10 build 19045 和 Windows 11 x64 上执行安装、升级、恢复和全量功能矩阵，并把二者分别标成“兼容验证”与“正式支持”。

### 4.2 不在首版支持范围

- Windows 10 build 19045 之前的版本；
- Windows 7/8/8.1、Windows Server、Wine/兼容层；
- Windows x86、Windows ARM64 原生包；
- macOS 与 Linux。

上述系统即使偶然可运行，也不得写入支持矩阵或替代正式证据。若 Tauri、WebView2 或 Microsoft 在 stable 前撤销所需平台支持，必须触发范围复审并取得作者明确决策，不能静默提高最低版本。

## 5. UDF 与通道隔离

1. 开发构建只能使用开发 identifier；正式构建只能使用正式 identifier。构建检查必须拒绝“Dev 标题 + 正式 identifier”或“正式标题 + dev identifier”的混合配置。
2. 开发 profile 只放合成数据。任何真实手稿、真实浏览器导出或作者凭据进入开发 profile 都是停止信号。
3. 自用、beta、stable 共用正式 `productName`、identifier、窗口 label 和 `dataDirectory`。通道只影响更新源、版本标签和 UI 徽标，不创建 `.self`、`.beta`、`.stable` 数据身份。
4. 同一正式 UDF 不允许两个 StoryForge 版本并发打开。启动互斥和更新互锁在 D1/D5 落地。
5. UDF 必须位于当前用户本地、可写的应用数据目录；禁止网络盘、仓库、安装目录、OneDrive 同步目录、临时目录和浏览器 profile 目录。
6. 卸载应用默认保留正式 UDF。删除真实数据必须是独立、明确确认且先有可验证备份的动作；安装器不得把“卸载程序”和“删除手稿”绑定。
7. 诊断信息可以显示解析后的 UDF 路径、identifier、窗口 label、应用版本和 WebView2 版本，但不得记录正文、Prompt、密钥或其他隐私内容。
8. CDP/DevTools 只允许开发构建使用；每个实例在开发身份下使用 `webview-data/runs/<run-id>` 子目录，端口动态选择，并把 profile、PID、路径和原因写入运行记录后按记录清理。不得让调试参数覆盖正式 UDF。

## 6. 进入真实数据后的不可变项

第一次正式迁移前必须再次核对并记录以下元组：

```text
productName = StoryForge
identifier = io.github.yuanbw2025.storyforge
window.label = main
window.dataDirectory = webview-data
architecture = windows-x86_64
```

真实数据进入后，以下项目不得通过普通配置 PR 修改：

- 正式 `productName`、identifier；
- 主窗口 label、`dataDirectory`；
- appDataDir/UDF 解析策略；
- 自用、beta、stable 共用同一数据身份的规则；
- x64 包与现有数据身份的关联。

显示文案可以修正普通描述，但不得把正式应用改成另一个 Windows 产品身份或造成安装器/UDF 分叉。版本升级只改变版本号、签名产物和受控功能代码，不改变上述元组。未来即使仓库转移 owner，也不得据此修改已经承载真实数据的 identifier；应保留旧技术身份，通过发布元数据指向新仓库。

## 7. 升级、误切身份与回滚

### 7.1 正常升级

1. 更新前创建并验证应用层完整恢复点；不得把原始 UDF 目录复制当作正式备份协议。
2. 关闭共享该 UDF 的全部 WebView2 会话后再安装更新。
3. 覆盖升级沿用同一正式身份；启动成功、Dexie 打开、注册表检查和主界面渲染完成后才写健康标记。
4. 升级失败不得清理、覆盖或重新初始化唯一正式 UDF。

### 7.2 错误身份表现为空 profile

如果应用意外显示空项目，第一处理原则是**停止写入**并核对版本、identifier、label 和 `dataDirectory`。禁止用“新建项目试试”、自动清库或复制 LevelDB/UDF 文件诊断。

确认是配置漂移后，应恢复到原身份配置并重新启动；旧 UDF 保持原位、只读观察。若确需更换身份，只能通过 D2 的应用层 `FullMigrationArchive` 从旧身份正常导出，导入新的空目标并逐表/hash 验证，不能复制或修改 WebView2 数据文件。

### 7.3 版本回滚

- 不允许让旧二进制直接打开已经升级 schema 的正式 UDF，也不承诺数据库降级；
- 首选恢复方式是发布版本号更高、兼容最新 schema 的前向热修复；
- 若必须恢复数据，使用更新前已验证的应用层恢复点导入新的空目标，验证通过后再激活；
- 原正式 UDF 和恢复点在新目标验证完成前不得删除；
- 每次恢复必须产生可追溯 receipt，记录 source version、target version、表计数、正文/Blob hash 和激活结果。

## 8. 唯一作者待确认项

作者需要提供或确认一个值：

> **正式 Authenticode 证书中用于 StoryForge 的完整 Subject/法定持有人名称是什么？**

该值确认后：

- Windows installer 的 publisher 显示值从证书 Subject 派生并保持一致；
- 不得因为 GitHub owner 是 `yuanbw2025` 就把它伪装成法定证书主体；
- 若尚未取得证书，D0.2 保持 `IN PROGRESS`，开发包保持未签名且带 Dev 标识；
- 自用未签名构建、beta 或公开 stable 均不得被用来反向猜测正式 Subject。

除该项外，本决议没有第二个作者选择题。正式 identifier 已依据公开仓库命名空间冻结，不与法定 publisher 绑定。

## 9. D0.2 验证与后续执行门

### 9.1 本任务可完成的静态验证

- 本决议的品牌、仓库 owner/name 与 `package.json`、PWA manifest、README 一致；
- 两个 identifier 字符合法、彼此不同，且 dev 仅比正式身份增加 `.dev` 隔离后缀；
- 正式通道不存在 `.beta`/`.stable` 第二数据身份；
- identity/UDF/支持边界/升级/回滚均已指定唯一值，没有占位状态或并列替代值；
- 实施规划不再要求在 Tauri 壳创建前完成运行时 profile 验证，消除 D0.2 → D0.5 → D1 → D0.2 的依赖循环；
- 正式 publisher/Subject 被明确保留为唯一阻塞项。

### 9.2 D1.3 必须补交的运行证据

以下测试在 Tauri 壳存在后执行，不作为本决议形成的循环前置，但失败会立即重开 D0.2，并阻止 G1 和任何真实数据迁移：

1. 开发版写入哨兵数据，正式候选看不到；正式候选写入哨兵，开发版看不到；
2. 同正式 identifier 覆盖升级后，IndexedDB、非密 localStorage 和 WebView 权限保持；
3. 把 identifier 或 `dataDirectory` 改为测试值时得到独立空 profile，恢复原元组后原数据重新出现；
4. 卸载/重装默认保留正式 UDF；
5. UDF 无写权限、磁盘不足或 WebView2 缺失时明确失败，不创建用户可见半初始化库；
6. 诊断摘要准确显示脱敏后的身份和目录信息。

## 10. 四问与范围

- **读什么**：只读仓库品牌、桌面规划和官方配置语义；不装配 AI 上下文。
- **写什么**：只写治理决议；不写业务数据或 AI 采纳结果。
- **涉及哪些表生命周期**：不触达 Dexie schema、PROJECT_TABLES 或任何用户表。
- **是否需要补注册表**：不新增表、字段、AI source 或 action，无需修改三注册表。

本任务不建立 Tauri 壳、不创建 UDF、不导入数据、不配置证书、不决定 updater endpoint，也不声明 Windows 客户端已经可用。

## 11. 官方技术依据

- Tauri v2 Configuration：https://v2.tauri.app/reference/config/
- Tauri v2 Webview API（`dataDirectory`）：https://v2.tauri.app/reference/javascript/api/namespacewebview/
- Tauri WebView versions：https://v2.tauri.app/reference/webview-versions/
- Tauri Windows installer：https://v2.tauri.app/distribute/windows-installer/
- Microsoft WebView2 UDF：https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder
- Microsoft Windows 10 结束支持公告：https://learn.microsoft.com/en-us/lifecycle/announcements/windows-10-end-of-support
