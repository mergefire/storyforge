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
  'src-tauri/Cargo.toml',
  'src-tauri/build.rs',
  'src-tauri/src/main.rs',
  'src-tauri/src/lib.rs',
  'src-tauri/tauri.conf.json',
  'src-tauri/tauri.stable.conf.json',
  'src-tauri/capabilities/main.json',
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
assert(pkg.scripts['desktop:build:dev'] === 'tauri build --no-bundle', '开发壳构建必须默认使用隔离身份')
assert(pkg.dependencies?.['@tauri-apps/api'] === '2.11.0', '@tauri-apps/api 必须精确锁定 2.11.0')
assert(pkg.devDependencies?.['@tauri-apps/cli'] === '2.11.2', '@tauri-apps/cli 必须精确锁定 2.11.2')

assert(cargo.includes('tauri = { version = "=2.11.5"'), 'Rust tauri 必须精确锁定 2.11.5')
assert(cargo.includes('tauri-build = { version = "=2.6.3"'), 'tauri-build 必须精确锁定 2.6.3')
assert(cargo.includes('default = ["custom-protocol"]'), 'release 壳必须默认启用 custom-protocol')
assert(cargo.includes('custom-protocol = ["tauri/custom-protocol"]'), 'custom-protocol 必须映射 tauri/custom-protocol')
assert(!cargo.includes('tauri-plugin-'), 'D1.1 不得引入 Tauri plugin')
assert(!lib.includes('#[tauri::command]'), 'D1.1 Rust 壳不得暴露 IPC command')
assert(!lib.includes('generate_handler!'), 'D1.1 Rust 壳不得注册万能 handler')
assert(main.includes('storyforge_desktop_lib::run()'), 'main.rs 必须只转发到 lib::run')
assert(runtimeIndex.includes('tauri: createTauriRuntime'), 'Tauri RuntimeAdapter 尚未注册')

console.log('D1.1 desktop shell static contract passed.')
