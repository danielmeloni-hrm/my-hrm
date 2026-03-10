"use client";

import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

const SublimeEmbed = ({
  socketUrl = "https://sublime-bridge-server.onrender.com",
}) => {
  const [files, setFiles] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState("disconnesso");

  useEffect(() => {
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("Socket connessa:", socket.id);
      setStatus("connesso");
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnessa:", reason);
      setStatus("disconnesso");
    });

    socket.on("connect_error", (err) => {
      console.error("Errore connessione socket:", err.message);
      setStatus("disconnesso");
    });

    socket.on("code-update", (data) => {
      console.log("Evento code-update ricevuto:", data);

      if (typeof data === "string") {
        setFiles((prev) => ({
          ...prev,
          "live_file.txt": data,
        }));
        setSelectedFile((prev) => prev || "live_file.txt");
        return;
      }

      if (!data || !data.filePath) return;

      setFiles((prev) => ({
        ...prev,
        [data.filePath]: data.code || "// Nessun contenuto",
      }));

      setSelectedFile((prev) => prev || data.filePath);
    });

    return () => {
  socket.disconnect();
};
  }, [socketUrl]);

  const fileNames = useMemo(() => Object.keys(files).sort(), [files]);

  const currentCode = selectedFile
    ? files[selectedFile]
    : "// In attesa di file da Sublime...";

  const getLanguageFromFile = (fileName) => {
    if (!fileName) return "javascript";
    const ext = fileName.split(".").pop()?.toLowerCase();

    const map = {
      js: "javascript",
      jsx: "jsx",
      ts: "typescript",
      tsx: "tsx",
      json: "json",
      html: "html",
      css: "css",
      md: "markdown",
      txt: "text",
    };

    return map[ext] || "javascript";
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar}>
        <div style={styles.dots}>
          <div style={{ ...styles.dot, backgroundColor: "#ff5f56" }} />
          <div style={{ ...styles.dot, backgroundColor: "#ffbd2e" }} />
          <div style={{ ...styles.dot, backgroundColor: "#27c93f" }} />
        </div>

        <div style={styles.fileName}>
          {selectedFile || "nessun file"} — {status === "connesso" ? "● Live" : "○ Offline"}
        </div>
      </div>

      <div style={styles.body}>
        <div style={styles.sidebar}>
          {fileNames.length === 0 ? (
            <div style={styles.emptyFiles}>Nessun file ricevuto</div>
          ) : (
            fileNames.map((file) => (
              <button
                key={file}
                onClick={() => setSelectedFile(file)}
                style={{
                  ...styles.tabButton,
                  ...(selectedFile === file ? styles.tabButtonActive : {}),
                }}
              >
                {file}
              </button>
            ))
          )}
        </div>

        <div style={styles.editorContainer}>
          <SyntaxHighlighter
            language={getLanguageFromFile(selectedFile)}
            style={vscDarkPlus}
            customStyle={styles.codeBlock}
            showLineNumbers
          >
            {currentCode}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
};

const styles = {
  wrapper: {
    borderRadius: "12px",
    overflow: "hidden",
    backgroundColor: "#1e1e1e",
    border: "1px solid #333",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  },
  toolbar: {
    backgroundColor: "#2d2d2d",
    padding: "10px 15px",
    display: "flex",
    alignItems: "center",
    borderBottom: "1px solid #3e3e3e",
  },
  dots: {
    display: "flex",
    gap: "6px",
  },
  dot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
  },
  fileName: {
    color: "#999",
    fontSize: "12px",
    marginLeft: "20px",
  },
  body: {
    display: "flex",
    minHeight: "520px",
  },
  sidebar: {
    width: "220px",
    backgroundColor: "#181818",
    borderRight: "1px solid #2c2c2c",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    overflowY: "auto",
  },
  emptyFiles: {
    color: "#777",
    fontSize: "12px",
  },
  tabButton: {
    background: "transparent",
    color: "#bbb",
    border: "1px solid transparent",
    borderRadius: "8px",
    padding: "10px 12px",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "12px",
  },
  tabButtonActive: {
    backgroundColor: "#2a2a2a",
    color: "#fff",
    border: "1px solid #3a3a3a",
  },
  editorContainer: {
    flex: 1,
    maxHeight: "520px",
    overflowY: "auto",
  },
  codeBlock: {
    margin: 0,
    background: "transparent",
    fontSize: "13px",
    minHeight: "520px",
  },
};

export default SublimeEmbed;