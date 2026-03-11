'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { io, Socket } from 'socket.io-client';
import { Terminal, Cloud, Zap, ZapOff, AlertCircle, Download, Power } from 'lucide-react';
import DownloadBridge from '@/components/DownloadBridge';
import SublimeEmbed from '@/components/SublimeEmbed';

// --- Inizializzazione Supabase ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --- Interfacce ---
interface TicketRecord {
  n_tag: string;
  cliente: string;
  titolo: string;
  in_lavorazione_ora: boolean;
  numero_priorita?: number;
  rilascio_in_collaudo?: string | null;
  rilascio_in_produzione?: string | null;
  note?: string;
}

interface Tab {
  id: number | string;
  content: string;
}

export default function SublimeSupabaseEditor() {
  const [connectedFile, setConnectedFile] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | string>(0);
  const [allTickets, setAllTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');
  const [localStreamStatus, setLocalStreamStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [isBridgeActive, setIsBridgeActive] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const syncTimeoutRef = useRef<Record<number, NodeJS.Timeout>>({});

  const activeTab = useMemo(
    () => tabs.find(t => t.id === activeTabId) || tabs[0] || null,
    [tabs, activeTabId]
  );

  const fetchData = useCallback(async () => {
    try {
      const { data: tData } = await supabase
        .from('ticket')
        .select(`n_tag, titolo, in_lavorazione_ora, numero_priorita, clienti ( nome )`)
        .order('n_tag', { ascending: false });

      if (tData) {
        const formattedData = tData.map(t => ({
          n_tag: String(t.n_tag || '').trim(),
          titolo: String(t.titolo || '').trim(),
          in_lavorazione_ora: Boolean(t.in_lavorazione_ora),
          numero_priorita: (t as any).numero_priorita,
          cliente: t.clienti ? String((t.clienti as any).nome).trim() : ''
        }));
        setAllTickets(formattedData);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, []);

  const isValidDate = (dateStr: string) => {
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (!match) return false;

    const d = parseInt(match[1]);
    const m = parseInt(match[2]) - 1;
    const y = match[3]
      ? match[3].length === 2
        ? 2000 + parseInt(match[3])
        : parseInt(match[3])
      : new Date().getFullYear();

    const date = new Date(y, m, d);
    return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d;
  };

  const parseDateToISO = (dateStr: string) => {
    const parts = dateStr.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    let y = parts[2] || new Date().getFullYear().toString();
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  };

  const syncTicketData = useCallback(async (allLines: string[], startIndex: number) => {
    const firstLine = allLines[startIndex];
    const clientMatch = firstLine.match(/@([^\s]+)/);
    const tagMatch = firstLine.match(/#([\w\d]+)/);
    const titleMatch = firstLine.match(/"(.*?)"/);

    if (!clientMatch) return;

    const clientName = clientMatch[1].toLowerCase();
    const tag = tagMatch ? tagMatch[1].toUpperCase() : null;
    const title = titleMatch ? titleMatch[1] : null;

    const multiLineNote: string[] = [];
    const firstLineClean = firstLine
      .replace(/@([^\s]+)/g, '')
      .replace(/#([\w\d]+)/g, '')
      .replace(/"(.*?)"/g, '')
      .replace(/\(coll:.*?\)/g, '')
      .replace(/\(prod:.*?\)/g, '')
      .replace(/\[perc:.*?\]/g, '')
      .trim();

    if (firstLineClean) multiLineNote.push(firstLineClean);

    for (let i = startIndex + 1; i < allLines.length; i++) {
      if (allLines[i].includes('@')) break;
      const content = allLines[i].trim();
      if (content) multiLineNote.push(content);
    }

    const finalNote = multiLineNote.join('\n');
    let queryField = '';
    let queryValue = '';

    if (clientName === 'esselunga') {
      if (!tag) return;
      queryField = 'n_tag';
      queryValue = tag;
    } else {
      if (!title) return;
      queryField = 'titolo';
      queryValue = title;
    }

    const updates: any = { note: finalNote };

    const percMatch = firstLine.match(/\[perc:\s*([^\]]+)\]/);
    if (percMatch) {
      const val = percMatch[1].trim().toLowerCase();
      if (val === 'null') {
        updates.percentuale_avanzamento = null;
      } else {
        const num = parseInt(val.replace('%', ''));
        if (!isNaN(num)) updates.percentuale_avanzamento = num;
      }
    }

    const collMatch = firstLine.match(/\(coll:\s*([^)]+)\)/);
    const prodMatch = firstLine.match(/\(prod:\s*([^)]+)\)/);

    if (collMatch && isValidDate(collMatch[1])) {
      updates.rilascio_in_collaudo = parseDateToISO(collMatch[1]);
    }

    if (prodMatch && isValidDate(prodMatch[1])) {
      updates.rilascio_in_produzione = parseDateToISO(prodMatch[1]);
    }

    setSaveStatus('saving');

    try {
      const { error } = await supabase
        .from('ticket')
        .update(updates)
        .eq(queryField, queryValue);

      if (!error) {
        setSaveStatus('saved');
        setAllTickets(prev =>
          prev.map(t => {
            const isMatch =
              queryField === 'n_tag'
                ? t.n_tag === queryValue
                : t.titolo === queryValue;

            return isMatch ? { ...t, ...updates } : t;
          })
        );
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      let storedId = localStorage.getItem('sublime_user_id');
      if (!storedId) {
        storedId = 'user_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('sublime_user_id', storedId);
      }
      setUserId(storedId);

      await fetchData();

      const savedTabs = localStorage.getItem('sublime_tabs');
      if (savedTabs) {
        try {
          const parsedTabs = JSON.parse(savedTabs);
          if (parsedTabs.length > 0) {
            setTabs(parsedTabs);
            setActiveTabId(parsedTabs[0].id);
          } else {
            const defaultTab = { id: Date.now(), content: '// Inizia a scrivere...\n' };
            setTabs([defaultTab]);
            setActiveTabId(defaultTab.id);
          }
        } catch (e) {
          console.error('Errore parsing tabs', e);
        }
      } else {
        const defaultTab = { id: Date.now(), content: '// Benvenuto!\n' };
        setTabs([defaultTab]);
        setActiveTabId(defaultTab.id);
      }

      setLoading(false);
    };

    init();
  }, [fetchData]);

  useEffect(() => {
    localStorage.setItem('sublime_tabs', JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    if (!userId || !isBridgeActive) {
      socketRef.current?.disconnect();
      setLocalStreamStatus('disconnected');
      setConnectedFile(null);
      return;
    }

    socketRef.current = io('https://sublime-bridge-server.onrender.com');

    socketRef.current.on('connect', () => {
      setLocalStreamStatus('connected');
      socketRef.current?.emit('join-room', userId);
    });

    socketRef.current.on('disconnect', () => {
      setLocalStreamStatus('disconnected');
      setConnectedFile(null);
    });

    socketRef.current.on('bridge-status', (status: { fileName: string }) => {
      setConnectedFile(status.fileName);
      setLocalStreamStatus('connected');
    });

    socketRef.current.on('code-update', (data: any) => {
      if (data.fullPath) setConnectedFile(data.fullPath);

      const currentCode = data.code || '';
      const lines = currentCode.split('\n');

      lines.forEach((line: string, idx: number) => {
        if (line.includes('@')) {
          if (syncTimeoutRef.current[idx]) clearTimeout(syncTimeoutRef.current[idx]);
          syncTimeoutRef.current[idx] = setTimeout(() => {
            syncTicketData(lines, idx);
          }, 600);
        }
      });

      setTabs(prev => {
        const tabId = data.fileName || 'lavora-qui.js';
        const exists = prev.find(t => String(t.id) === String(tabId));

        if (exists) {
          return prev.map(t =>
            String(t.id) === String(tabId) ? { ...t, content: currentCode } : t
          );
        }

        return [...prev, { id: tabId, content: currentCode }];
      });

      setActiveTabId(data.fileName || 'lavora-qui.js');
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [userId, isBridgeActive, syncTicketData]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#1e1e1e] text-white flex items-center justify-center font-mono">
        Caricamento...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full font-mono overflow-hidden bg-[#1e1e1e] text-[#d4d4d4]">
      <div className="w-64 border-r flex flex-col shrink-0 bg-[#181818] border-[#121212]">
        <div className="p-4 border-b border-black/10 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {localStreamStatus === 'connected' ? (
              <Zap size={14} className="text-green-500" />
            ) : (
              <ZapOff size={14} className="text-red-500" />
            )}
            <span className="text-[10px] font-bold uppercase tracking-tighter">
              Sublime Bridge: {localStreamStatus}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Cloud size={14} className="text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">
              Supabase Cloud: OK
            </span>
          </div>
        </div>

        

       
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2 border-b border-black/10 bg-[#111] text-[11px] flex items-center justify-between">
          <span className="opacity-70">
            {activeTab ? `Tab attiva: ${String(activeTab.id)}` : 'Nessuna tab attiva'}
          </span>
          <span className="opacity-50">
            {connectedFile ? connectedFile.split('\\').pop()?.split('/').pop() : 'Nessun file collegato'}
          </span>
        </div>

        <SublimeEmbed
  tabs={tabs}
  activeTabId={activeTabId}
  onSelectTab={setActiveTabId}
  status={localStreamStatus === 'connected' ? 'connesso' : 'disconnesso'}
/>

        <div
          className={`h-7 flex items-center justify-between px-3 text-[9px] font-black uppercase shrink-0 ${
            saveStatus === 'saving' ? 'bg-amber-600' : 'bg-[#007acc]'
          } text-white`}
        >
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1">
              <Cloud size={10} />
              {saveStatus === 'saving' ? 'Cloud Syncing...' : 'Cloud Synced'}
            </span>

            {localStreamStatus === 'connected' && (
              <span className="flex items-center gap-2 text-green-300">
                <Terminal size={10} className="shrink-0" />
                <span className="flex gap-1 items-baseline">
                  <span>Live from Sublime:</span>
                  <span className="text-white italic lowercase opacity-80 truncate max-w-[400px]">
                    {connectedFile ? connectedFile : 'In attesa di modifiche...'}
                  </span>
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}