'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { 
  ArrowLeft, Building2, ChevronRight, Layers, ListTodo, PlayCircle, CheckCircle2, 
  Tag, Search, Loader2, Settings2, Eye, EyeOff, MoveUp, MoveDown, 
  Calendar, Clock, AlertCircle, ShieldAlert
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
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [columnOrder, setColumnOrder] = useState(INITIAL_COLUMNS);

  // STATI FILTRI
  const [searchTerm, setSearchTerm] = useState('');
  const [filterApp, setFilterApp] = useState('');
  const [filterAttivita, setFilterAttivita] = useState('');
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

  // PERSISTENZA COLONNE
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

  // FETCH DATI
  useEffect(() => {
    async function fetchMyTickets() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data, error } = await supabase
        .from('ticket')
        .select(`*, clienti:cliente_id (nome)`)
        .eq('assignee', user.id)
        .order('ultimo_ping', { ascending: false });
      if (!error) setTickets(data || []);
      setLoading(false);
    }
    fetchMyTickets();
  }, [supabase]);

  const handleUpdate = async (id: string, field: string, value: any) => {
    setUpdatingId(`${id}-${field}`);
    const { error } = await supabase.from('ticket').update({ [field]: value }).eq('id', id);
    if (!error) setTickets(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    setUpdatingId(null);
  };

  // LOGICA FILTRI
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = searchTerm === '' || 
        t.titolo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.clienti?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.n_tag?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesApp = filterApp === '' || t.applicativo === filterApp;
      const matchesAttivita = filterAttivita === '' || t.tipo_di_attivita === filterAttivita;
      const matchesStatus = !selectedMacroarea || MACROAREE[selectedMacroarea].stati.includes(t.stato);
      return matchesSearch && matchesApp && matchesAttivita && matchesStatus;
    });
  }, [tickets, searchTerm, filterApp, filterAttivita, selectedMacroarea]);

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
          {/* SEARCH */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Cerca titolo o cliente..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 shadow-sm w-44 font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          {/* APP FILTER */}
          <div className="relative">
            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <select value={filterApp} onChange={(e) => setFilterApp(e.target.value)} className="pl-8 pr-6 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer">
              <option value="">Tutte le App</option>
              {APPLICATIVI.map(app => <option key={app} value={app}>{app}</option>)}
            </select>
          </div>

          {/* ATTIVITÀ FILTER */}
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <select value={filterAttivita} onChange={(e) => setFilterAttivita(e.target.value)} className="pl-8 pr-6 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer">
              <option value="">Ogni Attività</option>
              {TIPI_ATTIVITA.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </div>

          {/* MACROAREE BARS */}
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

      {/* PANNELLO CONFIGURAZIONE COLONNE */}
      {showConfig && (
        <div className="mb-6 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2">
          <span className="text-[10px] font-black uppercase text-slate-400 block mb-3">Ordine e Visibilità Colonne (Solo per questa pagina):</span>
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
              {columnOrder.filter(c => c.visible).map(col => <th key={col.id} className="px-6 py-4">{col.label}</th>)}
              <th className="px-6 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTickets.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50/50 transition-all group">
                {columnOrder.filter(c => c.visible).map(col => (
                  <td key={col.id} className="px-6 py-4">
                    {/* ID */}
                    {col.id === 'id' && <span className="text-[10px] font-mono text-slate-400">#{t.id.slice(0,8)}</span>}
                    
                    {/* N TAG */}
                    {col.id === 'n_tag' && (
                      <input className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-black rounded border border-slate-200 w-24 outline-none focus:bg-white transition-colors" value={t.n_tag || ''} onChange={(e) => handleUpdate(t.id, 'n_tag', e.target.value)} />
                    )}

                    {/* TITOLO */}
                    {col.id === 'titolo' && (
                      <input className="font-bold text-slate-900 text-sm bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 w-full outline-none" value={t.titolo || ''} onChange={(e) => handleUpdate(t.id, 'titolo', e.target.value)} />
                    )}

                    {/* PRIORITÀ */}
                    {col.id === 'priorita' && (
                      <select className="text-[9px] font-black uppercase rounded-lg px-2 py-1 outline-none border border-slate-100 bg-slate-50" value={t.priorita || ''} onChange={(e) => handleUpdate(t.id, 'priorita', e.target.value)}>
                        <option value="">-</option>
                        {PRIORITA_OPZIONI.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    )}

                    {/* APPLICATIVO */}
                    {col.id === 'applicativo' && (
                      <select className="text-[10px] font-bold text-blue-600 bg-blue-50/50 border border-blue-100 rounded-lg px-2 py-1 outline-none" value={t.applicativo || ''} onChange={(e) => handleUpdate(t.id, 'applicativo', e.target.value)}>
                        <option value="">-</option>
                        {APPLICATIVI.map(app => <option key={app} value={app}>{app}</option>)}
                      </select>
                    )}

                    {/* TIPO ATTIVITÀ */}
                    {col.id === 'tipo_di_attivita' && (
                      <select className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 outline-none" value={t.tipo_di_attivita || ''} onChange={(e) => handleUpdate(t.id, 'tipo_di_attivita', e.target.value)}>
                        <option value="">-</option>
                        {TIPI_ATTIVITA.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                      </select>
                    )}

                    {/* CLIENTE */}
                    {col.id === 'cliente' && (
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400"><Building2 size={12} /> {t.clienti?.nome || 'N/D'}</div>
                    )}

                    {/* STATO */}
                    {col.id === 'stato' && (
                      <div className="flex items-center gap-2">
                        {updatingId === `${t.id}-stato` ? <Loader2 size={10} className="animate-spin text-blue-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                        <select className="text-[9px] font-black uppercase bg-transparent outline-none cursor-pointer" value={t.stato} onChange={(e) => handleUpdate(t.id, 'stato', e.target.value)}>
                          {TUTTI_GLI_STATI.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    )}

                    {/* DESCRIZIONE */}
                    {col.id === 'descrizione' && (
                      <input className="text-[10px] text-slate-400 bg-transparent border-none w-full outline-none italic" value={t.descrizione || ''} placeholder="..." onChange={(e) => handleUpdate(t.id, 'descrizione', e.target.value)} />
                    )}

                    {/* CREATED AT */}
                    {col.id === 'created_at' && (
                      <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase"><Calendar size={10}/> {t.created_at ? new Date(t.created_at).toLocaleDateString() : '-'}</div>
                    )}

                    {/* ULTIMO PING */}
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