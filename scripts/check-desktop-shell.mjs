import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath))
}

function assert(condition, message) {
  if (!condition) throw new Error(`[desktop-shell] ${message}`)
}

function assertExactArray(actual, expected, label) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} 必须精确为 ${JSON.stringify(expected)}`)
}

function assertWindow(config, expected) {
  assertExactArray(config.app.windows.map(window => window.label), ['main'], `${expected.label} window labels`)
  const window = config.app.windows[0]
  assert(window.title === expected.title, `${expected.label} title 不匹配`)
  assert(window.dataDirectory === 'webview-data', `${expected.label} dataDirectory 必须是 webview-data`)
  assert(window.devtools === expected.devtools, `${expected.label} devtools 配置不匹配`)
}

const requiredFiles = [
  '.env',
  '.env.desktop',
  '.env.desktop-stable',
  'src/runtime/router.tsx',
  'src/runtime/tauri/index.ts',
  'src/runtime/tauri/dev-smoke.ts',
  'src-tauri/Cargo.toml',
  'src-tauri/build.rs',
  'src-tauri/src/main.rs',
  'src-tauri/src/lib.rs',
  'src-tauri/src/commands/ai.rs',
  'src-tauri/src/commands/dev.rs',
  'src-tauri/src/commands/files.rs',
  'src-tauri/src/commands/gist.rs',
  'src-tauri/src/commands/migration.rs',
  'src-tauri/src/commands/secrets.rs',
  'src-tauri/src/commands/system.rs',
  'src-tauri/tauri.conf.json',
  'src-tauri/tauri.stable.conf.json',
  'src-tauri/capabilities/main.json',
  'scripts/windows-desktop-artifact-guard.mjs',
  'scripts/windows-desktop-stable-boundary-check.mjs',
  'src-tauri/icons/32x32.png',
  'src-tauri/icons/128x128.png',
  'src-tauri/icons/128x128@2x.png',
  'src-tauri/icons/icon.ico',
]
for (const file of requiredFiles) assert(fs.existsSync(path.join(root, file)), `缺少 ${file}`)

const pkg = readJson('package.json')
const devConfig = readJson('src-tauri/tauri.conf.json')
const stableConfig = readJson('src-tauri/tauri.stable.conf.json')
const capability = readJson('src-tauri/capabilities/main.json')
const cargo = read('src-tauri/Cargo.toml')
const lib = read('src-tauri/src/lib.rs')
const main = read('src-tauri/src/main.rs')
const runtimeIndex = read('src/runtime/index.ts')
const routeSmoke = read('scripts/windows-desktop-route-smoke.mjs')
const upgradeSmoke = read('scripts/windows-desktop-persistence-upgrade-smoke.mjs')
const stableBoundary = read('scripts/windows-desktop-stable-boundary-check.mjs')

assert(devConfig.productName === 'StoryForge Dev', '默认配置必须使用开发产品名')
assert(devConfig.identifier === 'io.github.yuanbw2025.storyforge.dev', '默认配置必须使用开发 identifier')
assert(devConfig.build.devUrl === 'http://127.0.0.1:1420', '开发 URL 必须固定在隔离的 127.0.0.1:1420')
assert(devConfig.build.frontendDist === '../dist-desktop', 'Desktop 产物目录必须是 dist-desktop')
assertWindow(devConfig, {
  label: 'development',
  title: '故事熔炉 StoryForge Dev（仅合成数据）',
  devtools: true,
})

assert(stableConfig.productName === 'StoryForge', '正式 overlay 产品名不匹配')
assert(stableConfig.identifier === 'io.github.yuanbw2025.storyforge', '正式 overlay identifier 不匹配')
assert(stableConfig.build.beforeBuildCommand === 'npm run desktop:ui:build:stable', '正式 overlay 必须使用 stable UI mode')
assert(stableConfig.build.frontendDist === '../dist-desktop-stable', '正式 overlay 必须使用独立 stable UI 目录')
assertWindow(stableConfig, {
  label: 'stable',
  title: '故事熔炉 StoryForge',
  devtools: false,
})

assert(typeof devConfig.app.security.csp === 'string' && devConfig.app.security.csp.length > 0, '生产 CSP 不得为空')
assert(devConfig.app.security.csp.includes("object-src 'none'"), '生产 CSP 必须拒绝 object-src')
assert(typeof devConfig.app.security.devCsp === 'string' && devConfig.app.security.devCsp.length > 0, '开发 CSP 不得为空')
assertExactArray(devConfig.app.security.capabilities, ['main'], '启用 capability')
assert(capability.identifier === 'main', 'capability identifier 必须是 main')
assertExactArray(capability.windows, ['main'], 'capability windows')
assertExactArray(capability.permissions, ['core:default'], 'D1.1 capability permissions')

assert(pkg.scripts['desktop:ui:dev'] === 'node node_modules/vite/bin/vite.js --mode desktop', '缺少 desktop:ui:dev')
assert(pkg.scripts['desktop:ui:build'] === 'tsc -b && node node_modules/vite/bin/vite.js build --mode desktop', '缺少 desktop:ui:build')
assert(pkg.scripts['desktop:ui:build:stable'] === 'tsc -b && node node_modules/vite/bin/vite.js build --mode desktop-stable', '缺少 desktop:ui:build:stable')
assert(pkg.scripts['desktop:dev'] === 'tauri dev --features dev-identity', '开发启动必须显式启用 dev-identity')
assert(pkg.scripts['desktop:build:dev'] === 'tauri build --no-bundle --features dev-identity', '开发壳构建必须显式启用 dev-identity')
assert(pkg.scripts['desktop:build'] === 'tauri build --no-bundle --config src-tauri/tauri.stable.conf.json', 'stable 构建不得启用 dev-identity')
assert(pkg.scripts['check:desktop-stable-boundary'] === 'node scripts/windows-desktop-stable-boundary-check.mjs', '缺少 M0 stable boundary check')
assert(pkg.scripts['check:desktop-persistence'] === 'node scripts/windows-desktop-route-smoke.mjs --persistence', '缺少 D1.3 持久化 smoke')
assert(pkg.scripts['check:desktop-persistence-upgrade'] === 'node scripts/windows-desktop-persistence-upgrade-smoke.mjs', '缺少 D1.3 覆盖升级 smoke')
assert(pkg.dependencies?.['@tauri-apps/api'] === '2.11.0', '@tauri-apps/api 必须精确锁定 2.11.0')
assert(pkg.devDependencies?.['@tauri-apps/cli'] === '2.11.2', '@tauri-apps/cli 必须精确锁定 2.11.2')

assert(cargo.includes('tauri = { version = "=2.11.5"'), 'Rust tauri 必须精确锁定 2.11.5')
assert(cargo.includes('tauri-build = { version = "=2.6.3"'), 'tauri-build 必须精确锁定 2.6.3')
assert(cargo.includes('default = ["custom-protocol"]'), 'release 壳必须默认启用 custom-protocol')
assert(cargo.includes('custom-protocol = ["tauri/custom-protocol"]'), 'custom-protocol 必须映射 tauri/custom-protocol')
assert(cargo.includes('dev-identity = []'), '缺少显式 dev-identity Cargo feature')
assert(!cargo.includes('tauri-plugin-'), 'D1.1 不得引入 Tauri plugin')
assert(!lib.includes('#[tauri::command]'), 'M1 command 实现不得散落在组合根')
const commonCommands = [
  'commands::ai::runtime_ai_approve_endpoint',
  'commands::ai::runtime_ai_execute',
  'commands::gist::runtime_gist_validate',
  'commands::gist::runtime_gist_write',
  'commands::gist::runtime_gist_list',
  'commands::gist::runtime_gist_read',
  'commands::gist::runtime_gist_revisions',
  'commands::secrets::runtime_secret_put',
  'commands::secrets::runtime_secret_has',
  'commands::secrets::runtime_secret_reference',
  'commands::secrets::runtime_ai_secret_reveal',
  'commands::secrets::runtime_secret_delete',
  'commands::files::runtime_file_begin_save',
  'commands::files::runtime_file_write_chunk',
  'commands::files::runtime_file_finish_write',
  'commands::files::runtime_file_abort_write',
  'commands::files::runtime_file_open',
  'commands::files::runtime_backup_bind',
  'commands::files::runtime_backup_inspect',
  'commands::files::runtime_backup_clear',
  'commands::files::runtime_backup_begin_write',
  'commands::files::runtime_backup_list',
  'commands::files::runtime_backup_read',
  'commands::migration::runtime_migration_read_journal',
  'commands::migration::runtime_migration_write_journal',
  'commands::migration::runtime_migration_clear_journal',
  'commands::migration::runtime_migration_read_receipt',
  'commands::migration::runtime_migration_write_receipt',
  'commands::migration::runtime_migration_delete_receipt',
  'commands::system::runtime_cancel_request',
  'commands::system::runtime_clipboard_write',
  'commands::system::runtime_external_open',
  'commands::system::runtime_durability_status',
  'commands::system::runtime_diagnostics_snapshot',
]
const devOnlyCommands = [
  'commands::dev::runtime_dev_prepare_synthetic_binding',
  'commands::dev::runtime_dev_synthetic_fixture_digest',
  'commands::dev::runtime_dev_reset_synthetic_fixtures',
]
const handlerBlocks = [...lib.matchAll(/tauri::generate_handler!\[([\s\S]*?)\]/g)]
assert(handlerBlocks.length === 2, 'M1 必须分别注册 stable 白名单与 dev-identity 扩展白名单')
const registeredCommands = block => [...block.matchAll(/commands::[a-z_]+::[a-z_]+/g)].map(match => match[0])
assertExactArray(registeredCommands(handlerBlocks[0][1]), commonCommands, 'stable M1 IPC 白名单')
assertExactArray(registeredCommands(handlerBlocks[1][1]), [...commonCommands, ...devOnlyCommands], 'dev M1 IPC 白名单')
assert(lib.includes('#[cfg(not(feature = "dev-identity"))]'), 'stable handler 必须显式排除 dev-identity')
assert(lib.includes('#[cfg(feature = "dev-identity")]'), 'dev handler 必须受 dev-identity feature 保护')
const commandSources = ['ai', 'dev', 'files', 'gist', 'migration', 'secrets', 'system']
  .map(name => read(`src-tauri/src/commands/${name}.rs`))
  .join('\n')
const implementedCommands = [...commandSources.matchAll(/#\[tauri::command\]\s*pub\s+(?:async\s+)?fn\s+([a-z_]+)/g)]
  .map(match => match[1])
  .sort()
const allowedImplementations = [...commonCommands, ...devOnlyCommands]
  .map(command => command.split('::').at(-1))
  .sort()
assertExactArray(implementedCommands, allowedImplementations, 'M1 command 实现集合')
assert(lib.includes('clear_inherited_webview2_environment()'), 'Rust 壳必须清除继承的 WEBVIEW2_* 环境')
assert(lib.includes('#[cfg(feature = "dev-identity")]'), 'Rust 壳 dev overrides 必须受 dev-identity feature 保护')
assert(main.includes('storyforge_desktop_lib::run()'), 'main.rs 必须只转发到 lib::run')
assert(runtimeIndex.includes('tauri: createTauriRuntime'), 'Tauri RuntimeAdapter 尚未注册')
assert(routeSmoke.includes('const devIdentity = DESKTOP_DEV_IDENTITY'), 'Desktop smoke 必须从 artifact guard 固定 dev identity')
assert(routeSmoke.includes('assertDevIdentityExecutable(sourceExePath)'), 'Desktop smoke 必须在启动前拒绝 stable executable')
assert(routeSmoke.includes('STORYFORGE_DEV_WEBVIEW2_USER_DATA_FOLDER'), 'Desktop smoke 必须只传递自有 dev profile 变量')
assert(!routeSmoke.includes('process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'), 'Desktop smoke 不得继承外部 WebView2 浏览器参数')
assert(routeSmoke.includes('verifyPackagedPdfWorker'), 'Desktop smoke 必须运行真实 pdf.js worker 验证')
assert(routeSmoke.includes("cliArgs.includes('--persistence')"), 'Desktop smoke 必须提供 D1.3 persistence mode')
assert(routeSmoke.includes("cliArgs.indexOf('--upgrade-exe')"), 'Desktop smoke 必须支持不同版本的同身份覆盖升级')
assert(routeSmoke.includes('sameIdentityOverwriteUpgradePersisted'), 'Desktop smoke 必须报告覆盖升级持久化结果')
assert(routeSmoke.includes("cliArgs.includes('--m1')"), 'Desktop smoke 必须提供 M1 capability mode')
assert(routeSmoke.includes('runM1CoreUseSoak'), 'Desktop smoke 必须保留 M1 核心使用验证入口')
assert(pkg.scripts['check:desktop-m1'] === 'node scripts/windows-desktop-route-smoke.mjs --persistence --m1', '缺少 M1 快速实机 smoke')
assert(upgradeSmoke.includes("identifier: 'io.github.yuanbw2025.storyforge.dev'"), '覆盖升级 smoke 必须固定 dev identity')
assert((upgradeSmoke.match(/'dev-identity'/g) || []).length === 2, '覆盖升级 smoke 的两个 artifact 都必须显式启用 dev-identity')
assert(upgradeSmoke.includes('fs.rmSync(targetExe, { force: true })'), '覆盖升级 smoke 必须恢复“目标 exe 原本不存在”的状态')
assert(stableBoundary.includes('stableRejectedBeforeLaunch: true'), 'stable boundary 必须记录启动前拒绝')
assert(stableBoundary.includes('stableLaunchAttempted: false'), 'stable boundary 必须证明没有启动 stable artifact')
assert(!stableBoundary.includes('spawn('), 'stable boundary 不得启动任何 stable artifact')

console.log('M2 desktop shell and narrow IPC static contract passed.')
