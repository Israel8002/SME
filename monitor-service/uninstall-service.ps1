# SME Monitor Windows Background Task Uninstaller
# Run this script in PowerShell as Administrator.

$TaskName = "SMEMonitorService"

Write-Host "Unregistering SME Monitor background service..." -ForegroundColor Cyan

try {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "SME Monitor background service successfully unregistered!" -ForegroundColor Green
} catch {
    Write-Host "Failed to unregister task. Ensure you are running PowerShell as Administrator." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
