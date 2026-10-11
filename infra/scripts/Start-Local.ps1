[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'Common.ps1')
Assert-LocalDocker
& node (Join-Path $script:RepoRoot 'infra/configure.mjs') --check
if ($LASTEXITCODE -ne 0) { throw 'Configuration validation failed.' }
$composeArgs = Get-ComposeArgs
# Quiet validation prevents resolved secrets appearing on screen.
Invoke-Docker -DockerArgs ($composeArgs + @('config','--quiet')) | Out-Null
Invoke-Docker -DockerArgs ($composeArgs + @('build','web'))
# Probe connectivity BEFORE replacing any existing app container.
Invoke-Docker -DockerArgs ($composeArgs + @('run','--rm','--no-deps','web','node','infra/check-runtime.mjs'))
Invoke-Docker -DockerArgs ($composeArgs + @('up','-d','--no-deps','--wait','--wait-timeout','120','web'))
& (Join-Path $PSScriptRoot 'Test-Local.ps1')
