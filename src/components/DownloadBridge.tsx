'use client';

import JSZip from 'jszip';
// @ts-ignore
import { saveAs } from 'file-saver';
import { Download } from 'lucide-react';

export default function DownloadBridge({ userId }: { userId: string }) {
  const downloadPackage = async () => {
    const zip = new JSZip();

    // 1. BAT CON AUTO-INSTALLAZIONE NODE
    const setupCommand = `
@echo off
title Sublime Bridge Auto-Setup
set NODE_URL=https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi
set NODE_MSI=node_installer.msi
:check_node
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ATTENZIONE] Node.js non trovato! Scaricamento...
    powershell -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_MSI%'"
    msiexec /i %NODE_MSI% /passive /norestart
    del %NODE_MSI%
    echo [OK] Installato. Riavvia questo file.
    pause
    exit
)
:node_ok
if not exist node_modules (
    call npm install
)
node bridge.js
pause`.trim();

    // 2. BRIDGE CODE CORRETTO
    const bridgeCode = `
const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const USER_ID = "${userId}"; 
const SERVER_URL = "https://sublime-bridge-server.onrender.com";
const socket = io(SERVER_URL);
const folderPath = __dirname;

socket.on('connect', () => {
    console.log("✅ Connesso al Cloud!");
    socket.emit('join-room', USER_ID);
    syncAllFiles();
});

// ASCOLTA IL COMANDO DI APERTURA
socket.on('open-external-file', (data) => {
    console.log("📂 Apertura file: " + data.fullPath);
    
    // Per Windows, usiamo explorer /select per evidenziare il file
    // oppure explorer senza /select per aprirlo con l'app predefinita
    const command = process.platform === 'win32' 
        ? `explorer "${data.fullPath}"` 
        : `open "${data.fullPath}"`;
        
    exec(command, (err) => {
        if (err) console.error("❌ Errore apertura:", err);
    });
});

function syncAllFiles() {
    fs.readdir(folderPath, (err, files) => {
        if (err) return;
        files.filter(f => f.endsWith('.js') && f !== 'bridge.js').forEach(file => {
            const filePath = path.join(folderPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            socket.emit('code-from-sublime', { 
                userId: USER_ID, 
                code: content, 
                fileName: file,
                fullPath: filePath 
            });
        });
    });
}

fs.watch(__dirname, (event, filename) => {
    if (filename && filename.endsWith('.js') && filename !== 'bridge.js') {
        const filePath = path.join(__dirname, filename);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            socket.emit('code-from-sublime', { 
                userId: USER_ID, 
                code: content, 
                fileName: filename,
                fullPath: filePath 
            });
            console.log("⚡ Sincronizzazione riuscita per:", filename);
        }
    }
});`.trim();

    const packageJson = JSON.stringify({
      name: "sublime-bridge",
      version: "1.0.0",
      main: "bridge.js",
      dependencies: { "socket.io-client": "^4.7.2" }
    }, null, 2);

    zip.file("bridge.js", bridgeCode);
    zip.file("package.json", packageJson);
    zip.file("AVVIA_BRIDGE.bat", setupCommand);
    zip.file("lavora-qui.js", "// Inizia a scrivere qui\n");

    try {
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `sublime-bridge-${userId.substring(0, 5)}.zip`);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <button onClick={downloadPackage} className="bg-amber-500 hover:bg-amber-600 text-black py-3 px-4 rounded-lg font-black text-[10px] w-full flex items-center justify-center gap-2">
      <Download size={14} className="animate-bounce" />
      SCARICA SUBLIME BRIDGE
    </button>
  );
}