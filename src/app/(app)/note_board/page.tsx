'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Cloud, Zap, ZapOff } from 'lucide-react';
import SublimeEmbed from '@/components/SublimeEmbed';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

export default function SublimeSupabaseEditor() {
  const [userId, setUserId] = useState('');
  const [allTickets, setAllTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [connectedFile, setConnectedFile] = useState<string | null>(null);

  const syncTimeoutRef = useRef<Record<number, NodeJS.Timeout>>({});

  const fetchData = useCallback(async () => {
    try {
      const { data: tData } = await supabase
        .from('ticket')
        .select(`n_tag, titolo, in_lavorazione_ora, numero_priorita, clienti ( nome )`)
        .order('n_tag', { ascending: false });

      if (tData) {
        const formattedData = tData.map((t) => ({
          n_tag: String(t.n_tag || '').trim(),
          titolo: String(t.titolo || '').trim(),
          in_lavorazione_ora: Boolean(t.in_lavorazione_ora),
          numero_priorita: (t as any).numero_priorita,
          cliente: t.clienti ? String((t.clienti as any).nome).trim() : '',
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
        setAllTickets((prev) =>
          prev.map((t) => {
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
      setLoading(false);
    };

    init();
  }, [fetchData]);
  const handleBridgeStatusChange = useCallback(({ connected, fileName }: { connected: boolean; fileName: string | null }) => {
    setBridgeConnected(connected);
    setConnectedFile(fileName);
  }, []);
  const handleCodeUpdate = useCallback(
    ({ code, fileName, fullPath }: { code: string; fileName: string; fullPath?: string }) => {
      const lines = code.split('\n');

      lines.forEach((line, idx) => {
        if (line.includes('@')) {
          if (syncTimeoutRef.current[idx]) {
            clearTimeout(syncTimeoutRef.current[idx]);
          }

          syncTimeoutRef.current[idx] = setTimeout(() => {
            syncTicketData(lines, idx);
          }, 600);
        }
      });

      setConnectedFile(fullPath || fileName);
    },
    [syncTicketData]
  );

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#1e1e1e] text-white flex items-center justify-center font-mono">
        Caricamento...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full font-mono overflow-hidden bg-[#1e1e1e] text-[#d4d4d4]">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 min-h-0 p-1">
          <SublimeEmbed
            socketUrl="https://sublime-bridge-server.onrender.com"
            userId={userId}
            bridgeActive={true}
            onCodeUpdate={({ code, fileName, tabs }) => {
    console.log("Nuovo codice ricevuto:", code);}}
            onBridgeStatusChange={handleBridgeStatusChange} // Usa la funzione stabile definita sopra
            highlightRules={[
              { name: 'cliente', regex: /@([^\s]+)/ },
              { name: 'tag', regex: /#([\w\d]+)/ },
              { name: 'title', regex: /"(.*?)"/ },
              { name: 'collaudo', regex: /\(coll:\s*([^)]+)\)/ },
              { name: 'produzione', regex: /\(prod:\s*([^)]+)\)/ },
              { name: 'percentuale', regex: /\[perc:\s*([^\]]+)\]/ },
              { name: 'in_lavorazione', regex: /\{ora\}/ },
            ]}
          />
        </div>
        <div
          className={`h-7 flex items-center justify-between px-3 text-[9px] font-black uppercase shrink-0 ${
            saveStatus === 'saving' ? 'bg-amber-600' : 'bg-[#007acc]'
          } text-white`}
        >
        
          <div className="flex items-center gap-2">
            {bridgeConnected ? (
              <Zap size={14} className="text-green-500" />
            ) : (
              <ZapOff size={14} className="text-red-500" />
            )}
            <span className="text-[10px] font-bold uppercase tracking-tighter">
              Sublime Bridge: {bridgeConnected ? 'connected' : 'disconnected'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Cloud size={14} className="text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">
              Supabase Cloud: OK
            </span>
          </div>
        

       
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1">
              <Cloud size={10} />
              {saveStatus === 'saving' ? 'Cloud Syncing...' : 'Cloud Synced'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}