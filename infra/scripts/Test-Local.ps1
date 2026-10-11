[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-LocalDocker
$composeArgs = Get-ComposeArgs
Invoke-Docker -DockerArgs ($composeArgs + @('exec','-T','web','node','infra/check-runtime.mjs'))
$line = Get-Content (Join-Path $script:RepoRoot 'infra/.env.compose') | Where-Object { $_ -like 'NEXT_PUBLIC_SITE_URL=*' }
$base = $line.Substring('NEXT_PUBLIC_SITE_URL='.Length).TrimEnd('/')
foreach ($route in @('/','/search?q=deployment','/admin/login')) {
    $response = Invoke-WebRequest -UseBasicParsing -Uri ($base + $route) -TimeoutSec 30
    if ($response.StatusCode -ne 200) { throw "HTTP smoke failed: $route" }
    Write-Host "PASS $route"
}
Write-Host "Local URL: $base"
Write-Host 'Complete the manual Auth/Storage/quiz lifecycle checklist in DEPLOYMENT_TASKS.md. Automated probes did not create data.'
