#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertDevIdentityExecutable,
  inspectDesktopArtifact,
} from './windows-desktop-artifact-guard.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const tauriCli = path.join(repoRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')
const stableConfig = path.join(repoRoot, 'src-tauri', 'tauri.stable.conf.json')
const targetExe = path.join(repoRoot, 'src-tauri', 'target', 'release', 'storyforge-desktop.exe')
const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const runDir = path.join(os.tmpdir(), `storyforge-m0-stable-boundary-${process.pid}-${Date.now()}`)
const devExe = path.join(runDir, 'dev', 'storyforge-desktop.exe')
const stableExe = path.join(runDir, 'stable', 'storyforge-desktop.exe')
const originalExe = path.join(runDir, 'original', 'storyforge-desktop.exe')

function assert(condition, message) {
  if (!condition) throw new Error(`[desktop-stable-boundary] ${message}`)
}

function run(command, args) {
  execFileSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
    windowsHide: false,
  })
}

function runPowerShell(script) {
  return execFileSync(
    powershell,
    ['-NoLogo', '-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { encoding: 'utf8', windowsHide: true },
  ).replace(/^\uFEFF/, '').trim()
}

function exactTargetPids() {
  const escapedPath = targetExe.replaceAll("'", "''")
  const escapedName = path.basename(targetExe, path.extname(targetExe)).replaceAll("'", "''")
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
  return JSON.parse(output || '[]')
}

function copyExecutable(source, destination) {
  assert(fs.existsSync(source), `executable not found: ${source}`)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.copyFileSync(source, destination)
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase()
}

function restoreTarget(hadOriginal) {
  if (hadOriginal) copyExecutable(originalExe, targetExe)
  else fs.rmSync(targetExe, { force: true })
}

function removeRunDirectory() {
  const resolved = path.resolve(runDir)
  const temp = path.resolve(os.tmpdir())
  assert(
    resolved.startsWith(`${temp}${path.sep}`) && path.basename(resolved).startsWith('storyforge-m0-stable-boundary-'),
    `refusing to remove unexpected run directory: ${resolved}`,
  )
  fs.rmSync(resolved, { recursive: true, force: true })
}

assert(process.platform === 'win32', 'this check is Windows-only')
assert(fs.existsSync(tauriCli), `Tauri CLI not found: ${tauriCli}`)
const existingPids = exactTargetPids()
assert(existingPids.length === 0, `refusing to rebuild a running target executable; exact PIDs: ${existingPids.join(', ')}`)

const hadOriginal = fs.existsSync(targetExe)
fs.mkdirSync(runDir, { recursive: true })
if (hadOriginal) copyExecutable(targetExe, originalExe)

let exitCode = 0
try {
  console.log('[desktop-stable-boundary] building isolated dev artifact')
  run(process.execPath, [tauriCli, 'build', '--no-bundle', '--features', 'dev-identity'])
  copyExecutable(targetExe, devExe)
  const dev = assertDevIdentityExecutable(devExe)

  console.log('[desktop-stable-boundary] building stable artifact without dev-identity feature')
  run(process.execPath, [tauriCli, 'build', '--no-bundle', '--config', stableConfig])
  copyExecutable(targetExe, stableExe)
  const stable = inspectDesktopArtifact(stableExe)
  assert(stable.hasStableIdentity, 'stable artifact does not contain the frozen stable identifier')
  assert(!stable.hasDevIdentity, 'stable artifact contains the dev identifier')
  assert(!stable.hasDevOverrideMarker, 'stable artifact contains the dev WebView2 override marker')

  let stableRejected = false
  try {
    assertDevIdentityExecutable(stableExe)
  } catch (error) {
    stableRejected = /refusing to launch CDP smoke/.test(String(error))
  }
  assert(stableRejected, 'the CDP pre-launch guard did not reject the stable artifact')

  console.log(JSON.stringify({
    schemaVersion: 1,
    dev: { ...dev, sha256: sha256(devExe) },
    stable: { ...stable, sha256: sha256(stableExe) },
    stableRejectedBeforeLaunch: true,
    stableLaunchAttempted: false,
  }, null, 2))
} catch (error) {
  exitCode = 1
  console.error(error.stack || error)
} finally {
  try {
    restoreTarget(hadOriginal)
  } catch (error) {
    exitCode = 1
    console.error(`[desktop-stable-boundary] target restore failed: ${error.stack || error}`)
  }
  try {
    removeRunDirectory()
  } catch (error) {
    exitCode = 1
    console.error(`[desktop-stable-boundary] temporary cleanup failed: ${error.stack || error}`)
  }
}

process.exitCode = exitCode
