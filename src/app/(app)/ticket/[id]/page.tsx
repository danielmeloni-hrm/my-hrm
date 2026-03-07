
'use client'

import { useEffect, useState, useMemo } from 'react' // Aggiunto useMemo

import { useParams, useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase'

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

 

 

  // --- LOGICA OVERDUE (15 GIORNI) ---

  const isOverdue = useMemo(() => {

    if (!ticketData?.ultimo_ping) return false;

    const lastPing = new Date(ticketData.ultimo_ping);

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    lastPing.setHours(0, 0, 0, 0);

   

    const diffTime = today.getTime() - lastPing.getTime();

    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= 15;

  }, [ticketData?.ultimo_ping]);

  // Calcolo dinamico del numero di mail inviate

  const emailCount = useMemo(() => {

    if (!ticketData?.aggiornamento_storia) return 0;

    const matches = ticketData.aggiornamento_storia.match(/\[MAIL DEL/g);

    return matches ? matches.length : 0;

  }, [ticketData?.aggiornamento_storia]);



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



    setTicketData((prev: any) => {

      const newData = { ...prev, [field]: value };

      if (field === 'cliente_id') {

        const c = clienti.find(item => String(item.id) === String(value));

        newData.clienti = { ...prev.clienti, nome: c?.nome };

      }

      return newData;

    });



    setSaving(true);

    const targetId = typeof id === 'string' ? id : id[0];



    const { error } = await supabase

      .from('ticket')

      .update({ [field]: value })

      .eq('id', targetId);

   

    if (error) console.error("ERRORE:", error.message);

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

    {/* TITOLO TICKET */}

    <input

      type="text"

      value={ticketData.titolo || ''}

      onChange={(e) => handleUpdate('titolo', e.target.value)}

      className="text-3xl font-black bg-transparent outline-none focus:bg-gray-50 rounded-xl w-full tracking-tighter text-gray-900 transition-all py-1"

      placeholder="Titolo del ticket..."

    />



    <div className="flex flex-wrap items-center gap-y-4 gap-x-0 pt-4 border-t border-gray-50">

     

      {/* CLIENTE */}

      <div className="flex flex-col gap-1 pr-6">

        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">

          <Layers size={10} /> Cliente

        </span>

        <select

          value={ticketData.cliente_id || ''}

          onChange={(e) => handleUpdate('cliente_id', e.target.value)}

          className="bg-transparent font-bold text-xs text-blue-600 outline-none appearance-none cursor-pointer"

        >

          <option value="" disabled>Seleziona cliente</option>

          {clienti.map(c => (

            <option key={c.id} value={c.id}>{c.nome}</option>

          ))}

        </select>

      </div>



      {/* SEZIONE DINAMICA ESSELUNGA */}

      {ticketData.clienti?.nome?.toLowerCase() === 'esselunga' && (

        <>

          {/* APPLICATIVI MULTIPLI (ARRAY) */}

<div className="flex flex-col gap-2 px-6 border-l border-gray-100 animate-in fade-in slide-in-from-left-2 duration-300">

  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">

    <Activity size={10} /> Applicativi

  </span>

  <div className="flex flex-wrap gap-1.5 max-w-[350px]">

    {['ECOM35', 'APPECOM', 'EOL', 'ESB', 'GCW', 'IST35'].map((app) => {

      // Definiamo esplicitamente l'array come string[] per TypeScript

      const currentApps: string[] = Array.isArray(ticketData.applicativo)

        ? ticketData.applicativo

        : [];

     

      const isSelected = currentApps.includes(app);



      return (

        <button

          key={app}

          type="button"

          onClick={() => {

            // Ora TypeScript sa che 'a' è una stringa perché currentApps è string[]

            const nextApps = isSelected

              ? currentApps.filter((a: string) => a !== app)

              : [...currentApps, app];

            handleUpdate('applicativo', nextApps);

          }}

          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border ${

            isSelected

              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'

              : 'bg-transparent border-gray-200 text-gray-400 hover:border-blue-300'

          }`}

        >

          {app}

        </button>

      );

    })}

  </div>

</div>



          {/* TAG */}

          <div className="flex flex-col gap-1 px-6 border-l border-gray-100 animate-in fade-in slide-in-from-left-2 duration-300">

            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">

              <Hash size={10} /> Tag

            </span>

            <input

              type="text"

              value={ticketData.n_tag || ''}

              onChange={(e) => handleUpdate('n_tag', e.target.value)}

              className="bg-transparent font-bold text-xs text-gray-900 outline-none w-20"

              placeholder="N/A"

            />

          </div>

        </>

      )}



      {/* PRIORITÀ */}

      <div className="flex flex-col gap-1 px-6 border-l border-gray-100">

        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">

          <Star size={10} /> Priorità

        </span>

        <select

          value={ticketData.priorita || 'Media'}

          onChange={(e) => handleUpdate('priorita', e.target.value)}

          className={`bg-transparent font-black text-xs outline-none appearance-none cursor-pointer ${

            ticketData.priorita === 'Urgente' ? 'text-red-500' : 'text-gray-900'

          }`}

        >

          <option value="Bassa">Bassa</option>

          <option value="Media">Media</option>

          <option value="Alta">Alta</option>

          <option value="Urgente">Urgente</option>

        </select>

      </div>



      {/* SEZIONE DESTRA: AVANZAMENTO + ASSEGNATO */}

      <div className="flex items-center gap-0 ml-auto border-l border-gray-100">

       

        {/* AVANZAMENTO */}

        <div className="flex flex-col gap-1 px-6">

          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">

            <Activity size={10} /> Avanzamento

          </span>

          <div className="flex items-center gap-1">

            <input

              type="number"

              min="0"

              max="100"

              value={ticketData.percentuale_avanzamento ?? 0}

              onChange={(e) => {

                const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));

                handleUpdate('percentuale_avanzamento', val);

              }}

              className="bg-transparent font-black text-xs text-emerald-600 outline-none w-8 text-right"

            />

            <span className="text-[10px] font-black text-emerald-600 mr-2">%</span>

            <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden hidden xl:block">

              <div

                className="h-full bg-emerald-500 transition-all duration-500"

                style={{ width: `${ticketData.percentuale_avanzamento ?? 0}%` }}

              />

            </div>

          </div>

        </div>



        {/* ASSEGNATO (OWNER) */}

        <div className="flex flex-col gap-1 px-6 border-l border-gray-50">

          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">

            <User size={10} /> Assegnato

          </span>

          <select

            value={ticketData.assignee || ''}

            onChange={(e) => handleUpdate('assignee', e.target.value)}

            className="bg-transparent font-bold text-xs text-blue-600 outline-none appearance-none cursor-pointer"

          >

            <option value="">Non assegnato</option>

            {colleghi.map(col => (

              <option key={col.id} value={col.id}>{col.nome_completo}</option>

            ))}

          </select>

        </div>

      </div>



    </div>

  </div>

</div>

        {/* CONTENT GRID */}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

         

          <div className="lg:col-span-8">

            <div className="bg-white border border-gray-100 rounded-[32px] shadow-sm overflow-hidden flex flex-col h-[600px]">

              <div className="px-8 py-4 border-b border-gray-50 flex items-center gap-2">

                <MessageSquare size={16} className="text-gray-400" />

                <span className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Brief & Documentazione</span>

              </div>

              <textarea

                value={ticketData.note_importante || ''}

                onChange={(e) => handleUpdate('note_importante', e.target.value)}

                className="flex-1 p-8 text-[16px] leading-[1.6] outline-none resize-none bg-white text-gray-700 font-medium placeholder:text-gray-200"

              />
              <div className="h-[1px] bg-gray-100 w-full" />
              <textarea

                value={ticketData.note || ''}

                onChange={(e) => handleUpdate('note', e.target.value)}

                className="flex-1 p-8 text-[16px] leading-[1.6] outline-none resize-none bg-white text-gray-700 font-medium placeholder:text-gray-200"

              />
              

            </div>

          </div>



          <div className="lg:col-span-4 space-y-6">

           

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

            <div className={`bg-white border transition-all duration-300 rounded-[24px] shadow-sm overflow-hidden flex flex-col ${isOverdue ? 'border-red-200 ring-2 ring-red-50' : 'border-gray-100'}`}>

             

              {/* AREA INPUT E HEADER */}

              <div className="p-5 pb-3">

                <div className="flex items-center justify-between mb-4">

                  <div className="flex items-center gap-2">

                    <div className={`flex items-center gap-2 font-black uppercase text-[9px] tracking-[0.15em] ${isOverdue ? 'text-red-600' : 'text-blue-600'}`}>

                      {/* Switch dinamico dell'icona */}

                      {isOverdue ? (

                        <AlertCircle size={24} className="animate-pulse" />

                      ) : (

                        <Mail size={20} />

                      )}

                     

                      <span>Thread Mail</span>

                      </div>

                    {/* Badge Conteggio Mail */}

                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border transition-colors ${

                      isOverdue

                        ? 'bg-red-50 text-red-600 border-red-100'

                        : 'bg-blue-50 text-blue-600 border-blue-100'

                    }`}>

                      {emailCount}

                    </span>

                  </div>

                 

                  {/* Selettore Data Dinamico */}

                  <div className="flex items-center gap-2">

                    <Calendar size={12} className="text-gray-300" />

                    <input

                      type="date"

                      value={dataInvioMail}

                      onChange={(e) => setDataInvioMail(e.target.value)}

                      className="text-[10px] font-black text-gray-400 outline-none bg-transparent cursor-pointer hover:text-gray-600 transition-all"

                    />

                  </div>

                </div>

               

                {/* Campo Input Messaggio */}

                <div className="relative">

                  <textarea

                    value={nuovoThread}

                    onChange={(e) => setNuovoThread(e.target.value)}

                    placeholder="Incolla qui il contenuto della mail..."

                    className="w-full bg-gray-50 rounded-xl p-4 text-[12px] min-h-[100px] outline-none resize-none font-medium border border-transparent focus:border-blue-100 focus:bg-white transition-all placeholder:text-gray-300"

                  />

                  <button

                    onClick={aggiungiThreadEUpdatePing}

                    disabled={!nuovoThread.trim() || saving}

                    className={`absolute bottom-3 right-3 p-2.5 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 ${

                      isOverdue

                        ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-100'

                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'

                    }`}

                  >

                    <Send size={14} className={saving ? 'animate-pulse' : ''} />

                  </button>

                </div>

              </div>



              {/* TOGGLE STORICO */}

              <button

                onClick={() => setIsLogOpen(!isLogOpen)}

                className="w-full py-3 bg-gray-50/50 border-t border-gray-50 flex items-center justify-center gap-2 text-[9px] font-black text-gray-400 uppercase hover:text-gray-600 hover:bg-gray-100/50 transition-all"

              >

                {isLogOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}

                {isLogOpen ? 'Chiudi Log Storico' : `Vedi Storico Completo (${emailCount})`}

              </button>

             

              {/* AREA LOG ESPANDIBILE */}

              <div className={`transition-all duration-500 ease-in-out bg-[#FDFDFD] ${

                isLogOpen

                  ? 'max-h-[300px] p-5 border-t border-gray-50 opacity-100 overflow-y-auto'

                  : 'max-h-0 opacity-0 overflow-hidden'

              }`}>

                {ticketData.aggiornamento_storia ? (

                  <div className="font-mono text-[10px] text-gray-500 whitespace-pre-wrap leading-relaxed">

                    {ticketData.aggiornamento_storia}

                  </div>

                ) : (

                  <div className="text-[10px] text-gray-300 italic text-center py-4">

                    Nessun thread registrato per questo ticket.

                  </div>

                )}

              </div>

            </div>



            {/* RELEASE PIPELINE */}

            <div className="p-8 bg-white border border-gray-100 rounded-[32px] shadow-sm space-y-6">

              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50 pb-4">Release Pipeline</h3>

              <div className="space-y-4">

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