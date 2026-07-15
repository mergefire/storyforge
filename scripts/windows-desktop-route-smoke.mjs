#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const taskkill = 'C:\\Windows\\System32\\taskkill.exe'
const defaultExe = path.join(repoRoot, 'src-tauri', 'target', 'release', 'storyforge-desktop.exe')
const cliArgs = process.argv.slice(2)
const persistenceMode = cliArgs.includes('--persistence')
const upgradeOptionIndex = cliArgs.indexOf('--upgrade-exe')
if (upgradeOptionIndex >= 0 && (!cliArgs[upgradeOptionIndex + 1] || cliArgs[upgradeOptionIndex + 1].startsWith('--'))) {
  throw new Error('[desktop-route-smoke] --upgrade-exe requires an executable path')
}
const upgradeSourceExePath = upgradeOptionIndex >= 0
  ? path.resolve(cliArgs[upgradeOptionIndex + 1])
  : null
const positionalArgs = cliArgs.filter((argument, index) => {
  if (argument === '--persistence' || argument === '--upgrade-exe') return false
  if (upgradeOptionIndex >= 0 && index === upgradeOptionIndex + 1) return false
  if (argument.startsWith('--')) {
    throw new Error(`[desktop-route-smoke] unknown option: ${argument}`)
  }
  return true
})
if (positionalArgs.length > 1) {
  throw new Error('[desktop-route-smoke] expected at most one baseline executable path')
}
const sourceExePath = path.resolve(positionalArgs[0] || defaultExe)
const upgradeMode = Boolean(upgradeSourceExePath)
if (upgradeMode && !persistenceMode) {
  throw new Error('[desktop-route-smoke] --upgrade-exe requires --persistence')
}
const devIdentity = 'io.github.yuanbw2025.storyforge.dev'
const syntheticProjectName = `${upgradeMode ? 'D1.3 覆盖升级烟测' : persistenceMode ? 'D1.3 持久化烟测' : 'D1.2 路由烟测'} ${Date.now()}`
const syntheticChapterTitle = `D1.3 合成章节 ${Date.now()}`
const syntheticChapterText = `D1.3 自动保存正文 ${Date.now()}，用于验证关闭和重启后内容保持。`
const localStorageSentinelKey = 'storyforge-d1.3-synthetic-sentinel'
const localStorageSentinelValue = `sentinel-${Date.now()}`
const runDir = path.join(
  os.tmpdir(),
  `storyforge-${upgradeMode ? 'd1.3-upgrade' : persistenceMode ? 'd1.3-persistence' : 'd1.2-route'}-smoke-${process.pid}-${Date.now()}`,
)
const runtimeDir = path.join(runDir, 'runtime')
const exePath = upgradeMode
  ? path.join(runtimeDir, path.basename(sourceExePath))
  : sourceExePath
const profileDir = path.join(runDir, 'webview2-profile-primary')
const isolatedProfileDir = path.join(runDir, 'webview2-profile-isolated')
const recordPath = path.join(runDir, 'run-record.json')

const state = {
  cdp: null,
  launch: null,
  launches: [],
  activeArtifact: null,
  upgradeEvidence: null,
  runRecord: {
    schemaVersion: 1,
    workspace: repoRoot,
    executable: exePath,
    sourceExecutables: upgradeMode
      ? { baseline: sourceExePath, upgrade: upgradeSourceExePath }
      : { baseline: sourceExePath },
    profileDirectory: profileDir,
    profileDirectories: persistenceMode
      ? { primary: profileDir, isolated: isolatedProfileDir }
      : { primary: profileDir },
    reason: upgradeMode
      ? 'D1.3 same dev identity executable overwrite upgrade persistence smoke'
      : persistenceMode
        ? 'D1.3 synthetic project/chapter persistence and profile isolation smoke'
      : 'D1.2 home/settings/project direct-route and restart smoke',
    startedAt: new Date().toISOString(),
    launches: [],
  },
}

function assert(condition, message) {
  if (!condition) throw new Error(`[desktop-route-smoke] ${message}`)
}

function writeRunRecord() {
  fs.writeFileSync(recordPath, `${JSON.stringify(state.runRecord, null, 2)}\n`, 'utf8')
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase()
}

function assertDevIdentityExecutable(filePath = exePath) {
  const executableBytes = fs.readFileSync(filePath)
  assert(
    executableBytes.includes(Buffer.from(devIdentity, 'utf8')),
    `refusing to launch CDP smoke against a non-dev executable: ${filePath}`,
  )
}

function removeRunDirectory() {
  const resolvedRunDir = path.resolve(runDir)
  const resolvedTempDir = path.resolve(os.tmpdir())
  assert(
    resolvedRunDir.startsWith(`${resolvedTempDir}${path.sep}`) &&
      path.basename(resolvedRunDir).startsWith('storyforge-d1.'),
    `refusing to remove unexpected run directory: ${resolvedRunDir}`,
  )
  fs.rmSync(resolvedRunDir, { recursive: true, force: true })
}

