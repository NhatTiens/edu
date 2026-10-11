Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
function Invoke-Docker {
    param([Parameter(Mandatory=$true)][string[]]$DockerArgs)
    $result = & docker @DockerArgs
    if ($LASTEXITCODE -ne 0) { throw 'Docker operation failed. No subsequent step was executed.' }
    return $result
}
function Assert-LocalDocker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker CLI not found. Install/start Docker Desktop using Linux containers.' }
    $context = (Invoke-Docker -DockerArgs @('context','show') | Out-String).Trim()
    $endpoint = (Invoke-Docker -DockerArgs @('context','inspect',$context,'--format','{{.Endpoints.docker.Host}}') | Out-String).Trim()
    if ($env:DOCKER_HOST -or $endpoint -notmatch '^(npipe:|unix:)') { throw 'Only a local Docker Desktop context is supported. Inspect DOCKER_HOST/context before proceeding.' }
    $os = (Invoke-Docker -DockerArgs @('info','--format','{{.OSType}}') | Out-String).Trim()
    if ($os -ne 'linux') { throw 'Switch Docker Desktop to Linux containers.' }
    $versionText = (Invoke-Docker -DockerArgs @('compose','version','--short') | Out-String).Trim().TrimStart('v')
    if ([version]($versionText.Split('-')[0]) -lt [version]'2.30.0') { throw 'Docker Compose 2.30+ is required for raw env_file handling.' }
}
function Get-ComposeArgs {
    return @('compose','--project-name','edu-local-web','--env-file',(Join-Path $script:RepoRoot 'infra/.env.compose'),'-f',(Join-Path $script:RepoRoot 'infra/compose.local.yml'))
}
