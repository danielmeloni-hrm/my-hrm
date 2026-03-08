'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { 
  ArrowLeft, Building2, ChevronRight, Layers, ListTodo, PlayCircle, CheckCircle2, 
  Search, Loader2, Settings2, Eye, EyeOff, MoveUp, MoveDown, 
  Calendar, Clock, AlertCircle, User, ArrowUpDown, ChevronUp, ChevronDown
} from 'lucide-react';

const STORAGE_KEY = 'miei_ticket_config';

const INITIAL_COLUMNS = [
  { id: 'id', label: 'ID Ticket', visible: false },
  { id: 'n_tag', label: 'N° Tag', visible: true },
  { id: 'titolo', label: 'Titolo', visible: true },
  { id: 'priorita', label: 'Priorità', visible: true },
  { id: 'applicativo', label: 'App', visible: true },
  { id: 'tipo_di_attivita', label: 'Attività', visible: true },
  { id: 'cliente', label: 'Cliente', visible: true },
  { id: 'stato', label: 'Stato', visible: true },
  { id: 'descrizione', label: 'Descrizione', visible: false },
  { id: 'created_at', label: 'Data Creazione', visible: false },
  { id: 'ultimo_ping', label: 'Ultimo Ping', visible: true },
];

export default function MieiTicketPage() {
  const supabase = useMemo(() => createClient(), []);
  
  // STATI DATI E UI
  const [tickets, setTickets] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [columnOrder, setColumnOrder] = useState(INITIAL_COLUMNS);

  // STATI ORDINAMENTO E FILTRI
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'ultimo_ping', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterApp, setFilterApp] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('me'); 
  const [selectedMacroarea, setSelectedMacroarea] = useState<'todo' | 'progress' | 'complete' | null>(null);

  const APPLICATIVI = ["APPECOM", "ECOM35", "EOL", "IST35", "ESB", "GCW"];
  const TIPI_ATTIVITA = ["Preanalisi", "Evolutive GA4", "Evolutive BQ", "Incident Resolution", "Reporting", "Formazione", "Supporto Funzionale Business", "Analisi degli Impatti", "Supporto Tecnico"];
  const TUTTI_GLI_STATI = ["Attività Sospesa", "Non Iniziato", "In stand-by", "In lavorazione", "In attesa Sviluppo", "In attesa risposta Sviluppatore", "Attenzione Business", "Attenzione di Andrea", "Completato - In attesa di chiusura", "Completato"];
  const PRIORITA_OPZIONI = ["Bassa", "Media", "Alta", "Urgente"];

  const MACROAREE = {
    todo: { label: "To-do", icon: <ListTodo size={14} />, stati: ["Attività Sospesa", "Non Iniziato", "In stand-by"] },
    progress: { label: "In Progress", icon: <PlayCircle size={14} />, stati: ["In lavorazione", "In attesa Sviluppo", "In attesa risposta Sviluppatore", "Attenzione Business", "Attenzione di Andrea"] },
    complete: { label: "Complete", icon: <CheckCircle2 size={14} />, stati: ["Completato - In attesa di chiusura", "Completato"] }
  };

  // Caricamento profili (UUID e Nome)
  useEffect(() => {
    async function loadProfiles() {
      const { data } = await supabase.from('profili').select('id, nome').order('nome');
      if (data) setProfiles(data);
    }
    loadProfiles();
  }, [supabase]);

  // Persistenza configurazione colonne
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { try { setColumnOrder(JSON.parse(saved)); } catch (e) { console.error(e); } }
  }, []);

  const saveColumns = (newCols: typeof INITIAL_COLUMNS) => {
    setColumnOrder(newCols);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCols));
  };

  const toggleColumn = (id: string) => {
    const next = columnOrder.map(c => c.id === id ? { ...c, visible: !c.visible } : c);
    saveColumns(next);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const next = [...columnOrder];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    saveColumns(next);
  };

  // Fetch dei ticket con filtro assegnatario (UUID)
  useEffect(() => {
    async function fetchTickets() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      let query = supabase.from('ticket').select(`*, clienti:cliente_id (nome), profili:assignee (nome)`);
      
      if (filterAssignee === 'me' && user) {
        query = query.eq('assignee', user.id);
      } else if (filterAssignee !== 'all') {
        query = query.eq('assignee', filterAssignee);
      }

      const { data, error } = await query;
      if (!error) setTickets(data || []);
      setLoading(false);
    }
    fetchTickets();
  }, [supabase, filterAssignee]);

  const handleUpdate = async (id: string, field: string, value: any) => {
    setUpdatingId(`${id}-${field}`);
    const { error } = await supabase.from('ticket').update({ [field]: value }).eq('id', id);
    if (!error) setTickets(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    setUpdatingId(null);
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const processedTickets = useMemo(() => {
    let result = tickets.filter(t => {
      const matchesSearch = searchTerm === '' || 
        t.titolo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.clienti?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.n_tag?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesApp = filterApp === '' || t.applicativo === filterApp;
      const matchesStatus = !selectedMacroarea || MACROAREE[selectedMacroarea].stati.includes(t.stato);
      return matchesSearch && matchesApp && matchesStatus;
    });

    if (sortConfig.direction) {
      result.sort((a, b) => {
        let valA = a[sortConfig.key] ?? '';
        let valB = b[sortConfig.key] ?? '';
        if (sortConfig.key === 'cliente') valA = a.clienti?.nome ?? '';
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [tickets, searchTerm, filterApp, selectedMacroarea, sortConfig]);

  const isExpired = (dateString: string | null) => {
    if (!dateString) return false;
    const diff = (new Date().getTime() - new Date(dateString).getTime()) / (1000 * 3600 * 24);
    return diff > 15;
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-500 animate-pulse uppercase tracking-widest">Sincronizzazione...</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen pb-24 text-slate-900 font-sans">
      
      {/* HEADER & FILTRI */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 bg-white rounded-xl border border-slate-200 text-slate-400 hover:text-blue-600 transition shadow-sm">
            <ArrowLeft size={18} strokeWidth={3} />
          </Link>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight leading-none">I Miei Ticket</h1>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest italic">Personal Dashboard</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* ASSIGNEE FILTER (UUID BASED) */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <select 
              value={filterAssignee ?? "me"} 
              onChange={(e) => setFilterAssignee(e.target.value)} 
              className="pl-8 pr-6 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer min-w-[140px]"
            >
              <option value="me">Miei Ticket</option>
              <option value="all">Tutti i Ticket</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Cerca..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 shadow-sm w-44 font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <div className="relative">
            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <select value={filterApp ?? ""} onChange={(e) => setFilterApp(e.target.value)} className="pl-8 pr-6 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer">
              <option value="">Tutte le App</option>
              {APPLICATIVI.map(app => <option key={app} value={app}>{app}</option>)}
            </select>
          </div>

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
            <Settings2 size={14} /> Personalizza
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="mb-6 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2">
          <span className="text-[10px] font-black uppercase text-slate-400 block mb-3">Ordine e Visibilità Colonne:</span>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {columnOrder.map((col, index) => (
              <div key={col.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100 group">
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleColumn(col.id)} className={col.visible ? "text-blue-600" : "text-slate-300"}>
                    {col.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <span className={`text-[9px] font-bold uppercase truncate ${col.visible ? 'text-slate-700' : 'text-slate-300'}`}>{col.label}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
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
              {columnOrder.filter(c => c.visible).map(col => (
                <th key={col.id} className="px-6 py-4 cursor-pointer hover:text-blue-600 transition-colors group" onClick={() => requestSort(col.id)}>
                  <div className="flex items-center gap-2">
                    {col.label}
                    <span>
                      {sortConfig.key === col.id ? (
                        sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      ) : <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100" />}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {processedTickets.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50/50 transition-all group">
                {columnOrder.filter(c => c.visible).map(col => (
                  <td key={col.id} className="px-6 py-4">
                    {col.id === 'id' && <span className="text-[10px] font-mono text-slate-400">#{t.id.slice(0,8)}</span>}
                    {col.id === 'n_tag' && (
                      <input className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-black rounded border border-slate-200 w-24 outline-none focus:bg-white" value={t.n_tag ?? ""} onChange={(e) => handleUpdate(t.id, 'n_tag', e.target.value)} />
                    )}
                    {col.id === 'titolo' && (
                      <input className="font-bold text-slate-900 text-sm bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 w-full outline-none" value={t.titolo ?? ""} onChange={(e) => handleUpdate(t.id, 'titolo', e.target.value)} />
                    )}
                    {col.id === 'priorita' && (
                      <select className="text-[9px] font-black uppercase rounded-lg px-2 py-1 outline-none border border-slate-100 bg-slate-50" value={t.priorita ?? ""} onChange={(e) => handleUpdate(t.id, 'priorita', e.target.value)}>
                        <option value="">-</option>
                        {PRIORITA_OPZIONI.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    )}
                    {col.id === 'applicativo' && (
                      <select className="text-[10px] font-bold text-blue-600 bg-blue-50/50 border border-blue-100 rounded-lg px-2 py-1 outline-none" value={t.applicativo ?? ""} onChange={(e) => handleUpdate(t.id, 'applicativo', e.target.value)}>
                        <option value="">-</option>
                        {APPLICATIVI.map(app => <option key={app} value={app}>{app}</option>)}
                      </select>
                    )}
                    {col.id === 'tipo_di_attivita' && (
                      <select className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 outline-none" value={t.tipo_di_attivita ?? ""} onChange={(e) => handleUpdate(t.id, 'tipo_di_attivita', e.target.value)}>
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
                        <select className="text-[9px] font-black uppercase bg-transparent outline-none cursor-pointer" value={t.stato ?? ""} onChange={(e) => handleUpdate(t.id, 'stato', e.target.value)}>
                          {TUTTI_GLI_STATI.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    )}
                    {col.id === 'descrizione' && (
                      <input className="text-[10px] text-slate-400 bg-transparent border-none w-full outline-none italic" value={t.descrizione ?? ""} placeholder="..." onChange={(e) => handleUpdate(t.id, 'descrizione', e.target.value)} />
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