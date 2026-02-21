'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { 
  ArrowLeft, Mail, MessageSquare, 
  Clock, CloudCheck, CloudUpload, History, Send, Calendar,
  ChevronDown, ChevronUp, Layers, Hash, Activity, ChevronRight, 
  AlertCircle, Bell, User, Star, Rocket 
} from 'lucide-react'

export default function TicketDettaglioPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [colleghi, setColleghi] = useState<any[]>([])
  const [clienti, setClienti] = useState<any[]>([])
  const [ticketData, setTicketData] = useState<any>(null)
  
  const [nuovoThread, setNuovoThread] = useState('')
  const [dataInvioMail, setDataInvioMail] = useState(new Date().toISOString().split('T')[0])
  const [isLogOpen, setIsLogOpen] = useState(false)

  useEffect(() => {
    async function loadData() {
      const { data: ticket } = await supabase.from('ticket').select(`*, clienti (nome, id), profili:assignee (nome_completo, id)`).eq('id', id).single()
      const { data: dataColleghi } = await supabase.from('profili').select('id, nome_completo')
      const { data: dataClienti } = await supabase.from('clienti').select('id, nome')
      
      if (ticket) setTicketData(ticket)
      if (dataColleghi) setColleghi(dataColleghi)
      if (dataClienti) setClienti(dataClienti)
      setLoading(false)
    }
    loadData()
  }, [id, supabase])

