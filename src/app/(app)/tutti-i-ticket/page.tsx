'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { 
  ArrowLeft, Building2, ChevronRight, Layers, ListTodo, PlayCircle, CheckCircle2, 
  Tag, Search, Loader2, Settings2, Eye, EyeOff, MoveUp, MoveDown, 
  Calendar, Clock, AlertCircle, Users
} from 'lucide-react';

const STORAGE_KEY = 'columnConfig_storico';

const INITIAL_COLUMNS = [
  { id: 'n_tag', label: 'N° Tag', visible: true },
  { id: 'titolo', label: 'Titolo', visible: true },
  { id: 'assignee', label: 'Assegnatario', visible: true },
  { id: 'applicativo', label: 'App', visible: true },
  { id: 'tipo_di_attivita', label: 'Attività', visible: true },
  { id: 'cliente', label: 'Cliente', visible: true },
  { id: 'stato', label: 'Stato', visible: true },
  { id: 'ultimo_ping', label: 'Ultimo Ping', visible: true },
  { id: 'created_at', label: 'Data Creazione', visible: false },
];

export default function StoricoTicketPage() {
  const supabase = useMemo(() => createClient(), []);
  
  // STATI DATI
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [columnOrder, setColumnOrder] = useState(INITIAL_COLUMNS);
  
  // STATI FILTRI
  const [searchTerm, setSearchTerm] = useState('');
  const [filterApp, setFilterApp] = useState('');
  const [filterAttivita, setFilterAttivita] = useState('');
  const [filterAssegnatario, setFilterAssegnatario] = useState('');
  const [selectedMacroarea, setSelectedMacroarea] = useState<'todo' | 'progress' | 'complete' | null>(null);
  const [listaAssegnatari, setListaAssegnatari] = useState<{id: string, nome: string}[]>([]);

  const APPLICATIVI = ["APPECOM", "ECOM35", "EOL", "IST35", "ESB", "GCW"];
  const TIPI_ATTIVITA = ["Preanalisi", "Evolutive GA4", "Evolutive BQ", "Incident Resolution", "Reporting", "Formazione", "Supporto Funzionale Business", "Analisi degli Impatti", "Supporto Tecnico"];
  const TUTTI_GLI_STATI = ["Attività Sospesa", "Non Iniziato", "In stand-by", "In lavorazione", "In attesa Sviluppo", "In attesa risposta Sviluppatore", "Attenzione Business", "Attenzione di Andrea", "Completato - In attesa di chiusura", "Completato"];

  const MACROAREE = {
    todo: { label: "To-do", icon: <ListTodo size={14} />, stati: ["Attività Sospesa", "Non Iniziato", "In stand-by"] },
    progress: { label: "In Progress", icon: <PlayCircle size={14} />, stati: ["In lavorazione", "In attesa Sviluppo", "In attesa risposta Sviluppatore", "Attenzione Business", "Attenzione di Andrea"] },
    complete: { label: "Complete", icon: <CheckCircle2 size={14} />, stati: ["Completato - In attesa di chiusura", "Completato"] }
  };

  // --- PERSISTENZA COLONNE ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setColumnOrder(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  const saveAndSetColumns = (newOrder: typeof INITIAL_COLUMNS) => {
    setColumnOrder(newOrder);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
  };

  const toggleColumn = (id: string) => {
    const next = columnOrder.map(col => col.id === id ? { ...col, visible: !col.visible } : col);
    saveAndSetColumns(next);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const next = [...columnOrder];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    saveAndSetColumns(next);
  };

  // --- LOGICA DATI ---
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data, error } = await supabase
        .from('ticket')
        .select(`*, clienti:cliente_id (nome), profili:assignee (nome_completo)`)
        .order('ultimo_ping', { ascending: false });

      if (!error && data) {
        setTickets(data);
        const assegnatariUnici = data
          .filter(t => t.assignee && t.profili?.nome_completo)
          .reduce((acc: any[], curr) => {
            if (!acc.find(i => i.id === curr.assignee)) {
              acc.push({ id: curr.assignee, nome: curr.profili.nome_completo });
            }
            return acc;
          }, [])
          .sort((a, b) => a.nome.localeCompare(b.nome));
        setListaAssegnatari(assegnatariUnici);
      }
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  const handleUpdate = async (id: string, field: string, value: any) => {
    setUpdatingId(`${id}-${field}`);
    const { error } = await supabase.from('ticket').update({ [field]: value }).eq('id', id);
    if (!error) {
      setTickets(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    }
    setUpdatingId(null);
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = searchTerm === '' || 
        t.titolo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.clienti?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.n_tag?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesApp = filterApp === '' || t.applicativo === filterApp;
      const matchesAttivita = filterAttivita === '' || t.tipo_di_attivita === filterAttivita;
      const matchesAssegnatario = filterAssegnatario === '' || t.assignee === filterAssegnatario;
      const matchesStatus = !selectedMacroarea || MACROAREE[selectedMacroarea].stati.includes(t.stato);
      return matchesSearch && matchesApp && matchesAttivita && matchesAssegnatario && matchesStatus;
    });
  }, [tickets, searchTerm, filterApp, filterAttivita, filterAssegnatario, selectedMacroarea]);

  const isExpired = (dateString: string | null) => {
    if (!dateString) return false;
    const diff = (new Date().getTime() - new Date(dateString).getTime()) / (1000 * 3600 * 24);
    return diff > 15;
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-500 uppercase tracking-widest animate-pulse">Caricamento database...</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen pb-24 text-slate-900 font-sans">
      
      {/* HEADER & FILTRI */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 bg-white rounded-xl border border-slate-200 text-slate-400 hover:text-blue-600 transition shadow-sm">
            <ArrowLeft size={18} strokeWidth={3} />
          </Link>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight leading-none">Tutti i Ticket</h1>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Global Editor</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* SEARCH */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Cerca..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 shadow-sm w-44 font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          {/* USERS FILTER */}
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <select value={filterAssegnatario} onChange={(e) => setFilterAssegnatario(e.target.value)} className="pl-8 pr-6 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer min-w-[130px]">
              <option value="">Tutti gli Utenti</option>
              {listaAssegnatari.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>

          {/* ACTIVITY FILTER */}
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <select value={filterAttivita} onChange={(e) => setFilterAttivita(e.target.value)} className="pl-8 pr-6 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer">
              <option value="">Ogni Attività</option>
              {TIPI_ATTIVITA.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </div>

          {/* MACROAREAS */}
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            {(Object.keys(MACROAREE) as Array<keyof typeof MACROAREE>).map((key) => {
              const area = MACROAREE[key];
              const isActive = selectedMacroarea === key;
              return (
                <button key={key} onClick={() => setSelectedMacroarea(isActive ? null : key)} className={`px-3 py-1 rounded-lg transition-all flex items-center gap-2 ${isActive ? `bg-slate-900 text-white shadow-md` : 'text-slate-400 hover:bg-slate-50'}`}>
                  {area.icon} <span className="text-[9px] font-black uppercase">{area.label}</span>
                </button>
              );
            })}
          </div>

          <button onClick={() => setShowConfig(!showConfig)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition shadow-sm text-[10px] font-black uppercase tracking-widest ${showConfig ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <Settings2 size={14} /> Colonne
          </button>
        </div>
      </div>

      {/* CONFIGURAZIONE COLONNE (Persistente e Ordinabile) */}
      {showConfig && (
        <div className="mb-6 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2">
          <span className="text-[10px] font-black uppercase text-slate-400 block mb-3">Visibilità e Ordine (Global):</span>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {columnOrder.map((col, index) => (
              <div key={col.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100 group">
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleColumn(col.id)} className={col.visible ? "text-blue-600" : "text-slate-300"}>
                    {col.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <span className={`text-[9px] font-bold uppercase ${col.visible ? 'text-slate-700' : 'text-slate-300'}`}>{col.label}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => moveColumn(index, 'up')} className="text-slate-400 hover:text-blue-600"><MoveUp size={10} /></button>
                  <button onClick={() => moveColumn(index, 'down')} className="text-slate-400 hover:text-blue-600"><MoveDown size={10} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABELLA */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {columnOrder.filter(c => c.visible).map(col => <th key={col.id} className="px-6 py-4">{col.label}</th>)}
              <th className="px-6 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTickets.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50/50 transition-all group">
                {columnOrder.filter(c => c.visible).map(col => (
                  <td key={col.id} className="px-6 py-4">
                    {col.id === 'titolo' && (
                      <input className="font-bold text-slate-900 text-sm bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 w-full outline-none" value={t.titolo || ''} onChange={(e) => handleUpdate(t.id, 'titolo', e.target.value)} />
                    )}
                    {col.id === 'n_tag' && (
                      <input className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-black rounded border border-slate-200 w-24 outline-none focus:bg-white transition-colors" value={t.n_tag || ''} onChange={(e) => handleUpdate(t.id, 'n_tag', e.target.value)} />
                    )}
                    {col.id === 'assignee' && (
                       <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[8px] font-black text-blue-600 border border-blue-100 uppercase">
                          {t.profili?.nome_completo?.substring(0,2) || '??'}
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 uppercase">{t.profili?.nome_completo || 'N/D'}</span>
                      </div>
                    )}
                    {col.id === 'applicativo' && (
                      <select className="text-[10px] font-bold text-blue-600 bg-blue-50/50 border border-blue-100 rounded-lg px-2 py-1 outline-none" value={t.applicativo || ''} onChange={(e) => handleUpdate(t.id, 'applicativo', e.target.value)}>
                        <option value="">-</option>
                        {APPLICATIVI.map(app => <option key={app} value={app}>{app}</option>)}
                      </select>
                    )}
                    {col.id === 'tipo_di_attivita' && (
                      <select className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 outline-none" value={t.tipo_di_attivita || ''} onChange={(e) => handleUpdate(t.id, 'tipo_di_attivita', e.target.value)}>
                        <option value="">-</option>
                        {TIPI_ATTIVITA.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                      </select>
                    )}
                    {col.id === 'cliente' && (
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400"><Building2 size={12} /> {t.clienti?.nome || 'N/D'}</div>
                    )}
                    {col.id === 'stato' && (
                      <div className="flex items-center gap-2">
                        {updatingId === `${t.id}-stato` ? <Loader2 size={10} className="animate-spin text-blue-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                        <select className="text-[9px] font-black uppercase bg-transparent outline-none cursor-pointer" value={t.stato} onChange={(e) => handleUpdate(t.id, 'stato', e.target.value)}>
                          {TUTTI_GLI_STATI.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    )}
                    {col.id === 'created_at' && (
                      <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase"><Calendar size={10}/> {t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}</div>
                    )}
                    {col.id === 'ultimo_ping' && (
                      (() => {
                        const expired = isExpired(t.ultimo_ping);
                        return (
                          <div className={`flex items-center gap-2 px-2 py-1 rounded-lg w-fit ${expired ? 'bg-red-100 text-red-700 border border-red-200' : 'text-slate-500'}`}>
                            {expired ? <AlertCircle size={12} className="text-red-600 animate-pulse" /> : <Clock size={12} />}
                            <span className="text-[9px] font-black uppercase">{t.ultimo_ping ? new Date(t.ultimo_ping).toLocaleDateString() : 'MAI'}</span>
                          </div>
                        );
                      })()
                    )}
                  </td>
                ))}
                <td className="px-6 py-4 text-right">
                  <Link href={`/ticket/${t.id}`} className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 text-slate-300 hover:bg-blue-600 hover:text-white border border-slate-100 transition shadow-sm">
                    <ChevronRight size={14} strokeWidth={3} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}