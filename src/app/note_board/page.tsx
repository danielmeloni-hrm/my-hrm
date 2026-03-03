'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

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
}

interface Tab {
  id: number;
  content: string;
}

export default function SublimeSupabaseEditor() {
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
  const [workingByTag, setWorkingByTag] = useState<Record<string, boolean>>({});
  const [workingLoadingByTag, setWorkingLoadingByTag] = useState<Record<string, boolean>>({});
  const [syncingRows, setSyncingRows] = useState<{[key: number]: boolean}>({});
  const editorStyles: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    lineHeight: `${fontSize + 10}px`,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    letterSpacing: '0px',
    tabSize: 4,
    WebkitFontSmoothing: 'antialiased',
  };


const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [menu, setMenu] = useState<{ 
    open: boolean; 
    type: 'client' | 'ticket'; 
    filter: string; 
    selectedIndex: number;
    coords: { top: number; left: number };
  }>({
    open: false, type: 'client', filter: '', selectedIndex: 0, coords: { top: 0, left: 0 }
  });

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

const fetchData = async () => {
  try {
    const { data: cData } = await supabase.from('clienti').select('nome').order('nome');
    if (cData) setClients(cData.map(c => c.nome));

      const { data: tData } = await supabase
    .from('ticket')
    .select(`
      n_tag,
      titolo,
      in_lavorazione_ora,
      numero_priorita,
      clienti ( nome )
    `)
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
  } catch (err) { console.error(err); }
};

  useEffect(() => {
    const init = async () => {
      await fetchData();
      const savedTabs = localStorage.getItem('sublime_tabs');
      if (savedTabs && JSON.parse(savedTabs).length > 0) {
        const parsed = JSON.parse(savedTabs);
        setTabs(parsed);
        setActiveTabId(parsed[0].id);
      } else {
        const initialTab = { id: Date.now(), content: "Nuovo Documento\n@CLIENTE #TICKET \"TITOLO\"" };
        setTabs([initialTab]);
        setActiveTabId(initialTab.id);
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!loading && tabs.length > 0) {
      setSaveStatus('saving');
      const timer = setTimeout(() => {
        localStorage.setItem('sublime_tabs', JSON.stringify(tabs));
        setSaveStatus('saved');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [tabs, loading]);

  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) || tabs[0] || null;
  }, [tabs, activeTabId]);
const activeLines = useMemo(() => (activeTab?.content || "").split("\n"), [activeTab]);

const lineTags = useMemo(() => {
  return activeLines.map(line => {
    const m = line.match(/#([\w\d]+)/);
    return m ? m[1].trim().toUpperCase() : null;
  });
}, [activeLines]);
  // VALIDAZIONE RIGA PER RIGA (PALLINI) - VERSIONE AGGIORNATA
const lineStates = useMemo(() => {
  if (!activeTab) return [];
  return activeTab.content.split('\n').map(line => {
    const tagMatch = line.match(/#([\w\d]+)/);
    // NUOVA REGEX: Si ferma al primo spazio
    const clientMatch = line.match(/@([^\s]+)/);
    const titleMatch = line.match(/"(.*?)"/);

    if (!tagMatch) return 'none';

    const inputTag = tagMatch[1].trim().toUpperCase();
    const dbTicket = allTickets.find(t => t.n_tag.toUpperCase() === inputTag);

    if (!dbTicket) return 'error'; // ROSSO: Tag non trovato

    const inputClient = clientMatch ? clientMatch[1].trim().toLowerCase() : null;
    const inputTitle = titleMatch ? titleMatch[1].trim().toLowerCase() : null;

    const dbClient = dbTicket.cliente.toLowerCase();
    const dbTitle = dbTicket.titolo.toLowerCase();

    // Validazione stringente
    const mismatchClient = inputClient && dbClient !== inputClient;
    const mismatchTitle = inputTitle && !dbTitle.includes(inputTitle);

    if (mismatchClient || mismatchTitle) return 'warning'; // GIALLO: Dati diversi

    return 'success'; // VERDE: Tutto ok
  });
}, [activeTab, allTickets]);

  const filteredSuggestions = useMemo(() => {
    const list = menu.type === 'client' ? clients : tickets;
    return list.filter(i => i.toLowerCase().includes(menu.filter.toLowerCase()));
  }, [menu.type, menu.filter, clients, tickets]);

  const updateContent = (newContent: string) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, content: newContent } : t));
  };

  const insertText = (text: string) => {
    if (!activeTab) return;
    const pos = textAreaRef.current?.selectionStart || 0;
    const before = activeTab.content.slice(0, pos).replace(/[@#][\w\d]*$/, '');
    const after = activeTab.content.slice(pos);
    const symbol = menu.type === 'client' ? '@' : '#';
    updateContent(`${before}${symbol}${text} ${after}`);
    setMenu(prev => ({ ...prev, open: false }));
    setTimeout(() => textAreaRef.current?.focus(), 0);
  };

  const getCursorXY = (textarea: HTMLTextAreaElement, selectionPoint: number) => {
    const div = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    const props = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'padding', 'border', 'width', 'boxSizing', 'whiteSpace', 'wordWrap'];
    props.forEach(prop => { (div.style as any)[prop] = (style as any)[prop]; });
    div.style.position = 'absolute'; div.style.visibility = 'hidden';
    div.style.top = '0'; div.style.left = '0';
    div.textContent = textarea.value.substring(0, selectionPoint);
    const span = document.createElement('span');
    span.textContent = textarea.value.substring(selectionPoint) || '.';
    div.appendChild(span);
    document.body.appendChild(div);
    const { offsetLeft, offsetTop } = span;
    document.body.removeChild(div);
    return { 
      top: offsetTop + textarea.offsetTop + (parseInt(style.lineHeight) || fontSize + 10) - textarea.scrollTop, 
      left: Math.min(offsetLeft + textarea.offsetLeft, textarea.clientWidth - 240) 
    };
  };

  const getTabName = (content?: string) => {
    if (!content) return 'Nuova Tab';
    return content.split('\n')[0].trim().substring(0, 20) || 'Nuova Tab';
  };

  const handleCloseTab = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    if (newTabs.length === 0) {
      const resetTab = { id: Date.now(), content: "" };
      setTabs([resetTab]); setActiveTabId(resetTab.id);
    } else {
      setTabs(newTabs); if (activeTabId === id) setActiveTabId(newTabs[0].id);
    }
  };

