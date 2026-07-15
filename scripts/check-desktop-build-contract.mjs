import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const webDir = path.join(root, 'dist')
const desktopDir = path.join(root, 'dist-desktop')

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
assert(path.resolve(webDir) !== path.resolve(desktopDir), 'Web 与 Desktop 不能共用输出目录')

const webFiles = walk(webDir)
const desktopFiles = walk(desktopDir)
const webIndex = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8')
const desktopIndex = fs.readFileSync(path.join(desktopDir, 'index.html'), 'utf8')
assert(!desktopIndex.includes('fonts.googleapis.com'), 'Desktop index must not request Google Fonts')

assert(webFiles.includes('manifest.webmanifest'), 'Web 产物缺少 manifest.webmanifest')
assert(webFiles.includes('sw.js'), 'Web 产物缺少 sw.js')
assert(webFiles.some(file => file.startsWith('workbox-')), 'Web 产物缺少 Workbox runtime')
assert(webIndex.includes('/storyforge/assets/'), 'Web 资源路径必须保留 /storyforge/')

for (const forbidden of ['manifest.webmanifest', 'sw.js', 'registerSW.js']) {
  assert(!desktopFiles.includes(forbidden), `Desktop 产物不得包含 ${forbidden}`)
}
assert(!desktopFiles.some(file => file.startsWith('workbox-')), 'Desktop 产物不得包含 Workbox runtime')
assert(!desktopIndex.includes('/storyforge/'), 'Desktop index 不得请求 /storyforge/ 绝对路径')
assert(/(?:src|href)="\.\/assets\//.test(desktopIndex), 'Desktop index 必须使用 ./assets 相对路径')
assert(desktopFiles.some(file => file.startsWith('assets/') && file.endsWith('.js')), 'Desktop 产物缺少 JavaScript chunks')
assert(desktopFiles.some(file => file.startsWith('assets/') && file.endsWith('.css')), 'Desktop 产物缺少 CSS')

assert(desktopFiles.some(file => /^assets\/SettingsPage-.+\.js$/.test(file)), 'Desktop output must include the settings lazy chunk')
assert(desktopFiles.some(file => /^assets\/pdf\.worker-.+\.mjs$/.test(file)), 'Desktop output must include the pdf.js worker')

console.log(`Desktop build contract passed: web=${webFiles.length} files, desktop=${desktopFiles.length} files.`)
