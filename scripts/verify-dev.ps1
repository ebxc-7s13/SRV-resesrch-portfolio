<#Requires -Version 5.1
<#
.SYNOPSIS
  Reusable local dev-server verification workflow (detached lifecycle).

.DESCRIPTION
  Lifecycle: Start (detach + capture PID) -> WaitReady (1s HTTP poll, 120s max,
  stops on first 200) -> TestRoutes (sequential, bounded) -> BrowserCheck
  (DOMContentLoaded equivalent + content markers, NEVER network-idle) -> Stop
  (only the captured process tree).

  Each phase is a separate invocation so no caller ever blocks on the
  long-running server process. Never uses a fixed sleep for readiness.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-dev.ps1 -Action Start
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-dev.ps1 -Action WaitReady
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-dev.ps1 -Action TestRoutes
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-dev.ps1 -Action BrowserCheck
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-dev.ps1 -Action Stop
#>
[CmdletBinding()]
param(
  [ValidateSet("Start", "WaitReady", "TestRoutes", "BrowserCheck", "Stop", "Status", "RunAll")]
  [string]$Action = "RunAll",
  [int]$Port = 3000,
  [int]$TimeoutSec = 120,
  [int]$RequestTimeoutSec = 25,
  [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  if ($PSScriptRoot) { $ProjectRoot = (Split-Path -Parent $PSScriptRoot) }
  else { $ProjectRoot = (Get-Location).Path }
}
$ProjectRoot = [IO.Path]::GetFullPath($ProjectRoot)

$StateDir = Join-Path $env:TEMP "opencode"
$StateFile = Join-Path $StateDir ("dev-verify-{0}.json" -f $Port)
$OutLog = Join-Path $StateDir ("dev-verify-{0}.out.log" -f $Port)
$ErrLog = Join-Path $StateDir ("dev-verify-{0}.err.log" -f $Port)

function Get-PortOwner([int]$p) {
  $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $conn) { return $null }
  $proc = Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $conn.OwningProcess) -ErrorAction SilentlyContinue
  return @{ Pid = $conn.OwningProcess; CommandLine = if ($proc) { $proc.CommandLine } else { "" } }
}

function Test-Ours([string]$cmd) {
  return (-not [string]::IsNullOrEmpty($cmd)) -and ($cmd -like ("*" + $ProjectRoot + "*"))
}

function Get-ProjectNodeProcesses {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { Test-Ours $_.CommandLine }
}

function Write-Tails {
  Write-Output "---STDOUT tail ($OutLog)---"
  if (Test-Path -LiteralPath $OutLog) { Get-Content -LiteralPath $OutLog -Tail 25 -ErrorAction SilentlyContinue }
  Write-Output "---STDERR tail ($ErrLog)---"
  if (Test-Path -LiteralPath $ErrLog) { Get-Content -LiteralPath $ErrLog -Tail 25 -ErrorAction SilentlyContinue }
}

function Invoke-Start {
  $owner = Get-PortOwner $Port
  if ($owner) {
    $kind = if (Test-Ours $owner.CommandLine) { "STALE-OURS" } else { "FOREIGN" }
    Write-Output ("PORT-OCCUPIED port={0} pid={1} kind={2}" -f $Port, $owner.Pid, $kind)
    Write-Output ("OWNER-CMD: {0}" -f $owner.CommandLine)
    Write-Output "REFUSING-TO-START: stop or reassign before starting a new server."
    exit 2
  }
  if (-not (Test-Path -LiteralPath $StateDir)) { New-Item -ItemType Directory -Path $StateDir | Out-Null }
  Remove-Item -LiteralPath $OutLog -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $ErrLog -ErrorAction SilentlyContinue
  New-Item -ItemType File -Path $OutLog | Out-Null
  New-Item -ItemType File -Path $ErrLog | Out-Null
  $sw = [Diagnostics.Stopwatch]::StartNew()
  # Detached: never wait for this process; caller polls separately.
  $srv = Start-Process -FilePath "npm.cmd" `
    -ArgumentList "run", "dev", "--", "--port", "$Port" `
    -WorkingDirectory $ProjectRoot `
    -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog `
    -NoNewWindow -PassThru
  @{ pid = $srv.Id; port = $Port; outLog = $OutLog; errLog = $ErrLog;
     startedAt = (Get-Date).ToString("o") } |
    ConvertTo-Json | Set-Content -LiteralPath $StateFile -Encoding Ascii
  $sw.Stop()
  Write-Output ("STARTED pid={0} port={1} spawn_ms={2}" -f $srv.Id, $Port, $sw.ElapsedMilliseconds)
  Write-Output ("STATE: {0}" -f $StateFile)
}

