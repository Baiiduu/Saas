$ErrorActionPreference = "Stop"

$Ports = @(3000, 5173)

$owners = Get-NetTCPConnection -LocalPort $Ports -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

if (-not $owners) {
  Write-Host "No frontend/backend dev process is listening on ports 3000 or 5173."
  exit 0
}

foreach ($owner in $owners) {
  if ($owner) {
    Write-Host "Stopping process $owner..."
    Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
  }
}

Start-Sleep -Seconds 1

$remaining = Get-NetTCPConnection -LocalPort $Ports -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, OwningProcess

if ($remaining) {
  Write-Warning "Some dev ports are still listening:"
  $remaining
} else {
  Write-Host "Frontend/backend dev processes stopped."
}
