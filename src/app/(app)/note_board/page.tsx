'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { io, Socket } from 'socket.io-client';
import { Terminal, Cloud, CloudOff, Zap, ZapOff,AlertCircle, Download} from 'lucide-react';

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
  id: number;
  content: string;
}

const SPECIAL_PARAMS = [
  { label: 'Cliente', value: '@' },
  { label: 'Numero Ticket', value: '#' },
  { label: 'Data Collaudo', value: '(coll: dd/mm)' },
  { label: 'Data Produzione', value: '(prod: dd/mm)' },
  { label: 'Reset Collaudo', value: '(coll: null)' },
  { label: 'Reset Produzione', value: '(prod: null)' },
  { label: 'Percentuale', value: '[perc: 0%]' },
  { label: 'Reset Percentuale', value: '[perc: Null]' },
];

export default function SublimeSupabaseEditor() {
  // --- State ---
  const [connectedFile, setConnectedFile] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<number>(0);
  const [showLegend, setShowLegend] = useState(true);
  const [clients, setClients] = useState<string[]>([]);
  const [tickets, setTickets] = useState<string[]>([]);
  const [allTickets, setAllTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');
  const [localStreamStatus, setLocalStreamStatus] = useState<'connected' | 'disconnected'>('disconnected');

  const [workingRows, setWorkingRows] = useState<Record<number, boolean>>({});
  const [workingLoadingByTag, setWorkingLoadingByTag] = useState<Record<string, boolean>>({});
  const [syncingRows, setSyncingRows] = useState<{ [key: number]: boolean }>({});

  const [menu, setMenu] = useState<{
    open: boolean;
    type: 'client' | 'ticket' | 'param' | 'title';
    filter: string;
    selectedIndex: number;
    coords: { top: number; left: number };
  }>({
    open: false, type: 'client', filter: '', selectedIndex: 0, coords: { top: 0, left: 0 }
  });

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const syncTimeoutRef = useRef<Record<number, NodeJS.Timeout>>({});
  const socketRef = useRef<Socket | null>(null);

  // --- Helpers ---
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0] || null, [tabs, activeTabId]);
  const activeLines = useMemo(() => (activeTab?.content || "").split("\n"), [activeTab]);

  const tokenClass = (base: string, ok: boolean) => 
    `${base} ${!ok ? 'underline decoration-red-500 decoration-2 underline-offset-4 bg-red-500/10' : ''}`;

  const isValidDate = (dateStr: string) => {
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (!match) return false;
    const d = parseInt(match[1]), m = parseInt(match[2]) - 1, y = match[3] ? (match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3])) : new Date().getFullYear();
    const date = new Date(y, m, d);
    return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d;
  };

  const parseDateToISO = (dateStr: string) => {
    const parts = dateStr.split('/');
    const d = parts[0].padStart(2, '0'), m = parts[1].padStart(2, '0');
    let y = parts[2] || new Date().getFullYear().toString();
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  };

  // --- API / Sync Logic ---
  const fetchData = useCallback(async () => {
    try {
      const { data: cData } = await supabase.from('clienti').select('nome').order('nome');
      if (cData) setClients(cData.map(c => c.nome));

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
        setTickets(Array.from(new Set(formattedData.map(t => t.n_tag).filter(v => v !== ''))));
      }
    } catch (err) { console.error("Fetch error:", err); }
  }, []);

  const syncTicketData = useCallback(async (allLines: string[], startIndex: number) => {
    const firstLine = allLines[startIndex];
    const clientMatch = firstLine.match(/@([^\s]+)/);
    const tagMatch = firstLine.match(/#([\w\d]+)/);
    const titleMatch = firstLine.match(/"(.*?)"/);
    
    if (!clientMatch) return;

    const clientName = clientMatch[1].toLowerCase();
    const tag = tagMatch ? tagMatch[1].toUpperCase() : null;
    const title = titleMatch ? titleMatch[1] : null;

    let multiLineNote = [];
    const firstLineClean = firstLine
      .replace(/@([^\s]+)/g, '').replace(/#([\w\d]+)/g, '').replace(/"(.*?)"/g, '')
      .replace(/\(coll:.*?\)/g, '').replace(/\(prod:.*?\)/g, '').replace(/\[perc:.*?\]/g, '').trim();
    
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
      queryField = 'n_tag'; queryValue = tag;
    } else {
      if (!title) return;
      queryField = 'titolo'; queryValue = title;
    }

    const updates: any = { note: finalNote };
    const percMatch = firstLine.match(/\[perc:\s*([^\]]+)\]/);
    if (percMatch) {
      const val = percMatch[1].trim().toLowerCase();
      if (val === 'null') updates.percentuale_avanzamento = null;
      else {
        const num = parseInt(val.replace('%', ''));
        if (!isNaN(num)) updates.percentuale_avanzamento = num;
      }
    }

    const collMatch = firstLine.match(/\(coll:\s*([^)]+)\)/);
    const prodMatch = firstLine.match(/\(prod:\s*([^)]+)\)/);
    if (collMatch && isValidDate(collMatch[1])) updates.rilascio_in_collaudo = parseDateToISO(collMatch[1]);
    if (prodMatch && isValidDate(prodMatch[1])) updates.rilascio_in_produzione = parseDateToISO(prodMatch[1]);

    setSyncingRows(prev => ({ ...prev, [startIndex]: true }));
    setSaveStatus('saving');

    try {
      const { error } = await supabase.from('ticket').update(updates).eq(queryField, queryValue);
      if (!error) {
        setSaveStatus('saved');
        setAllTickets(prev => prev.map(t => {
          const isMatch = queryField === 'n_tag' ? t.n_tag === queryValue : t.titolo === queryValue;
          return isMatch ? { ...t, ...updates } : t;
        }));
      }
    } catch (err) { console.error(err); } 
    finally {
      setTimeout(() => setSyncingRows(prev => { const n = { ...prev }; delete n[startIndex]; return n; }), 800);
    }
  }, []);

  // --- Sublime Stream Effect ---
  useEffect(() => {
    socketRef.current = io('http://localhost:4000');

    socketRef.current.on('connect', () => setLocalStreamStatus('connected'));
    socketRef.current.on('disconnect', () => setLocalStreamStatus('disconnected'));
    socketRef.current.on('bridge-status', (status: { fileName: string, fullPath?: string }) => {
  // Salviamo il nome o il percorso completo se disponibile
  setConnectedFile(status.fullPath || status.fileName);
  setLocalStreamStatus('connected');
});

    // Resetta se si disconnette
    socketRef.current.on('disconnect', () => {
      setLocalStreamStatus('disconnected');
      setConnectedFile(null);
    });
    socketRef.current.on('code-update', (data: { code: string, fileName: string }) => {
  setLocalStreamStatus('connected');
  setConnectedFile(data.fileName);

  setTabs(prev => {
    // 1. Cerchiamo se esiste già una tab con lo stesso nome file
    const existingTab = prev.find(t => t.id.toString() === data.fileName);

    if (existingTab) {
      // 2. Se esiste, aggiorna solo il contenuto
      return prev.map(t => 
        t.id.toString() === data.fileName ? { ...t, content: data.code } : t
      );
    } else {
      // 3. Se NON esiste, crea una nuova tab!
      const newTab = {
        id: data.fileName as any, // Usiamo il nome file come ID univoco
        content: data.code
      };
      return [...prev, newTab];
    }
  });
});

    return () => { socketRef.current?.disconnect(); };
  }, [activeTabId, syncTicketData]);

  // --- Lifecycle ---
 useEffect(() => {
  const init = async () => {
    // 1. Gestione User ID
    let storedId = localStorage.getItem('sublime_user_id');
    if (!storedId) {
      storedId = "user_" + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('sublime_user_id', storedId);
    }
    setUserId(storedId);

    // 2. Caricamento Dati API
    await fetchData();

    // 3. RECUPERO TAB DAL LOCALSTORAGE (La parte mancante!)
    const savedTabs = localStorage.getItem('sublime_tabs');
    if (savedTabs) {
      try {
        const parsedTabs = JSON.parse(savedTabs);
        if (parsedTabs.length > 0) {
          setTabs(parsedTabs);
          setActiveTabId(parsedTabs[0].id); // Imposta la prima tab come attiva
        } else {
          // Se il log è vuoto, crea una tab di default
          const defaultTab = { id: Date.now(), content: "// Inizia a scrivere...\n" };
          setTabs([defaultTab]);
          setActiveTabId(defaultTab.id);
        }
      } catch (e) {
        console.error("Errore nel parsing delle tab salvate", e);
      }
    } else {
      // Se non c'è nulla nel localStorage, crea la prima tab
      const defaultTab = { id: Date.now(), content: "// Benvenuto!\n" };
      setTabs([defaultTab]);
      setActiveTabId(defaultTab.id);
    }

    setLoading(false);
  };
  init();
}, [fetchData]);

 // --- Sublime Stream Effect ---
