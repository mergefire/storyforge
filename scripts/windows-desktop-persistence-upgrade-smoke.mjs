#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const tauriCli = path.join(repoRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')
const routeSmoke = path.join(scriptDir, 'windows-desktop-route-smoke.mjs')
const targetExe = path.join(repoRoot, 'src-tauri', 'target', 'release', 'storyforge-desktop.exe')
const runDir = path.join(os.tmpdir(), `storyforge-d1.3-upgrade-build-${process.pid}-${Date.now()}`)
const baselineExe = path.join(runDir, 'baseline', 'storyforge-desktop.exe')
const upgradeExe = path.join(runDir, 'upgrade', 'storyforge-desktop.exe')
const originalExe = path.join(runDir, 'original-target', 'storyforge-desktop.exe')
const upgradeConfig = path.join(runDir, 'tauri.upgrade-smoke.conf.json')

function assert(condition, message) {
  if (!condition) throw new Error(`[desktop-persistence-upgrade-smoke] ${message}`)
}

function nextPatchVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  assert(match, `package version must be plain semver, got ${version}`)
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
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

function restoreTarget(hadOriginal) {
  if (hadOriginal) {
    assert(fs.existsSync(originalExe), `original target backup not found: ${originalExe}`)
    copyExecutable(originalExe, targetExe)
    return
  }
  fs.rmSync(targetExe, { force: true })
}

function removeRunDirectory() {
  const resolvedRunDir = path.resolve(runDir)
  const resolvedTempDir = path.resolve(os.tmpdir())
  assert(
    resolvedRunDir.startsWith(`${resolvedTempDir}${path.sep}`) &&
      path.basename(resolvedRunDir).startsWith('storyforge-d1.3-upgrade-build-'),
    `refusing to remove unexpected run directory: ${resolvedRunDir}`,
  )
  fs.rmSync(resolvedRunDir, { recursive: true, force: true })
}

assert(process.platform === 'win32', 'this smoke test is Windows-only')
assert(fs.existsSync(tauriCli), `Tauri CLI not found: ${tauriCli}`)
const existingTargetPids = exactTargetPids()
assert(existingTargetPids.length === 0, `refusing to rebuild a running target executable; exact PIDs: ${existingTargetPids.join(', ')}`)
const upgradeVersion = nextPatchVersion(packageJson.version)
const hadOriginal = fs.existsSync(targetExe)
fs.mkdirSync(runDir, { recursive: true })
if (hadOriginal) copyExecutable(targetExe, originalExe)

let exitCode = 0
try {
  console.log(`[desktop-persistence-upgrade-smoke] building baseline dev artifact ${packageJson.version}`)
  run(process.execPath, [tauriCli, 'build', '--no-bundle', '--features', 'dev-identity'])
  copyExecutable(targetExe, baselineExe)

  fs.writeFileSync(upgradeConfig, `${JSON.stringify({
    productName: 'StoryForge Dev',
    version: upgradeVersion,
    identifier: 'io.github.yuanbw2025.storyforge.dev',
  }, null, 2)}\n`, 'utf8')
  console.log(`[desktop-persistence-upgrade-smoke] building same-identity upgrade artifact ${upgradeVersion}`)
  run(process.execPath, [
    tauriCli,
    'build',
    '--no-bundle',
    '--features',
    'dev-identity',
    '--config',
    upgradeConfig,
  ])
  copyExecutable(targetExe, upgradeExe)

  restoreTarget(hadOriginal)
  run(process.execPath, [
    routeSmoke,
    '--persistence',
    baselineExe,
    '--upgrade-exe',
    upgradeExe,
  ])
} catch (error) {
  exitCode = 1
  console.error(error.stack || error)
} finally {
  try {
    restoreTarget(hadOriginal)
  } catch (error) {
    exitCode = 1
    console.error(`[desktop-persistence-upgrade-smoke] target restore failed: ${error.stack || error}`)
  }
  try {
    removeRunDirectory()
  } catch (error) {
    exitCode = 1
    console.error(`[desktop-persistence-upgrade-smoke] temporary build cleanup failed: ${error.stack || error}`)
  }
}

process.exitCode = exitCode