const parseDateToISO = (dateStr: string) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  const day = parts[0].padStart(2, '0');
  const month = parts[1]?.padStart(2, '0');
  let year = parts[2] || new Date().getFullYear().toString();
  
  // Se l'anno è di 2 cifre (es. 26), trasformalo in 2026
  if (year.length === 2) year = `20${year}`;
  
  if (!day || !month || !year) return null;
  return `${year}-${month}-${day}`; // Formato YYYY-MM-DD
};

const syncReleaseDates = async (line: string, rowIndex: number) => {
    const tagMatch = line.match(/#([\w\d]+)/);
    if (!tagMatch) return;

    const tag = tagMatch[1].trim().toUpperCase();
    
    // 1. RECUPERA IL TICKET DALLE INFO CARICATE
    const dbTicket = allTickets.find(t => t.n_tag.toUpperCase() === tag);
    if (!dbTicket) return; // Se il tag non esiste, esci (Pallino Rosso)

    // 2. VERIFICA INCONGRUENZE (Blocco di sicurezza)
    const clientMatch = line.match(/@([^\s]+)/);
    const inputClient = clientMatch ? clientMatch[1].trim().toLowerCase() : null;
    const dbClient = dbTicket.cliente.toLowerCase();

    // Se hai scritto un cliente e non corrisponde al DB, annulla il sync
    if (inputClient && dbClient !== inputClient) {
        console.warn(`Sync annullato per ${tag}: Cliente non corrispondente (@${inputClient} != @${dbClient})`);
        return; 
    }

    // 3. SE OK, PROCEDI CON IL PARSING DELLE DATE
    const collMatch = line.match(/\(coll:\s*([\d/]+)\)/);
    const prodMatch = line.match(/\(prod:\s*([\d/]+)\)/);

    // VALIDAZIONE PRIMA DI PROCEDERE
    const collDate = collMatch ? collMatch[1] : null;
    const prodDate = prodMatch ? prodMatch[1] : null;

    if (collDate && !isValidDate(collDate)) return; // Stop se collaudo errato
    if (prodDate && !isValidDate(prodDate)) return; // Stop se produzione errata

    // ... procedi con l'update solo se le date esistenti sono valide
    const updates: any = {};
    if (collDate) updates.rilascio_in_collaudo = parseDateToISO(collDate);
    if (prodDate) updates.rilascio_in_produzione = parseDateToISO(prodDate);

    if (Object.keys(updates).length === 0) return;

    // 4. ESEGUI L'UPDATE
    setSyncingRows(prev => ({ ...prev, [rowIndex]: true }));

    const { error } = await supabase
        .from('ticket')
        .update(updates)
        .eq('n_tag', tag);

    if (!error) {
        setTimeout(() => {
            setSyncingRows(prev => ({ ...prev, [rowIndex]: false }));
            // Opzionale: fetchData() per aggiornare lo stato locale
        }, 1000);
    } else {
        setSyncingRows(prev => ({ ...prev, [rowIndex]: false }));
    }
};
const isValidDate = (dateStr: string) => {
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return false;

  const day = parseInt(match[1]);
  const month = parseInt(match[2]) - 1; // 0-11
  const year = match[3] 
    ? (match[3].length === 2 ? parseInt(`20${match[3]}`) : parseInt(match[3]))
    : new Date().getFullYear();

  const date = new Date(year, month, day);
  // Se l'oggetto Date ha "shittato" il giorno (es 30/02 -> 02/03), la data non è valida
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
};

const toggleInLavorazioneOra = async (tag: string, nextValue: boolean) => {
  if (!tag) return;
  if (workingLoadingByTag[tag]) return;

  // UI ottimistica
  setWorkingLoadingByTag(prev => ({ ...prev, [tag]: true }));
  setWorkingByTag(prev => ({ ...prev, [tag]: nextValue }));

  const { error } = await supabase
    .from("ticket")
    .update({ in_lavorazione_ora: nextValue })
    .eq("n_tag", tag);

  if (error) {
    // rollback se fallisce
    setWorkingByTag(prev => ({ ...prev, [tag]: !nextValue }));
  }

  setWorkingLoadingByTag(prev => ({ ...prev, [tag]: false }));
};
  return (
    <div className={`flex h-screen w-full font-mono overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-[#1e1e1e] text-[#d4d4d4]' : 'bg-white text-[#333]'}`}>
      
      {/* SIDEBAR RIPRISTINATA */}
      <div className={`w-64 border-r flex flex-col shrink-0 ${isDarkMode ? 'bg-[#181818] border-[#121212]' : 'bg-[#f3f3f3] border-[#ddd]'}`}>
        <div className="border-b border-black/10">
          <div onClick={() => setShowLegend(!showLegend)} className="p-4 py-3 flex justify-between cursor-pointer hover:bg-black/5 items-center">
            <span className="text-[9px] font-black uppercase opacity-50 tracking-widest">Legenda & Info</span>
            <span className="text-[10px]">{showLegend ? '▼' : '▲'}</span>
          </div>
          {showLegend && (
            <div className="px-4 pb-4 flex flex-col gap-3 text-[11px]">
              {/* Contatori */}
              <div className="flex justify-between"><span>@ Clienti:</span> <span className="font-bold text-blue-400">{clients.length}</span></div>
              <div className="flex justify-between"><span># Ticket:</span> <span className="font-bold text-amber-500">{tickets.length}</span></div>
              <hr className="opacity-10" />
              {/* Sostituzioni */}
              <div className="flex flex-col gap-1.5 opacity-80">
                <div className="flex items-center gap-2"><span className="text-blue-400 font-bold w-4">@</span> Cliente</div>
                <div className="flex items-center gap-2"><span className="text-amber-500 font-bold w-4">#</span> N° Tag</div>
                <div className="flex items-center gap-2"><span className="text-green-500 font-bold w-4">" "</span> Titolo</div>
                <div className="flex items-center gap-2"><span className="text-purple-400 font-bold w-4">(c)</span> Rilascio Coll.</div>
                <div className="flex items-center gap-2"><span className="text-red-500 font-bold w-4">(p)</span> Rilascio Prod.</div>
              </div>
              <hr className="opacity-10" />
              {/* Stati Validazione */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_green]" /> <span>Validato</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_5px_yellow]" /> <span>Incongruenza</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_red]" /> <span>Non Trovato</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 py-3 text-[9px] font-black uppercase opacity-50 flex justify-between items-center">
            Files 
            <button onClick={() => {
              const n = { id: Date.now(), content: "Nuova Tab\n" };
              setTabs([...tabs, n]); setActiveTabId(n.id);
            }} className="text-amber-500 hover:text-white text-lg font-bold">+</button>
          </div>
          {tabs.map(t => (
            <div key={t.id} onClick={() => setActiveTabId(t.id)} className={`px-4 py-2 text-[11px] cursor-pointer border-l-2 flex justify-between items-center ${activeTabId === t.id ? 'bg-black/10 border-amber-500 text-amber-500' : 'border-transparent opacity-60 hover:bg-black/5'}`}>
              <span className="truncate">{getTabName(t.content)}</span>
              <button onClick={(e) => handleCloseTab(t.id, e)} className="hover:text-red-500 ml-2">✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative min-w-0">
        <div className={`h-9 border-b flex items-center px-4 text-[11px] font-bold ${isDarkMode ? 'bg-[#181818] border-[#121212]' : 'bg-[#f3f3f3] border-[#ddd]'}`}>
          <span className="text-amber-500 underline decoration-amber-500/30 underline-offset-4 tracking-tight">
            {activeTab ? getTabName(activeTab.content) : 'Caricamento...'}
          </span>
        </div>

        <div className="flex-1 flex relative overflow-hidden">
          {menu.open && filteredSuggestions.length > 0 && (
            <div style={{ top: menu.coords.top, left: menu.coords.left }} className={`absolute z-50 border shadow-2xl rounded w-64 overflow-hidden ${isDarkMode ? 'bg-[#252526] border-[#404040]' : 'bg-white border-gray-300'}`}>
              <div className="max-h-60 overflow-y-auto">
                {filteredSuggestions.map((item, idx) => (
                  <div key={item} onClick={() => insertText(item)} className={`px-3 py-1.5 text-xs cursor-pointer ${menu.selectedIndex === idx ? 'bg-[#007acc] text-white' : 'hover:bg-black/5'}`}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GUTTER CON PALLINI */}
          <div
            className={`w-14 border-r pt-5 flex flex-col items-center shrink-0 select-none ${
              isDarkMode ? 'bg-[#1e1e1e] border-[#252526]' : 'bg-[#f9f9f9] border-gray-100'
            }`}
          >
            {lineStates.map((state, i) => {
              const tag = lineTags[i]; 
              // Recuperiamo il ticket dal tuo stato 'allTickets'
              const dbTicket = tag ? allTickets.find(t => t.n_tag.toUpperCase() === tag) : null;

              const isWorking =
                tag
                  ? (workingByTag[tag] !== undefined
                      ? workingByTag[tag]
                      : Boolean(dbTicket?.in_lavorazione_ora))
                  : false;

              const isBusy = tag ? Boolean(workingLoadingByTag[tag]) : false;

              const dotClass =
                state === 'success'
                  ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]'
                  : state === 'warning'
                  ? 'bg-yellow-500 shadow-[0_0_4px_yellow]'
                  : 'bg-red-500 shadow-[0_0_4px_red]';

              return (
                <div
                  key={i}
                  className="flex items-center gap-2 justify-end w-full pr-3"
                  style={{ height: `${fontSize + 10}px` }}
                >
                  {/* PALLINO DI STATO */}
                  {syncingRows[i] ? (
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shadow-[0_0_10px_cyan]" />
                  ) : state !== 'none' ? (
                    <button
                      type="button"
                      disabled={!tag || isBusy}
                      onClick={() => {
                        if (!tag) return;
                        toggleInLavorazioneOra(tag, !isWorking);
                      }}
                      className="relative flex items-center justify-center"
                      style={{ width: 18, height: 18 }}
                      title={tag ? `#${tag} - Priorità: ${dbTicket?.numero_priorita || 'N/D'}` : ''}
                    >
                      {/* CORONA MULTICOLORE (ON) */}
                      {isWorking && (
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: 'conic-gradient(#ff0080, #7928ca, #0070f3, #00dfd8, #00c853, #ffeb3b, #ff6d00, #ff0080)',
                            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))',
                            mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))',
                          }}
                        />
                      )}

                      {/* PALLINO CON NUMERO PRIORITÀ */}
                      <span
                        className={`
                          rounded-full transition-all duration-200 
                          flex items-center justify-center font-bold text-[8px] text-white
                          ${dotClass} 
                          ${isWorking ? 'w-3.5 h-3.5 scale-110' : 'w-3 h-3'} 
                          ${isBusy ? 'opacity-50' : ''}
                        `}
                      >
                        {/* Usiamo dbTicket che è già definito sopra nel map */}
                        {(dbTicket as any)?.numero_priorita}
                      </span>
                    </button>
                  ) : null}

                  <span className={`text-[12px] ${state === 'none' ? 'opacity-20' : 'opacity-80'}`}>
                    {i + 1}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="relative flex-1 overflow-hidden">
            <div className="absolute inset-0 p-5 pt-5 pointer-events-none whitespace-pre-wrap break-words overflow-y-auto scrollbar-hide" style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize + 10}px` }}>

                {/* ... dentro il map del contenuto split ... */}
                {(activeTab?.content || "")
                    .split(/(@[^\s]+)|(#[\w\d]+)|(".*?")|(\(coll:.*?\))|(\(prod:.*?\))/g)
                    .map((part, i) => {
                      if (!part) return null;

                      const RE_COLL = /\(coll:\s*([\d/]+)\)/;
                      const RE_PROD = /\(prod:\s*([\d/]+)\)/;

                      // helper: evidenzia SENZA padding (non sposta il caret)
                      const tokenClass = (base: string, valid: boolean) =>
                        [
                          base,
                          "relative z-10",              // solo per styling
                          "rounded-sm",                 // ok, non cambia width
                          valid
                            ? "bg-white/5"              // leggero (non cambia layout)
                            : "bg-red-500/10 shadow-[inset_0_-2px_0_rgba(239,68,68,0.95)]", // underline interno (no layout shift)
                        ].join(" ");

                      if (part.startsWith("(coll:")) {
                        const match = part.match(RE_COLL);
                        const ok = isValidDate(match ? match[1] : "");
                        return (
                          <span key={i} className={tokenClass("text-purple-400", ok)}>
                            {part}
                          </span>
                        );
                      }

                      if (part.startsWith("(prod:")) {
                        const match = part.match(RE_PROD);
                        const ok = isValidDate(match ? match[1] : "");
                        return (
                          <span key={i} className={tokenClass("text-red-400", ok)}>
                            {part}
                          </span>
                        );
                      }

                      // IMPORTANTISSIMO: evita font-bold/font-black e padding anche qui se vuoi 0 drift
                      if (part.startsWith("@")) return <span key={i} className="text-blue-400">{part}</span>;
                      if (part.startsWith("#")) return <span key={i} className="text-amber-500">{part}</span>;
                      if (part.startsWith('"')) return <span key={i} className="text-green-400 italic">{part}</span>;

                      return <span key={i}>{part}</span>;
                    })}

                  {activeTab?.content?.endsWith("\n") ? " " : ""}
            </div>
            <textarea
              ref={textAreaRef}
              spellCheck={false}
              value={activeTab?.content || ""}
              onKeyDown={(e) => {
                if (menu.open && filteredSuggestions.length > 0) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setMenu(prev => ({ ...prev, selectedIndex: Math.min(prev.selectedIndex + 1, filteredSuggestions.length - 1) })); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setMenu(prev => ({ ...prev, selectedIndex: Math.max(prev.selectedIndex - 1, 0) })); }
                  if (e.key === 'Enter') { e.preventDefault(); if (filteredSuggestions[menu.selectedIndex]) insertText(filteredSuggestions[menu.selectedIndex]); }
                  if (e.key === 'Escape') setMenu(prev => ({ ...prev, open: false }));
                }
              }}
              onChange={(e) => {
                const val = e.target.value;
                updateContent(val);
                const pos = e.target.selectionStart;

                // Reset del timer di sincronizzazione
                if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

                syncTimeoutRef.current = setTimeout(() => {
                    const lines = val.split('\n');
                    const currentLineIndex = val.substring(0, pos).split('\n').length - 1;
                    const currentLine = lines[currentLineIndex];

                    // Sincronizza solo se la riga ha i tag necessari e non è vuota
                    if (currentLine.includes('#') && (currentLine.includes('(coll:') || currentLine.includes('(prod:'))) {
                        syncReleaseDates(currentLine, currentLineIndex);
                    }
                }, 800);// Aspetta 800ms di inattività sulla riga
            }}
              className="absolute inset-0 w-full h-full bg-transparent p-5 pt-5 outline-none resize-none text-transparent caret-white z-30 font-mono scrollbar-hide"
              style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize + 10}px` }}
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className={`h-6 flex items-center justify-between px-3 text-[9px] font-black uppercase shrink-0 select-none ${isDarkMode ? 'bg-[#007acc] text-white' : 'bg-[#e1e1e1] text-[#666]'}`}>
          <div className="flex gap-4 items-center">
            <span className={saveStatus === 'saving' ? 'animate-pulse text-amber-200' : 'text-green-300'}>
              {saveStatus === 'saving' ? '● SYNCING' : '● SAVED'}
            </span>
            <div className="flex gap-3 opacity-70 border-l border-white/20 pl-4 font-normal tracking-tight">
              <span>Chars: {activeTab?.content.length || 0}</span>
              <span>Lines: {activeTab?.content.split('\n').length || 0}</span>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex gap-1 border-x border-white/20 px-4">
              <button onClick={() => setFontSize(Math.max(10, fontSize - 1))} className="hover:bg-white/10 px-1">A-</button>
              <span className="w-8 text-center">{fontSize}PX</span>
              <button onClick={() => setFontSize(Math.min(30, fontSize + 1))} className="hover:bg-white/10 px-1">A+</button>
            </div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="hover:bg-white/10 px-2 transition-colors">
              {isDarkMode ? '🌙 DARK' : '☀️ LIGHT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}