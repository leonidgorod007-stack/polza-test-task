param([switch]$SetupOnly)

$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo    = Split-Path -Parent $PSScriptRoot
$Tools   = Join-Path $Repo '.tools'
$NodeVer = 'v24.18.1'
$PgPort  = 5433
$DbName  = 'polza'
$WebPort = 3000
$script:Npm = 'npm'

function Say($m)  { Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "OK  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "!!  $m" -ForegroundColor Yellow }

function Ensure-Node {
  if (Get-Command node -ErrorAction SilentlyContinue) { Ok "Node found: $(node --version)"; return }
  $existing = Get-ChildItem (Join-Path $Tools 'node') -Filter node.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existing) {
    $env:Path = "$($existing.Directory.FullName);$env:Path"
    $script:Npm = Join-Path $existing.Directory.FullName 'npm.cmd'
    Ok "Node (local): $(node --version)"; return
  }
  Say "Node not found - downloading portable $NodeVer"
  New-Item -ItemType Directory -Force $Tools | Out-Null
  $zip = Join-Path $Tools 'node.zip'
  $urls = @(
    "https://nodejs.org/dist/$NodeVer/node-$NodeVer-win-x64.zip",
    "https://npmmirror.com/mirrors/node/$NodeVer/node-$NodeVer-win-x64.zip"
  )
  $downloaded = $false
  foreach ($u in $urls) {
    try { Say "  source: $u"; Invoke-WebRequest -Uri $u -OutFile $zip -TimeoutSec 300 -ErrorAction Stop; $downloaded = $true; break }
    catch { Warn "  failed: $($_.Exception.Message)" }
  }
  if (-not $downloaded) { throw "Could not download Node from any source. Install Node manually (https://nodejs.org) and re-run." }
  Expand-Archive -Path $zip -DestinationPath (Join-Path $Tools 'node') -Force -ErrorAction Stop
  Remove-Item $zip -Force
  $nodeDir = (Get-ChildItem (Join-Path $Tools 'node') -Directory | Where-Object Name -like 'node-*' | Select-Object -First 1).FullName
  $env:Path = "$nodeDir;$env:Path"
  $script:Npm = Join-Path $nodeDir 'npm.cmd'
  Ok "Node installed: $(node --version)"
}

function Test-DbUrl($url) {
  & node (Join-Path $Repo 'scripts\db_check.mjs') $url *> $null
  return ($LASTEXITCODE -eq 0)
}

function Start-PortablePostgres {
  $bin  = Join-Path $Tools 'pgsql\bin'
  $data = Join-Path $Tools 'pgdata'
  if (-not (Test-Path (Join-Path $bin 'postgres.exe'))) {
    Say "Downloading portable PostgreSQL (~320 MB, one time)"
    New-Item -ItemType Directory -Force $Tools | Out-Null
    $zip = Join-Path $Tools 'pg.zip'
    Invoke-WebRequest -Uri 'https://get.enterprisedb.com/postgresql/postgresql-17.5-1-windows-x64-binaries.zip' -OutFile $zip -TimeoutSec 1800 -ErrorAction Stop
    Expand-Archive -Path $zip -DestinationPath $Tools -Force -ErrorAction Stop
    Remove-Item $zip -Force
  }
  $vc = Join-Path $bin 'vcruntime140_1.dll'
  if (-not (Test-Path $vc) -and -not (Test-Path 'C:\Windows\System32\vcruntime140_1.dll')) {
    $src = Get-ChildItem 'C:\Program Files (x86)\Microsoft\Edge\Application','C:\Program Files\Microsoft\Edge\Application' -Filter 'vcruntime140_1.dll' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($src) { Copy-Item $src.FullName $vc -Force }
  }
  if (-not (Test-Path (Join-Path $data 'PG_VERSION'))) {
    Say "Initializing database cluster"
    $pw = Join-Path $Tools 'pw.txt'
    Set-Content -Path $pw -Value 'postgres' -NoNewline -Encoding ascii
    & (Join-Path $bin 'initdb.exe') -D $data -U postgres -A scram-sha-256 --pwfile=$pw -E UTF8 | Out-Null
    Remove-Item $pw -Force
  }
  $status = & (Join-Path $bin 'pg_ctl.exe') -D $data status 2>&1
  if ($status -notmatch 'server is running') {
    Say "Starting PostgreSQL on port $PgPort"
    & (Join-Path $bin 'pg_ctl.exe') -D $data -l (Join-Path $Tools 'pg.log') -o "-p $PgPort" -w start | Out-Null
  }
  return "postgresql://postgres:postgres@localhost:$PgPort/$DbName"
}

