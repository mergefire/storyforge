#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createServer } from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertDevIdentityExecutable,
  DESKTOP_DEV_IDENTITY,
} from './windows-desktop-artifact-guard.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const taskkill = 'C:\\Windows\\System32\\taskkill.exe'
const defaultExe = path.join(repoRoot, 'src-tauri', 'target', 'release', 'storyforge-desktop.exe')
const cliArgs = process.argv.slice(2)
const persistenceMode = cliArgs.includes('--persistence')
const m1Mode = cliArgs.includes('--m1')
const soakOptionIndex = cliArgs.indexOf('--soak-minutes')
if (soakOptionIndex >= 0 && (!cliArgs[soakOptionIndex + 1] || cliArgs[soakOptionIndex + 1].startsWith('--'))) {
  throw new Error('[desktop-route-smoke] --soak-minutes requires a number')
}
const soakMinutes = soakOptionIndex >= 0 ? Number(cliArgs[soakOptionIndex + 1]) : 0
if (!Number.isFinite(soakMinutes) || soakMinutes < 0 || soakMinutes > 120) {
  throw new Error('[desktop-route-smoke] --soak-minutes must be between 0 and 120')
}
const upgradeOptionIndex = cliArgs.indexOf('--upgrade-exe')
if (upgradeOptionIndex >= 0 && (!cliArgs[upgradeOptionIndex + 1] || cliArgs[upgradeOptionIndex + 1].startsWith('--'))) {
  throw new Error('[desktop-route-smoke] --upgrade-exe requires an executable path')
}
const upgradeSourceExePath = upgradeOptionIndex >= 0
  ? path.resolve(cliArgs[upgradeOptionIndex + 1])
  : null
