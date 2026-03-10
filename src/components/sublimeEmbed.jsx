"use client";
import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const SublimeEmbed = ({ filePath = "file_corrente.js" }) => {
  const [code, setCode] = useState("// In attesa di modifiche da Sublime...");
  const [status, setStatus] = useState("disconnesso");

  useEffect(() => {
    // Connessione al server locale Node.js
    const socket = io('http://localhost:4000');

    socket.on('connect', () => setStatus("connesso"));
    socket.on('code-update', (newCode) => setCode(newCode));
    socket.on('disconnect', () => setStatus("disconnesso"));
    socket.on('code-update', (data) => {
  console.log("Dati ricevuti dal server:", data); // Controlla in console (F12)
  
  if (typeof data === 'string') {
    // Se il server manda solo testo
    setCode(data);
  } else if (data && data.code) {
    // Se il server manda l'oggetto completo (come nel nuovo server.js)
    setCode(data.code);
  }
});
    return () => socket.disconnect();
  }, []);

  return (
    <div style={styles.wrapper}>
      {/* Barra superiore stile Mac/Sublime */}
      <div style={styles.toolbar}>
        <div style={styles.dots}>
          <div style={{...styles.dot, backgroundColor: '#ff5f56'}}></div>
          <div style={{...styles.dot, backgroundColor: '#ffbd2e'}}></div>
          <div style={{...styles.dot, backgroundColor: '#27c93f'}}></div>
        </div>
        <div style={styles.fileName}>
           {filePath} — {status === "connesso" ? "● Live" : "○ Offline"}
        </div>
      </div>

      {/* Area del Codice */}
      <div style={styles.editorContainer}>
        <SyntaxHighlighter 
          language="javascript" 
          style={vscDarkPlus}
          customStyle={styles.codeBlock}
          showLineNumbers={true}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

const styles = {
  wrapper: {
    borderRadius: '10px',
    overflow: 'hidden',
    backgroundColor: '#1e1e1e',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    border: '1px solid #333',
    fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace'
  },
  toolbar: {
    backgroundColor: '#2d2d2d',
    padding: '10px 15px',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #3e3e3e'
  },
  dots: { display: 'flex', gap: '6px' },
  dot: { width: '10px', height: '10px', borderRadius: '50%' },
  fileName: {
    color: '#999',
    fontSize: '12px',
    marginLeft: '20px',
    textTransform: 'lowercase'
  },
  editorContainer: {
    maxHeight: '500px',
    overflowY: 'auto'
  },
  codeBlock: {
    margin: 0,
    background: 'transparent',
    fontSize: '13px'
  }
};

export default SublimeEmbed;