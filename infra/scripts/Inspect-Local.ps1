[CmdletBinding()]
param([string]$DbContainer)
. (Join-Path $PSScriptRoot 'Common.ps1')
$reportDir = Join-Path $script:RepoRoot 'infra/reports'
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$report = [ordered]@{ checked_at = (Get-Date).ToUniversalTime().ToString('o'); os = [Environment]::OSVersion.VersionString; powershell = $PSVersionTable.PSVersion.ToString() }
if (Get-Command node -ErrorAction SilentlyContinue) { $report.node = (& node --version | Out-String).Trim() } else { $report.node = 'NOT_FOUND' }
$desktop = if ($env:ProgramFiles) { Join-Path $env:ProgramFiles 'Docker/Docker/Docker Desktop.exe' } else { $null }
$report.docker_desktop = if ($desktop -and (Test-Path $desktop)) { (Get-Item $desktop).VersionInfo.ProductVersion } else { 'NOT_FOUND_AT_DEFAULT_PATH' }
$report.environment_files = @()
foreach ($file in @('.env.local','.env','infra/.env.runtime','infra/.env.compose')) {
    $full = Join-Path $script:RepoRoot $file
    if (Test-Path $full) {
        $names = @(Get-Content $full | ForEach-Object { if ($_ -match '^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$') { [ordered]@{name=$Matches[1]; populated=([bool]$Matches[2].Trim())} } })
        $report.environment_files += @{ file=$file; variables=$names }
    }
}
$report.repository_migrations = @(Get-ChildItem (Join-Path $script:RepoRoot 'supabase/migrations/*.sql') | ForEach-Object { @{ name=$_.Name; sha256=(Get-FileHash $_.FullName -Algorithm SHA256).Hash } })
$report.supabase_config_present = Test-Path (Join-Path $script:RepoRoot 'supabase/config.toml')
try {
    Assert-LocalDocker
    $report.docker_version = Invoke-Docker -DockerArgs @('version','--format','{{json .}}') | ConvertFrom-Json
    $report.compose_version = Invoke-Docker -DockerArgs @('compose','version','--short')
    $report.context = Invoke-Docker -DockerArgs @('context','show')
    $report.containers = @(Invoke-Docker -DockerArgs @('ps','-a','--format','{{json .}}') | ForEach-Object { $_ | ConvertFrom-Json })
    $report.networks = @(Invoke-Docker -DockerArgs @('network','ls','--format','{{json .}}') | ForEach-Object { $_ | ConvertFrom-Json })
    $report.volumes = @(Invoke-Docker -DockerArgs @('volume','ls','--format','{{json .}}') | ForEach-Object { $_ | ConvertFrom-Json })
    $report.container_mounts = @()
    foreach ($c in $report.containers) {
        # Never dump Config.Env: it contains database passwords and JWT secrets.
        $mounts = @(Invoke-Docker -DockerArgs @('inspect',$c.ID,'--format','{{json .Mounts}}') | ConvertFrom-Json)
        $networks = Invoke-Docker -DockerArgs @('inspect',$c.ID,'--format','{{json .NetworkSettings.Networks}}') | ConvertFrom-Json
        $report.container_mounts += @{name=$c.Names; mounts=$mounts; networks=$networks; status=$c.Status}
    }
    $candidates = @($report.containers | Where-Object { $_.Names -like 'supabase_db_*' -and $_.State -eq 'running' })
    if (-not $DbContainer -and $candidates.Count -eq 1) { $DbContainer = $candidates[0].Names }
    if ($DbContainer) {
        if (-not @($report.containers | Where-Object { $_.Names -eq $DbContainer -and $_.State -eq 'running' }).Count) { throw 'The selected DB container is not running.' }
        $sql = @'
BEGIN READ ONLY;
SELECT json_build_object('postgres_version',current_setting('server_version'),'database_bytes',pg_database_size(current_database()));
SELECT json_build_object('auth_users',(SELECT count(*) FROM auth.users),'storage_buckets',(SELECT count(*) FROM storage.buckets),'storage_objects',(SELECT count(*) FROM storage.objects));
SELECT json_build_object('migration_table',to_regclass('supabase_migrations.schema_migrations')::text);
SELECT json_build_object('schema',schemaname,'table',relname,'estimated_rows',n_live_tup) FROM pg_stat_user_tables WHERE schemaname IN ('public','auth','storage') ORDER BY schemaname,relname;
COMMIT;
'@
        $report.database = Invoke-Docker -DockerArgs @('exec',$DbContainer,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At','-c',$sql)
        $exists = (Invoke-Docker -DockerArgs @('exec',$DbContainer,'psql','-X','-U','postgres','-d','postgres','-At','-c',"SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL") | Out-String).Trim()
        if ($exists -eq 't') {
            $report.applied_migrations = @(Invoke-Docker -DockerArgs @('exec',$DbContainer,'psql','-X','-U','postgres','-d','postgres','-At','-c','BEGIN READ ONLY; SELECT version FROM supabase_migrations.schema_migrations ORDER BY version; COMMIT;') | Where-Object { $_ -notin @('BEGIN','COMMIT') })
            $report.repository_versions_not_in_history = @($report.repository_migrations | Where-Object { ($_.name.Split('_')[0]) -notin $report.applied_migrations } | ForEach-Object { $_.name })
            $report.migration_note = 'Version comparison only; does not establish SQL checksum equivalence. Never apply missing versions blindly.'
        } else { $report.migration_note = 'No migration history. Existing schema must be reviewed; do not replay schema.sql or migrations.' }
        $report.db_container = $DbContainer
    } else { $report.database = 'NOT_INSPECTED: rerun with -DbContainer using the exact container name. No automatic selection across multiple projects.' }
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $report.listening_ports = @(Get-NetTCPConnection -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess)
    }
    $report.storage_note = 'Counts are metadata only. Check actual object reads in browser; this report is not a backup or restore verification.'
} catch { $report.blocked = $_.Exception.Message }
$target = Join-Path $reportDir ('local-audit-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$report | ConvertTo-Json -Depth 15 | Set-Content -Encoding UTF8 $target
Write-Host "Read-only audit saved: $target"
if ($report.Contains('blocked')) { Write-Warning $report.blocked }
Write-Host 'Review locally before sharing: the report contains container paths and machine metadata, but no environment values or user rows.'
