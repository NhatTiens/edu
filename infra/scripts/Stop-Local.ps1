[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-LocalDocker
Invoke-Docker -DockerArgs ((Get-ComposeArgs) + @('stop','web'))
Write-Host 'Stopped only edu-local-web/web. Supabase containers and volumes untouched.'
