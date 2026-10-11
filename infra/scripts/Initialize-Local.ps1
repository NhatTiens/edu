[CmdletBinding()]
param([string]$SourceEnv, [string]$InternalUrl)
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-LocalDocker
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22+ is needed for configuration validation on Windows.' }
if (-not $SourceEnv) { $SourceEnv = Join-Path $script:RepoRoot '.env.local' }
$nodeArgs = @((Join-Path $script:RepoRoot 'infra/configure.mjs'),$SourceEnv)
if ($InternalUrl) { $nodeArgs += $InternalUrl }
& node @nodeArgs
if ($LASTEXITCODE -ne 0) { throw 'Environment initialization failed.' }
