'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { 
  ArrowLeft, ChevronRight, Search, Settings2, Eye, EyeOff, 
  MoveUp, MoveDown, FilterX, LayoutGrid, AlertCircle, Rocket, Activity, AlertTriangle
} from 'lucide-react';

// --- CONFIGURAZIONI COSTANTI ---
const STATO_PROGRESS_MAP: Record<string, number> = {
  "Non Iniziato": 0, "In stand-by": 5, "Attività Sospesa": 5, "In lavorazione": 30,
  "In attesa Sviluppo": 50, "In attesa risposta Sviluppatore": 60, "Attenzione Business": 75,
  "Attenzione di Andrea": 85, "Completato - In attesa di chiusura": 95, "Completato": 100
};

const APPLICATIVI_LIST = ["APPECOM", "ECOM35", "EOL", "IST35", "ESB", "GCW"];
const PRIORITA_LIST = ["Bassa", "Media", "Alta", "Urgente"];
const ATTIVITA_LIST = [
  "Preanalisi", "Evolutive GA4", "Evolutive BQ", "Incident Resolution", 
  "Reporting", "Formazione", "Supporto Funzionale Business", 
  "Analisi degli Impatti", "Supporto Tecnico"
];
const SPRINT_LIST = ["Sprint", "Backlog", "Opex"];

const DEFAULT_COLUMNS = [
  { id: 'n_tag', label: 'N° Tag', visible: true },
  { id: 'numero_storia', label: 'N° Storia', visible: true },
  { id: 'titolo', label: 'Titolo', visible: true },
  { id: 'priorita', label: 'Priorità', visible: true },
  { id: 'stato', label: 'Stato', visible: true },
  { id: 'progress', label: 'Avanzamento %', visible: true },
  { id: 'assignee', label: 'Assegnatario', visible: true },
  { id: 'applicativo', label: 'App', visible: true },
  { id: 'tipo_di_attivita', label: 'Attività', visible: true },
  { id: 'cliente', label: 'Cliente', visible: true },
  { id: 'sprint', label: 'Sprint', visible: true },
  { id: 'rilascio_in_collaudo', label: 'Data Collaudo', visible: true },
  { id: 'rilascio_collaudo_eseguito', label: 'Collaudo OK', visible: true },
  { id: 'rilascio_in_produzione', label: 'Data Prod', visible: true },
  { id: 'rilascio_produzione_eseguito', label: 'Prod OK', visible: true },
  { id: 'data_chiusura_attivita', label: 'Chiusura', visible: true },
  { id: 'ultimo_ping', label: 'Ultimo Ping', visible: true },
];

