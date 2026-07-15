#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process'
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
const exePath = path.resolve(process.argv[2] || defaultExe)
const syntheticProjectName = `D1.2 路由烟测 ${Date.now()}`
const runDir = path.join(os.tmpdir(), `storyforge-d1.2-route-smoke-${process.pid}-${Date.now()}`)
const profileDir = path.join(runDir, 'webview2-profile')
const recordPath = path.join(runDir, 'run-record.json')

const state = {
  cdp: null,
  launch: null,
  launches: [],
  runRecord: {
    schemaVersion: 1,
    workspace: repoRoot,
    executable: exePath,
    profileDirectory: profileDir,
    reason: 'D1.2 home/settings/project direct-route and restart smoke',
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

function runPowerShell(script) {
  return execFileSync(
    powershell,
    ['-NoLogo', '-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { encoding: 'utf8', windowsHide: true },
  ).replace(/^\uFEFF/, '').trim()
}

function exactExecutablePids() {
  const escapedPath = exePath.replaceAll("'", "''")
  const escapedName = path.basename(exePath).replaceAll("'", "''")
  const output = runPowerShell(`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$target = [IO.Path]::GetFullPath('${escapedPath}')
$matches = Get-CimInstance Win32_Process -Filter "Name = '${escapedName}'" |
  Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq $target }
ConvertTo-Json -Compress -InputObject @($matches.ProcessId)
`)
  if (!output) return []
  const value = JSON.parse(output)
  if (value == null) return []
  const pids = Array.isArray(value) ? value.map(Number) : [Number(value)]
  return pids.filter(pid => Number.isInteger(pid) && pid > 0)
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

async function launchDesktop(label) {
  const port = await freePort()
  const stderr = []
  const stdout = []
  const child = spawn(exePath, [], {
    cwd: path.dirname(exePath),
    env: {
      ...process.env,
      WEBVIEW2_USER_DATA_FOLDER: profileDir,
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
  state.launches.push({ label, pid: child.pid, port })
  state.runRecord.launches.push({
    label,
    pid: child.pid,
    cdpPort: port,
    executable: exePath,
    profileDirectory: profileDir,
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
    try {
      execFileSync(taskkill, ['/PID', String(launch.child.pid), '/T', '/F'], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: 'ignore',
      })
    } catch (error) {
      if (launch.child.exitCode === null) throw error
    }
  }

  await Promise.race([
    new Promise(resolve => launch.child.once('exit', resolve)),
    delay(5_000),
  ])
  await waitForPortClosed(launch.port)
  state.runRecord.launches.find(item => item.pid === launch.pid).stoppedAt = new Date().toISOString()
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
  assert(fs.existsSync(exePath), `release executable not found: ${exePath}`)
  const existing = exactExecutablePids()
  assert(existing.length === 0, `refusing to reuse a running desktop executable; exact PIDs: ${existing.join(', ')}`)
  fs.mkdirSync(profileDir, { recursive: true })
  writeRunRecord()

  const first = await launchDesktop('initial')
  const firstTelemetry = await prepareCdp(first)
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
  const workspace = await directRoute(
    first.cdp,
    `#/workspace/${projectId}`,
    `document.body.innerText.includes(${JSON.stringify(syntheticProjectName)}) && !document.body.innerText.includes('加载中...')`,
    'workspace route',
  )
  const runtime = await inspectDesktopRuntime(first.cdp)

  assert(firstTelemetry.exceptions.length === 0, `JavaScript exceptions on first launch: ${JSON.stringify(firstTelemetry.exceptions)}`)
  assertDesktopRequests(firstTelemetry.requests)
  assert(runtime.devIdentityMarker, 'CDP route smoke is restricted to the dev-identity build')
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

  const report = {
    schemaVersion: 1,
    executable: exePath,
    profileWasIsolated: true,
    identity: 'io.github.yuanbw2025.storyforge.dev',
    launches: state.launches,
    routes: {
      initial: { home: home.hash, settings: settings.hash, workspace: workspace.hash },
      restart: { home: restartHome.hash, settings: restartSettings.hash, workspace: restartWorkspace.hash },
    },
    syntheticProject: { id: projectId, name: syntheticProjectName, persistedAcrossRestart: true },
    packagedFonts: runtime.fonts,
    desktopPwaBoundary: {
      manifestLinks: runtime.manifestLinks,
      serviceWorkerRegistrations: runtime.serviceWorkerRegistrations,
      cacheKeys: runtime.cacheKeys,
      forbiddenRequests: 0,
    },
    javascriptExceptions: 0,
    consoleErrors: [...firstTelemetry.consoleErrors, ...restartTelemetry.consoleErrors],
  }
  console.log(JSON.stringify(report, null, 2))
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
    fs.rmSync(runDir, { recursive: true, force: true })
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
    fs.rmSync(runDir, { recursive: true, force: true })
  } catch (error) {
    exitCode = 1
    console.error(`[desktop-route-smoke] temporary profile cleanup failed: ${error.stack || error}`)
  }
}

process.exitCode = exitCode
