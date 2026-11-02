[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9_.:-]+$')][string] $Serial = '',
    [ValidateRange(1, 65535)][int] $BackendPort = 8000,
    [ValidateRange(10, 600)][int] $TimeoutSeconds = 300
)
$ErrorActionPreference = 'Stop'
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$adb = Join-Path $sdk 'platform-tools\adb.exe'
if (-not (Test-Path -LiteralPath $adb)) {
    $command = Get-Command adb.exe -ErrorAction SilentlyContinue
    if (-not $command) { throw 'Android SDK platform-tools were not found. Install them through Android Studio SDK Manager.' }
    $adb = $command.Source
}
& $adb start-server
if ($LASTEXITCODE -ne 0) { throw 'ADB could not start.' }
& $adb reconnect offline
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
Write-Output 'Waiting for Android to finish booting. Start your emulator in Android Studio Device Manager.'
do {
    $devices = @(& $adb devices | Where-Object { $_ -match '^\S+\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] })
    if ($Serial) { $devices = @($devices | Where-Object { $_ -eq $Serial }) }
    elseif ($devices.Count -gt 1) { throw 'More than one Android device is ready. Run this script with -Serial <device-id>.' }
    if ($devices.Count -eq 1) {
        $target = $devices[0]
        $booted = (& $adb -s $target shell getprop sys.boot_completed 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -eq 0 -and $booted -eq '1') {
            & $adb -s $target reverse tcp:8000 "tcp:$BackendPort"
            if ($LASTEXITCODE -ne 0) { throw 'Android is ready, but the local backend port could not be forwarded.' }
            Write-Output "Android $target is ready. App port 8000 forwards to backend port $BackendPort."
            Write-Output 'Run npm.cmd run android:launch to install the built APK and start Metro.'
            exit 0
        }
    }
    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)
& $adb devices
throw 'Android did not become ready. In Android Studio Device Manager, stop the emulator and choose Cold Boot, then retry. Do not rerun prebuild to fix an offline emulator.'
