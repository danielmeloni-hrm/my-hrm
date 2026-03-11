'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

type Tab = {
  id: number | string;
  content: string;
};

type HighlightRule = {
  name: string;
  regex: RegExp;
  className?: string;
};

type SublimeEmbedProps = {
  socketUrl: string;
  userId: string;
  bridgeActive: boolean;
  initialTabs?: Tab[];
  onCodeUpdate?: (payload: {
    code: string;
    fileName: string;
    fullPath?: string;
    tabs: Tab[];
    activeTabId: string | number;
  }) => void;
  onBridgeStatusChange?: (status: {
    connected: boolean;
    fileName: string | null;
  }) => void;
  highlightRules?: HighlightRule[];
};

const SublimeEmbed = ({
  socketUrl,
  userId,
  bridgeActive,
  initialTabs = [],
  onCodeUpdate,
  onBridgeStatusChange,
  highlightRules = [],
}: SublimeEmbedProps) => {
  const [tabs, setTabs] = useState<Tab[]>(
    initialTabs.length > 0
      ? initialTabs
      : [{ id: 'welcome.js', content: '// In attesa di file da Sublime...\n' }]
  );
  const [activeTabId, setActiveTabId] = useState<number | string>(
    initialTabs[0]?.id ?? 'welcome.js'
  );
  const [status, setStatus] = useState<'connesso' | 'disconnesso'>('disconnesso');
  const [connectedFile, setConnectedFile] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => String(tab.id) === String(activeTabId)) || tabs[0] || null,
    [tabs, activeTabId]
  );

  const currentCode = activeTab?.content || '// In attesa di file da Sublime...';

  const getLanguageFromFile = (fileName: string | null): string => {
    if (!fileName) return 'text';

    const ext = fileName.split('.').pop()?.toLowerCase();

    const map: Record<string, string> = {
      js: 'javascript',
      jsx: 'jsx',
      ts: 'typescript',
      tsx: 'tsx',
      json: 'json',
      html: 'html',
      css: 'css',
      md: 'markdown',
      txt: 'text',
      py: 'python',
      php: 'php',
      java: 'java',
      sql: 'sql',
      yml: 'yaml',
      yaml: 'yaml',
      xml: 'xml',
    };

    return map[ext || ''] || 'text';
  };

  // 1. Crea i ref per mantenere le callback aggiornate senza triggerare useEffect
const onCodeUpdateRef = useRef(onCodeUpdate);
const onBridgeStatusChangeRef = useRef(onBridgeStatusChange);

// 2. Aggiorna i ref ogni volta che il componente renderizza
useEffect(() => {
  onCodeUpdateRef.current = onCodeUpdate;
  onBridgeStatusChangeRef.current = onBridgeStatusChange;
});