function runPowerShell(script) {
  return execFileSync(
    powershell,
    ['-NoLogo', '-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { encoding: 'utf8', windowsHide: true },
  ).replace(/^\uFEFF/, '').trim()
}

function exactExecutablePids(executablePath = exePath) {
  const escapedPath = executablePath.replaceAll("'", "''")
  const escapedName = path.basename(executablePath, path.extname(executablePath)).replaceAll("'", "''")
  const output = runPowerShell(`
$ErrorActionPreference = 'Stop'
$target = [IO.Path]::GetFullPath('${escapedPath}')
$pids = @()
foreach ($process in [Diagnostics.Process]::GetProcessesByName('${escapedName}')) {
  try {
    if ($process.MainModule -and [IO.Path]::GetFullPath($process.MainModule.FileName) -eq $target) {
      $pids += $process.Id
    }
  } catch {
  } finally {
    $process.Dispose()
  }
}
[Console]::Write('[' + ($pids -join ',') + ']')
`)
  if (!output) return []
  const value = JSON.parse(output)
  if (value == null) return []
  const pids = Array.isArray(value) ? value.map(Number) : [Number(value)]
  return pids.filter(pid => Number.isInteger(pid) && pid > 0)
}

function executableEvidence(filePath) {
  const escapedPath = filePath.replaceAll("'", "''")
  const versionInfo = JSON.parse(runPowerShell(`
$ErrorActionPreference = 'Stop'
$item = Get-Item -LiteralPath '${escapedPath}'
$result = @{
  fileVersion = $item.VersionInfo.FileVersion
  productVersion = $item.VersionInfo.ProductVersion
}
[Console]::Write((ConvertTo-Json -Compress -InputObject $result))
`))
  return {
    path: filePath,
    bytes: fs.statSync(filePath).size,
    sha256: sha256File(filePath),
    fileVersion: versionInfo.fileVersion || null,
    productVersion: versionInfo.productVersion || null,
  }
}

async function freePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : null
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  assert(port, 'failed to allocate a dynamic CDP port')
  return port
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitFor(check, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const value = await check()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await delay(100)
  }
  const suffix = lastError ? `; last error: ${lastError.message}` : ''
  throw new Error(`[desktop-route-smoke] timed out waiting for ${label}${suffix}`)
}

async function waitForPortClosed(port) {
  await waitFor(async () => new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port })
    socket.setTimeout(250)
    socket.once('connect', () => {
      socket.destroy()
      resolve(false)
    })
    const closed = () => {
      socket.destroy()
      resolve(true)
    }
    socket.once('error', closed)
    socket.once('timeout', closed)
  }), `CDP port ${port} to close`, 10_000)
}

async function waitForChildExit(child, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (child.exitCode === null && Date.now() < deadline) await delay(100)
  return child.exitCode !== null
}

function requestGracefulWindowClose(pid) {
  const output = runPowerShell(`
$ErrorActionPreference = 'Stop'
$process = [Diagnostics.Process]::GetProcessById(${pid})
[Console]::Write($process.CloseMainWindow())
$process.Dispose()
`)
  return output.toLowerCase() === 'true'
}

async function decodeWebSocketMessage(data) {
  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8')
  if (data && typeof data.text === 'function') return data.text()
  return String(data)
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()
    this.socket = null
  }

  async connect() {
    const socket = new WebSocket(this.webSocketUrl)
    this.socket = socket
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('CDP websocket open timeout')), 10_000)
      socket.addEventListener('open', () => {
        clearTimeout(timeout)
        resolve()
      }, { once: true })
      socket.addEventListener('error', event => {
        clearTimeout(timeout)
        reject(new Error(`CDP websocket error: ${event.message || 'unknown'}`))
      }, { once: true })
    })
    socket.addEventListener('message', async event => {
      const message = JSON.parse(await decodeWebSocketMessage(event.data))
      if (message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        clearTimeout(pending.timeout)
        if (message.error) pending.reject(new Error(`${message.error.code}: ${message.error.message}`))
        else pending.resolve(message.result)
        return
      }
      for (const listener of this.listeners.get(message.method) || []) {
        listener(message.params || {})
      }
    })
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('CDP websocket closed'))
      }
      this.pending.clear()
    })
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || []
    listeners.push(listener)
    this.listeners.set(method, listeners)
  }

  send(method, params = {}) {
    assert(this.socket?.readyState === WebSocket.OPEN, 'CDP websocket is not open')
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP command timed out: ${method}`))
      }, 15_000)
      this.pending.set(id, { resolve, reject, timeout })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  close() {
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) this.socket.close()
  }
}

async function waitForTarget(port, launch) {
  return waitFor(async () => {
    if (launch.child.exitCode !== null) {
      throw new Error(`desktop exited early with code ${launch.child.exitCode}: ${launch.stderr.join('')}`)
    }
    const response = await fetch(`http://127.0.0.1:${port}/json/list`)
    if (!response.ok) return null
    const targets = await response.json()
    return targets.find(target => target.type === 'page' && target.url.includes('tauri.localhost')) || null
  }, `WebView2 CDP target on port ${port}`)
}

