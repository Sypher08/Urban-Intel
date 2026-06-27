param(
  [switch]$Stop = $false
)

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$pidFile = "$env:TEMP\urban_intel_e2e_pids.txt"

if ($Stop) {
  if (Test-Path $pidFile) {
    Get-Content $pidFile | ForEach-Object {
      $p = $_ -as [int]
      if ($p -and (Get-Process -Id $p -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $p -Force
        Write-Host "Stopped PID $p"
      }
    }
    Remove-Item $pidFile -Force
  }
  exit
}

Write-Host "▶ Starting Urban Intel E2E servers..."

# Start backend
$backendLog = "$env:TEMP\urban_intel_backend.log"
$backendJob = Start-Job -Name "urban-intel-backend" -ScriptBlock {
  param($rootDir, $logFile)
  $env:PYTHONIOENCODING = "utf-8"
  Set-Location "$rootDir\backend"
  $p = Start-Process -FilePath ".\.venv\Scripts\python.exe" -ArgumentList "-m uvicorn server:app --host 0.0.0.0 --port 8001" -NoNewWindow -PassThru -RedirectStandardOutput $logFile -RedirectStandardError $logFile
  $p.Id | Out-File -FilePath "$env:TEMP\urban_intel_backend.pid" -Encoding ascii
  Wait-Process -Id $p.Id
} -ArgumentList $root, $backendLog

# Start frontend
$frontendLog = "$env:TEMP\urban_intel_frontend.log"
$frontendJob = Start-Job -Name "urban-intel-frontend" -ScriptBlock {
  param($rootDir, $logFile)
  Set-Location "$rootDir\frontend"
  $p = Start-Process -FilePath "cmd.exe" -ArgumentList "/c yarn web --port 8081" -NoNewWindow -PassThru -RedirectStandardOutput $logFile -RedirectStandardError $logFile
  $p.Id | Out-File -FilePath "$env:TEMP\urban_intel_frontend.pid" -Encoding ascii
  Wait-Process -Id $p.Id
} -ArgumentList $root, $frontendLog

# Wait for backend
Write-Host "Waiting for backend on http://localhost:8001/api/health ..."
$backendReady = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri "http://localhost:8001/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) {
      $backendReady = $true
      Write-Host "Backend is ready!"
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}
if (-not $backendReady) {
  Write-Error "Backend failed to start within 60s. Check $backendLog"
  exit 1
}

# Wait for frontend
Write-Host "Waiting for frontend on http://localhost:8081 ..."
$frontendReady = $false
for ($i = 0; $i -lt 120; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri "http://localhost:8081" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) {
      $frontendReady = $true
      Write-Host "Frontend is ready!"
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}
if (-not $frontendReady) {
  Write-Error "Frontend failed to start within 120s. Check $frontendLog"
  exit 1
}

# Save PIDs
$backendPid = Get-Content "$env:TEMP\urban_intel_backend.pid" -ErrorAction SilentlyContinue
$frontendPid = Get-Content "$env:TEMP\urban_intel_frontend.pid" -ErrorAction SilentlyContinue
@($backendPid, $frontendPid) | Out-File $pidFile -Encoding ascii

Write-Host "Both servers are running!"
Write-Host "Backend PID: $backendPid"
Write-Host "Frontend PID: $frontendPid"

# Keep script alive so Playwright webServer waits
Write-Host "Press Ctrl+C to stop servers..."
Wait-Event
