; ================================================================
;  VoxFlow Dialer Launcher — AutoHotkey v2
;  Ctrl+D global → Chrome mode app (comme Aircall / Kavkom)
;  Icone dans la barre des taches systeme
; ================================================================

#Requires AutoHotkey v2.0
#SingleInstance Force

CHROME  := "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
URL     := "http://localhost:3001/VoxFlow-Dialer.html"
W       := 360
H       := 700
LEFT    := 2176
TOP     := 644

; Icone tray
A_IconTip := "VoxFlow Dialer — Ctrl+D"
tray := A_TrayMenu
tray.Delete()
tray.Add("Ouvrir le Dialer", OpenDialer)
tray.Add("", 0)
tray.Add("Quitter", (*) => ExitApp())
tray.Default := "Ouvrir le Dialer"

; Raccourci global Ctrl+D
^d:: OpenDialer()

OpenDialer(*) {
    global CHROME, URL, W, H, LEFT, TOP
    ; Si deja ouvert, juste ramener au premier plan
    if WinExist("VoxFlow-Dialer") {
        WinActivate("VoxFlow-Dialer")
        return
    }
    args := '--app="' URL '" --window-size=' W ',' H ' --window-position=' LEFT ',' TOP ' --no-first-run'
    Run('"' CHROME '" ' args)
}

; Notification au demarrage
TrayTip("Ctrl+D pour ouvrir le dialer", "VoxFlow Dialer actif", 1)