async function launchDesktop(label, profileDirectory = profileDir) {
  const port = await freePort()
  const stderr = []
  const stdout = []
  const child = spawn(exePath, [], {
    cwd: path.dirname(exePath),
    env: {
      ...process.env,
      WEBVIEW2_USER_DATA_FOLDER: profileDirectory,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: [
        process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS || '',
        `--remote-debugging-port=${port}`,
        `--remote-allow-origins=http://127.0.0.1:${port}`,
      ].filter(Boolean).join(' '),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: false,
  })
  child.stdout.on('data', chunk => stdout.push(chunk.toString()))
  child.stderr.on('data', chunk => stderr.push(chunk.toString()))

  const launch = { child, label, pid: child.pid, port, stderr, stdout }
  state.launch = launch
  state.launches.push({
    label,
    pid: child.pid,
    port,
    profileDirectory,
    artifactSha256: state.activeArtifact?.sha256 || null,
    artifactVersion: state.activeArtifact?.productVersion || state.activeArtifact?.fileVersion || null,
  })
  state.runRecord.launches.push({
    label,
    pid: child.pid,
    cdpPort: port,
    executable: exePath,
    artifactSha256: state.activeArtifact?.sha256 || null,
    artifactVersion: state.activeArtifact?.productVersion || state.activeArtifact?.fileVersion || null,
    profileDirectory,
    launchedAt: new Date().toISOString(),
  })
  writeRunRecord()

  const target = await waitForTarget(port, launch)
  const cdp = new CdpClient(target.webSocketDebuggerUrl)
  await cdp.connect()
  state.cdp = cdp
  return { ...launch, cdp, target }
}

async function stopDesktop() {
  const launch = state.launch
  if (!launch) return
  state.cdp?.close()
  state.cdp = null

  if (launch.child.exitCode === null && launch.child.pid) {
    let shutdownMode = 'graceful'
    const closeRequested = requestGracefulWindowClose(launch.child.pid)
    const closedGracefully = closeRequested && await waitForChildExit(launch.child, 10_000)
    if (!closedGracefully && launch.child.exitCode === null) {
      shutdownMode = 'forced-fallback'
      try {
        execFileSync(taskkill, ['/PID', String(launch.child.pid), '/T', '/F'], {
          encoding: 'utf8',
          windowsHide: true,
          stdio: 'ignore',
        })
      } catch (error) {
        if (launch.child.exitCode === null) throw error
      }
      await waitForChildExit(launch.child, 5_000)
    }
    const record = state.runRecord.launches.find(item => item.pid === launch.pid)
    if (record) record.shutdownMode = shutdownMode
    const summary = state.launches.find(item => item.pid === launch.pid)
    if (summary) summary.shutdownMode = shutdownMode
  }

  await waitForPortClosed(launch.port)
  const record = state.runRecord.launches.find(item => item.pid === launch.pid)
  if (record) record.stoppedAt = new Date().toISOString()
  writeRunRecord()
  state.launch = null
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  }
  return result.result?.value
}

async function waitForExpression(cdp, expression, label, timeoutMs = 30_000) {
  return waitFor(() => evaluate(cdp, expression), label, timeoutMs)
}

async function directRoute(cdp, hash, readyExpression, label) {
  await evaluate(cdp, `location.hash = ${JSON.stringify(hash)}`)
  await waitForExpression(cdp, readyExpression, `${label} navigation`)
  await cdp.send('Page.reload')
  await waitForExpression(cdp, readyExpression, `${label} direct reload`)
  return evaluate(cdp, `({ hash: location.hash, title: document.title, body: document.body.innerText.slice(0, 500) })`)
}

async function prepareCdp(launch) {
  const requests = []
  const exceptions = []
  const consoleErrors = []
  launch.cdp.on('Network.requestWillBeSent', params => requests.push(params.request.url))
  launch.cdp.on('Runtime.exceptionThrown', params => exceptions.push(params.exceptionDetails))
  launch.cdp.on('Runtime.consoleAPICalled', params => {
    if (params.type === 'error') consoleErrors.push(params.args.map(arg => arg.value || arg.description || '').join(' '))
  })
  await Promise.all([
    launch.cdp.send('Page.enable'),
    launch.cdp.send('Runtime.enable'),
    launch.cdp.send('Network.enable'),
  ])
  const rootReady = `document.readyState === 'complete' && Boolean(document.querySelector('#root')?.children.length)`
  await waitForExpression(launch.cdp, rootReady, 'React root on initial startup')
  await launch.cdp.send('Page.reload')
  try {
    await waitForExpression(launch.cdp, rootReady, 'React root after instrumented reload')
  } catch (error) {
    const snapshot = await evaluate(launch.cdp, `({
      href: location.href,
      readyState: document.readyState,
      title: document.title,
      body: document.body?.innerText?.slice(0, 1000) || '',
      html: document.documentElement?.outerHTML?.slice(0, 2000) || '',
    })`).catch(snapshotError => ({ snapshotError: snapshotError.message }))
    throw new Error(`${error.message}; snapshot=${JSON.stringify(snapshot)}; exceptions=${JSON.stringify(exceptions)}`)
  }
  return { requests, exceptions, consoleErrors }
}