const handleUpdate = async (field: string, value: any) => {
  if (!id) return;

  // Update locale (ottimistico)
  setTicketData((prev: any) => {
    const newData = { ...prev, [field]: value };
    if (field === 'cliente_id') {
      const c = clienti.find(item => String(item.id) === String(value));
      newData.clienti = { ...prev.clienti, nome: c?.nome };
    }
    return newData;
  });

  setSaving(true);

  // PULIZIA: Assicuriamoci che l'ID sia nel formato corretto
  // Se il tuo ID nel DB è un numero, usa Number(id). Se è UUID, usa String(id).
  const targetId = typeof id === 'string' ? id : id[0]; 

  const { error } = await supabase
    .from('ticket')
    .update({ [field]: value })
    .eq('id', targetId);
  
  if (error) {
    console.error("ERRORE SUPABASE DIRETTO:", error.message, error.details);
  }

  setTimeout(() => setSaving(false), 400);
};

  const aggiungiThreadEUpdatePing = async () => {
    const testoPulito = nuovoThread.trim();
    if (!testoPulito) return;
    
    setSaving(true);
    const dateObj = new Date(dataInvioMail);
    const dataFormattata = dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
    
    const logEntry = `[MAIL DEL ${dataFormattata}]\n${testoPulito}\n\n`;
    const nuovoStorico = logEntry + (ticketData.aggiornamento_storia || '');
    
    const { error } = await supabase.from('ticket').update({ 
      aggiornamento_storia: nuovoStorico, 
      ultimo_ping: dataInvioMail 
    }).eq('id', id);

    if (!error) {
      setTicketData((prev: any) => ({ ...prev, aggiornamento_storia: nuovoStorico, ultimo_ping: dataInvioMail }));
      setNuovoThread('');
      setIsLogOpen(true);
    }
    setTimeout(() => setSaving(false), 400);
  }

  const getSprintOptions = () => {
    if (ticketData?.tipo_di_attivita === 'Incident Resolution') return ['Opex', 'Backlog Opex'];
    return ['Sprint', 'Backlog'];
  }

  if (loading || !ticketData) return <div className="p-10 text-xs font-mono text-gray-400 animate-pulse uppercase tracking-widest text-center">Inizializzazione...</div>

  return (
    <div className="min-h-screen bg-[#FBFBFB] p-4 lg:p-8 font-sans text-gray-900">
      <div className="max-w-[1600px] mx-auto">
        
        {/* NAV & STATUS */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => router.back()} className="group flex items-center gap-2 text-gray-400 hover:text-blue-600 transition-all font-black uppercase text-[10px] tracking-widest">
            <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 transition-all">
              <ArrowLeft size={14} />
            </div>
            Torna alla Dashboard
          </button>
          
          <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 border-r border-gray-100 pr-4">
               <div className={`w-2 h-2 rounded-full ${saving ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
               <span className="text-[10px] font-black uppercase tracking-tighter text-gray-500">
                {saving ? 'Sincronizzazione...' : 'Dati Salvati'}
               </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-gray-300 tracking-widest">ID: {id?.toString().slice(0,8)}</span>
          </div>
        </div>

        {/* HEADER AREA */}
        <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm mb-8">
          <div className="flex flex-col gap-6">
            <input 
              type="text" 
              value={ticketData.titolo} 
              onChange={(e) => handleUpdate('titolo', e.target.value)} 
              className="text-3xl font-black bg-transparent outline-none focus:bg-gray-50 rounded-xl w-full tracking-tighter text-gray-900 transition-all py-1"
            />

            <div className="flex flex-wrap items-center gap-y-4 gap-x-6 pt-4 border-t border-gray-50">
              {/* Cliente */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Layers size={10} /> Cliente</span>
                <select value={ticketData.cliente_id} onChange={(e) => handleUpdate('cliente_id', e.target.value)} className="bg-transparent font-bold text-xs text-blue-600 outline-none appearance-none cursor-pointer">
                  {clienti.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              {/* Applicativo (Condizionale Esselunga) */}
              {ticketData.clienti?.nome?.toLowerCase() === 'esselunga' && (
                <div className="flex flex-col gap-1 px-6 border-l border-gray-100 animate-in fade-in slide-in-from-left-2 duration-300">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Activity size={10} /> Applicativo</span>
                  <select value={ticketData.applicativo || ''} onChange={(e) => handleUpdate('applicativo', e.target.value)} className="bg-transparent font-black text-xs text-blue-600 outline-none appearance-none cursor-pointer">
                    <option value="" disabled>Seleziona...</option>
                    <option value="ECOM35">ECOM35</option>
                    <option value="APPECOM">APPECOM</option>
                    <option value="EOL">EOL</option>
                    <option value="ESB">ESB</option>
                    <option value="GCW">GCW</option>
                    <option value="IST35">IST35</option>
                  </select>
                </div>
              )}

              {/* Tag (Condizionale Esselunga) */}
              {ticketData.clienti?.nome?.toLowerCase() === 'esselunga' && (
                <div className="flex flex-col gap-1 px-6 border-l border-gray-100">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Hash size={10} /> Tag</span>
                  <input type="text" value={ticketData.n_tag || ''} onChange={(e) => handleUpdate('n_tag', e.target.value)} className="bg-transparent font-bold text-xs text-gray-900 outline-none w-20" placeholder="N/A" />
                </div>
              )}

              {/* Priorità */}
              <div className="flex flex-col gap-1 px-6 border-l border-gray-100">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><Star size={10} /> Priorità</span>
                <select value={ticketData.priorita} onChange={(e) => handleUpdate('priorita', e.target.value)} className={`bg-transparent font-black text-xs outline-none appearance-none cursor-pointer ${ticketData.priorita === 'Urgente' ? 'text-red-500' : 'text-gray-900'}`}>
                  <option>Bassa</option>
                  <option>Media</option>
                  <option>Alta</option>
                  <option>Urgente</option>
                </select>
              </div>

              {/* Owner */}
              <div className="flex flex-col gap-1 px-6 border-l border-gray-100 ml-auto">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><User size={10} /> Owner</span>
                <select value={ticketData.assignee} onChange={(e) => handleUpdate('assignee', e.target.value)} className="bg-transparent font-bold text-xs text-purple-600 outline-none appearance-none cursor-pointer">
                  {colleghi.map(col => <option key={col.id} value={col.id}>{col.nome_completo}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* DESCRIPTION */}
          <div className="lg:col-span-8">
            <div className="bg-white border border-gray-100 rounded-[32px] shadow-sm overflow-hidden flex flex-col h-[600px]">
              <div className="px-8 py-4 border-b border-gray-50 flex items-center gap-2">
                <MessageSquare size={16} className="text-gray-400" />
                <span className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Brief & Documentazione</span>
              </div>
              <textarea 
                value={ticketData.descrizione || ''} 
                onChange={(e) => handleUpdate('descrizione', e.target.value)} 
                className="flex-1 p-8 text-[16px] leading-[1.6] outline-none resize-none bg-white text-gray-700 font-medium placeholder:text-gray-200"
              />
            </div>
          </div>

          {/* CONTROLS COLUMN */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* PROJECT METRICS */}
            <div className="p-8 bg-white border border-gray-100 rounded-[32px] shadow-sm space-y-6">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50 pb-4">Project Metrics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Story ID</label>
                  <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100 focus-within:border-blue-200 transition-all">
                    <Hash size={14} className="text-gray-300" />
                    <input type="text" value={ticketData.numero_storia || ''} onChange={(e) => handleUpdate('numero_storia', e.target.value)} className="bg-transparent font-black outline-none text-xs w-full" placeholder="#0000" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Slot Sprint</label>
                  <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100 focus-within:border-blue-200 transition-all">
                    <Clock size={14} className="text-gray-300" />
                    <select value={ticketData.sprint || ''} onChange={(e) => handleUpdate('sprint', e.target.value)} className="bg-transparent font-black outline-none text-xs w-full appearance-none">
                      <option value="">Nessuno</option>
                      {getSprintOptions().map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tipo di Attività</label>
                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100 focus-within:border-blue-200 transition-all">
                  <Activity size={14} className="text-gray-300" />
                  <select 
                    value={ticketData.tipo_di_attivita || ''} 
                    onChange={(e) => handleUpdate('tipo_di_attivita', e.target.value)} 
                    className="bg-transparent font-black outline-none text-xs w-full appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Seleziona...</option>
                    <option value="Preanalisi">Preanalisi</option>
                    <option value="Evolutiva GA4">Evolutiva GA4</option>
                    <option value="Evolutiva BQ">Evolutiva BQ</option>
                    <option value="Incident Resolution">Incident Resolution</option>
                    <option value="Reporting">Reporting</option>
                    <option value="Formazione">Formazione</option>
                    <option value="Supporto Tecnico">Supporto Tecnico</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* MAIL THREAD ENGINE */}
            <div className="bg-white border border-gray-100 rounded-[24px] shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 pb-3">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-blue-600 font-black uppercase text-[9px] tracking-[0.15em]"><Mail size={14} /> Thread Mail</div>
                  <input type="date" value={dataInvioMail} onChange={(e) => setDataInvioMail(e.target.value)} className="text-[10px] font-black text-gray-400 outline-none bg-transparent" />
                </div>
                <div className="relative">
                  <textarea 
                    value={nuovoThread} 
                    onChange={(e) => setNuovoThread(e.target.value)} 
                    placeholder="Incolla thread..." 
                    className="w-full bg-gray-50 rounded-xl p-4 text-[12px] min-h-[80px] outline-none resize-none font-medium border border-transparent focus:border-blue-100 focus:bg-white transition-all"
                  />
                  <button onClick={aggiungiThreadEUpdatePing} className="absolute bottom-3 right-3 bg-blue-600 text-white p-2 rounded-lg hover:scale-105 active:scale-95 transition-all">
                    <Send size={14} />
                  </button>
                </div>
              </div>

              <button onClick={() => setIsLogOpen(!isLogOpen)} className="w-full py-3 bg-gray-50/50 border-t border-gray-50 flex items-center justify-center gap-2 text-[9px] font-black text-gray-400 uppercase hover:text-gray-600 transition-all">
                {isLogOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {isLogOpen ? 'Nascondi Storico' : 'Vedi Storico'}
              </button>
              
              <div className={`transition-all duration-300 ease-in-out bg-[#FDFDFD] ${isLogOpen ? 'max-h-[250px] p-5 border-t border-gray-50 opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                <div className="font-mono text-[10px] text-gray-400 whitespace-pre-wrap leading-relaxed">
                  {ticketData.aggiornamento_storia || 'Nessun thread salvato.'}
                </div>
              </div>
            </div>

            {/* RELEASE PIPELINE */}
            <div className="p-8 bg-white border border-gray-100 rounded-[32px] shadow-sm space-y-6">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50 pb-4">Release Pipeline</h3>
              <div className="space-y-4">
                {/* Collaudo */}
                <div className={`p-4 rounded-3xl border transition-all ${ticketData.rilascio_collaudo_eseguito ? 'bg-purple-50/50 border-purple-100 shadow-sm' : 'bg-gray-50/50 border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${ticketData.rilascio_collaudo_eseguito ? 'bg-purple-100 text-purple-600' : 'bg-white text-gray-300'}`}><Bell size={14} /></div>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${ticketData.rilascio_collaudo_eseguito ? 'text-purple-700' : 'text-gray-400'}`}>Collaudo</span>
                    </div>
                    <button onClick={() => handleUpdate('rilascio_collaudo_eseguito', !ticketData.rilascio_collaudo_eseguito)} className={`px-4 py-1.5 rounded-full text-[9px] font-black border uppercase transition-all ${ticketData.rilascio_collaudo_eseguito ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-100' : 'bg-white text-gray-400 border-gray-200'}`}>
                      {ticketData.rilascio_collaudo_eseguito ? 'DEPLOYED' : 'Mark'}
                    </button>
                  </div>
                  <input type="date" value={ticketData.rilascio_in_collaudo || ''} onChange={(e) => handleUpdate('rilascio_in_collaudo', e.target.value)} className="w-full text-xs font-black bg-white/80 border border-gray-100 p-3 rounded-2xl outline-none text-purple-700" />
                </div>

                {/* Produzione */}
                <div className={`p-4 rounded-3xl border transition-all ${ticketData.rilascio_produzione_eseguito ? 'bg-green-50/50 border-green-100 shadow-sm' : 'bg-gray-50/50 border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${ticketData.rilascio_produzione_eseguito ? 'bg-green-100 text-green-600' : 'bg-white text-gray-300'}`}><Rocket size={14} /></div>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${ticketData.rilascio_produzione_eseguito ? 'text-green-700' : 'text-gray-400'}`}>Produzione</span>
                    </div>
                    <button onClick={() => handleUpdate('rilascio_produzione_eseguito', !ticketData.rilascio_produzione_eseguito)} className={`px-4 py-1.5 rounded-full text-[9px] font-black border uppercase transition-all ${ticketData.rilascio_produzione_eseguito ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-100' : 'bg-white text-gray-400 border-gray-200'}`}>
                      {ticketData.rilascio_produzione_eseguito ? 'LIVE' : 'Mark'}
                    </button>
                  </div>
                  <input type="date" value={ticketData.rilascio_in_produzione || ''} onChange={(e) => handleUpdate('rilascio_in_produzione', e.target.value)} className="w-full text-xs font-black bg-white/80 border border-gray-100 p-3 rounded-2xl outline-none text-green-700" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}