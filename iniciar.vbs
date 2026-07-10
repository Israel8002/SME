Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Obtener la ruta del directorio donde esta guardado este script (C:\SME)
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Forzar el directorio de trabajo al del script para resolucion de rutas relativas
WshShell.CurrentDirectory = scriptDir

' Comprobar si existe node portable en bin/node.exe, de lo contrario usar node del sistema
nodePath = "node"
If fso.FileExists(scriptDir & "\bin\node.exe") Then
    nodePath = """" & scriptDir & "\bin\node.exe" & """"
ElseIf fso.FileExists("C:\Program Files\nodejs\node.exe") Then
    nodePath = """C:\Program Files\nodejs\node.exe"""
End If

' Iniciar el Servidor API REST (sirve el Backend y el Frontend en el puerto 3001)
WshShell.Run nodePath & " " & """" & scriptDir & "\backend-api\dist\server.js" & """", 0, False

' Iniciar el Servicio Monitor de Pings en segundo plano
WshShell.Run nodePath & " " & """" & scriptDir & "\monitor-service\dist\monitor.js" & """", 0, False

' Esperar 2.5 segundos para dar tiempo a inicializar y abrir el navegador
WScript.Sleep 2500
WshShell.Run "cmd /c start http://localhost:3001", 0, False
