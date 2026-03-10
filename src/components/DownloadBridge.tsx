'use client';

import JSZip from 'jszip';
// @ts-ignore
import { saveAs } from 'file-saver';
import { Download } from 'lucide-react';

export default function DownloadBridge({ userId }: { userId: string }) {
  const downloadPackage = async () => {
    const zip = new JSZip();

    // 1. BAT CON AUTO-INSTALLAZIONE NODE
    const setupCommand = [
      '@echo off',
      'title Sublime Bridge Auto-Setup',
      'set NODE_URL=https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi',
      'set NODE_MSI=node_installer.msi',
      ':check_node',
      'where node >nul 2>nul',
      'if %errorlevel% neq 0 (',
      '    echo [ATTENZIONE] Node.js non trovato! Scaricamento...',
      '    powershell -Command "Invoke-WebRequest -Uri \'%NODE_URL%\' -OutFile \'%NODE_MSI%\'"',
      '    msiexec /i %NODE_MSI% /passive /norestart',
      '    del %NODE_MSI%',
      '    echo [OK] Installato. Riavvia questo file.',
      '    pause',
      '    exit',
      ')',
      ':node_ok',
      'if not exist node_modules (',
      '    call npm install',
      ')',
      'node bridge.js',
      'pause'
    ].join('\r\n');

    // 2. BRIDGE CODE - Usiamo concatenazione classica per evitare conflitti Turbopack
    const bridgeCode = 
      "const io = require('socket.io-client');\n" +
      "const fs = require('fs');\n" +
      "const path = require('path');\n" +
      "const { exec } = require('child_process');\n\n" +
      "const USER_ID = '" + userId + "';\n" +
      "const SERVER_URL = 'https://sublime-bridge-server.onrender.com';\n" +
      "const socket = io(SERVER_URL);\n" +
      "const folderPath = __dirname;\n\n" +
      "socket.on('connect', () => {\n" +
      "    console.log('✅ Connesso al Cloud!');\n" +
      "    socket.emit('join-room', USER_ID);\n" +
      "    syncAllFiles();\n" +
      "});\n\n" +
      "socket.on('open-external-file', (data) => {\n" +
      "    console.log('📂 Apertura file: ' + data.fullPath);\n" +
      "    const command = process.platform === 'win32' \n" +
      "        ? 'explorer \"' + data.fullPath + '\"' \n" +
      "        : 'open \"' + data.fullPath + '\"';\n" +
      "    exec(command, (err) => {\n" +
      "        if (err) console.error('❌ Errore apertura:', err);\n" +
      "    });\n" +
      "});\n\n" +
      "function syncAllFiles() {\n" +
      "    fs.readdir(folderPath, (err, files) => {\n" +
      "        if (err) return;\n" +
      "        files.filter(f => f.endsWith('.js') && f !== 'bridge.js').forEach(file => {\n" +
      "            const filePath = path.join(folderPath, file);\n" +
      "            const content = fs.readFileSync(filePath, 'utf8');\n" +
      "            socket.emit('code-from-sublime', { \n" +
      "                userId: USER_ID, \n" +
      "                code: content, \n" +
      "                fileName: file,\n" +
      "                fullPath: filePath \n" +
      "            });\n" +
      "        });\n" +
      "    });\n" +
      "}\n\n" +
      "fs.watch(__dirname, (event, filename) => {\n" +
      "    if (filename && filename.endsWith('.js') && filename !== 'bridge.js') {\n" +
      "        const filePath = path.join(__dirname, filename);\n" +
      "        if (fs.existsSync(filePath)) {\n" +
      "            const content = fs.readFileSync(filePath, 'utf8');\n" +
      "            socket.emit('code-from-sublime', { \n" +
      "                userId: USER_ID, \n" +
      "                code: content, \n" +
      "                fileName: filename,\n" +
      "                fullPath: filePath \n" +
      "            });\n" +
      "            console.log('⚡ Sincronizzazione riuscita per:', filename);\n" +
      "        }\n" +
      "    }\n" +
      "});";

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