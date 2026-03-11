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
  // Inizializziamo i tab. Se vuoti, mettiamo un segnaposto.
  const [tabs, setTabs] = useState<Tab[]>(
    initialTabs.length > 0 ? initialTabs : []
  );
  const [activeTabId, setActiveTabId] = useState<number | string>(
    initialTabs[0]?.id ?? ''
  );
  const [status, setStatus] = useState<'connesso' | 'disconnesso'>('disconnesso');
  const [connectedFile, setConnectedFile] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // Memorizziamo il tab attivo
  const activeTab = useMemo(
    () => tabs.find((tab) => String(tab.id) === String(activeTabId)) || null,
    [tabs, activeTabId]
  );

  const currentCode = activeTab?.content || '// Seleziona un file o salva in Sublime per iniziare...';

  const getLanguageFromFile = (fileName: string | null): string => {
    if (!fileName) return 'javascript';
    const ext = fileName.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
      json: 'json', html: 'html', css: 'css', md: 'markdown',
      txt: 'text', py: 'python', php: 'php',
    };
    return map[ext || ''] || 'javascript';
  };

  const onCodeUpdateRef = useRef(onCodeUpdate);
  const onBridgeStatusChangeRef = useRef(onBridgeStatusChange);

  useEffect(() => {
    onCodeUpdateRef.current = onCodeUpdate;
    onBridgeStatusChangeRef.current = onBridgeStatusChange;
  });

  useEffect(() => {
    if (!userId || !bridgeActive) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setStatus('disconnesso');
      return;
    }

    const socket = io(socketUrl, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connesso');
      socket.emit('join-room', userId);
      onBridgeStatusChangeRef.current?.({ connected: true, fileName: connectedFile });
    });

    socket.on('disconnect', () => {
      setStatus('disconnesso');
      onBridgeStatusChangeRef.current?.({ connected: false, fileName: null });
    });

    socket.on('code-update', (data: any) => {
      const nextFileName = data.fileName || 'unnamed.js';
      const nextCode = data.code || '';
      const nextFullPath = data.fullPath || null;

      setConnectedFile(nextFullPath || nextFileName);

      setTabs((prev) => {
        // Rimuoviamo eventuali tab di "welcome" se stiamo ricevendo file reali
        const cleanPrev = prev.filter(t => t.id !== 'welcome.js');
        
        const exists = cleanPrev.find((t) => String(t.id) === String(nextFileName));
        let updatedTabs: Tab[];

        if (exists) {
          updatedTabs = cleanPrev.map((t) =>
            String(t.id) === String(nextFileName) ? { ...t, content: nextCode } : t
          );
        } else {
          updatedTabs = [...cleanPrev, { id: nextFileName, content: nextCode }];
        }

        onCodeUpdateRef.current?.({
          code: nextCode,
          fileName: nextFileName,
          fullPath: nextFullPath || undefined,
          tabs: updatedTabs,
          activeTabId: nextFileName,
        });

        return updatedTabs;
      });

      // Se non c'è un tab attivo o se il file aggiornato è quello appena arrivato, lo selezioniamo
      setActiveTabId((current) => current === '' ? nextFileName : current);
    });

    return () => {
      socket.disconnect();
    };
  }, [socketUrl, userId, bridgeActive]);

  const lineProps = (lineNumber: number) => {
    const line = currentCode.split('\n')[lineNumber - 1] || '';
    const matched = highlightRules.some((rule) => rule.regex.test(line));
    if (!matched) return {};
    return {
      style: {
        display: 'block',
        background: 'rgba(255,255,0,0.05)',
        borderLeft: '3px solid #eab308',
      },
    };
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar}>
        
        <div style={styles.statusBadge}>
          <span style={{ 
            ...styles.statusDot, 
            backgroundColor: status === 'connesso' ? '#27c93f' : '#ff5f56' 
          }} />
          {status}
        </div>
        <div style={styles.connectedFile}>
          {activeTab ? `Editando: ${activeTab.id}` : 'In attesa di file...'}
        </div>
      </div>

      <div style={styles.body}>
        <div style={styles.sidebar}>
          <div style={styles.sidebarTitle}>EXPLORER (NOTES)</div>
          {tabs.length === 0 ? (
            <div style={styles.emptyFiles}>Nessun file nella cartella</div>
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
                  <span style={{ marginRight: '8px', opacity: 0.5 }}>{'>'}</span>
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
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
  },
  toolbar: {
    backgroundColor: '#252526',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    borderBottom: '1px solid #333',
  },
  dots: { display: 'flex', gap: '8px' },
  dot: { width: '12px', height: '12px', borderRadius: '50%' },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#888',
  },
  statusDot: { width: '6px', height: '6px', borderRadius: '50%' },
  connectedFile: {
    color: '#e0e0e0',
    fontSize: '12px',
    marginLeft: 'auto',
    opacity: 0.8,
  },
  body: { display: 'flex', flex: 1, minHeight: 0 },
  sidebar: {
    width: '220px',
    backgroundColor: '#252526',
    borderRight: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  sidebarTitle: {
    padding: '12px',
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#666',
    letterSpacing: '1px',
  },
  emptyFiles: { padding: '20px', color: '#555', fontSize: '12px', textAlign: 'center' },
  tabButton: {
    background: 'transparent',
    color: '#969696',
    border: 'none',
    padding: '8px 16px',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s',
  },
  tabButtonActive: {
    backgroundColor: '#37373d',
    color: '#fff',
  },
  editorContainer: { flex: 1, overflow: 'hidden', backgroundColor: '#1e1e1e' },
  codeBlock: {
    margin: 0,
    padding: '20px',
    background: 'transparent !important',
    fontSize: '14px',
    height: '100%',
    lineHeight: '1.5',
  },
};

export default SublimeEmbed;