useEffect(() => {
  if (!userId) return; // Non connetterti se l'ID non è pronto

  // CAMBIO QUI: Punta al server Render, non a localhost
  socketRef.current = io('https://sublime-bridge-server.onrender.com');

  socketRef.current.on('connect', () => {
    setLocalStreamStatus('connected');
    // IMPORTANTE: Diciamo al server di unirsi alla stanza dell'utente
    socketRef.current?.emit('join-room', userId);
  });

  socketRef.current.on('disconnect', () => {
    setLocalStreamStatus('disconnected');
    setConnectedFile(null);
  });

  // Riceve lo stato dal bridge (nome file)
  socketRef.current.on('bridge-status', (status: { fileName: string }) => {
    setConnectedFile(status.fileName);
    setLocalStreamStatus('connected');
  });

  // Riceve il codice e sincronizza Supabase
  socketRef.current.on('code-update', (newCode: string) => {
    setTabs(prev => prev.map(t => (t.id === activeTabId ? { ...t, content: newCode } : t)));
    setLocalStreamStatus('connected');

    const lines = newCode.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('@')) syncTicketData(lines, idx);
    });
  });

  return () => { socketRef.current?.disconnect(); };
}, [activeTabId, syncTicketData, userId]); // userId aggiunto alle dipendenze

  const lineStates = useMemo(() => {
    return activeLines.map(line => {
      const tagMatch = line.match(/#([\w\d]+)/);
      const clientMatch = line.match(/@([^\s]+)/);
      const titleMatch = line.match(/"(.*?)"/);
      if (!tagMatch) return 'none';
      const tag = tagMatch[1].toUpperCase();
      const dbTicket = allTickets.find(t => t.n_tag.toUpperCase() === tag);
      if (!dbTicket) return 'error';
      const mismatchClient = clientMatch && dbTicket.cliente.toLowerCase() !== clientMatch[1].toLowerCase();
      const mismatchTitle = titleMatch && !dbTicket.titolo.toLowerCase().includes(titleMatch[1].toLowerCase());
      return (mismatchClient || mismatchTitle) ? 'warning' : 'success';
    });
  }, [activeLines, allTickets]);

  // --- Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setTabs(prev => prev.map(t => (t.id === activeTabId ? { ...t, content: val } : t)));

    const lines = val.split('\n');
    const textBeforeCursor = val.substring(0, pos);
    const lineIdx = textBeforeCursor.split('\n').length - 1;
    const currentLine = lines[lineIdx] || '';
    const currentLineStart = textBeforeCursor.lastIndexOf('\n') + 1;
    const cursorInLine = pos - currentLineStart;
    const beforeCursorInLine = currentLine.slice(0, cursorInLine);
   
    // Autocomplete Logic
    const slashMatch = beforeCursorInLine.match(/\/([^\s/]*)$/);
    const clientMatch = beforeCursorInLine.match(/@([^\s@]*)$/);
    const ticketMatch = beforeCursorInLine.match(/#([^\s#]*)$/);
    const titleMatch = beforeCursorInLine.match(/"([^"]*)$/);

    if ((slashMatch || clientMatch || ticketMatch || titleMatch) && textAreaRef.current) {
      const coords = getCursorXY(textAreaRef.current, pos);
      setMenu({
        open: true,
        type: slashMatch ? 'param' : clientMatch ? 'client' : ticketMatch ? 'ticket' : 'title',
        filter: (slashMatch || clientMatch || ticketMatch || titleMatch)![1] || '',
        selectedIndex: 0,
        coords
      });
    } else {
      setMenu(prev => ({ ...prev, open: false }));
    }

    // Sync Delay
    let lastClientLineIdx = -1;
    for (let i = lineIdx; i >= 0; i--) { if (lines[i].includes('@')) { lastClientLineIdx = i; break; } }
    if (lastClientLineIdx !== -1) {
      if (syncTimeoutRef.current[lastClientLineIdx]) clearTimeout(syncTimeoutRef.current[lastClientLineIdx]);
      syncTimeoutRef.current[lastClientLineIdx] = setTimeout(() => syncTicketData(lines, lastClientLineIdx), 1500);
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
  if (menu.open) {
    const list = getFilteredList();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMenu(prev => ({ ...prev, selectedIndex: (prev.selectedIndex + 1) % list.length }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMenu(prev => ({ ...prev, selectedIndex: (prev.selectedIndex - 1 + list.length) % list.length }));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const selected = list[menu.selectedIndex];
      if (selected) insertText(typeof selected === 'string' ? selected : (selected as any).value);
    } else if (e.key === 'Escape') {
      setMenu(prev => ({ ...prev, open: false }));
    }
  }
};

  const getFilteredList = useCallback(() => {
    if (!menu.open) return [];
    const filter = menu.filter.toLowerCase();
    switch (menu.type) {
      case 'param': return SPECIAL_PARAMS.filter(p => p.label.toLowerCase().includes(filter));
      case 'client': return clients.filter(c => c.toLowerCase().includes(filter));
      case 'ticket': return tickets.filter(t => t.toLowerCase().includes(filter));
      case 'title':
        const currentLine = activeLines[valutateCurrentLineIndex()] || "";
        const clientOnLine = currentLine.match(/@([^\s]+)/)?.[1]?.toLowerCase();
        return Array.from(new Set(
          allTickets.filter(t => (!clientOnLine || t.cliente.toLowerCase() === clientOnLine) && t.titolo.toLowerCase().includes(filter)).map(t => t.titolo)
        )).slice(0, 10);
      default: return [];
    }
  }, [menu.open, menu.type, menu.filter, clients, tickets, allTickets, activeLines]);

  const valutateCurrentLineIndex = () => {
    if (!textAreaRef.current) return 0;
    return (activeTab?.content || "").substring(0, textAreaRef.current.selectionStart).split('\n').length - 1;
  };

  const insertText = (suggestion: string) => {
    if (!textAreaRef.current || !activeTab) return;
    const pos = textAreaRef.current.selectionStart;
    const before = activeTab.content.substring(0, pos);
    const symbols: any = { client: '@', ticket: '#', param: '/', title: '"' };
    const symbol = symbols[menu.type];
    const lastSymbolPos = before.lastIndexOf(symbol);
    if (lastSymbolPos === -1) return;

    const textToInsert = menu.type === 'title' ? `${suggestion}" ` : `${suggestion} `;
    const newContent = activeTab.content.substring(0, menu.type === 'param' ? lastSymbolPos : lastSymbolPos + 1) + 
                       textToInsert + activeTab.content.substring(pos).replace(menu.type === 'param' ? /^[^\s]*/ : /^"?\s*/, '');

    setTabs(prev => prev.map(t => (t.id === activeTabId ? { ...t, content: newContent } : t)));
    setMenu(prev => ({ ...prev, open: false }));
    setTimeout(() => textAreaRef.current?.focus(), 10);
  };

  const getCursorXY = (textarea: HTMLTextAreaElement, selectionPoint: number) => {
    const div = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'padding', 'border', 'width', 'boxSizing', 'whiteSpace', 'wordWrap'].forEach(prop => { (div.style as any)[prop] = (style as any)[prop]; });
    div.style.position = 'absolute'; div.style.visibility = 'hidden';
    div.textContent = textarea.value.substring(0, selectionPoint);
    const span = document.createElement('span'); span.textContent = textarea.value.substring(selectionPoint) || '.';
    div.appendChild(span); document.body.appendChild(div);
    const { offsetLeft, offsetTop } = span; document.body.removeChild(div);
    return { top: offsetTop + (parseInt(style.lineHeight) || fontSize + 10) - textarea.scrollTop + 5, left: Math.min(offsetLeft + 20, textarea.clientWidth - 280) };
  };

  const toggleInLavorazioneOra = async (tag: string, rowIndex: number, nextValue: boolean) => {
    if (!tag || workingLoadingByTag[tag]) return;
    setWorkingLoadingByTag(prev => ({ ...prev, [tag]: true }));
    setWorkingRows(prev => ({ ...prev, [rowIndex]: nextValue }));
    try {
      const { error } = await supabase.from("ticket").update({ in_lavorazione_ora: nextValue }).eq("n_tag", tag);
      if (error) setWorkingRows(prev => ({ ...prev, [rowIndex]: !nextValue }));
    } catch { setWorkingRows(prev => ({ ...prev, [rowIndex]: !nextValue })); }
    finally { setWorkingLoadingByTag(prev => ({ ...prev, [tag]: false })); }
  };

  return (
    <div className={`flex h-screen w-full font-mono overflow-hidden ${isDarkMode ? 'bg-[#1e1e1e] text-[#d4d4d4]' : 'bg-white text-[#333]'}`}>
      <style jsx global>{`
        @keyframes pulse-sync { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.2); } }
        .animate-sync { animation: pulse-sync 1s infinite ease-in-out; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Sidebar */}
      <div className={`w-64 border-r flex flex-col shrink-0 ${isDarkMode ? 'bg-[#181818] border-[#121212]' : 'bg-[#f3f3f3] border-[#ddd]'}`}>
        <div className="p-4 border-b border-black/10 flex flex-col gap-2">
           <div className="flex items-center gap-2">
              {localStreamStatus === 'connected' ? <Zap size={14} className="text-green-500" /> : <ZapOff size={14} className="text-red-500" />}
              <span className="text-[10px] font-bold uppercase tracking-tighter">Sublime Bridge: {localStreamStatus}</span>
           </div>
           <div className="flex items-center gap-2">
              <Cloud size={14} className="text-blue-400" />
              <span className="text-[10px] font-bold uppercase tracking-tighter tracking-tighter">Supabase Cloud: OK</span>
           </div>
        </div>

        
        

        <div className="flex-1 overflow-y-auto border-t border-black/10">
          <div className="p-4 py-3 text-[12px] font-black uppercase opacity-90 flex justify-between items-center">
            Tabs <button onClick={() => { const n = { id: Date.now(), content: "Nuova Tab\n" }; setTabs([...tabs, n]); setActiveTabId(n.id); }} className="text-[12px] text-white-500"> +</button>
          </div>
          {tabs.map(t => (
            <div key={t.id} onClick={() => setActiveTabId(t.id)} className={`px-4 py-2 text-[11px] cursor-pointer border-l-2 flex justify-between items-center ${activeTabId === t.id ? 'bg-black/20 border-amber-500 text-amber-500' : 'border-transparent opacity-60'}`}>
              <span className="truncate">{t.content.split('\n')[0] || 'Vuoto'}</span>
              <button onClick={(e) => { e.stopPropagation(); setTabs(tabs.filter(tab => tab.id !== t.id)); }} className="hover:text-red-500">✕</button>
            </div>
          ))}
        </div>


          <div className="mt-auto p-4 border-t border-black/10 bg-black/10 flex flex-col gap-3">
  {localStreamStatus === 'disconnected' ? (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 text-amber-400">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <p className="text-[9px] leading-tight font-bold uppercase italic">
          Sublime non collegato. Scarica il ponte per iniziare.
        </p>
      </div>
      <DownloadBridge userId={userId || "guests_123"} />
    </div>
  ) : (
    <div className="bg-green-500/10 border border-green-500/30 p-2 rounded-lg flex flex-col gap-2">
  <div className="flex items-center justify-between gap-2">
    {/* Status compatto */}
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
      <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">
        SINCRO
      </span>
    </div>

    {/* Pulsante di apertura */}
    <button 
      onClick={() => {
        if (connectedFile) {
          // Invia l'evento al server che poi lo girerà al bridge
          socketRef.current?.emit('open-external-file', { 
            userId, 
            fullPath: connectedFile 
          });
        }
      }}
      className="bg-green-500 hover:bg-green-400 text-black px-2 py-1 rounded text-[8px] font-bold flex items-center gap-1 transition-colors"
    >
      <Download size={10} className="rotate-180" /> {/* Icona invertita per "apri" */}
      OPEN SUB-T
    </button>
  </div>

  {/* Mostra solo il nome del file, non tutto il path, per pulizia */}
  {connectedFile && (
    <div className="text-[8px] font-mono text-green-200/60 truncate border-t border-green-500/20 pt-1">
      FILE: {connectedFile.split('\\').pop()?.split('/').pop()}
    </div>
  )}
</div>
  )}
</div>

</div>
        
      
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Autocomplete Menu */}
        {menu.open && (
          <div style={{ top: menu.coords.top, left: menu.coords.left }} className={`absolute z-50 border shadow-2xl rounded w-80 overflow-hidden ${isDarkMode ? 'bg-[#252526] border-[#404040]' : 'bg-white border-gray-300'}`}>
            <div className="bg-black/20 px-2 py-1 text-[8px] opacity-50 font-bold uppercase border-b border-white/5">Suggerimenti {menu.type}</div>
            <div className="max-h-60 overflow-y-auto scrollbar-hide">
              {getFilteredList().map((item, idx) => (
                <div key={idx} onClick={() => insertText(typeof item === 'string' ? item : item.value)} className={`px-3 py-2 text-xs cursor-pointer flex justify-between items-center ${menu.selectedIndex === idx ? 'bg-[#007acc] text-white' : 'hover:bg-black/10'}`}>
                  <span className="truncate">{typeof item === 'string' ? item : item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 flex relative overflow-hidden">
          {/* Gutter */}
          <div className={`w-14 border-r pt-5 flex flex-col items-center shrink-0 select-none ${isDarkMode ? 'bg-[#1e1e1e] border-[#252526]' : 'bg-[#f9f9f9] border-gray-100'}`}>
            {lineStates.map((state, i) => {
              const tag = activeLines[i]?.match(/#([\w\d]+)/)?.[1]?.toUpperCase();
              const dbTicket = allTickets.find(t => t.n_tag.toUpperCase() === tag);
              const isWorking = workingRows[i] || false;
              return (
                <div key={i} className="flex items-center gap-2 justify-end w-full pr-3" style={{ height: `${fontSize + 10}px` }}>
                  {syncingRows[i] ? (
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-sync" />
                  ) : state !== 'none' ? (
                    <button onClick={() => toggleInLavorazioneOra(tag!, i, !isWorking)} className={`w-3 h-3 rounded-full transition-all ${state === 'success' ? 'bg-green-500' : state === 'warning' ? 'bg-yellow-500' : 'bg-red-500'} ${isWorking ? 'ring-2 ring-white scale-110' : 'opacity-30'}`}>
                      <span className="text-[6px] text-white font-bold block">{dbTicket?.numero_priorita || ''}</span>
                    </button>
                  ) : null}
                  <span className="text-[10px] opacity-20">{i + 1}</span>
                </div>
              );
            })}
          </div>

          <div className="relative flex-1">
            {/* Highlighter */}
            <div className="absolute inset-0 p-5 pt-5 pointer-events-none whitespace-pre-wrap break-words overflow-y-auto scrollbar-hide" style={{ fontSize, lineHeight: `${fontSize + 10}px` }}>
              {(activeTab?.content || "").split(/(@[^\s]+)|(#[\w\d]+)|(".*?")|(\(coll:.*?\))|(\(prod:.*?\))|(\[perc:.*?\])/g).map((part, i) => {
                  if (!part) return null;
                  if (part.startsWith("@")) return <span key={i} className="text-blue-400 font-bold">{part}</span>;
                  if (part.startsWith("#")) return <span key={i} className="text-amber-500 font-bold">{part}</span>;
                  if (part.startsWith('"')) return <span key={i} className="text-green-400 italic">{part}</span>;
                  if (part.startsWith("(coll:") || part.startsWith("(prod:")) {
                    const ok = isValidDate(part.match(/:\s*([^)]+)\)/)?.[1] || "") || part.includes("null");
                    return <span key={i} className={tokenClass(part.startsWith("(coll:") ? "text-purple-400" : "text-red-400", ok)}>{part}</span>;
                  }
                  if (part.startsWith("[perc:")) {
                    return <span key={i} className={`font-bold ${part.toLowerCase().includes("null") ? 'text-gray-500' : 'text-orange-400'}`}>{part}</span>;
                  }
                  return <span key={i} className="opacity-80">{part}</span>;
                })}
            </div>
            {/* Real Textarea */}
            <textarea
              ref={textAreaRef}
              spellCheck={false}
              value={activeTab?.content || ""}
              onChange={handleInputChange}
              className="absolute inset-0 w-full h-full bg-transparent p-5 pt-5 outline-none resize-none text-transparent caret-white z-30 font-mono"
              style={{ fontSize, lineHeight: `${fontSize + 10}px` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`h-7 flex items-center justify-between px-3 text-[9px] font-black uppercase shrink-0 ${saveStatus === 'saving' ? 'bg-amber-600' : 'bg-[#007acc]'} text-white`}>
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1">
               {saveStatus === 'saving' ? <Cloud className="animate-bounce" size={10}/> : <Cloud size={10}/>}
               {saveStatus === 'saving' ? 'Cloud Syncing...' : 'Cloud Synced'}
            </span>
            {localStreamStatus === 'connected' && (
                  <span className="flex items-center gap-2 text-green-300">
                    <Terminal size={10} className="shrink-0" />
                    <span className="flex gap-1 items-baseline">
                      <span>Live from Sublime:</span>
                      <span className="text-white italic lowercase opacity-80 truncate max-w-[250px]">
                        {connectedFile ? `Editing: \${connectedFile}` : 'In attesa di modifiche...'}
                      </span>
                    </span>
                  </span>
                )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsDarkMode(!isDarkMode)}>{isDarkMode ? '🌙 Dark' : '☀️ Light'}</button>
            <div className="flex gap-1">
              <button onClick={() => setFontSize(f => Math.max(10, f-1))}>-</button>
              <span>{fontSize}px</span>
              <button onClick={() => setFontSize(f => Math.min(30, f+1))}>+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


import JSZip from 'jszip';
import { saveAs } from 'file-saver';

function DownloadBridge({ userId }: { userId: string }) {
  const downloadPackage = async () => {
    const zip = new JSZip();
    
    // Il cuore del sistema: il bridge Node.js personalizzato per l'utente
    const bridgeCode = `
const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const USER_ID = "${userId}"; 
const SERVER_URL = "https://sublime-bridge-server.onrender.com"; // <-- IL TUO URL RENDER
const FILE_TO_WATCH = path.join(__dirname, 'lavora-qui.js');

if (!fs.existsSync(FILE_TO_WATCH)) {
    fs.writeFileSync(FILE_TO_WATCH, "// Apri questo file con Sublime Text...\\n");
}

const socket = io(SERVER_URL);
console.log("🚀 Bridge Attivo per: " + USER_ID);

socket.on('connect', () => {
    console.log("✅ Connesso al Cloud!");
    socket.emit('join-room', USER_ID);
});

fs.watch(FILE_TO_WATCH, (event) => {
  if (event === 'change') {
    try {
        const content = fs.readFileSync(FILE_TO_WATCH, 'utf8');
        socket.emit('code-from-sublime', { userId: USER_ID, code: content });
        console.log("⚡ Sincronizzato!");
    } catch(e) {}
  }
});`.trim();

    const packageJson = JSON.stringify({
      name: "sublime-bridge",
      version: "1.0.0",
      main: "bridge.js",
      dependencies: { "socket.io-client": "^4.7.2" }
    }, null, 2);

    const startBat = `@echo off
echo Avvio Sublime Bridge...
IF NOT EXIST node_modules (
    echo Installazione dipendenze in corso...
    call npm install
)
node bridge.js
pause`.trim();

    zip.file("bridge.js", bridgeCode);
    zip.file("package.json", packageJson);
    zip.file("AVVIA_BRIDGE.bat", startBat);
    zip.file("lavora-qui.js", "// Inizia a scrivere qui\n");

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `sublime-bridge-${userId.substring(0, 5)}.zip`);
  };

  return (
    <button 
      onClick={downloadPackage}
      className="group relative flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-black py-3 px-2 rounded-lg font-black text-[10px] transition-all overflow-hidden shadow-lg shadow-amber-500/20"
    >
      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
      <div className="relative flex items-center gap-2">
        <Download size={14} className="animate-bounce" />
        SCARICA SUBLIME BRIDGE
      </div>
    </button>
  );
}