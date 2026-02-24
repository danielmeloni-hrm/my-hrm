'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  const [loading, setLoading] = useState(true);
  
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');

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
        // Carica Clienti
        const { data: cData } = await supabase.from('clienti').select('nome').order('nome');
        if (cData) setClients(cData.map(c => c.nome));

        // Carica Ticket - Versione Blindata
        const { data: tData, error: tError } = await supabase
          .from('ticket')
          .select('n_tag') // La colonna esiste ed è di tipo text nello screen
          .order('n_tag', { ascending: false });
        
        if (tError) {
          console.error("Errore Supabase:", tError.message);
          return;
        }

        if (tData) {
          // Estraiamo i tag assicurandoci che siano stringhe pulite
          const formatted = tData
            .map(t => t.n_tag ? String(t.n_tag).trim() : '')
            .filter(val => val.length > 0);
          
          const uniqueTickets = Array.from(new Set(formatted));
          setTickets(uniqueTickets);
          console.log("Ticket caricati con successo:", uniqueTickets);
        }
      } catch (err) {
        console.error("Errore imprevisto:", err);
      }
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
        const initialTab = { id: Date.now(), content: "Nuovo Documento\nScrivi qui..." };
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

  const filteredSuggestions = useMemo(() => {
    const list = menu.type === 'client' ? clients : tickets;
    return list.filter(i => i.toLowerCase().includes(menu.filter.toLowerCase()));
  }, [menu.type, menu.filter, clients, tickets]);

  const updateContent = (newContent: string) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, content: newContent } : t));
  };

  const insertText = (text: string) => {
    if (!activeTab) return;
    const symbol = menu.type === 'client' ? '@' : '#';
    const pos = textAreaRef.current?.selectionStart || 0;
    const before = activeTab.content.slice(0, pos).replace(/[@#][\w\d]*$/, '');
    const after = activeTab.content.slice(pos);
    
    updateContent(`${before}${symbol}${text} ${after}`);
    setMenu(prev => ({ ...prev, open: false }));
    
    setTimeout(() => textAreaRef.current?.focus(), 0);
  };

  const getCursorXY = (textarea: HTMLTextAreaElement, selectionPoint: number) => {
    const div = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    const props = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'padding', 'border', 'width', 'boxSizing', 'whiteSpace', 'wordWrap'];
    props.forEach(prop => { (div.style as any)[prop] = (style as any)[prop]; });
    
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.top = '0';
    div.style.left = '0';
    div.textContent = textarea.value.substring(0, selectionPoint);
    
    const span = document.createElement('span');
    span.textContent = textarea.value.substring(selectionPoint) || '.';
    div.appendChild(span);
    
    document.body.appendChild(div);
    const { offsetLeft, offsetTop } = span;
    document.body.removeChild(div);

    const lineHeight = parseInt(style.lineHeight) || fontSize + 10;

    return { 
      top: offsetTop + textarea.offsetTop + lineHeight - textarea.scrollTop, 
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
      const resetTab = { id: Date.now(), content: "Nuovo Documento\n..." };
      setTabs([resetTab]);
      setActiveTabId(resetTab.id);
    } else {
      setTabs(newTabs);
      if (activeTabId === id) setActiveTabId(newTabs[0].id);
    }
  };

  return (
    <div className={`flex h-screen w-full font-mono overflow-hidden transition-colors duration-200 ${isDarkMode ? 'bg-[#1e1e1e] text-[#d4d4d4]' : 'bg-white text-[#333]'}`}>
      
      {/* SIDEBAR */}
      <div className={`w-64 border-r flex flex-col shrink-0 ${isDarkMode ? 'bg-[#181818] border-[#121212]' : 'bg-[#f3f3f3] border-[#ddd]'}`}>
        <div className="border-b border-black/10">
          <div onClick={() => setShowLegend(!showLegend)} className="p-4 py-3 flex justify-between cursor-pointer hover:bg-black/5 items-center">
            <span className="text-[9px] font-black uppercase opacity-50">Legenda</span>
            <span className="text-[10px]">{showLegend ? '▼' : '▲'}</span>
          </div>
          {showLegend && (
            <div className="px-4 pb-4 flex flex-col gap-2 text-[11px]">
              <div className="flex justify-between"><span>@ Clienti:</span> <span className="font-bold text-blue-400">{clients.length}</span></div>
              <div className="flex justify-between"><span># Ticket:</span> <span className="font-bold text-amber-500">{tickets.length}</span></div>
              <hr className="opacity-10" />
              <div className="text-[9px] opacity-50 italic">Se i Ticket sono 0, controlla la tabella "ticket" su Supabase.</div>
            </div>
          )}
          {showLegend && (
            <div className="px-4 pb-4 flex flex-col gap-2 text-[11px]">
              <div><span className="text-blue-400 font-bold mr-2">@</span> Cliente</div>
              <div><span className="text-amber-500 font-bold mr-2">#</span> N° Tag</div>
              <div><span className="text-green-500 font-bold mr-2">" "</span> Titolo</div>
              <div><span className="text-[10px] text-purple-400 font-bold">(coll: )</span> Rilascio Collaudo</div>
              <div><span className="text-[10px] text-red-500 font-bold">(prod: )</span> Rilascio Produzione</div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 py-3 text-[9px] font-black uppercase opacity-50 flex justify-between items-center">
            Files 
            <button onClick={() => {
              const n = { id: Date.now(), content: "Nuova Tab" };
              setTabs([...tabs, n]);
              setActiveTabId(n.id);
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
        {/* HEADER */}
        <div className={`h-9 border-b flex items-center px-4 text-[11px] font-bold ${isDarkMode ? 'bg-[#181818] border-[#121212]' : 'bg-[#f3f3f3] border-[#ddd]'}`}>
          <span className="text-amber-500 underline decoration-amber-500/30 underline-offset-4">
            {activeTab ? getTabName(activeTab.content) : 'Caricamento...'}
          </span>
        </div>

        {/* EDITOR AREA */}
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

          <div className={`w-12 border-r pt-5 pr-4 text-right shrink-0 select-none opacity-30 ${isDarkMode ? 'bg-[#1e1e1e] border-[#252526]' : 'bg-white border-gray-100'}`}>
            {(activeTab?.content || "").split('\n').map((_, i) => (
              <div key={i} style={{ height: `${fontSize + 10}px`, fontSize: `${fontSize - 2}px`, lineHeight: `${fontSize + 10}px` }}>{i + 1}</div>
            ))}
          </div>

          <div className="relative flex-1">
            <div className="absolute inset-0 p-5 pt-5 pointer-events-none whitespace-pre-wrap break-words overflow-y-auto" style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize + 10}px` }}>
              {(activeTab?.content || "").split(/(@[\w\d]*)|(#[\w\d]*)|(".*?")|(\(coll:.*?\))|(\(prod:.*?\))/g).map((part, i) => {
                if (!part) return null;
                if (part.startsWith('@')) return <span key={i} className="text-blue-400 font-bold">{part}</span>;
                if (part.startsWith('#')) return <span key={i} className="text-amber-500 font-bold">{part}</span>;
                if (part.startsWith('"')) return <span key={i} className={`${isDarkMode ? 'text-green-400' : 'text-green-600'} italic font-bold`}>{part}</span>;
                if (part.startsWith('(coll:')) return <span key={i} className="text-purple-400 font-bold">{part}</span>;
                if (part.startsWith('(prod:')) return <span key={i} className="text-red-500 font-bold">{part}</span>;
                return <span key={i}>{part}</span>;
              })}
              {activeTab?.content?.endsWith('\n') ? ' ' : ''}
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
                  const before = val.slice(0, pos);
                  
                  // Regex migliorata: intercetta @ o # anche se preceduti da caratteri speciali come )
                  const match = before.match(/([@#][\w\d]*)$/);
                  
                  if (match) {
                    const currentWord = match[0];
                    const trigger = currentWord[0];
                    const searchFilter = currentWord.slice(1);

                    setMenu({ 
                      open: true, 
                      type: trigger === '@' ? 'client' : 'ticket', 
                      filter: searchFilter, 
                      selectedIndex: 0, 
                      coords: getCursorXY(e.target, pos)
                    });
                  } else {
                    setMenu(prev => ({ ...prev, open: false }));
                  }
                }}
              className="absolute inset-0 w-full h-full bg-transparent p-5 pt-5 outline-none resize-none text-transparent caret-[#aeafad] z-20 font-mono"
              style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize + 10}px` }}
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className={`h-6 flex items-center justify-between px-3 text-[10px] font-bold uppercase shrink-0 select-none ${isDarkMode ? 'bg-[#007acc] text-white' : 'bg-[#e1e1e1] text-[#666]'}`}>
          <div className="flex gap-4 items-center">
            <span className={saveStatus === 'saving' ? 'animate-pulse text-amber-200' : 'text-green-300'}>
              {saveStatus === 'saving' ? '● SYNCING' : '● SAVED'}
            </span>
            <div className="flex gap-2 opacity-70 border-l border-white/20 pl-4">
              <span>Chars: {activeTab?.content.length || 0}</span>
              <span>Lines: {activeTab?.content.split('\n').length || 0}</span>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex gap-1 border-x border-white/20 px-4">
              <button onClick={() => setFontSize(Math.max(10, fontSize - 1))} className="hover:bg-white/10 px-1">A-</button>
              <span className="w-8 text-center">{fontSize}px</span>
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