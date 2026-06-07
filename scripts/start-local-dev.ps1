param(
  [int]$Port = 3012
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root ".local-dev"
$OutLog = Join-Path $LogDir "next-$Port.out.log"
$ErrLog = Join-Path $LogDir "next-$Port.err.log"
$Url = "http://127.0.0.1:$Port/login"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Test-CorsoDevServer {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 4
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

if (Test-CorsoDevServer) {
  Write-Host "Corso local dev server is already running at $Url"
  exit 0
}

$node = (Get-Command node -ErrorAction Stop).Source
$nodeRoot = Split-Path -Parent $node
$npmCli = Join-Path $nodeRoot "node_modules\npm\bin\npm-cli.js"

if (!(Test-Path $npmCli)) {
  throw "Could not find npm CLI at $npmCli"
}

$arguments = "`"$npmCli`" run dev:local"
Start-Process `
  -FilePath $node `
  -ArgumentList $arguments `
  -WorkingDirectory $Root `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog `
  -WindowStyle Hidden

for ($attempt = 1; $attempt -le 20; $attempt++) {
  Start-Sleep -Seconds 2
  if (Test-CorsoDevServer) {
    Write-Host "Corso local dev server started at $Url"
    Write-Host "Logs: $OutLog"
    exit 0
  }
}

Write-Host "Corso local dev server did not become ready."
Write-Host "Last stdout:"
if (Test-Path $OutLog) { Get-Content $OutLog -Tail 40 }
Write-Host "Last stderr:"
if (Test-Path $ErrLog) { Get-Content $ErrLog -Tail 80 }
exit 1