const positionalArgs = cliArgs.filter((argument, index) => {
  if (argument === '--persistence' || argument === '--m1' || argument === '--upgrade-exe' || argument === '--soak-minutes') return false
  if (upgradeOptionIndex >= 0 && index === upgradeOptionIndex + 1) return false
  if (soakOptionIndex >= 0 && index === soakOptionIndex + 1) return false
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
if (m1Mode && !persistenceMode) {
  throw new Error('[desktop-route-smoke] --m1 requires --persistence')
}
if (soakMinutes > 0 && !m1Mode) {
  throw new Error('[desktop-route-smoke] --soak-minutes requires --m1')
}
const devIdentity = DESKTOP_DEV_IDENTITY
const syntheticProjectName = `${m1Mode ? 'M1 全能力烟测' : upgradeMode ? 'D1.3 覆盖升级烟测' : persistenceMode ? 'D1.3 持久化烟测' : 'D1.2 路由烟测'} ${Date.now()}`
const syntheticChapterTitle = `D1.3 合成章节 ${Date.now()}`
const syntheticChapterText = `D1.3 自动保存正文 ${Date.now()}，用于验证关闭和重启后内容保持。`
const localStorageSentinelKey = 'storyforge-d1.3-synthetic-sentinel'
const localStorageSentinelValue = `sentinel-${Date.now()}`
const syntheticAiKey = 'storyforge-m1-synthetic-key'
const syntheticBlobName = 'storyforge-m1-100mib.json'
const syntheticBlobBytes = 100 * 1024 * 1024
const syntheticAiPayload = 'data: {"choices":[{"delta":{"content":"合成流式响应"}}]}\n\ndata: [DONE]\n\n'
const runDir = path.join(
  os.tmpdir(),
  `storyforge-${m1Mode ? 'd1.m1' : upgradeMode ? 'd1.3-upgrade' : persistenceMode ? 'd1.3-persistence' : 'd1.2-route'}-smoke-${process.pid}-${Date.now()}`,
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
  mockAi: null,
  m1Evidence: null,
  m1Cleaned: false,
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
      : m1Mode
        ? `M1 synthetic full-capability smoke${soakMinutes > 0 ? ` with ${soakMinutes}-minute core-use soak` : ''}`
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

function createSyntheticPdfBase64() {
  const text = 'StoryForge M0 PDF worker'
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(pdf, 'ascii')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf, 'ascii').toString('base64')
}

function desktopLaunchEnvironment(profileDirectory, port) {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => {
    const normalized = key.toUpperCase()
    return !normalized.startsWith('WEBVIEW2_') && !normalized.startsWith('STORYFORGE_DEV_WEBVIEW2_')
  }))
  return {
    ...inherited,
    STORYFORGE_DEV_WEBVIEW2_USER_DATA_FOLDER: profileDirectory,
    STORYFORGE_DEV_WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: [
      `--remote-debugging-port=${port}`,
      `--remote-allow-origins=http://127.0.0.1:${port}`,
    ].join(' '),
  }
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

function syntheticBlobSha256() {
  const hash = createHash('sha256')
  const chunk = Buffer.alloc(1024 * 1024, 0x5a)
  for (let index = 0; index < 100; index += 1) hash.update(chunk)
  return hash.digest('hex')
}

async function startMockAiServer() {
  const requests = []
  const server = createServer((request, response) => {
    const requestEvidence = {
      method: request.method,
      path: request.url,
      authorized: request.headers.authorization === `Bearer ${syntheticAiKey}`,
      receivedAt: new Date().toISOString(),
      closedBeforeDone: false,
    }
    requests.push(requestEvidence)
    let bodyBytes = 0
    const bodyChunks = []
    request.on('data', chunk => {
      bodyBytes += chunk.length
      if (bodyBytes <= 1024 * 1024) bodyChunks.push(chunk)
    })
    request.on('end', () => {
      requestEvidence.bodyBytes = bodyBytes
      if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
        response.writeHead(404, { 'content-type': 'application/json' })
        response.end('{"error":"not-found"}')
        return
      }
      if (!requestEvidence.authorized) {
        response.writeHead(401, { 'content-type': 'application/json' })
        response.end('{"error":"unauthorized"}')
        return
      }
      let cancellationRequest = false
      try {
        const body = JSON.parse(Buffer.concat(bodyChunks).toString('utf8'))
        cancellationRequest = body?.messages?.some(message => message?.content === 'synthetic-cancel') === true
      } catch {
        response.writeHead(400, { 'content-type': 'application/json' })
        response.end('{"error":"invalid-json"}')
        return
      }
      requestEvidence.kind = cancellationRequest ? 'cancellation' : 'stream'
      response.writeHead(200, {
        'cache-control': 'no-store',
        connection: 'close',
        'content-type': 'text/event-stream; charset=utf-8',
      })
      response.flushHeaders()
      const payload = Buffer.from(syntheticAiPayload, 'utf8')
      const multibyteStart = payload.indexOf(Buffer.from('合', 'utf8'))
      const chunks = [
        payload.subarray(0, multibyteStart + 1),
        payload.subarray(multibyteStart + 1, multibyteStart + 5),
        payload.subarray(multibyteStart + 5),
      ]
      let completed = false
      response.once('close', () => {
        requestEvidence.closedBeforeDone = !completed
      })
      void (async () => {
        for (let index = 0; index < chunks.length; index += 1) {
          if (response.destroyed) break
          response.write(chunks[index])
          await delay(cancellationRequest ? 300 : 40)
        }
        if (!response.destroyed) {
          completed = true
          response.end()
        }
      })()
    })
  })
  server.on('clientError', (_error, socket) => socket.destroy())
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : null
  assert(port, 'failed to allocate a dynamic synthetic AI port')
  const baseUrl = `http://127.0.0.1:${port}/v1`
  state.mockAi = { server, baseUrl, requests }
  state.runRecord.mockAi = {
    baseUrl,
    pid: process.pid,
    purpose: 'synthetic loopback AI streaming and cancellation only',
  }
  writeRunRecord()
  return state.mockAi
}

