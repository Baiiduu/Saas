param(
  [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Ports = @(3000, 5173)

function Stop-PortOwners {
  $owners = Get-NetTCPConnection -LocalPort $Ports -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($owner in $owners) {
    if ($owner) {
      Write-Host "Stopping process $owner on dev port..."
      Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
    }
  }
}

function Clear-LogFile {
  param([string]$Path)

  for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
      Set-Content -Path $Path -Value "" -Encoding utf8
      return
    } catch {
      if ($attempt -eq 5) {
        Write-Warning "Could not clear log file: $Path"
        return
      }
      Start-Sleep -Milliseconds 500
    }
  }
}

function Wait-ForPort {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 90
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($listener) {
      return $true
    }
    Start-Sleep -Seconds 1
  }

  return $false
}

function Wait-ForHttp {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 90
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  return $false
}

Set-Location $Root

Write-Host "Restarting local frontend/backend..."
Stop-PortOwners
Start-Sleep -Seconds 2

$LogFiles = @(
  "backend-dev.log",
  "backend-dev.err.log",
  "frontend-dev.log",
  "frontend-dev.err.log"
)

foreach ($logFile in $LogFiles) {
  Clear-LogFile -Path (Join-Path $Root $logFile)
}

if (-not $SkipDocker) {
  if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "Starting infrastructure containers..."
    docker compose up -d
  } else {
    Write-Warning "Docker was not found. Start Postgres/Redis/MinIO yourself, or install Docker Desktop."
  }
}

Write-Host "Starting backend on http://localhost:3000 ..."
Start-Process -FilePath powershell -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  "pnpm start:dev"
) -WorkingDirectory (Join-Path $Root "packages/backend") `
  -RedirectStandardOutput (Join-Path $Root "backend-dev.log") `
  -RedirectStandardError (Join-Path $Root "backend-dev.err.log") `
  -WindowStyle Hidden

Write-Host "Starting frontend on http://127.0.0.1:5173 ..."
Start-Process -FilePath powershell -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  "pnpm dev -- --host 127.0.0.1"
) -WorkingDirectory (Join-Path $Root "packages/frontend") `
  -RedirectStandardOutput (Join-Path $Root "frontend-dev.log") `
  -RedirectStandardError (Join-Path $Root "frontend-dev.err.log") `
  -WindowStyle Hidden

Write-Host "Waiting for frontend port 5173..."
if (-not (Wait-ForPort -Port 5173 -TimeoutSeconds 45)) {
  Write-Warning "Frontend did not open port 5173 in time. Check frontend-dev.err.log."
}

Write-Host "Waiting for backend port 3000..."
if (-not (Wait-ForPort -Port 3000 -TimeoutSeconds 120)) {
  Write-Warning "Backend did not open port 3000 in time. Check backend-dev.err.log."
}

Write-Host "Checking frontend HTTP..."
if (-not (Wait-ForHttp -Url "http://127.0.0.1:5173/" -TimeoutSeconds 30)) {
  Write-Warning "Frontend HTTP check failed. Check frontend-dev.log and frontend-dev.err.log."
}

Write-Host "Checking backend HTTP..."
if (-not (Wait-ForHttp -Url "http://localhost:3000/docs" -TimeoutSeconds 90)) {
  Write-Warning "Backend HTTP check failed. Check backend-dev.log and backend-dev.err.log."
}

Get-NetTCPConnection -LocalPort $Ports -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, OwningProcess

Write-Host ""
Write-Host "Frontend: http://127.0.0.1:5173/"
Write-Host "Backend docs: http://localhost:3000/docs"
Write-Host "Logs: backend-dev.log, backend-dev.err.log, frontend-dev.log, frontend-dev.err.log"