function Invoke-WaitReady {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $pid0 = $null
  if (Test-Path -LiteralPath $StateFile) {
    try { $pid0 = (Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json).pid } catch {}
  }
  for ($i = 1; $i -le $TimeoutSec; $i++) {
    if ($pid0) {
      $p = Get-Process -Id $pid0 -ErrorAction SilentlyContinue
      if (-not $p) {
        $sw.Stop()
        Write-Output ("SERVER-PROCESS-EXITED pid={0} elapsed_s={1}" -f $pid0, $sw.Elapsed.TotalSeconds.ToString("F1"))
        Write-Tails
        exit 1
      }
    }
    try {
      $r = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/" -f $Port) -TimeoutSec 3 -UseBasicParsing
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
        $sw.Stop()
        Write-Output ("READY status={0} len={1} elapsed_s={2} polls={3}" -f `
          $r.StatusCode, $r.RawContentLength, $sw.Elapsed.TotalSeconds.ToString("F1"), $i)
        return
      }
    } catch {
      if (($i -le 3) -or (($i % 10) -eq 0)) {
        $msg = $_.Exception.Message
        Write-Output ("poll {0}: not ready ({1})" -f $i, $msg.Substring(0, [Math]::Min(100, $msg.Length)))
      }
    }
    Start-Sleep -Seconds 1
  }
  $sw.Stop()
  Write-Output ("NOT-READY timeout_s={0} elapsed_s={1}" -f $TimeoutSec, $sw.Elapsed.TotalSeconds.ToString("F1"))
  Write-Tails
  exit 1
}

function Invoke-TestRoutes {
  $routes = @("/", "/research", "/publications", "/patents")
  $fail = 0
  foreach ($route in $routes) {
    $url = ("http://127.0.0.1:{0}{1}" -f $Port, $route)
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try {
      $r = Invoke-WebRequest -Uri $url -TimeoutSec $RequestTimeoutSec -UseBasicParsing
      $sw.Stop()
      $digest = if ($r.Content -match 'E\{"digest"') { "DIGEST-ERROR" } else { "no-digest" }
      Write-Output ("ROUTE {0} status={1} ms={2} len={3} {4}" -f `
        $route, $r.StatusCode, $sw.ElapsedMilliseconds, $r.RawContentLength, $digest)
      if ($r.StatusCode -ne 200 -or $digest -eq "DIGEST-ERROR") { $fail++ }
    } catch {
      $sw.Stop()
      Write-Output ("ROUTE {0} FAIL after {1}ms: {2}" -f $route, $sw.ElapsedMilliseconds, $_.Exception.Message)
      $fail++
    }
    # Sequential only: small gap, never parallel.
    Start-Sleep -Milliseconds 300
  }
  if ($fail -gt 0) { Write-Output ("ROUTES-FAILED count={0}" -f $fail); exit 1 }
  Write-Output "ROUTES-OK all=4"
}

