# Samples CPU% (of one core) and working set of the e2e backend listener on :8010 plus all postgres processes.
# Usage: powershell -File sample-proc.ps1 -Out <csv> -Seconds 240
param([string]$Out, [int]$Seconds = 240, [int]$Interval = 2)
$pidBackend = (Get-NetTCPConnection -LocalPort 8010 -State Listen | Select-Object -First 1).OwningProcess
"t,backend_cpu_pct,backend_ws_mb,backend_private_mb,pg_cpu_pct,pg_ws_mb" | Out-File -Encoding ascii $Out
$prev = $null; $prevPg = $null; $start = Get-Date
while (((Get-Date) - $start).TotalSeconds -lt $Seconds) {
  $p = Get-Process -Id $pidBackend -ErrorAction SilentlyContinue
  $pg = Get-Process -Name postgres -ErrorAction SilentlyContinue
  $now = Get-Date
  $pgCpu = ($pg | Measure-Object CPU -Sum).Sum; $pgWs = ($pg | Measure-Object WorkingSet64 -Sum).Sum
  if ($prev -and $p) {
    $dt = ($now - $prev.t).TotalSeconds
    $cpu = [math]::Round(100 * ($p.CPU - $prev.cpu) / $dt, 1)
    $pgc = [math]::Round(100 * ($pgCpu - $prevPg) / $dt, 1)
    "{0},{1},{2},{3},{4},{5}" -f [math]::Round(($now - $start).TotalSeconds), $cpu, [math]::Round($p.WorkingSet64/1MB,1), [math]::Round($p.PrivateMemorySize64/1MB,1), $pgc, [math]::Round($pgWs/1MB,1) | Out-File -Append -Encoding ascii $Out
  }
  if ($p) { $prev = @{ t = $now; cpu = $p.CPU } }; $prevPg = $pgCpu
  Start-Sleep -Seconds $Interval
}
