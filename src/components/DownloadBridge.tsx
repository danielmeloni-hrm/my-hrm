import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Download } from 'lucide-react';

export default function DownloadBridge({ userId }: { userId: string }) {
  const downloadPackage = async () => {
    const zip = new JSZip();

    // 1. Il file bridge.js (GIÀ CONFIGURATO!)
    const bridgeCode = `
const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

// CONFIGURAZIONE AUTOMATICA
const USER_ID = "${userId}"; 
const SERVER_URL = "https://sublime-bridge-server.onrender.com";
const FILE_TO_WATCH = path.join(__dirname, 'lavora-qui.js');

// Crea il file se non esiste
if (!fs.existsSync(FILE_TO_WATCH)) {
    fs.writeFileSync(FILE_TO_WATCH, "// Scrivi qui il tuo codice per Sublime\\n");
}

const socket = io(SERVER_URL);

console.log("🚀 Bridge avviato per l'utente: " + USER_ID);
console.log("📝 Modifica il file 'lavora-qui.js' su Sublime Text");

socket.on('connect', () => console.log("✅ Connesso al server!"));

fs.watch(FILE_TO_WATCH, (event) => {
  if (event === 'change') {
    try {
        const content = fs.readFileSync(FILE_TO_WATCH, 'utf8');
        socket.emit('code-from-sublime', { userId: USER_ID, code: content });
        console.log("⚡ Codice inviato al sito!");
    } catch(e) {}
  }
});
    `.trim();

    // 2. Il file package.json (per le dipendenze)
    const packageJson = JSON.stringify({
      name: "sublime-bridge",
      version: "1.0.0",
      main: "bridge.js",
      dependencies: { "socket.io-client": "^4.7.2" }
    }, null, 2);

    // 3. Il file di avvio rapido (Windows)
    const startBat = `
@echo off
echo Installazione dipendenze...
call npm install
echo Avvio del bridge...
node bridge.js
pause
    `.trim();

    // Aggiungi i file allo ZIP
    zip.file("bridge.js", bridgeCode);
    zip.file("package.json", packageJson);
    zip.file("AVVIA_BRIDGE.bat", startBat);
    zip.file("lavora-qui.js", "// Apri questo file con Sublime Text\n");

    // Genera e scarica
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `sublime-bridge-${userId.substring(0, 5)}.zip`);
  };

  return (
    <button 
      onClick={downloadPackage}
      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-md font-bold text-xs transition-all"
    >
      <Download size={16} />
      SCARICA SUBLIME BRIDGE
    </button>
  );
}