function Invoke-BrowserCheck {
  # No Playwright in this environment: HTTP document check is the bounded
  # readiness gate. Explicitly NEVER waits for network-idle (WebGL/animation
  # loops may never quiesce). Equivalent of DOMContentLoaded + app markers.
  $url = ("http://127.0.0.1:{0}/" -f $Port)
  $sw = [Diagnostics.Stopwatch]::StartNew()
  try {
    $r = Invoke-WebRequest -Uri $url -TimeoutSec $RequestTimeoutSec -UseBasicParsing
  } catch {
    $sw.Stop()
    Write-Output ("BROWSER-CHECK-NAV-FAIL after {0}ms url={1}: {2}" -f $sw.ElapsedMilliseconds, $url, $_.Exception.Message)
    exit 1
  }
  $sw.Stop()
  $h = $r.Content
  $markers = @(
    @("skip-link", "Skip to content"),
    @("nav", "Main navigation"),
    @("hero", "SILUVERU"),
    @("hero-cta", "Explore research"),
    @("lab-cover-cta", "Enter the laboratory"),
    @("featured", "Featured Research")
  )
  $missing = 0
  foreach ($m in $markers) {
    if ($h -match [regex]::Escape($m[1])) { Write-Output ("DOM-HAS: {0}" -f $m[0]) }
    else { Write-Output ("DOM-MISSING: {0}" -f $m[0]); $missing++ }
  }
  # 3D must be lazy: cover present in SSR, heavy scene NOT in SSR HTML.
  if ($h -match "lab-stage") { Write-Output "LAZY3D-OK: lab shell present without blocking document" }
  else { Write-Output "LAZY3D-NOTE: lab shell marker absent"; $missing++ }
  if ($h -match 'E\{"digest"') { Write-Output "STREAM-ERROR-DIGEST-PRESENT"; $missing++ }
  else { Write-Output "NO-STREAM-ERROR-DIGEST" }
  Write-Output ("DOC ms={0} bytes={1}" -f $sw.ElapsedMilliseconds, $h.Length)
  if ($missing -gt 0) { Write-Output ("BROWSER-CHECK-FAIL missing={0}" -f $missing); exit 1 }
  Write-Output "BROWSER-READY (document markers; no network-idle wait by design)"
}

function Invoke-Stop {
  if (-not (Test-Path -LiteralPath $StateFile)) {
    Write-Output "NO-STATE-FILE: nothing started by this workflow on this port."
    return
  }
  $st = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
  $pid0 = [int]$st.pid
  $p = Get-Process -Id $pid0 -ErrorAction SilentlyContinue
  if (-not $p) { Write-Output ("ALREADY-STOPPED pid={0}" -f $pid0) }
  else {
    # Only the captured tree; never unrelated PIDs.
    taskkill /PID $pid0 /T /F | Out-Null
    Write-Output ("STOP-SIGNALED pid={0}" -f $pid0)
  }
  for ($i = 1; $i -le 15; $i++) {
    if (-not (Get-PortOwner $Port)) { break }
    Start-Sleep -Seconds 1
  }
  if (Get-PortOwner $Port) { Write-Output ("PORT-STILL-OCCUPIED port={0}" -f $Port); exit 1 }
  Remove-Item -LiteralPath $StateFile -ErrorAction SilentlyContinue
  Write-Output ("CLEANUP-OK pid={0} port={1} released" -f $pid0, $Port)
  $left = Get-ProjectNodeProcesses
  if ($left) {
    Write-Output "STALE-REPORT: other project-owned node processes still running (untouched):"
    foreach ($n in $left) { Write-Output ("  STALE pid={0} cmd={1}" -f $n.ProcessId, $n.CommandLine) }
  } else { Write-Output "NO-STALE-PROJECT-PROCESSES" }
}

function Invoke-Status {
  $owner = Get-PortOwner $Port
  if ($owner) {
    $kind = if (Test-Ours $owner.CommandLine) { "STALE-OURS" } else { "FOREIGN" }
    Write-Output ("PORT port={0} occupied pid={1} kind={2}" -f $Port, $owner.Pid, $kind)
    Write-Output ("OWNER-CMD: {0}" -f $owner.CommandLine)
  } else { Write-Output ("PORT port={0} FREE" -f $Port) }
  if (Test-Path -LiteralPath $StateFile) { Write-Output ("STATE: " + (Get-Content -LiteralPath $StateFile -Raw)) }
  else { Write-Output "STATE: none" }
  $all = Get-ProjectNodeProcesses
  if ($all) { foreach ($n in $all) { Write-Output ("PROJECT-NODE pid={0} ppid={1}" -f $n.ProcessId, $n.ParentProcessId) } }
  else { Write-Output "PROJECT-NODE: none" }
}

switch ($Action) {
  "Start" { Invoke-Start }
  "WaitReady" { Invoke-WaitReady }
  "TestRoutes" { Invoke-TestRoutes }
  "BrowserCheck" { Invoke-BrowserCheck }
  "Stop" { Invoke-Stop }
  "Status" { Invoke-Status }
  "RunAll" {
    Invoke-Start
    try {
      Invoke-WaitReady
      Invoke-TestRoutes
      Invoke-BrowserCheck
    } finally { Invoke-Stop }
  }
}
