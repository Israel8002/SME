@echo off
title Detener SME Monitor
color 0c
echo ==============================================
echo  DETENIENDO TODOS LOS SERVICIOS DE SME MONITOR
echo ==============================================
echo.
taskkill /f /im node.exe
echo.
echo ==============================================
echo  Los servicios han sido detenidos exitosamente.
echo ==============================================
timeout /t 3
