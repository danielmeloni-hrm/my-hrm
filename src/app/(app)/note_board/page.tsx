'use client';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

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

  const tokenClass = (base: string, ok: boolean) => {
    return `${base} ${!ok ? 'underline decoration-red-500 decoration-2 underline-offset-4 bg-red-500/10' : ''}`;
  };

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0] || null, [tabs, activeTabId]);
  const activeLines = useMemo(() => (activeTab?.content || "").split("\n"), [activeTab]);

  const valutateCurrentLineIndex = useCallback(() => {
    if (!textAreaRef.current) return 0;
    const pos = textAreaRef.current.selectionStart;
    return (activeTab?.content || "").substring(0, pos).split('\n').length - 1;
  }, [activeTab]);

  // --- Helpers ---
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
  }, [menu.open, menu.type, menu.filter, clients, tickets, allTickets, activeLines, valutateCurrentLineIndex]);

  // --- API / Sync ---
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

  const syncTicketData = async (allLines: string[], startIndex: number) => {
      const firstLine = allLines[startIndex];
      
      // 1. Identificatori della riga principale
      const clientMatch = firstLine.match(/@([^\s]+)/);
      const tagMatch = firstLine.match(/#([\w\d]+)/);
      const titleMatch = firstLine.match(/"(.*?)"/);
      
      if (!clientMatch) return; // Se la riga non inizia con un cliente, non sincronizziamo

      const clientName = clientMatch[1].toLowerCase();
      const tag = tagMatch ? tagMatch[1].toUpperCase() : null;
      const title = titleMatch ? titleMatch[1] : null;

      // 2. RACCOLTA MULTI-RIGA: Prendi le righe successive finché non trovi un nuovo @
      let multiLineNote = [];
      
      // Puliamo la prima riga dai parametri speciali
      const firstLineClean = firstLine
        .replace(/@([^\s]+)/g, '')
        .replace(/#([\w\d]+)/g, '')
        .replace(/"(.*?)"/g, '')
        .replace(/\(coll:.*?\)/g, '')
        .replace(/\(prod:.*?\)/g, '')
        .replace(/\[perc:.*?\]/g, '')
        .trim();
      
      if (firstLineClean) multiLineNote.push(firstLineClean);

      // Ciclo sulle righe successive
      for (let i = startIndex + 1; i < allLines.length; i++) {
        if (allLines[i].includes('@')) break; // Ci fermiamo se appare un nuovo cliente
        const content = allLines[i].trim();
        if (content) multiLineNote.push(content);
      }

      const finalNote = multiLineNote.join('\n'); // Uniamo con a capo

      // 3. Strategia di Associazione
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

      // 4. Preparazione altri parametri (estrapolati solo dalla riga principale)
      const updates: any = { note: finalNote };
      
      // Percentuale
      const percMatch = firstLine.match(/\[perc:\s*([^\]]+)\]/);
      if (percMatch) {
        const val = percMatch[1].trim().toLowerCase();
        if (val === 'null') updates.percentuale_avanzamento = null;
        else {
          const num = parseInt(val.replace('%', ''));
          if (!isNaN(num)) updates.percentuale_avanzamento = num;
        }
      }

      // Date
      const collMatch = firstLine.match(/\(coll:\s*([^)]+)\)/);
      const prodMatch = firstLine.match(/\(prod:\s*([^)]+)\)/);
      if (collMatch && isValidDate(collMatch[1])) updates.rilascio_in_collaudo = parseDateToISO(collMatch[1]);
      if (prodMatch && isValidDate(prodMatch[1])) updates.rilascio_in_produzione = parseDateToISO(prodMatch[1]);

      // 5. Invio a Supabase
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
      } catch (err) {
        console.error(err);
      } finally {
        setTimeout(() => setSyncingRows(prev => { const n = { ...prev }; delete n[startIndex]; return n; }), 600);
      }
    };

  // --- Lifecycle ---
  useEffect(() => {
    const init = async () => {
      await fetchData();
      const saved = localStorage.getItem('sublime_tabs');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.length > 0) { setTabs(parsed); setActiveTabId(parsed[0].id); }
        } catch (e) { console.error("Local storage corrupt"); }
      } else {
        const initial = { id: Date.now(), content: "Nuovo Documento\n@CLIENTE #TICKET \"TITOLO\"" };
        setTabs([initial]); setActiveTabId(initial.id);
      }
      setLoading(false);
    };
    init();
  }, [fetchData]);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => localStorage.setItem('sublime_tabs', JSON.stringify(tabs)), 800);
      return () => clearTimeout(timer);
    }
  }, [tabs, loading]);

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

  // --- Event Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      const pos = e.target.selectionStart;
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, content: val } : t));

      const lines = val.split('\n');
      const textBeforeCursor = val.substring(0, pos);
      const lineIdx = textBeforeCursor.split('\n').length - 1;

      // Troviamo l'indice della riga che contiene il cliente (@) più vicino "sopra" di noi
      let lastClientLineIdx = -1;
      for (let i = lineIdx; i >= 0; i--) {
        if (lines[i].includes('@')) {
          lastClientLineIdx = i;
          break;
        }
      }

      // Se abbiamo trovato un blocco cliente, aggiorniamo quello
      if (lastClientLineIdx !== -1) {
        if (syncTimeoutRef.current[lastClientLineIdx]) clearTimeout(syncTimeoutRef.current[lastClientLineIdx]);
        syncTimeoutRef.current[lastClientLineIdx] = setTimeout(() => {
          syncTicketData(lines, lastClientLineIdx);
        }, 1000);
      }
    };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (menu.open) {
      const currentList = getFilteredList();
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenu(prev => ({ ...prev, selectedIndex: (prev.selectedIndex + 1) % (currentList.length || 1) })); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setMenu(prev => ({ ...prev, selectedIndex: (prev.selectedIndex - 1 + currentList.length) % (currentList.length || 1) })); }
      else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = currentList[menu.selectedIndex];
        if (selected) insertText(typeof selected === 'string' ? selected : selected.value);
      } else if (e.key === 'Escape') setMenu(prev => ({ ...prev, open: false }));
    }
  };

  const insertText = (suggestion: string) => {
    if (!textAreaRef.current || !activeTab) return;
    const pos = textAreaRef.current.selectionStart;
    const before = activeTab.content.substring(0, pos);
    const symbols: Record<string, string> = { client: '@', ticket: '#', param: '/', title: '"' };
    const symbol = symbols[menu.type];
    const lastSymbolPos = before.lastIndexOf(symbol);
    if (lastSymbolPos === -1) return;

    const isTitle = menu.type === 'title';
    const textToInsert = isTitle ? `${suggestion}" ` : `${suggestion} `;
    const newContent = activeTab.content.substring(0, lastSymbolPos + 1) + textToInsert + activeTab.content.substring(pos).replace(/^"?\s*/, '');

    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, content: newContent } : t));
    setMenu(prev => ({ ...prev, open: false }));
    setTimeout(() => {
      const newPos = lastSymbolPos + 1 + textToInsert.length;
      textAreaRef.current?.focus();
      textAreaRef.current?.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const getCursorXY = (textarea: HTMLTextAreaElement, selectionPoint: number) => {
    const div = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'padding', 'border', 'width', 'boxSizing', 'whiteSpace', 'wordWrap'].forEach(prop => { (div.style as any)[prop] = (style as any)[prop]; });
    div.style.position = 'absolute'; div.style.visibility = 'hidden';
    div.textContent = textarea.value.substring(0, selectionPoint);
    const span = document.createElement('span');
    span.textContent = textarea.value.substring(selectionPoint) || '.';
    div.appendChild(span);
    document.body.appendChild(div);
    const { offsetLeft, offsetTop } = span;
    document.body.removeChild(div);
    return { top: offsetTop + (parseInt(style.lineHeight) || fontSize + 10) - textarea.scrollTop + 5, left: Math.min(offsetLeft + 20, textarea.clientWidth - 280) };
  };

  const toggleInLavorazioneOra = async (tag: string, rowIndex: number, nextValue: boolean) => {
    if (!tag || workingLoadingByTag[tag]) return;
    setWorkingLoadingByTag(prev => ({ ...prev, [tag]: true }));
    setWorkingRows(prev => ({ ...prev, [rowIndex]: nextValue }));
    try {
      const { error } = await supabase.from("ticket").update({ in_lavorazione_ora: nextValue }).eq("n_tag", tag);
      if (error) setWorkingRows(prev => ({ ...prev, [rowIndex]: !nextValue }));
    } catch (err) { setWorkingRows(prev => ({ ...prev, [rowIndex]: !nextValue })); }
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
        <div className="border-b border-black/10 p-4 py-3 flex justify-between items-center cursor-pointer" onClick={() => setShowLegend(!showLegend)}>
          <span className="text-[9px] font-black uppercase opacity-50 tracking-widest">Legenda & Stato</span>
          <span className="text-[10px]">{showLegend ? '▼' : '▲'}</span>
        </div>
        {showLegend && (
          <div className="px-4 pb-4 flex flex-col gap-3 text-[11px]">
            <div className="flex justify-between"><span>@ Clienti:</span> <span className="font-bold text-blue-400">{clients.length}</span></div>
            <div className="flex justify-between"><span># Ticket:</span> <span className="font-bold text-amber-500">{tickets.length}</span></div>
            <hr className="opacity-10" />
            <div className="flex flex-col gap-1.5 opacity-70 text-[10px]">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500" /> <span>Validato</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500" /> <span>Mismatch / Errore</span></div>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto border-t border-black/10">
          <div className="p-4 py-3 text-[9px] font-black uppercase opacity-50 flex justify-between items-center">
            Tabs <button onClick={() => { const n = { id: Date.now(), content: "Nuovo\n" }; setTabs([...tabs, n]); setActiveTabId(n.id); }} className="text-amber-500">+</button>
          </div>
          {tabs.map(t => (
            <div key={t.id} onClick={() => setActiveTabId(t.id)} className={`px-4 py-2 text-[11px] cursor-pointer border-l-2 flex justify-between items-center ${activeTabId === t.id ? 'bg-black/20 border-amber-500 text-amber-500' : 'border-transparent opacity-60'}`}>
              <span className="truncate">{t.content.split('\n')[0] || 'Vuoto'}</span>
              <button onClick={(e) => { e.stopPropagation(); setTabs(tabs.filter(tab => tab.id !== t.id)); }} className="hover:text-red-500">✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Suggerimenti Menu UI */}
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
            {/* Highlighter Overlay */}
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
                    const isNull = part.toLowerCase().includes("null");
                    return <span key={i} className={`font-bold ${isNull ? 'text-gray-500' : 'text-orange-400'}`}>{part}</span>;
                  }
                  return <span key={i} className="opacity-80">{part}</span>; // Testo delle note leggermente opaco
                })}
             
            </div>
            {/* Real Textarea */}
            <textarea
              ref={textAreaRef}
              spellCheck={false}
              value={activeTab?.content || ""}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="absolute inset-0 w-full h-full bg-transparent p-5 pt-5 outline-none resize-none text-transparent caret-white z-30 font-mono"
              style={{ fontSize, lineHeight: `${fontSize + 10}px` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`h-7 flex items-center justify-between px-3 text-[9px] font-black uppercase shrink-0 ${saveStatus === 'saving' ? 'bg-amber-600' : 'bg-[#007acc]'} text-white`}>
          <div className="flex gap-4">
            <span>{saveStatus === 'saving' ? 'Syncing...' : '✓ Cloud Ready'}</span>
            <span className="opacity-50">Lines: {activeLines.length}</span>
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