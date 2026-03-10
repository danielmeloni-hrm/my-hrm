'use client';

import JSZip from 'jszip';
// @ts-ignore
import { saveAs } from 'file-saver';
import { Download } from 'lucide-react';

export default function DownloadBridge({ userId }: { userId: string }) {
  const downloadPackage = async () => {
    const zip = new JSZip();

    // 1. IL FILE DI AVVIO (BAT) - Versione con Auto-Download di Node.js
    const setupCommand = `
@echo off
title Sublime Bridge Auto-Setup
set NODE_URL=https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi
set NODE_MSI=node_installer.msi

:check_node
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\\Program Files\\nodejs\\node.exe" (
        set "PATH=%PATH%;C:\\Program Files\\nodejs\\"
        goto node_ok
    )
    echo ====================================================
    echo [ATTENZIONE] Node.js non trovato! Scaricamento...
    echo ====================================================
    powershell -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_MSI%'"
    echo [INFO] Avvio installazione... Attendi il termine.
    msiexec /i %NODE_MSI% /passive /norestart
    del %NODE_MSI%
    echo.
    echo [IMPORTANTE] Installazione completata. 
    echo Chiudi questa finestra e riavvia AVVIA_BRIDGE.bat per attivare i comandi.
    pause
    exit
)

:node_ok
if not exist node_modules (
    echo [INFO] Installazione dipendenze bridge...
    call npm install
)

echo [OK] Bridge in avvio...
node bridge.js
pause
`.trim();

    const bridgeCode = `
const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process')
const USER_ID = "${userId}"; 
const SERVER_URL = "https://sublime-bridge-server.onrender.com";
const socket = io(SERVER_URL);

// Monitoriamo tutta la cartella corrente
const folderPath = __dirname;

console.log("🚀 Multi-Tab Bridge Attivo per: " + USER_ID);

socket.on('connect', () => {
    socket.emit('join-room', USER_ID);
    // Invia subito tutti i file esistenti al sito
    syncAllFiles();
});
// Ascolta l'istruzione dal sito per aprire il file
socket.on('open-file-locally', (data) => {
    console.log("📂 Apertura file richiesta: " + data.fullPath);
    // Comando per Windows (start), Mac (open) o Linux (xdg-open)
    const command = process.platform === 'win32' 
        ? 'start "" "' + data.fullPath + '"' 
        : 'open "' + data.fullPath + '"';
    exec(command);
});
// --- NUOVA LOGICA: Ascolta il comando dal sito ---
socket.on('open-file-locally', (data) => {
    console.log("📂 Richiesta apertura file: " + data.fullPath);
    // Questo comando apre il file con l'applicazione predefinita (Sublime)
    const command = process.platform === 'win32' ? 'start "" "' + data.fullPath + '"' : 'open "' + data.fullPath + '"';
    exec(command);
});
function syncAllFiles() {
    fs.readdir(folderPath, (err, files) => {
        if (err) return;
        files.filter(f => f.endsWith('.js') && f !== 'bridge.js').forEach(file => {
            const content = fs.readFileSync(path.join(folderPath, file), 'utf8');
            socket.emit('code-from-sublime', { 
                userId: USER_ID, 
                code: content, 
                fileName: file 
            });
        });
    });
}

// Guarda se aggiungi, elimini o modifichi file
fs.watch(folderPath, (event, filename) => {
    if (filename && filename.endsWith('.js') && filename !== 'bridge.js') {
        const filePath = path.join(folderPath, filename);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            socket.emit('code-from-sublime', { 
                userId: USER_ID, 
                code: content, 
                fileName: filename 
            });
            console.log("⚡ Tab aggiornata/creata: " + filename);
        }
    }
});
`.trim();

    // 3. IL FILE PACKAGE.JSON
    const packageJson = JSON.stringify({
      name: "sublime-bridge",
      version: "1.0.0",
      main: "bridge.js",
      dependencies: { "socket.io-client": "^4.7.2" }
    }, null, 2);

    // AGGIUNGIAMO TUTTO ALLO ZIP
    zip.file("bridge.js", bridgeCode);
    zip.file("package.json", packageJson);
    zip.file("AVVIA_BRIDGE.bat", setupCommand); // Usiamo setupCommand per evitare doppioni
    zip.file("lavora-qui.js", "// Inizia a scrivere qui su Sublime Text\n");

    // GENERAZIONE E DOWNLOAD
    try {
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `sublime-bridge-${userId.substring(0, 5)}.zip`);
    } catch (error) {
      console.error("Errore durante la creazione dello ZIP:", error);
    }
  };

  return (
    <button 
      onClick={downloadPackage}
      className="group relative flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-black py-3 px-4 rounded-lg font-black text-[10px] transition-all overflow-hidden shadow-lg shadow-amber-500/20 w-full"
    >
      <div className="relative flex items-center gap-2">
        <Download size={14} className="animate-bounce" />
        SCARICA SUBLIME BRIDGE
      </div>
    </button>
  );
}