export default function StoricoTicketPage() {
  const supabase = useMemo(() => createClient(), []);
  
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showConfig, setShowConfig] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMNS);

  // --- STATI FILTRI ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCliente, setSelectedCliente] = useState('');
  const [selectedAssegnatario, setSelectedAssegnatario] = useState('');
  const [selectedSprint, setSelectedSprint] = useState('');
  const [selectedAttivita, setSelectedAttivita] = useState('');
  const [filterAttenzioneBusiness, setFilterAttenzioneBusiness] = useState(false);

  const [listaAssegnatari, setListaAssegnatari] = useState<any[]>([]);
  const [listaClienti, setListaClienti] = useState<any[]>([]);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          const { data: profilo } = await supabase.from('profili').select('all_ticket_settings_colonne').eq('id', user.id).single();
          if (profilo?.all_ticket_settings_colonne) setColumnOrder(profilo.all_ticket_settings_colonne);
        }
        const [tRes, pRes, cRes] = await Promise.all([
          supabase.from('ticket').select(`*, clienti:cliente_id(id, nome), profili:assignee(id, nome_completo)`).order('ultimo_ping', { ascending: false }),
          supabase.from('profili').select('id, nome_completo'),
          supabase.from('clienti').select('id, nome')
        ]);
        if (tRes.error) throw tRes.error;
        setTickets(tRes.data || []);
        setListaAssegnatari(pRes.data || []);
        setListaClienti(cRes.data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [supabase]);

  const handleUpdate = async (id: string, field: string, value: any) => {
    const updatePayload: any = { [field]: value };
    if (field === 'stato' && STATO_PROGRESS_MAP[value] !== undefined) {
      updatePayload.percentuale_avanzamento = STATO_PROGRESS_MAP[value];
    }
    const { error } = await supabase.from('ticket').update(updatePayload).eq('id', id);
    if (!error) {
      const { data } = await supabase.from('ticket').select(`*, clienti:cliente_id(id, nome), profili:assignee(id, nome_completo)`).eq('id', id).single();
      setTickets(prev => prev.map(t => t.id === id ? data : t));
    }
  };

  const saveUserSettings = async (newConfig: typeof columnOrder) => {
    setColumnOrder(newConfig);
    if (currentUserId) await supabase.from('profili').update({ all_ticket_settings_colonne: newConfig }).eq('id', currentUserId);
  };

  const toggleColumn = (id: string) => {
    const newConfig = columnOrder.map(col => col.id === id ? { ...col, visible: !col.visible } : col);
    saveUserSettings(newConfig);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newConfig = [...columnOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newConfig.length) return;
    [newConfig[index], newConfig[targetIndex]] = [newConfig[targetIndex], newConfig[index]];
    saveUserSettings(newConfig);
  };

  // --- LOGICA FILTRO APPLICATA ---
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = t.titolo?.toLowerCase().includes(searchTerm.toLowerCase()) || t.n_tag?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCliente = selectedCliente === '' || String(t.cliente_id) === selectedCliente;
      const matchesAssegnatario = selectedAssegnatario === '' || String(t.assignee) === selectedAssegnatario;
      const matchesSprint = selectedSprint === '' || t.sprint === selectedSprint;
      const matchesAttivita = selectedAttivita === '' || t.tipo_di_attivita === selectedAttivita;
      const matchesAttenzione = !filterAttenzioneBusiness || t.stato === "Attenzione Business";
      
      return matchesSearch && matchesCliente && matchesAssegnatario && matchesSprint && matchesAttivita && matchesAttenzione;
    });
  }, [tickets, searchTerm, selectedCliente, selectedAssegnatario, selectedSprint, selectedAttivita, filterAttenzioneBusiness]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCliente('');
    setSelectedAssegnatario('');
    setSelectedSprint('');
    setSelectedAttivita('');
    setFilterAttenzioneBusiness(false);
  };

  if (loading) return (
    <div className="h-screen bg-[#FDFDFD] flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-[3px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4" />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Inizializzazione Sistema</span>
    </div>
  );

  return (
    <div className="p-4 md:p-8 bg-[#FAFBFC] min-h-screen text-slate-900 font-sans">
      
      {/* HEADER */}
      <header className="max-w-[1600px] mx-auto mb-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Link href="/" className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm">
                <ArrowLeft size={18} className="text-slate-500"/>
              </Link>
              <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded">v2.1 Control Panel</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
              Database <span className="text-slate-400 font-light italic">Ticket</span>
            </h1>
          </div>

          {/* ACTIONS & FILTERS BAR (MODERNIZZATA) */}
          <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input 
                type="text" 
                placeholder="Cerca..." 
                className="pl-9 pr-4 py-2 bg-slate-50 border-transparent rounded-xl text-sm w-40 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none font-medium" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>

            {/* Dropdowns */}
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
              <select className="bg-transparent px-2 py-1 text-[10px] font-bold uppercase text-slate-600 outline-none w-28" value={selectedCliente} onChange={(e) => setSelectedCliente(e.target.value)}>
                <option value="">Cliente</option>
                {listaClienti.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <select className="bg-transparent px-2 py-1 text-[10px] font-bold uppercase text-slate-600 outline-none w-28" value={selectedSprint} onChange={(e) => setSelectedSprint(e.target.value)}>
                <option value="">Tipo Ticket</option>
                {SPRINT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="bg-transparent px-2 py-1 text-[10px] font-bold uppercase text-slate-600 outline-none w-28" value={selectedAttivita} onChange={(e) => setSelectedAttivita(e.target.value)}>
                <option value="">Attività</option>
                {ATTIVITA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Pulsante Attenzione Business */}
            <button 
              onClick={() => setFilterAttenzioneBusiness(!filterAttenzioneBusiness)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all border ${
                filterAttenzioneBusiness 
                ? 'bg-purple-500 text-white border-purple-600 shadow-lg shadow-purple-200' 
                : 'bg-white text-purple-600 border-purple-200 hover:bg-purple-50'
              }`}
            >
              <AlertTriangle size={14} />
              Att. Business
            </button>

            {(searchTerm || selectedCliente || selectedAssegnatario || selectedSprint || selectedAttivita || filterAttenzioneBusiness) && (
              <button onClick={resetFilters} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Resetta filtri">
                <FilterX size={18} />
              </button>
            )}

            <div className="w-px h-6 bg-slate-200 mx-1" />

            <button onClick={() => setShowConfig(!showConfig)} className={`p-2 rounded-xl ${showConfig ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              <Settings2 size={20}/>
            </button>
          </div>
        </div>
      </header>

      {/* CONFIGURATORE COLONNE */}
      {showConfig && (
        <div className="max-w-[1600px] mx-auto mb-8 animate-in fade-in slide-in-from-top-2">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {columnOrder.map((col, index) => (
              <div key={col.id} className={`flex items-center justify-between p-2 rounded-xl border ${col.visible ? 'bg-white border-slate-200' : 'bg-slate-50 border-transparent opacity-50'}`}>
                <button onClick={() => toggleColumn(col.id)} className="flex items-center gap-2 text-[10px] font-bold uppercase">
                  {col.visible ? <Eye size={12} className="text-blue-500" /> : <EyeOff size={12} />}
                  {col.label}
                </button>
                {col.visible && (
                  <div className="flex gap-1">
                    <button onClick={() => moveColumn(index, 'up')} className="p-1 hover:bg-slate-100 rounded"><MoveUp size={10} /></button>
                    <button onClick={() => moveColumn(index, 'down')} className="p-1 hover:bg-slate-100 rounded"><MoveDown size={10} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABELLA */}
      <div className="max-w-[1600px] mx-auto">
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {columnOrder.filter(c => c.visible).map(col => (
                    <th key={col.id} className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((t) => (
                  <tr key={t.id} className="group hover:bg-slate-50/40 transition-colors">
                    {columnOrder.filter((c) => c.visible).map((col) => (
                      <td key={col.id} className="px-5 py-3">
                        
                        {/* Renderer Celle Specifiche */}
                        {col.id === 'titolo' && (
                          <input className="w-full min-w-[200px] bg-transparent font-semibold text-[13px] text-slate-800 outline-none focus:text-blue-600 transition-colors" value={t.titolo || ''} onChange={(e) => handleUpdate(t.id, 'titolo', e.target.value)} />
                        )}

                        {col.id === 'tipo_di_attivita' && (
                          <select className="bg-transparent text-[10px] font-bold text-slate-600 outline-none" value={t.tipo_di_attivita || ''} onChange={(e) => handleUpdate(t.id, 'tipo_di_attivita', e.target.value)}>
                            <option value="">Seleziona...</option>
                            {ATTIVITA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        )}

                        {col.id === 'sprint' && (
                          <select className="bg-transparent text-[10px] font-bold text-slate-600 outline-none" value={t.sprint || ''} onChange={(e) => handleUpdate(t.id, 'sprint', e.target.value)}>
                            <option value="">-</option>
                            {SPRINT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}

                        {col.id === 'stato' && (
                          <select 
                            className={`text-[9px] font-bold uppercase px-2 py-1 rounded-lg outline-none cursor-pointer border ${t.stato === 'Attenzione Business' ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-900 text-white border-transparent'}`} 
                            value={t.stato || ''} 
                            onChange={(e) => handleUpdate(t.id, 'stato', e.target.value)}
                          >
                            {Object.keys(STATO_PROGRESS_MAP).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}

                        {/* ... Altri renderer (n_tag, progress, assignee, etc) invariati dal codice precedente ... */}
                        {col.id === 'n_tag' && <input className="bg-slate-50 border-transparent px-2 py-1 rounded text-[10px] font-mono w-20" value={t.n_tag || ''} onChange={(e) => handleUpdate(t.id, 'n_tag', e.target.value)} />}
 

                          {col.id === 'progress' && (
                            <div className="flex items-center gap-2 w-28 group/progress">
                              <div className="relative">
                                <input 
                                  type="number"
                                  min="0"
                                  max="100"
                                  className="bg-slate-100/50 border-transparent px-1 py-0.5 rounded text-[10px] font-mono font-bold text-slate-600 w-10 outline-none focus:ring-1 focus:ring-green-500 focus:bg-white transition-all appearance-none"
                                  value={t.percentuale_avanzamento ?? 0}
                                  onChange={(e) => {
                                    // Aggiornamento locale immediato per fluidità UI
                                    const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                    setTickets(prev => prev.map(tick => tick.id === t.id ? { ...tick, percentuale_avanzamento: val } : tick));
                                  }}
                                  onBlur={(e) => {
                                    // Salvataggio su DB all'uscita dal campo
                                    const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                    handleUpdate(t.id, 'percentuale_avanzamento', val);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = Math.min(100, Math.max(0, parseInt((e.target as HTMLInputElement).value) || 0));
                                      handleUpdate(t.id, 'percentuale_avanzamento', val);
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                />
                                <span className="absolute -right-3 top-1/2 -translate-y-1/2 text-[8px] text-slate-400 font-bold">%</span>
                              </div>
                              
                              <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden ml-2">
                                <div 
                                  className={`h-full transition-all duration-500 ease-out ${
                                    (t.percentuale_avanzamento ?? 0) >= 100 ? 'bg-emerald-500' : 'bg-green-600'
                                  }`} 
                                  style={{ width: `${t.percentuale_avanzamento || 0}%` }} 
                                />
                              </div>
                            </div>
                          )}


                        {col.id === 'assignee' && (
                          <select className="bg-transparent text-[10px] font-bold uppercase outline-none text-slate-600" value={t.assignee || ''} onChange={(e) => handleUpdate(t.id, 'assignee', e.target.value)}>
                            <option value="">Nessuno</option>
                            {listaAssegnatari.map(u => <option key={u.id} value={u.id}>{u.nome_completo}</option>)}
                          </select>
                        )}
                        {col.id === 'cliente' && (
                          <select className="bg-transparent text-[10px] font-bold uppercase outline-none text-slate-600" value={t.cliente_id || ''} onChange={(e) => handleUpdate(t.id, 'cliente_id', e.target.value)}>
                            <option value="">Nessuno</option>
                            {listaClienti.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                          </select>
                        )}
                        {/* Gestione Date: Collaudo, Produzione e Chiusura */}
{['rilascio_in_collaudo', 'rilascio_in_produzione', 'data_chiusura_attivita'].includes(col.id) && (
  <div className="relative flex items-center group">
    <input 
      type="date" 
      className="bg-slate-100/50 border-transparent px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer appearance-none" 
      value={t[col.id] || ''} 
      onChange={(e) => handleUpdate(t.id, col.id, e.target.value)} 
    />
    {t[col.id] && (
      <button 
        onClick={() => handleUpdate(t.id, col.id, null)}
        className="ml-1 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
        title="Cancella data"
      >
        <FilterX size={12} />
      </button>
    )}
  </div>
)}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-right">
                      <Link href={`/ticket/${t.id}`} className="p-2 inline-flex rounded-lg border border-slate-100 text-slate-300 hover:text-blue-600 hover:bg-blue-50">
                        <ChevronRight size={18}/>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}