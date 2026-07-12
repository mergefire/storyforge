$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$runDir = Join-Path $root 'tmp'
$pidPath = Join-Path $runDir 'storyforge-dev.pid'
$logPath = Join-Path $runDir 'storyforge-dev.out.log'

function Stop-ProcessTree([int]$processId) {
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $processId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    Stop-ProcessTree -processId ([int]$child.ProcessId)
  }

  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

if (-not (Test-Path -LiteralPath $pidPath)) {
  Add-Content -LiteralPath $logPath -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Stop requested, but no PID file was found."
  exit 0
}

$pidText = (Get-Content -LiteralPath $pidPath -ErrorAction SilentlyContinue | Select-Object -First 1)
$pid = 0
if (-not [int]::TryParse($pidText, [ref]$pid)) {
  Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
  Add-Content -LiteralPath $logPath -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Stop requested, but PID file was invalid."
  exit 0
}

Stop-ProcessTree -processId $pid
Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
Add-Content -LiteralPath $logPath -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] StoryForge background dev server stopped."