useEffect(() => {
  if (!userId || !bridgeActive) {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setStatus('disconnesso');
    setConnectedFile(null);
    onBridgeStatusChangeRef.current?.({ connected: false, fileName: null });
    return;
  }

  const socket = io(socketUrl, {
    transports: ['websocket'],
  });

  socketRef.current = socket;

  socket.on('connect', () => {
    setStatus('connesso');
    socket.emit('join-room', userId);
    onBridgeStatusChangeRef.current?.({
      connected: true,
      fileName: connectedFile, // Qui usiamo il valore al momento della connessione
    });
  });

  socket.on('disconnect', () => {
    setStatus('disconnesso');
    setConnectedFile(null);
    onBridgeStatusChangeRef.current?.({ connected: false, fileName: null });
  });

  socket.on('bridge-status', (payload: { fileName: string }) => {
    setConnectedFile(payload.fileName);
    onBridgeStatusChangeRef.current?.({
      connected: true,
      fileName: payload.fileName,
    });
  });

  socket.on('code-update', (data: any) => {
    const nextFileName = data.fileName || 'lavora-qui.js';
    const nextCode = data.code || '';
    const nextFullPath = data.fullPath || null;

    setConnectedFile(nextFullPath || nextFileName);

    setTabs((prev) => {
      const exists = prev.find((t) => String(t.id) === String(nextFileName));
      let updatedTabs: Tab[];

      if (exists) {
        updatedTabs = prev.map((t) =>
          String(t.id) === String(nextFileName) ? { ...t, content: nextCode } : t
        );
      } else {
        updatedTabs = [...prev, { id: nextFileName, content: nextCode }];
      }

      // Chiamiamo la callback dal REF
      onCodeUpdateRef.current?.({
        code: nextCode,
        fileName: nextFileName,
        fullPath: nextFullPath || undefined,
        tabs: updatedTabs,
        activeTabId: nextFileName,
      });

      return updatedTabs;
    });

    setActiveTabId(nextFileName);
  });

  return () => {
    socket.disconnect();
    socketRef.current = null;
  };
  // NOTA: Abbiamo rimosso le callback e connectedFile dalle dipendenze!
  // La socket si riavvia solo se cambia URL, User o se accendi/spegni il bridge.
}, [socketUrl, userId, bridgeActive]);

  const lineProps = (lineNumber: number) => {
    const line = currentCode.split('\n')[lineNumber - 1] || '';

    const matched = highlightRules.some((rule) => rule.regex.test(line));

    if (!matched) return {};

    return {
      style: {
        display: 'block',
        background: 'rgba(255,255,0,0.08)',
        borderLeft: '3px solid rgba(255,255,0,0.45)',
      },
    };
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar}>
        <div style={styles.dots}>
          <div style={{ ...styles.dot, backgroundColor: '#ff5f56' }} />
          <div style={{ ...styles.dot, backgroundColor: '#ffbd2e' }} />
          <div style={{ ...styles.dot, backgroundColor: '#27c93f' }} />
        </div>

        <div style={styles.fileName}>
          {status} {activeTab ? `• ${String(activeTab.id)}` : ''}
        </div>

        <div style={styles.connectedFile}>
          {connectedFile
            ? connectedFile.split('\\').pop()?.split('/').pop()
            : 'Nessun file collegato'}
        </div>
      </div>

      <div style={styles.body}>
        <div style={styles.sidebar}>
          {tabs.length === 0 ? (
            <div style={styles.emptyFiles}>Nessun file ricevuto</div>
          ) : (
            tabs.map((tab) => {
              const isActive = String(tab.id) === String(activeTabId);

              return (
                <button
                  key={String(tab.id)}
                  onClick={() => setActiveTabId(tab.id)}
                  style={{
                    ...styles.tabButton,
                    ...(isActive ? styles.tabButtonActive : {}),
                  }}
                >
                  {String(tab.id)}
                </button>
              );
            })
          )}
        </div>

        <div style={styles.editorContainer}>
          <SyntaxHighlighter
            language={getLanguageFromFile(activeTab ? String(activeTab.id) : null)}
            style={vscDarkPlus}
            customStyle={styles.codeBlock}
            showLineNumbers
            wrapLines
            lineProps={lineProps}
          >
            {currentCode}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#1e1e1e',
    border: '1px solid #333',
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  toolbar: {
    backgroundColor: '#2d2d2d',
    padding: '10px 15px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    borderBottom: '1px solid #3e3e3e',
  },
  dots: {
    display: 'flex',
    gap: '6px',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  fileName: {
    color: '#ccc',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  connectedFile: {
    color: '#888',
    fontSize: '12px',
    marginLeft: 'auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '45%',
  },
  body: {
    display: 'flex',
    height: '100%',
    minHeight: 0,
  },
  sidebar: {
    width: '240px',
    backgroundColor: '#181818',
    borderRight: '1px solid #2c2c2c',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
  },
  emptyFiles: {
    color: '#777',
    fontSize: '12px',
  },
  tabButton: {
    background: 'transparent',
    color: '#bbb',
    border: '1px solid transparent',
    borderRadius: '8px',
    padding: '10px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '12px',
  },
  tabButtonActive: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    border: '1px solid #3a3a3a',
  },
  editorContainer: {
    flex: 1,
    overflowY: 'auto',
    minWidth: 0,
  },
  codeBlock: {
    margin: 0,
    background: 'transparent',
    fontSize: '13px',
    minHeight: '100%',
  },
};

export default SublimeEmbed;