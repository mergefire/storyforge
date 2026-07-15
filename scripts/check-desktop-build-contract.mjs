import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const webDir = path.join(root, 'dist')
const desktopDir = path.join(root, 'dist-desktop')
const stableDesktopDir = path.join(root, 'dist-desktop-stable')

function assert(condition, message) {
  if (!condition) throw new Error(`[desktop-build] ${message}`)
}

function walk(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(prefix, entry.name)
    return entry.isDirectory() ? walk(path.join(dir, entry.name), relative) : [relative.replaceAll('\\', '/')]
  })
}

assert(fs.existsSync(webDir), '缺少 Web 产物 dist；先运行 npm run build')
assert(fs.existsSync(desktopDir), '缺少 Desktop 产物 dist-desktop；先运行 npm run desktop:ui:build')
assert(fs.existsSync(stableDesktopDir), '缺少 Stable Desktop 产物 dist-desktop-stable；先运行 npm run desktop:ui:build:stable')
assert(new Set([webDir, desktopDir, stableDesktopDir].map(dir => path.resolve(dir))).size === 3, 'Web、Dev Desktop 与 Stable Desktop 不能共用输出目录')

const webFiles = walk(webDir)
const desktopFiles = walk(desktopDir)
const stableDesktopFiles = walk(stableDesktopDir)
const webIndex = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8')
const desktopIndex = fs.readFileSync(path.join(desktopDir, 'index.html'), 'utf8')
const stableDesktopIndex = fs.readFileSync(path.join(stableDesktopDir, 'index.html'), 'utf8')

function readTextArtifacts(dir, files) {
  return files
    .filter(file => /\.(?:css|html|js|mjs|webmanifest)$/.test(file))
    .map(file => fs.readFileSync(path.join(dir, file), 'utf8'))
    .join('\n')
}

const webText = readTextArtifacts(webDir, webFiles)
const desktopText = readTextArtifacts(desktopDir, desktopFiles)
const stableDesktopText = readTextArtifacts(stableDesktopDir, stableDesktopFiles)

for (const [target, text] of [['Web', webText], ['Dev Desktop', desktopText], ['Stable Desktop', stableDesktopText]]) {
  assert(!/https:\/\/fonts\.(?:googleapis|gstatic)\.com/i.test(text), `${target} output must not request remote Google Fonts`)
}

assert(webFiles.includes('manifest.webmanifest'), 'Web 产物缺少 manifest.webmanifest')
assert(webFiles.includes('sw.js'), 'Web 产物缺少 sw.js')
assert(webFiles.some(file => file.startsWith('workbox-')), 'Web 产物缺少 Workbox runtime')
assert(webIndex.includes('/storyforge/assets/'), 'Web 资源路径必须保留 /storyforge/')

for (const forbidden of ['manifest.webmanifest', 'sw.js', 'registerSW.js']) {
  assert(!desktopFiles.includes(forbidden), `Desktop 产物不得包含 ${forbidden}`)
  assert(!stableDesktopFiles.includes(forbidden), `Stable Desktop 产物不得包含 ${forbidden}`)
}
assert(!desktopFiles.some(file => file.startsWith('workbox-')), 'Desktop 产物不得包含 Workbox runtime')
assert(!stableDesktopFiles.some(file => file.startsWith('workbox-')), 'Stable Desktop 产物不得包含 Workbox runtime')
assert(!desktopIndex.includes('/storyforge/'), 'Desktop index 不得请求 /storyforge/ 绝对路径')
assert(!stableDesktopIndex.includes('/storyforge/'), 'Stable Desktop index 不得请求 /storyforge/ 绝对路径')
assert(/(?:src|href)="\.\/assets\//.test(desktopIndex), 'Desktop index 必须使用 ./assets 相对路径')
assert(/(?:src|href)="\.\/assets\//.test(stableDesktopIndex), 'Stable Desktop index 必须使用 ./assets 相对路径')
assert(desktopFiles.some(file => file.startsWith('assets/') && file.endsWith('.js')), 'Desktop 产物缺少 JavaScript chunks')
assert(desktopFiles.some(file => file.startsWith('assets/') && file.endsWith('.css')), 'Desktop 产物缺少 CSS')
assert(stableDesktopFiles.some(file => file.startsWith('assets/') && file.endsWith('.js')), 'Stable Desktop 产物缺少 JavaScript chunks')
assert(stableDesktopFiles.some(file => file.startsWith('assets/') && file.endsWith('.css')), 'Stable Desktop 产物缺少 CSS')

const expectedLocalFonts = [
  /^assets\/Inter-Variable-.+\.ttf$/,
  /^assets\/SourceSerif4-Variable-.+\.ttf$/,
  /^assets\/SourceSerif4-Italic-Variable-.+\.ttf$/,
  /^assets\/JetBrainsMono-Variable-.+\.ttf$/,
]
for (const pattern of expectedLocalFonts) {
  const webFont = webFiles.find(file => pattern.test(file))
  assert(webFont, `Web output missing local font ${pattern}`)
  assert(desktopFiles.some(file => pattern.test(file)), `Desktop output missing local font ${pattern}`)
  assert(stableDesktopFiles.some(file => pattern.test(file)), `Stable Desktop output missing local font ${pattern}`)
  const webServiceWorker = fs.readFileSync(path.join(webDir, 'sw.js'), 'utf8')
  assert(webServiceWorker.includes(webFont), `Web service worker must precache ${webFont}`)
}
assert(webText.includes('Inter') && webText.includes('Source Serif 4') && webText.includes('JetBrains Mono'), 'Web CSS must declare packaged fonts')
assert(desktopText.includes('Inter') && desktopText.includes('Source Serif 4') && desktopText.includes('JetBrains Mono'), 'Desktop CSS must declare packaged fonts')
assert(stableDesktopText.includes('Inter') && stableDesktopText.includes('Source Serif 4') && stableDesktopText.includes('JetBrains Mono'), 'Stable Desktop CSS must declare packaged fonts')

assert(desktopFiles.some(file => /^assets\/SettingsPage-.+\.js$/.test(file)), 'Desktop output must include the settings lazy chunk')
assert(desktopFiles.some(file => /^assets\/pdf\.worker-.+\.mjs$/.test(file)), 'Desktop output must include the pdf.js worker')
assert(stableDesktopFiles.some(file => /^assets\/SettingsPage-.+\.js$/.test(file)), 'Stable Desktop output must include the settings lazy chunk')
assert(stableDesktopFiles.some(file => /^assets\/pdf\.worker-.+\.mjs$/.test(file)), 'Stable Desktop output must include the pdf.js worker')
assert(desktopText.includes('io.github.yuanbw2025.storyforge.dev'), 'Dev Desktop output must contain the dev identifier')
assert(desktopText.includes('storyforge-m0-dev-smoke'), 'Dev Desktop output must contain the dev-only smoke hook')
assert(stableDesktopText.includes('io.github.yuanbw2025.storyforge'), 'Stable Desktop output must contain the stable identifier')
assert(!stableDesktopText.includes('io.github.yuanbw2025.storyforge.dev'), 'Stable Desktop output must not contain the dev identifier')
assert(!stableDesktopText.includes('storyforge-m0-dev-smoke'), 'Stable Desktop output must not contain the dev-only smoke hook')

console.log(`Desktop build contract passed: web=${webFiles.length}, dev=${desktopFiles.length}, stable=${stableDesktopFiles.length} files.`)