async function dismissWelcomeGuide(cdp) {
  await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('button')]
      .find(candidate => candidate.getAttribute('title') === '跳过引导')
    if (button) button.click()
    return true
  })()`)
  await waitForExpression(
    cdp,
    `![...document.querySelectorAll('button')].some(button => button.getAttribute('title') === '跳过引导')`,
    'welcome guide dismissal',
  )
}

async function createSyntheticProject(cdp) {
  await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('button')]
      .find(candidate => candidate.textContent.trim() === '+ 新建项目')
    if (!button) throw new Error('new project button not found')
    button.click()
    return true
  })()`)
  await waitForExpression(cdp, `Boolean(document.querySelector('input[placeholder="如：《剑出山门》"]'))`, 'new project dialog')
  await evaluate(cdp, `(() => {
    const input = document.querySelector('input[placeholder="如：《剑出山门》"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(syntheticProjectName)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return input.value
  })()`)
  await waitForExpression(cdp, `(() => {
    const button = [...document.querySelectorAll('button')]
      .find(candidate => candidate.textContent.trim() === '创建')
    return Boolean(button && !button.disabled)
  })()`, 'enabled create project button')
  await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('button')]
      .find(candidate => candidate.textContent.trim() === '创建')
    button.click()
    return true
  })()`)
  const hash = await waitForExpression(
    cdp,
    `location.hash.startsWith('#/workspace/') && Number.isInteger(Number(location.hash.split('/').at(-1))) && location.hash`,
    'workspace route after project creation',
  )
  const projectId = Number(hash.split('/').at(-1))
  assert(Number.isInteger(projectId) && projectId > 0, `invalid synthetic project id from ${hash}`)
  await waitForExpression(cdp, `document.body.innerText.includes(${JSON.stringify(syntheticProjectName)})`, 'synthetic project workspace')
  return projectId
}

async function clickExactButton(cdp, text, label) {
  await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('button')]
      .find(candidate => candidate.textContent.trim() === ${JSON.stringify(text)})
    if (!button) throw new Error(${JSON.stringify(`${label} button not found`)})
    button.click()
    return true
  })()`)
}

async function createSyntheticChapterAndEdit(cdp) {
  await clickExactButton(cdp, '大纲', 'outline navigation')
  await waitForExpression(cdp, `document.body.innerText.includes('添加卷')`, 'outline panel')
  await clickExactButton(cdp, '添加卷', 'add volume')
  await waitForExpression(
    cdp,
    `[...document.querySelectorAll('input')].some(input => input.value === '第1卷')`,
    'synthetic volume creation',
  )
  await clickExactButton(cdp, '添加章节', 'add chapter')
  await waitForExpression(
    cdp,
    `[...document.querySelectorAll('input')].some(input => input.value === '第1章')`,
    'synthetic outline chapter creation',
  )

  await evaluate(cdp, `(() => {
    const titleInput = [...document.querySelectorAll('input')]
      .find(input => input.value === '第1章')
    if (!titleInput) throw new Error('synthetic chapter title input not found')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(titleInput, ${JSON.stringify(syntheticChapterTitle)})
    titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    titleInput.dispatchEvent(new Event('change', { bubbles: true }))
    return titleInput.value
  })()`)
  await waitForExpression(
    cdp,
    `[...document.querySelectorAll('input')].some(input => input.value === ${JSON.stringify(syntheticChapterTitle)})`,
    'synthetic chapter title update',
  )

  await evaluate(cdp, `(() => {
    const editButton = [...document.querySelectorAll('button')]
      .find(button => button.getAttribute('title') === '编辑章节')
    if (!editButton) throw new Error('edit chapter button not found')
    editButton.click()
    return true
  })()`)
  await waitForExpression(
    cdp,
    `document.body.innerText.includes('创作区 · 正文') && document.body.innerText.includes(${JSON.stringify(syntheticChapterTitle)})`,
    'synthetic chapter editor',
  )
  await waitForExpression(
    cdp,
    `Boolean(document.querySelector('.tiptap-editor[contenteditable="true"]'))`,
    'editable TipTap surface',
  )
  await evaluate(cdp, `(() => {
    const editor = document.querySelector('.tiptap-editor[contenteditable="true"]')
    if (!editor) throw new Error('editable TipTap surface not found')
    editor.focus()
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
    return true
  })()`)
  await cdp.send('Input.insertText', { text: syntheticChapterText })
  await waitForExpression(
    cdp,
    `document.querySelector('.tiptap-editor')?.innerText.includes(${JSON.stringify(syntheticChapterText)})`,
    'synthetic chapter text input',
  )
  await evaluate(cdp, `localStorage.setItem(
    ${JSON.stringify(localStorageSentinelKey)},
    ${JSON.stringify(localStorageSentinelValue)},
  )`)
}

async function readPersistenceSnapshot(cdp, projectId) {
  return evaluate(cdp, `(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('storyforge')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('failed to open storyforge IndexedDB'))
    })
    try {
      const storeNames = [...db.objectStoreNames].sort()
      const transaction = db.transaction(['projects', 'outlineNodes', 'chapters'], 'readonly')
      const readAll = storeName => new Promise((resolve, reject) => {
        const request = transaction.objectStore(storeName).getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error || new Error('failed to read ' + storeName))
      })
      const [projects, outlineNodes, chapters] = await Promise.all([
        readAll('projects'),
        readAll('outlineNodes'),
        readAll('chapters'),
      ])
      const project = projects.find(item => item.id === ${projectId}) || null
      return {
        databaseVersion: db.version,
        storeNames,
        project: project ? { id: project.id, name: project.name } : null,
        outlineNodes: outlineNodes
          .filter(item => item.projectId === ${projectId})
          .map(item => ({
            id: item.id,
            parentId: item.parentId ?? null,
            type: item.type,
            title: item.title,
            order: item.order,
          }))
          .sort((a, b) => a.id - b.id),
        chapters: chapters
          .filter(item => item.projectId === ${projectId})
          .map(item => ({
            id: item.id,
            outlineNodeId: item.outlineNodeId,
            title: item.title,
            content: item.content,
            wordCount: item.wordCount,
            status: item.status,
          }))
          .sort((a, b) => a.id - b.id),
        localStorageSentinel: localStorage.getItem(${JSON.stringify(localStorageSentinelKey)}),
      }
    } finally {
      db.close()
    }
  })()`)
}