async function stopMockAiServer() {
  if (!state.mockAi) return
  const { server } = state.mockAi
  state.mockAi = null
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
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

  send(method, params = {}, timeoutMs = 15_000) {
    assert(this.socket?.readyState === WebSocket.OPEN, 'CDP websocket is not open')
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP command timed out: ${method}`))
      }, timeoutMs)
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
    env: desktopLaunchEnvironment(profileDirectory, port),
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

async function evaluate(cdp, expression, timeoutMs = 15_000) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  }, timeoutMs)
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

async function verifyPackagedPdfWorker(cdp, telemetry) {
  await waitForExpression(
    cdp,
    `window.__STORYFORGE_DESKTOP_DEV_SMOKE__?.marker === 'storyforge-m0-dev-smoke'`,
    'desktop dev smoke hook',
  )
  const requestStart = telemetry.requests.length
  const result = await evaluate(cdp, `(async () => {
    return window.__STORYFORGE_DESKTOP_DEV_SMOKE__.extractSyntheticPdf(
      ${JSON.stringify(createSyntheticPdfBase64())}
    )
  })()`)
  assert(result.pageCount === 1, `synthetic PDF page count mismatch: ${JSON.stringify(result)}`)
  assert(result.text.includes('StoryForge M0 PDF worker'), `synthetic PDF text mismatch: ${JSON.stringify(result)}`)
  const workerRequest = await waitFor(
    () => telemetry.requests
      .slice(requestStart)
      .find(url => /\/assets\/pdf\.worker-[^/]+\.mjs(?:\?|$)/.test(url)),
    'packaged pdf.js worker request',
  )
  return {
    request: workerRequest,
    pageCount: result.pageCount,
    rawChars: result.rawChars,
    textMatched: true,
  }
}

async function waitForM1DevHook(cdp) {
  await waitForExpression(
    cdp,
    `window.__STORYFORGE_DESKTOP_DEV_SMOKE__?.contractVersion === 'm1'`,
    'M1 desktop dev smoke hook',
  )
}

async function invokeM1Hook(cdp, expression) {
  await waitForM1DevHook(cdp)
  return evaluate(cdp, `(async () => ${expression})()`, 180_000)
}

async function verifyM1InitialCapabilities(cdp) {
  const mock = state.mockAi ?? await startMockAiServer()
  const credentialId = await invokeM1Hook(
    cdp,
    `window.__STORYFORGE_DESKTOP_DEV_SMOKE__.storeSyntheticDeviceCredential(
      ${JSON.stringify(mock.baseUrl)},
      ${JSON.stringify(syntheticAiKey)}
    )`,
  )
  assert(typeof credentialId === 'string' && credentialId.length >= 16, 'M1 credential reference is not opaque')
  assert(!credentialId.includes(syntheticAiKey), 'M1 credential reference leaked the credential value')

  const stream = await invokeM1Hook(
    cdp,
    `window.__STORYFORGE_DESKTOP_DEV_SMOKE__.runSyntheticAiStream(${JSON.stringify(mock.baseUrl)})`,
  )
  assert(stream.status === 200, `M1 synthetic AI stream status mismatch: ${JSON.stringify(stream)}`)
  assert(stream.text === syntheticAiPayload, `M1 synthetic AI stream text mismatch: ${JSON.stringify(stream)}`)
  assert(stream.chunkCount >= 3, `M1 synthetic AI stream did not preserve streaming chunks: ${JSON.stringify(stream)}`)

  const cancellation = await invokeM1Hook(
    cdp,
    `window.__STORYFORGE_DESKTOP_DEV_SMOKE__.runSyntheticAiCancellation(${JSON.stringify(mock.baseUrl)})`,
  )
  assert(cancellation.cancelled, `M1 synthetic AI cancellation failed: ${JSON.stringify(cancellation)}`)
  assert(cancellation.firstChunkBytes > 0, 'M1 synthetic AI cancellation happened before the first streamed chunk')
  await waitFor(
    () => mock.requests.some(request => request.kind === 'cancellation' && request.closedBeforeDone),
    'native AI cancellation to close the loopback response',
  )

  const blob = await invokeM1Hook(
    cdp,
    `window.__STORYFORGE_DESKTOP_DEV_SMOKE__.writeSyntheticBlob(
      ${syntheticBlobBytes},
      ${JSON.stringify(syntheticBlobName)}
    )`,
  )
  assert(blob.name === syntheticBlobName, `M1 synthetic Blob name mismatch: ${JSON.stringify(blob)}`)
  assert(blob.sizeBytes === syntheticBlobBytes, `M1 synthetic Blob size mismatch: ${JSON.stringify(blob)}`)
  assert(blob.sha256 === syntheticBlobSha256(), `M1 synthetic Blob digest mismatch: ${JSON.stringify(blob)}`)

  await delay(250)
  const diagnostics = await invokeM1Hook(
    cdp,
    'window.__STORYFORGE_DESKTOP_DEV_SMOKE__.diagnosticsSnapshot()',
  )
  const diagnosticsText = JSON.stringify(diagnostics)
  assert(!diagnosticsText.includes(syntheticAiKey), 'M1 diagnostics leaked the synthetic credential')
  assert(
    diagnostics.events.every(event => Number.isFinite(event.timestamp)),
    `M1 diagnostics contain events without timestamps: ${diagnosticsText}`,
  )
  assert(
    diagnostics.events.some(event => event.kind === 'network-attempt'),
    `M1 diagnostics did not record the AI transport: ${diagnosticsText}`,
  )
  assert(
    mock.requests.every(request => request.authorized),
    `M1 loopback server received an unauthorized request: ${JSON.stringify(mock.requests)}`,
  )
  return { credentialId, stream, cancellation, blob, diagnostics }
}

async function verifyM1RestartCapabilities(cdp) {
  const mock = state.mockAi
  assert(mock, 'M1 synthetic AI server was not started')
  const credentialPresent = await invokeM1Hook(
    cdp,
    'window.__STORYFORGE_DESKTOP_DEV_SMOKE__.credentialPresent()',
  )
  assert(credentialPresent, 'M1 device credential did not survive Desktop restart')
  const blob = await invokeM1Hook(
    cdp,
    `window.__STORYFORGE_DESKTOP_DEV_SMOKE__.inspectSyntheticBlob(${JSON.stringify(syntheticBlobName)})`,
  )
  assert(blob.sizeBytes === syntheticBlobBytes, `M1 Blob size did not survive restart: ${JSON.stringify(blob)}`)
  assert(blob.sha256 === syntheticBlobSha256(), `M1 Blob digest did not survive restart: ${JSON.stringify(blob)}`)
  const stream = await invokeM1Hook(
    cdp,
    `window.__STORYFORGE_DESKTOP_DEV_SMOKE__.runSyntheticAiStream(${JSON.stringify(mock.baseUrl)})`,
  )
  assert(stream.status === 200 && stream.text === syntheticAiPayload, `M1 AI credential was not reusable after restart: ${JSON.stringify(stream)}`)
  return { credentialPresent, blob, stream }
}

async function exerciseVisibleSidebarModules(cdp) {
  const labels = await evaluate(cdp, `[
    ...document.querySelectorAll('aside nav button.text-sm'),
  ].map(button => button.innerText.trim()).filter(Boolean)`)
  assert(labels.length >= 30, `M1 expected at least 30 visible sidebar modules, found ${labels.length}`)
  const visited = []
  for (const label of labels) {
    const selected = await evaluate(cdp, `(() => {
      const button = [...document.querySelectorAll('aside nav button.text-sm')]
        .find(candidate => candidate.innerText.trim() === ${JSON.stringify(label)})
      if (!button) return false
      button.click()
      return true
    })()`)
    assert(selected, `M1 sidebar module disappeared before selection: ${label}`)
    await waitForExpression(
      cdp,
      `document.querySelector('main') &&
        !document.querySelector('main').innerText.includes('面板加载中…') &&
        document.querySelector('aside nav button.text-sm.text-accent')?.innerText.trim() === ${JSON.stringify(label)}`,
      `M1 sidebar module ${label}`,
    )
    visited.push(label)
  }
  return visited
}

async function runM1CoreUseSoak(cdp, projectId) {
  if (soakMinutes <= 0) return { minutes: 0, iterations: 0, aiChecks: 0 }
  const startedAt = Date.now()
  const deadline = startedAt + soakMinutes * 60_000
  let iterations = 0
  let aiChecks = 0
  while (Date.now() < deadline) {
    await directRoute(
      cdp,
      '#/',
      `document.body.innerText.includes(${JSON.stringify(syntheticProjectName)})`,
      'M1 soak home route',
    )
    await directRoute(
      cdp,
      '#/settings',
      `document.body.innerText.includes('API Key') && document.body.innerText.includes('重新引导')`,
      'M1 soak settings route',
    )
    await openPersistedChapter(cdp, projectId, 'M1 soak')
    const snapshot = await readPersistenceSnapshot(cdp, projectId)
    assertPersistedSnapshot(snapshot, projectId, 'M1 soak')
    const native = await verifyM1RestartCapabilities(cdp)
    assert(native.credentialPresent, 'M1 soak credential check failed')
    aiChecks += 1
    iterations += 1
    const elapsedMinutes = (Date.now() - startedAt) / 60_000
    console.error(`[desktop-route-smoke] M1 soak ${elapsedMinutes.toFixed(1)}/${soakMinutes} min; iteration ${iterations}`)
    if (Date.now() < deadline) await delay(Math.min(30_000, deadline - Date.now()))
  }
  return {
    minutes: (Date.now() - startedAt) / 60_000,
    iterations,
    aiChecks,
  }
}

async function cleanupM1SyntheticState(cdp) {
  if (!m1Mode || !cdp || state.m1Cleaned) return
  await invokeM1Hook(
    cdp,
    `Promise.all([
      window.__STORYFORGE_DESKTOP_DEV_SMOKE__.clearSyntheticDeviceCredential(),
      window.__STORYFORGE_DESKTOP_DEV_SMOKE__.resetSyntheticFixtures(),
    ])`,
  )
  const credentialPresent = await invokeM1Hook(
    cdp,
    'window.__STORYFORGE_DESKTOP_DEV_SMOKE__.credentialPresent()',
  )
  assert(!credentialPresent, 'M1 synthetic credential cleanup failed')
  state.m1Cleaned = true
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
  assertDevIdentityExecutable(exePath)
  const existing = exactExecutablePids()
  assert(existing.length === 0, `refusing to reuse a running desktop executable; exact PIDs: ${existing.join(', ')}`)
  fs.mkdirSync(profileDir, { recursive: true })
  if (persistenceMode) fs.mkdirSync(isolatedProfileDir, { recursive: true })
  writeRunRecord()
  if (m1Mode) await startMockAiServer()

  const first = await launchDesktop('initial')
  const firstTelemetry = await prepareCdp(first)
  const runtime = await inspectDesktopRuntime(first.cdp)
  assert(runtime.devIdentityMarker, 'CDP smoke is restricted to the dev-identity build')
  const pdfWorker = await verifyPackagedPdfWorker(first.cdp, firstTelemetry)
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
  let sidebarModules = null
  let m1Initial = null
  let m1Restart = null
  let m1Soak = null
  if (m1Mode) {
    sidebarModules = await exerciseVisibleSidebarModules(first.cdp)
    await directRoute(
      first.cdp,
      `#/workspace/${projectId}`,
      `document.body.innerText.includes(${JSON.stringify(syntheticProjectName)}) && !document.body.innerText.includes('加载中...')`,
      'workspace route after M1 sidebar traversal',
    )
  }
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
  if (m1Mode) m1Initial = await verifyM1InitialCapabilities(first.cdp)

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
  if (m1Mode) m1Restart = await verifyM1RestartCapabilities(restarted.cdp)

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

    if (m1Mode) m1Soak = await runM1CoreUseSoak(restored.cdp, projectId)

    if (upgradeMode) {
      await stopDesktop()
      assert(exactExecutablePids().length === 0, 'pre-upgrade Desktop process tree did not stop cleanly')
      fs.copyFileSync(upgradeSourceExePath, exePath)
      const stagedUpgrade = executableEvidence(exePath)
      assert(
        stagedUpgrade.sha256 === state.upgradeEvidence.upgrade.sha256,
        'same-path upgrade overwrite changed the upgrade executable bytes',
      )
      assertDevIdentityExecutable(exePath)
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

  if (m1Mode) {
    await cleanupM1SyntheticState(state.cdp)
    state.m1Evidence = {
      initial: m1Initial,
      restart: m1Restart,
      sidebarModules,
      soak: m1Soak,
      mockRequests: state.mockAi?.requests ?? [],
    }
    state.runRecord.m1 = state.m1Evidence
    writeRunRecord()
  }

  await stopDesktop()
  assert(exactExecutablePids().length === 0, 'final Desktop process tree did not stop cleanly')

  const report = {
    schemaVersion: 1,
    executable: exePath,
    profileWasIsolated: true,
    identity: devIdentity,
    mode: m1Mode ? 'M1-capabilities' : upgradeMode ? 'D1.3-upgrade' : persistenceMode ? 'D1.3-persistence' : 'D1.2-routes',
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
    ...(m1Mode ? { m1: state.m1Evidence } : {}),
    packagedFonts: runtime.fonts,
    pdfWorker,
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
    await cleanupM1SyntheticState(state.cdp)
  } catch (error) {
    console.error(`[desktop-route-smoke] signal synthetic-state cleanup failed: ${error.stack || error}`)
  }
  try {
    await stopDesktop()
  } catch (error) {
    console.error(`[desktop-route-smoke] signal cleanup failed: ${error.stack || error}`)
  }
  try {
    await stopMockAiServer()
  } catch (error) {
    console.error(`[desktop-route-smoke] signal mock-server cleanup failed: ${error.stack || error}`)
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
    await cleanupM1SyntheticState(state.cdp)
  } catch (error) {
    exitCode = 1
    console.error(`[desktop-route-smoke] synthetic-state cleanup failed: ${error.stack || error}`)
  }
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
    await stopMockAiServer()
  } catch (error) {
    exitCode = 1
    console.error(`[desktop-route-smoke] mock-server cleanup failed: ${error.stack || error}`)
  }
  try {
    removeRunDirectory()
  } catch (error) {
    exitCode = 1
    console.error(`[desktop-route-smoke] temporary profile cleanup failed: ${error.stack || error}`)
  }
}

process.exitCode = exitCode
