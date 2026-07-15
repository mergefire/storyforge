# Windows 桌面基线参考环境（D0.4）

> 状态：**部分静态事实已采集，交互测量环境尚未冻结**  
> 日期：2026-07-14（Asia/Shanghai）  
> 协议：`d0.4-v2`

## 1. 当前参考机草案

以下信息来自本机只读静态查询或已安装工具版本。它们仅描述当前候选参考机，不构成 Web / PWA 性能样本。

| 项目 | 当前值 | 状态 |
| --- | --- | --- |
| Windows | Windows 10 Pro 64-bit，build 19045 | `MEASURED_STATIC` |
| CPU | AMD Ryzen 9 7950X，32 logical processors | `MEASURED_STATIC` |
| 物理内存 | 67,795,095,552 bytes（约 63.1 GiB） | `MEASURED_STATIC` |
| 独显 | NVIDIA GeForce RTX 4090，driver 32.0.15.9159 | `MEASURED_STATIC` |
| 集显 | AMD Radeon Graphics，driver 31.0.24002.92 | `MEASURED_STATIC` |
| WebView2 Runtime | 150.0.4078.65 | `MEASURED_STATIC` |
| Node | v22.16.0 | `MEASURED_STATIC` |
| npm / npx | 10.9.2 | `MEASURED_STATIC` |
| Rust | 1.95.0 | `MEASURED_STATIC` |
| Edge | 150.0.4078.65（system x86 version directory） | `MEASURED_STATIC` |
| Chrome | 150.0.7871.114（system x86 version directory） | `MEASURED_STATIC` |
| 物理显示器、分辨率、DPI、刷新率 | `NOT_MEASURED` | 必须排除虚拟显示适配器歧义 |
| 电源模式 / AC 状态 | `NOT_MEASURED` | 运行前冻结 |
| 应用实际选用 GPU | `NOT_MEASURED` | 运行时证据 |
| 固定视频源与 SHA-256 | `NOT_MEASURED` | 夹具未生成 |
| 固定项目夹具 manifest / SHA-256 | `NOT_MEASURED` | 夹具未生成 |
| 源提交 | `UNRESOLVED` | 采集器禁止运行 Git，由调用方传入 |

注意：系统中可能存在远程、虚拟或镜像显示适配器。仅凭 GPU 设备列表不能推断浏览器或 WebView2 实际渲染 GPU，也不能推断物理显示器参数。

## 2. 未冻结项及冻结方法

进行首轮 Web / PWA 测量前必须补齐：

1. 运行前重新核对 Edge、Chrome、WebView2 文件版本，并关闭测量窗口内的自动更新版本漂移；上表目录版本只是 2026-07-14 的静态快照。
2. 物理显示器型号、有效分辨率、缩放、刷新率和连接方式。
3. Windows 电源模式、AC 状态、前后台进程约束和网络整形方式。
4. 浏览器扩展、实验 flag、硬件加速状态和候选 GPU。
5. 固定视频文件及编码参数、固定项目/Blob 夹具 manifest 和全部 SHA-256。
6. Web / PWA 所用生产资源版本、源提交和缓存策略。

任何缺项都应保留为 `NOT_MEASURED` / `UNRESOLVED`；禁止通过经验补值。

## 3. 工具链注意事项

- 本机 PowerShell 执行策略可能阻止 `npm.ps1`；使用 `npm.cmd` / `npx.cmd`。
- 普通 shell 的 `PATH` 未必含 MSVC `cl.exe` / `link.exe`；这只表示环境尚未加载，不能推断构建工具未安装。
- Windows 命令环境必须保留 `SystemRoot`、`windir`、`ComSpec` 和 `SystemDrive`，否则 Winsock/WebView2 本地调试可能出现误导性故障。
- D0.4 静态采集器不启动浏览器或客户端，不分配 CDP 端口，也不采集进程树。

## 4. 依赖安装的当前风险信号

2026-07-14 在该独立 checkout 执行 `npm ci`，安装摘要为：

- 780 packages；
- 18 个 audit advisories：1 low、8 moderate、7 high、2 critical。

这只是 `npm ci` 输出中的 **npm audit summary**。当前没有审计具体包、传递路径、dev/production 范围、可达性或可利用性，因此：

- 不能把这些数量直接当作产品风险等级；
- 不能据此宣称依赖安全通过或失败；
- 不能据此宣称 D0.4 的动态安全场景已测；
- 本轮未执行 `npm audit fix` 或 `npm audit fix --force`。

依赖漏洞归因和升级策略属于独立依赖审计工作，应在发布闸门前形成可复核结论。

## 5. 当前可用结论

- 静态硬件/工具链事实可作为参考环境草案。
- 浏览器、显示、电源、固定媒体和固定数据尚未完整冻结。
- 没有 Web / PWA 启动、编辑、内存、视频、Blob 或安全动态样本。
- 因此本环境当前只能支持 `NOT_ELIGIBLE` 的静态报告，不能支持 D0.4 PASS 或客户端发布裁决。
