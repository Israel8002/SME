# SME Monitor Windows Background Task Installer
# This script registers the monitor service to run on Windows startup in the background as a Scheduled Task.
# Run this script in PowerShell as Administrator.

$ScriptPath = Join-Path (Get-Location) "dist\monitor.js"
$NodePath = (Get-Command node.exe).Source

if (-not $NodePath) {
    Write-Host "Error: Node.exe not found on PATH." -ForegroundColor Red
    Exit 1
}

Write-Host "Registering SME Monitor background service..." -ForegroundColor Cyan
Write-Host "Script: $ScriptPath"
Write-Host "Node: $NodePath"

# Define Task parameters
$TaskName = "SMEMonitorService"
$Action = New-ScheduledTaskAction -Execute $NodePath -Argument $ScriptPath -WorkingDirectory (Get-Location)
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Register Task to run as SYSTEM (unattended background service)
try {
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -User "NT AUTHORITY\SYSTEM" -Force
    Write-Host "SME Monitor background service successfully registered as Scheduled Task!" -ForegroundColor Green
    Write-Host "To start it now, run: Start-ScheduledTask -TaskName $TaskName" -ForegroundColor Yellow
} catch {
    Write-Host "Failed to register scheduled task. Ensure you are running PowerShell as Administrator." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
