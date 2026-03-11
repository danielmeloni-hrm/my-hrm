"use client";

import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";

type Tab = {
  id: number | string;
  content: string;
};

type SublimeEmbedProps = {
  socketUrl: string;
  tabs: Tab[];
  activeTabId: number | string;
  onSelectTab: (id: number | string) => void;
  status?: "connesso" | "disconnesso";
};

const SublimeEmbed = ({
  socketUrl,
  tabs,
  activeTabId,
  onSelectTab,
  status = "disconnesso",
}: SublimeEmbedProps) => {
  const activeTab =
    tabs.find((tab) => String(tab.id) === String(activeTabId)) || tabs[0] || null;

  const currentCode = activeTab?.content || "// In attesa di file da Sublime...";

  const getLanguageFromFile = (fileName: string | null): string => {
    if (!fileName) return "text";

    const ext = fileName.split(".").pop()?.toLowerCase();

    const map: Record<string, string> = {
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

    return map[ext || ""] || "text";
  };

  return (
    <div style={styles.wrapper}>
      

        <div style={styles.editorContainer}>
          <SyntaxHighlighter
            language={getLanguageFromFile(activeTab ? String(activeTab.id) : null)}
            style={vscDarkPlus}
            customStyle={styles.codeBlock}
            showLineNumbers
          >
            {currentCode}
          </SyntaxHighlighter>
        </div>
      
    </div>
    
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    borderRadius: "12px",
    overflow: "hidden",
    backgroundColor: "#1e1e1e",
    border: "1px solid #333",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    height: "100%",
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
    height: "calc(100% - 41px)",
  },
  sidebar: {
    width: "240px",
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
    overflowY: "auto",
  },
  codeBlock: {
    margin: 0,
    background: "transparent",
    fontSize: "13px",
    minHeight: "100%",
  },
};

export default SublimeEmbed;