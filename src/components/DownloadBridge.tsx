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

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ====================================================
    echo [ATTENZIONE] Node.js non trovato!
    echo Sto scaricando l'installer automatico per te...
    echo ====================================================
    
    :: Usa PowerShell per scaricare l'MSI
    powershell -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_MSI%'"
    
    echo [INFO] Download completato. Avvio installazione...
    echo IMPORTANTE: Accetta le conferme di Windows e clicca sempre 'Avanti'.
    
    :: Avvia l'installazione e aspetta che finisca
    msiexec /i %NODE_MSI% /passive /norestart
    
    echo [OK] Installazione finita. 
    echo Per rendere attive le modifiche, devo riavviare questo terminale.
    echo Premi un tasto, poi riapri AVVIA_BRIDGE.bat
    del %NODE_MSI%
    pause
    exit
)

:: Se Node c'e', installa le dipendenze se manca la cartella node_modules
if not exist node_modules (
    echo [INFO] Installazione dipendenze bridge...
    call npm install
)

echo [OK] Pronto! Avvio sincronizzazione...
node bridge.js
pause
`.trim();

    // 2. IL CODICE DEL BRIDGE (JS)
    const bridgeCode = `
const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const USER_ID = "${userId}"; 
const SERVER_URL = "https://sublime-bridge-server.onrender.com";
const FILE_TO_WATCH = path.join(__dirname, 'lavora-qui.js');

if (!fs.existsSync(FILE_TO_WATCH)) {
    fs.writeFileSync(FILE_TO_WATCH, "// Apri questo file con Sublime Text...\\n");
}

const socket = io(SERVER_URL);
console.log("🚀 Bridge Attivo per: " + USER_ID);

socket.on('connect', () => {
    console.log("✅ Connesso al Cloud!");
    socket.emit('join-room', USER_ID);
    socket.emit('bridge-status', { 
      fileName: path.basename(FILE_TO_WATCH)
    });
});

fs.watch(FILE_TO_WATCH, (event) => {
  if (event === 'change') {
    try {
        const content = fs.readFileSync(FILE_TO_WATCH, 'utf8');
        socket.emit('code-from-sublime', { userId: USER_ID, code: content });
        console.log("⚡ Sincronizzato!");
    } catch(e) {}
  }
});`.trim();

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