function Ensure-Postgres {
  $candidates = @()
  if ($env:DATABASE_URL) { $candidates += $env:DATABASE_URL }
  $candidates += "postgresql://postgres:postgres@localhost:5432/$DbName"
  $candidates += "postgresql://postgres:postgres@localhost:5433/$DbName"
  foreach ($u in $candidates) {
    if (Test-DbUrl $u) { $masked = $u -replace ':[^:@/]+@', ':****@'; Ok "Reachable database found: $masked"; return $u }
  }
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if ($docker) {
    try {
      Say "No database found - starting PostgreSQL via Docker (docker compose up -d)"
      Push-Location $Repo; & docker compose up -d | Out-Null; Pop-Location
      $url = "postgresql://postgres:postgres@localhost:5432/$DbName"
      for ($i = 0; $i -lt 30; $i++) { if (Test-DbUrl $url) { Ok "Docker Postgres is ready"; return $url }; Start-Sleep 2 }
      Warn "Docker started but DB is not responding - falling back to portable"
    } catch { Warn "Docker unavailable ($($_.Exception.Message)) - falling back to portable" }
  }
  $url = Start-PortablePostgres
  for ($i = 0; $i -lt 20; $i++) { if (Test-DbUrl $url) { Ok "Portable Postgres is ready"; return $url }; Start-Sleep 1 }
  throw "Could not start PostgreSQL. Install Docker Desktop or a local PostgreSQL and re-run."
}

function Write-EnvFile($file, $url) {
  Set-Content -Path $file -Value "DATABASE_URL=$url" -Encoding ascii
}

function Npm-Install($dir) {
  if (Test-Path (Join-Path $dir 'node_modules')) { Ok "Dependencies already installed: $dir"; return }
  Say "npm install: $dir"
  Push-Location $dir
  & $script:Npm install --no-audit --no-fund | Out-Null
  Pop-Location
}

Say "Project directory: $Repo"
Ensure-Node
Npm-Install $Repo
$DbUrl = Ensure-Postgres
Write-EnvFile (Join-Path $Repo '.env') $DbUrl
Write-EnvFile (Join-Path $Repo 'web\.env') $DbUrl
Ok "Connection string written to .env and web/.env"

Say "Task 1 - loading companies"
& node (Join-Path $Repo 'scripts\load_companies.mjs')
if ($LASTEXITCODE -ne 0) { throw "load_companies failed" }
Say "Task 3 - loading review.csv"
& node (Join-Path $Repo 'scripts\load_reviews.mjs')
if ($LASTEXITCODE -ne 0) { throw "load_reviews failed" }

Npm-Install (Join-Path $Repo 'web')

if ($SetupOnly) {
  Ok "Done (SetupOnly). Start the site: cd web && npm run dev  ->  http://localhost:$WebPort/companies"
  exit 0
}

Say "Starting the site: http://localhost:$WebPort/companies"
$opener = "for(`$i=0;`$i -lt 60;`$i++){ try{ if((Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://localhost:$WebPort/companies').StatusCode -eq 200){ Start-Process 'http://localhost:$WebPort/companies'; break } }catch{}; Start-Sleep 2 }"
Start-Process powershell -ArgumentList '-NoProfile','-WindowStyle','Hidden','-Command', $opener | Out-Null
Set-Location (Join-Path $Repo 'web')
& $script:Npm run dev