function assertPersistedSnapshot(snapshot, projectId, label, expectedIds = null) {
  assert(snapshot.storeNames.length === 42, `${label}: expected 42 IndexedDB stores, got ${snapshot.storeNames.length}`)
  for (const required of ['projects', 'outlineNodes', 'chapters']) {
    assert(snapshot.storeNames.includes(required), `${label}: missing IndexedDB store ${required}`)
  }
  assert(snapshot.project?.id === projectId, `${label}: synthetic project id did not persist`)
  assert(snapshot.project?.name === syntheticProjectName, `${label}: synthetic project name did not persist`)

  const volume = snapshot.outlineNodes.find(node => node.type === 'volume' && node.title === '第1卷')
  const chapterNode = snapshot.outlineNodes.find(
    node => node.type === 'chapter' && node.title === syntheticChapterTitle,
  )
  const chapter = snapshot.chapters.find(item => item.title === syntheticChapterTitle)
  assert(volume?.id > 0, `${label}: synthetic volume did not persist`)
  assert(chapterNode?.id > 0, `${label}: synthetic outline chapter did not persist`)
  assert(chapterNode?.parentId === volume.id, `${label}: outline parent relation changed`)
  assert(chapter?.id > 0, `${label}: synthetic chapter record did not persist`)
  assert(chapter?.outlineNodeId === chapterNode.id, `${label}: chapter -> outline relation changed`)
  assert(chapter?.content.includes(syntheticChapterText), `${label}: autosaved chapter text did not persist`)
  assert(chapter?.wordCount > 0, `${label}: autosaved chapter word count is empty`)
  assert(
    snapshot.localStorageSentinel === localStorageSentinelValue,
    `${label}: localStorage sentinel did not persist`,
  )

  const ids = {
    projectId: snapshot.project.id,
    volumeId: volume.id,
    outlineChapterId: chapterNode.id,
    chapterId: chapter.id,
  }
  if (expectedIds) {
    assert(JSON.stringify(ids) === JSON.stringify(expectedIds), `${label}: persisted primary keys changed`)
  }
  return ids
}

function assertEmptyProfileSnapshot(snapshot, label) {
  assert(snapshot.storeNames.length === 42, `${label}: expected 42 IndexedDB stores, got ${snapshot.storeNames.length}`)
  assert(snapshot.project === null, `${label}: isolated profile can see the primary synthetic project`)
  assert(snapshot.outlineNodes.length === 0, `${label}: isolated profile can see primary outline data`)
  assert(snapshot.chapters.length === 0, `${label}: isolated profile can see primary chapter data`)
  assert(snapshot.localStorageSentinel === null, `${label}: isolated profile can see the primary localStorage sentinel`)
}

async function waitForAutosaveSnapshot(cdp, projectId) {
  return waitFor(async () => {
    const snapshot = await readPersistenceSnapshot(cdp, projectId)
    const chapter = snapshot.chapters.find(item => item.title === syntheticChapterTitle)
    return chapter?.content.includes(syntheticChapterText) && chapter.wordCount > 0
      ? snapshot
      : null
  }, 'debounced chapter autosave in IndexedDB', 20_000)
}

async function openPersistedChapter(cdp, projectId, label) {
  const workspace = await directRoute(
    cdp,
    `#/workspace/${projectId}`,
    `document.body.innerText.includes(${JSON.stringify(syntheticProjectName)}) && !document.body.innerText.includes('加载中...')`,
    `${label} workspace route`,
  )
  await clickExactButton(cdp, '章节', `${label} chapters navigation`)
  await waitForExpression(
    cdp,
    `document.body.innerText.includes('创作区 · 正文') &&
      document.body.innerText.includes(${JSON.stringify(syntheticChapterTitle)}) &&
      document.querySelector('.tiptap-editor')?.innerText.includes(${JSON.stringify(syntheticChapterText)})`,
    `${label} persisted chapter UI`,
  )
  return workspace
}

async function inspectDesktopRuntime(cdp) {
  return evaluate(cdp, `(async () => {
    await Promise.all([
      document.fonts.load('400 16px "Inter"', 'StoryForge'),
      document.fonts.load('400 16px "Source Serif 4"', 'StoryForge'),
      document.fonts.load('italic 400 16px "Source Serif 4"', 'StoryForge'),
      document.fonts.load('400 16px "JetBrains Mono"', 'StoryForge'),
    ])
    await document.fonts.ready
    const families = ['Inter', 'Source Serif 4', 'JetBrains Mono']
    const fontFaces = [...document.fonts].map(face => ({
      family: face.family.replaceAll('"', ''),
      style: face.style,
      weight: face.weight,
      status: face.status,
    }))
    const entrySources = await Promise.all(
      [...document.scripts]
        .map(script => script.src)
        .filter(Boolean)
        .map(source => fetch(source).then(response => response.text())),
    )
    return {
      devIdentityMarker: entrySources.some(source => source.includes('io.github.yuanbw2025.storyforge.dev')),
      fonts: families.map(family => ({
        family,
        loaded: fontFaces.some(face => face.family === family && face.status === 'loaded'),
        faces: fontFaces.filter(face => face.family === family),
      })),
      manifestLinks: document.querySelectorAll('link[rel="manifest"]').length,
      serviceWorkerRegistrations: navigator.serviceWorker
        ? (await navigator.serviceWorker.getRegistrations()).length
        : 0,
      cacheKeys: 'caches' in window ? await caches.keys() : [],
      resources: performance.getEntriesByType('resource').map(entry => entry.name),
    }
  })()`)
}

