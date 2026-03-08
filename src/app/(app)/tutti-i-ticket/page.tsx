'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { 
  ArrowLeft, ChevronRight, Search, Settings2, Eye, EyeOff, 
  MoveUp, MoveDown
} from 'lucide-react';

const STATO_PROGRESS_MAP: Record<string, number> = {
  "Non Iniziato": 0, "In stand-by": 5, "Attività Sospesa": 5, "In lavorazione": 30,
  "In attesa Sviluppo": 50, "In attesa risposta Sviluppatore": 60, "Attenzione Business": 75,
  "Attenzione di Andrea": 85, "Completato - In attesa di chiusura": 95, "Completato": 100
};

const APPLICATIVI_LIST = ["APPECOM", "ECOM35", "EOL", "IST35", "ESB", "GCW"];
const PRIORITA_LIST = ["Bassa", "Media", "Alta", "Urgente"];

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
  const [showConfig, setShowConfig] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMNS);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [listaAssegnatari, setListaAssegnatari] = useState<any[]>([]);
  const [listaClienti, setListaClienti] = useState<any[]>([]);
  const ATTIVITA_LIST = [
  "Preanalisi", "Evolutive GA4", "Evolutive BQ", "Incident Resolution", 
  "Reporting", "Formazione", "Supporto Funzionale Business", 
  "Analisi degli Impatti", "Supporto Tecnico"
  ];
  const SPRINT_LIST = ["Sprint", "Backlog", "Opex"];
  // Funzione per salvare su Supabase e aggiornare lo stato locale
  const saveUserSettings = async (newConfig: typeof columnOrder) => {
    setColumnOrder(newConfig);
    if (!currentUserId) return;
    
    const { error } = await supabase
      .from('profili')
      .update({ all_ticket_settings_colonne: newConfig })
      .eq('id', currentUserId);
    
    if (error) console.error("Errore salvataggio configurazione:", error);
  };

  const toggleColumn = (id: string) => {
    const newConfig = columnOrder.map(col => 
      col.id === id ? { ...col, visible: !col.visible } : col
    );
    saveUserSettings(newConfig);
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newConfig = [...columnOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newConfig.length) return;
    [newConfig[index], newConfig[targetIndex]] = [newConfig[targetIndex], newConfig[index]];
    saveUserSettings(newConfig);
  };

  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setCurrentUserId(user.id);
        const { data: profilo } = await supabase
          .from('profili')
          .select('all_ticket_settings_colonne')
          .eq('id', user.id)
          .single();
        
        if (profilo?.all_ticket_settings_colonne && Array.isArray(profilo.all_ticket_settings_colonne)) {
          setColumnOrder(profilo.all_ticket_settings_colonne);
        }
      }

      const [tRes, pRes, cRes] = await Promise.all([
        supabase.from('ticket').select(`*, clienti:cliente_id(id, nome), profili:assignee(id, nome_completo)`).order('ultimo_ping', { ascending: false }),
        supabase.from('profili').select('id, nome_completo'),
        supabase.from('clienti').select('id, nome')
      ]);

      if (tRes.data) setTickets(tRes.data);
      if (pRes.data) setListaAssegnatari(pRes.data);
      if (cRes.data) setListaClienti(cRes.data);
      setLoading(false);
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

  const toggleApp = async (ticket: any, appName: string) => {
    const currentApps = Array.isArray(ticket.applicativo) ? ticket.applicativo : [];
    const newApps = currentApps.includes(appName) 
      ? currentApps.filter((a: string) => a !== appName) 
      : [...currentApps, appName];
    await handleUpdate(ticket.id, 'applicativo', newApps);
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => 
      t.titolo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.n_tag?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tickets, searchTerm]);

  if (loading) return <div className="h-screen flex items-center justify-center font-black text-slate-300 animate-pulse uppercase tracking-widest">Loading Systems...</div>;

  return (
    <div className="p-6 bg-[#F8FAFC] min-h-screen text-slate-900">
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition"><ArrowLeft size={20}/></Link>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-800">Ticket <span className="text-blue-600">Database</span></h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">User-specific layout enabled</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
            <input type="text" placeholder="Cerca titolo o tag..." className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold w-64 outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={() => setShowConfig(!showConfig)} className={`p-2.5 rounded-2xl border transition-all ${showConfig ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-600'}`}>
            <Settings2 size={20}/>
          </button>
        </div>
      </div>

      {/* CONFIGURATORE COLONNE */}
      {showConfig && (
        <div className="mb-8 p-6 bg-white border border-slate-200 rounded-[32px] shadow-2xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-6">
             <h2 className="text-[10px] font-black uppercase tracking-widest text-blue-600">Personalizza Vista</h2>
             <button onClick={() => saveUserSettings(DEFAULT_COLUMNS)} className="text-[9px] font-black text-slate-400 hover:text-red-500 uppercase">Reset Default</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {columnOrder.map((col, index) => (
              <div key={col.id} className="flex items-center justify-between bg-slate-50/50 p-3 rounded-2xl border border-slate-100 group hover:bg-white transition-all">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleColumn(col.id)} className={col.visible ? 'text-blue-600' : 'text-slate-300'}>
                    {col.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <span className={`text-[10px] font-black uppercase ${col.visible ? 'text-slate-700' : 'text-slate-300'}`}>{col.label}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => moveColumn(index, 'up')} className="p-1 hover:text-blue-600"><MoveUp size={12} /></button>
                  <button onClick={() => moveColumn(index, 'down')} className="p-1 hover:text-blue-600"><MoveDown size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABELLA */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                {columnOrder.filter(c => c.visible).map(col => <th key={col.id} className="px-6 py-6">{col.label}</th>)}
                <th className="px-6 py-6 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
  {filteredTickets.map((t) => (
    <tr 
      key={t.id} 
      className={`hover:bg-blue-50/10 transition-all ${t.percentuale_avanzamento >= 100 ? 'bg-green-50/10' : ''}`}
    >
      {columnOrder.filter((c) => c.visible).map((col) => (
        <td key={col.id} className="px-6 py-4">
          
          {/* N° TAG & N° STORIA */}
          {(col.id === 'n_tag' || col.id === 'numero_storia') && (
            <input 
              className="bg-slate-100/50 px-2 py-1 rounded-lg text-[10px] font-black text-slate-500 w-24 outline-none border border-transparent focus:border-blue-300" 
              value={t[col.id] || ''} 
              onChange={(e) => handleUpdate(t.id, col.id, e.target.value)} 
            />
          )}

          {/* TITOLO */}
          {col.id === 'titolo' && (
            <input 
              className="w-full min-w-[200px] bg-transparent font-bold text-sm outline-none focus:text-blue-600" 
              value={t.titolo || ''} 
              onChange={(e) => handleUpdate(t.id, 'titolo', e.target.value)} 
            />
          )}

          {/* PRIORITÀ */}
          {col.id === 'priorita' && (
            <select 
              className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg outline-none ${t.priorita === 'Alta' || t.priorita === 'Urgente' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`} 
              value={t.priorita || 'Media'} 
              onChange={(e) => handleUpdate(t.id, 'priorita', e.target.value)}
            >
              {PRIORITA_LIST.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}

          {/* STATO */}
          {col.id === 'stato' && (
            <select 
              className="bg-slate-900 text-white text-[9px] font-black uppercase px-2 py-1 rounded-xl outline-none" 
              value={t.stato || ''} 
              onChange={(e) => handleUpdate(t.id, 'stato', e.target.value)}
            >
              {Object.keys(STATO_PROGRESS_MAP).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {/* PROGRESS % */}
          {col.id === 'progress' && (
            <div className="flex flex-col gap-1 w-24">
              <input 
                type="number" 
                className="w-12 bg-white border border-slate-100 rounded text-[10px] font-black text-blue-600 outline-none px-1" 
                value={t.percentuale_avanzamento ?? 0} 
                onChange={(e) => handleUpdate(t.id, 'percentuale_avanzamento', parseInt(e.target.value) || 0)} 
              />
              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-700 ${t.percentuale_avanzamento >= 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${t.percentuale_avanzamento || 0}%` }} />
              </div>
            </div>
          )}

          {/* ASSEGNATARIO & CLIENTE */}
          {col.id === 'assignee' && (
            <select className="bg-transparent text-[10px] font-bold uppercase outline-none text-slate-600" value={t.assignee || ''} onChange={(e) => handleUpdate(t.id, 'assignee', e.target.value)}>
              <option value="">Non assegnato</option>
              {listaAssegnatari.map(u => <option key={u.id} value={u.id}>{u.nome_completo}</option>)}
            </select>
          )}

          {col.id === 'cliente' && (
            <select className="bg-transparent text-[10px] font-bold uppercase outline-none text-slate-600" value={t.cliente_id || ''} onChange={(e) => handleUpdate(t.id, 'cliente_id', e.target.value)}>
              <option value="">Nessun Cliente</option>
              {listaClienti.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}

          {/* APPLICATIVI (Multi-tag) */}
          {col.id === 'applicativo' && (
            <div className="flex flex-wrap gap-1 max-w-[180px]">
              {APPLICATIVI_LIST.map(app => (
                <button 
                  key={app} 
                  onClick={() => toggleApp(t, app)} 
                  className={`px-2 py-0.5 rounded text-[8px] font-black transition-all border ${t.applicativo?.includes(app) ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-blue-400'}`}
                >
                  {app}
                </button>
              ))}
            </div>
          )}

          {/* TIPO DI ATTIVITÀ (Select) */}
          {col.id === 'tipo_di_attivita' && (
            <select 
              className="bg-transparent text-[10px] font-bold uppercase outline-none text-slate-600 border-b border-transparent focus:border-slate-200" 
              value={t.tipo_di_attivita || ''} 
              onChange={(e) => handleUpdate(t.id, 'tipo_di_attivita', e.target.value)}
            >
              <option value="">Seleziona...</option>
              {ATTIVITA_LIST.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}

          {/* SPRINT (Select) */}
          {col.id === 'sprint' && (
            <select 
              className="bg-transparent text-[10px] font-bold uppercase outline-none text-slate-600 border-b border-transparent focus:border-slate-200" 
              value={t.sprint || ''} 
              onChange={(e) => handleUpdate(t.id, 'sprint', e.target.value)}
            >
              <option value="">Nessuno</option>
              {SPRINT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {/* DATE (Collaudo, Produzione, Chiusura) */}
          {(col.id === 'rilascio_in_collaudo' || col.id === 'rilascio_in_produzione' || col.id === 'data_chiusura_attivita') && (
            <input 
              type="date" 
              className="bg-transparent text-[10px] font-bold outline-none text-slate-600" 
              value={t[col.id] || ''} 
              onChange={(e) => handleUpdate(t.id, col.id, e.target.value)} 
            />
          )}

          {/* CHECKBOX OK */}
          {(col.id === 'rilascio_collaudo_eseguito' || col.id === 'rilascio_produzione_eseguito') && (
            <div className="flex justify-center">
              <input 
                type="checkbox" 
                className={`w-4 h-4 rounded border-slate-300 ${col.id.includes('produzione') ? 'accent-green-600' : 'accent-blue-600'}`}
                checked={t[col.id] || false} 
                onChange={(e) => handleUpdate(t.id, col.id, e.target.checked)} 
              />
            </div>
          )}

          {/* ULTIMO PING */}
          {col.id === 'ultimo_ping' && (
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
              {t.ultimo_ping ? new Date(t.ultimo_ping).toLocaleDateString() : '-'}
            </div>
          )}

        </td>
      ))}
      
      <td className="px-6 py-4 text-right">
        <Link 
          href={`/ticket/${t.id}`} 
          className="p-2 inline-block rounded-xl border border-slate-200 text-slate-300 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all"
        >
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
  );
}