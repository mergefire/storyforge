$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$runDir = Join-Path $root 'tmp'
$pidPath = Join-Path $runDir 'storyforge-dev.pid'
$logPath = Join-Path $runDir 'storyforge-dev.out.log'
$metaPath = Join-Path $runDir 'storyforge-dev.meta.txt'
$url = 'http://localhost:1111/storyforge/'

if (-not (Test-Path -LiteralPath $runDir)) {
  New-Item -ItemType Directory -Path $runDir | Out-Null
}

function Open-StoryForge {
  Start-Process $url | Out-Null
}

function Show-ErrorWindow([string]$message) {
  $escaped = $message.Replace('"', '\"')
  Start-Process -FilePath $env:ComSpec -ArgumentList "/k echo $escaped" | Out-Null
}

if (Test-Path -LiteralPath $pidPath) {
  $oldPidText = (Get-Content -LiteralPath $pidPath -ErrorAction SilentlyContinue | Select-Object -First 1)
  $oldPid = 0
  if ([int]::TryParse($oldPidText, [ref]$oldPid)) {
    $oldProcess = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
    if ($oldProcess) {
      Open-StoryForge
      exit 0
    }
  }
  Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Show-ErrorWindow 'Node.js was not found. Please install Node.js LTS from https://nodejs.org/ and restart.'
  exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Show-ErrorWindow 'npm was not found. Please reinstall Node.js LTS and restart.'
  exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $root 'node_modules'))) {
  Show-ErrorWindow 'Dependencies are missing. Please run start-storyforge.cmd once, or run npm install in this folder.'
  exit 1
}

$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -LiteralPath $logPath -Value ""
Add-Content -LiteralPath $logPath -Value "[$timestamp] Starting StoryForge background dev server..."

$command = "/d /s /c `"npm.cmd run dev 1>> `"$logPath`" 2>>&1`""
$process = Start-Process `
  -FilePath $env:ComSpec `
  -ArgumentList $command `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -PassThru

Set-Content -LiteralPath $pidPath -Value $process.Id -Encoding ASCII
Set-Content -LiteralPath $metaPath -Encoding UTF8 -Value @(
  "pid=$($process.Id)"
  "project=$root"
  "url=$url"
  "log=$logPath"
  "startedAt=$timestamp"
)

Start-Sleep -Seconds 2

if ((Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
  Open-StoryForge
}