function assertDesktopRequests(requests) {
  const forbidden = requests.filter(url =>
    url.includes('/storyforge/') ||
    /\/sw\.js(?:$|[?#])/.test(url) ||
    /\/manifest\.webmanifest(?:$|[?#])/.test(url) ||
    /https:\/\/fonts\.(?:googleapis|gstatic)\.com/i.test(url),
  )
  assert(forbidden.length === 0, `forbidden Desktop requests: ${forbidden.join(', ')}`)
}

async function run() {
  assert(process.platform === 'win32', 'this smoke test is Windows-only')
  assert(fs.existsSync(sourceExePath), `baseline executable not found: ${sourceExePath}`)
  assertDevIdentityExecutable(sourceExePath)
  const baselineEvidence = executableEvidence(sourceExePath)
  if (upgradeMode) {
    assert(fs.existsSync(upgradeSourceExePath), `upgrade executable not found: ${upgradeSourceExePath}`)
    assertDevIdentityExecutable(upgradeSourceExePath)
    const upgradeEvidence = executableEvidence(upgradeSourceExePath)
    assert(
      baselineEvidence.sha256 !== upgradeEvidence.sha256,
      'baseline and upgrade executables must have different SHA-256 values',
    )
    assert(
      baselineEvidence.fileVersion !== upgradeEvidence.fileVersion ||
        baselineEvidence.productVersion !== upgradeEvidence.productVersion,
      'baseline and upgrade executables must have different version resources',
    )
    fs.mkdirSync(runtimeDir, { recursive: true })
    fs.copyFileSync(sourceExePath, exePath)
    const stagedBaseline = executableEvidence(exePath)
    assert(stagedBaseline.sha256 === baselineEvidence.sha256, 'baseline executable staging changed its bytes')
    state.activeArtifact = stagedBaseline
    state.upgradeEvidence = {
      identity: devIdentity,
      runtimePath: exePath,
      baseline: baselineEvidence,
      upgrade: upgradeEvidence,
      sameExecutablePathOverwrite: true,
    }
    state.runRecord.upgrade = state.upgradeEvidence
  } else {
    state.activeArtifact = baselineEvidence
  }
  assertDevIdentityExecutable()
  const existing = exactExecutablePids()
  assert(existing.length === 0, `refusing to reuse a running desktop executable; exact PIDs: ${existing.join(', ')}`)
  fs.mkdirSync(profileDir, { recursive: true })
  if (persistenceMode) fs.mkdirSync(isolatedProfileDir, { recursive: true })
  writeRunRecord()

  const first = await launchDesktop('initial')
  const firstTelemetry = await prepareCdp(first)
  const runtime = await inspectDesktopRuntime(first.cdp)
  assert(runtime.devIdentityMarker, 'CDP smoke is restricted to the dev-identity build')
  const home = await directRoute(
    first.cdp,
    '#/',
    `document.body.innerText.includes('故事熔炉') && document.body.innerText.includes('新建项目')`,
    'home route',
  )
  await dismissWelcomeGuide(first.cdp)
  const settings = await directRoute(
    first.cdp,
    '#/settings',
    `document.body.innerText.includes('API Key') && document.body.innerText.includes('重新引导')`,
    'settings route',
  )
  await directRoute(
    first.cdp,
    '#/',
    `document.body.innerText.includes('故事熔炉') && document.body.innerText.includes('新建项目')`,
    'home route before project creation',
  )
  const projectId = await createSyntheticProject(first.cdp)
  let workspace
  let initialPersistence = null
  let persistedIds = null
  if (persistenceMode) {
    workspace = { hash: locationHashForProject(projectId) }
    await createSyntheticChapterAndEdit(first.cdp)
    initialPersistence = await waitForAutosaveSnapshot(first.cdp, projectId)
    persistedIds = assertPersistedSnapshot(initialPersistence, projectId, 'initial autosave')
  } else {
    workspace = await directRoute(
      first.cdp,
      `#/workspace/${projectId}`,
      `document.body.innerText.includes(${JSON.stringify(syntheticProjectName)}) && !document.body.innerText.includes('加载中...')`,
      'workspace route',
    )
  }

  assert(firstTelemetry.exceptions.length === 0, `JavaScript exceptions on first launch: ${JSON.stringify(firstTelemetry.exceptions)}`)
  assertDesktopRequests(firstTelemetry.requests)
  assert(runtime.fonts.every(font => font.loaded), `packaged fonts not loaded: ${JSON.stringify(runtime.fonts)}`)
  assert(runtime.manifestLinks === 0, 'Desktop DOM must not contain a Web manifest link')
  assert(runtime.serviceWorkerRegistrations === 0, 'Desktop profile must not register a service worker')
  assert(runtime.cacheKeys.length === 0, `Desktop profile unexpectedly created Cache Storage: ${runtime.cacheKeys.join(', ')}`)
  for (const fontName of ['Inter-Variable', 'SourceSerif4-Variable', 'SourceSerif4-Italic-Variable', 'JetBrainsMono-Variable']) {
    assert(runtime.resources.some(url => url.includes(fontName)), `packaged font was not requested: ${fontName}`)
  }

  await stopDesktop()
  assert(exactExecutablePids().length === 0, 'initial Desktop process tree did not stop cleanly')

  const restarted = await launchDesktop('restart')
  const restartTelemetry = await prepareCdp(restarted)
  const restartHome = await directRoute(
    restarted.cdp,
    '#/',
    `document.body.innerText.includes(${JSON.stringify(syntheticProjectName)})`,
    'home route after restart',
  )
  const restartSettings = await directRoute(
    restarted.cdp,
    '#/settings',
    `document.body.innerText.includes('API Key') && document.body.innerText.includes('重新引导')`,
    'settings route after restart',
  )
  const restartWorkspace = await directRoute(
    restarted.cdp,
    `#/workspace/${projectId}`,
    `document.body.innerText.includes(${JSON.stringify(syntheticProjectName)}) && !document.body.innerText.includes('加载中...')`,
    'workspace route after restart',
  )

  assert(restartTelemetry.exceptions.length === 0, `JavaScript exceptions after restart: ${JSON.stringify(restartTelemetry.exceptions)}`)
  assertDesktopRequests(restartTelemetry.requests)

  let restartPersistence = null
  let isolatedPersistence = null
  let restoredPersistence = null
  let restoreWorkspace = null
  let upgradePersistence = null
  let upgradeWorkspace = null
  const extraTelemetry = []
  if (persistenceMode) {
    await openPersistedChapter(restarted.cdp, projectId, 'restart')
    restartPersistence = await readPersistenceSnapshot(restarted.cdp, projectId)
    assertPersistedSnapshot(restartPersistence, projectId, 'restart', persistedIds)
    await stopDesktop()
    assert(exactExecutablePids().length === 0, 'restart Desktop process tree did not stop cleanly')

    const isolated = await launchDesktop('isolated-empty', isolatedProfileDir)
    const isolatedTelemetry = await prepareCdp(isolated)
    extraTelemetry.push(isolatedTelemetry)
    const isolatedRuntime = await inspectDesktopRuntime(isolated.cdp)
    assert(isolatedRuntime.devIdentityMarker, 'isolated profile smoke is restricted to the dev-identity build')
    await directRoute(
      isolated.cdp,
      '#/',
      `document.body.innerText.includes('故事熔炉') && document.body.innerText.includes('新建项目')`,
      'isolated profile home route',
    )
    isolatedPersistence = await readPersistenceSnapshot(isolated.cdp, projectId)
    assertEmptyProfileSnapshot(isolatedPersistence, 'isolated profile')
    assert(
      !documentTextContains(isolatedPersistence, syntheticProjectName),
      'isolated profile unexpectedly contains the primary project name',
    )
    assert(isolatedTelemetry.exceptions.length === 0, `JavaScript exceptions in isolated profile: ${JSON.stringify(isolatedTelemetry.exceptions)}`)
    assertDesktopRequests(isolatedTelemetry.requests)
    await stopDesktop()
    assert(exactExecutablePids().length === 0, 'isolated Desktop process tree did not stop cleanly')

    const restored = await launchDesktop('restore-primary', profileDir)
    const restoredTelemetry = await prepareCdp(restored)
    extraTelemetry.push(restoredTelemetry)
    restoreWorkspace = await openPersistedChapter(restored.cdp, projectId, 'restored primary profile')
    restoredPersistence = await readPersistenceSnapshot(restored.cdp, projectId)
    assertPersistedSnapshot(restoredPersistence, projectId, 'restored primary profile', persistedIds)
    assert(restoredTelemetry.exceptions.length === 0, `JavaScript exceptions after primary profile restore: ${JSON.stringify(restoredTelemetry.exceptions)}`)
    assertDesktopRequests(restoredTelemetry.requests)

    if (upgradeMode) {
      await stopDesktop()
      assert(exactExecutablePids().length === 0, 'pre-upgrade Desktop process tree did not stop cleanly')
      fs.copyFileSync(upgradeSourceExePath, exePath)
      const stagedUpgrade = executableEvidence(exePath)
      assert(
        stagedUpgrade.sha256 === state.upgradeEvidence.upgrade.sha256,
        'same-path upgrade overwrite changed the upgrade executable bytes',
      )
      assertDevIdentityExecutable()
      state.activeArtifact = stagedUpgrade
      state.runRecord.upgrade.overwrittenAt = new Date().toISOString()
      state.runRecord.upgrade.stagedUpgrade = stagedUpgrade
      writeRunRecord()

      const upgraded = await launchDesktop('same-path-upgrade', profileDir)
      const upgradeTelemetry = await prepareCdp(upgraded)
      extraTelemetry.push(upgradeTelemetry)
      const upgradedRuntime = await inspectDesktopRuntime(upgraded.cdp)
      assert(upgradedRuntime.devIdentityMarker, 'upgrade smoke is restricted to the dev-identity build')
      upgradeWorkspace = await openPersistedChapter(upgraded.cdp, projectId, 'same-path upgraded profile')
      upgradePersistence = await readPersistenceSnapshot(upgraded.cdp, projectId)
      assertPersistedSnapshot(upgradePersistence, projectId, 'same-path upgraded profile', persistedIds)
      assert(upgradeTelemetry.exceptions.length === 0, `JavaScript exceptions after same-path upgrade: ${JSON.stringify(upgradeTelemetry.exceptions)}`)
      assertDesktopRequests(upgradeTelemetry.requests)
    }
  }

  await stopDesktop()
  assert(exactExecutablePids().length === 0, 'final Desktop process tree did not stop cleanly')

  const report = {
    schemaVersion: 1,
    executable: exePath,
    profileWasIsolated: true,
    identity: devIdentity,
    mode: upgradeMode ? 'D1.3-upgrade' : persistenceMode ? 'D1.3-persistence' : 'D1.2-routes',
    launches: state.launches,
    routes: {
      initial: { home: home.hash, settings: settings.hash, workspace: workspace.hash },
      restart: { home: restartHome.hash, settings: restartSettings.hash, workspace: restartWorkspace.hash },
      ...(restoreWorkspace ? { restoredPrimary: { workspace: restoreWorkspace.hash } } : {}),
      ...(upgradeWorkspace ? { upgradedPrimary: { workspace: upgradeWorkspace.hash } } : {}),
    },
    syntheticProject: { id: projectId, name: syntheticProjectName, persistedAcrossRestart: true },
    ...(persistenceMode ? {
      persistence: {
        primaryProfile: profileDir,
        isolatedProfile: isolatedProfileDir,
        syntheticChapter: {
          title: syntheticChapterTitle,
          text: syntheticChapterText,
          ids: persistedIds,
        },
        databaseVersion: initialPersistence.databaseVersion,
        objectStoreCount: initialPersistence.storeNames.length,
        autosavePersisted: true,
        restartPersisted: Boolean(restartPersistence),
        isolatedProfileWasEmpty: Boolean(isolatedPersistence),
        primaryProfileRestored: Boolean(restoredPersistence),
        localStorageSentinelPersisted: true,
        sameIdentityOverwriteUpgradePersisted: upgradeMode ? Boolean(upgradePersistence) : null,
      },
    } : {}),
    ...(upgradeMode ? { upgrade: state.upgradeEvidence } : {}),
    packagedFonts: runtime.fonts,
    desktopPwaBoundary: {
      manifestLinks: runtime.manifestLinks,
      serviceWorkerRegistrations: runtime.serviceWorkerRegistrations,
      cacheKeys: runtime.cacheKeys,
      forbiddenRequests: 0,
    },
    javascriptExceptions: 0,
    consoleErrors: [
      ...firstTelemetry.consoleErrors,
      ...restartTelemetry.consoleErrors,
      ...extraTelemetry.flatMap(telemetry => telemetry.consoleErrors),
    ],
  }
  console.log(JSON.stringify(report, null, 2))
}

function locationHashForProject(projectId) {
  return `#/workspace/${projectId}`
}

function documentTextContains(snapshot, text) {
  return snapshot.project?.name?.includes(text) ||
    snapshot.outlineNodes.some(node => node.title.includes(text)) ||
    snapshot.chapters.some(chapter => chapter.title.includes(text) || chapter.content.includes(text))
}

let signalCleanupRunning = false
async function handleSignal(signal) {
  if (signalCleanupRunning) return
  signalCleanupRunning = true
  console.error(`[desktop-route-smoke] received ${signal}; cleaning the recorded process tree`)
  try {
    await stopDesktop()
  } catch (error) {
    console.error(`[desktop-route-smoke] signal cleanup failed: ${error.stack || error}`)
  }
  try {
    removeRunDirectory()
  } catch (error) {
    console.error(`[desktop-route-smoke] signal profile cleanup failed: ${error.stack || error}`)
  }
  process.exit(signal === 'SIGINT' ? 130 : 143)
}

process.once('SIGINT', () => void handleSignal('SIGINT'))
process.once('SIGTERM', () => void handleSignal('SIGTERM'))

let exitCode = 0
try {
  await run()
} catch (error) {
  exitCode = 1
  console.error(error.stack || error)
} finally {
  try {
    await stopDesktop()
  } catch (error) {
    exitCode = 1
    console.error(`[desktop-route-smoke] cleanup failed: ${error.stack || error}`)
  }
  try {
    const leftovers = fs.existsSync(exePath) ? exactExecutablePids() : []
    if (leftovers.length > 0) {
      exitCode = 1
      console.error(`[desktop-route-smoke] exact executable still running: ${leftovers.join(', ')}`)
    }
  } catch (error) {
    exitCode = 1
    console.error(`[desktop-route-smoke] process verification failed: ${error.stack || error}`)
  }
  try {
    removeRunDirectory()
  } catch (error) {
    exitCode = 1
    console.error(`[desktop-route-smoke] temporary profile cleanup failed: ${error.stack || error}`)
  }
}

process.exitCode = exitCode
