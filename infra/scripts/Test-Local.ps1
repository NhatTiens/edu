[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-LocalDocker
$composeArgs = Get-ComposeArgs
Invoke-Docker -DockerArgs ($composeArgs + @('exec','-T','web','node','infra/check-runtime.mjs'))
$line = Get-Content (Join-Path $script:RepoRoot 'infra/.env.compose') | Where-Object { $_ -like 'NEXT_PUBLIC_SITE_URL=*' }
$base = $line.Substring('NEXT_PUBLIC_SITE_URL='.Length).TrimEnd('/')
& node (Join-Path $script:RepoRoot 'infra/smoke-live.mjs') $base
if ($LASTEXITCODE -ne 0) { throw 'Live app smoke failed. Review the printed check; do not reset Supabase.' }
Write-Host "Local URL: $base"
Write-Host 'Complete the manual Auth/Storage/quiz lifecycle checklist in DEPLOYMENT_TASKS.md. Automated probes did not create data.'
