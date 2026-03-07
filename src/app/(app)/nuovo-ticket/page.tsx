'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  FileText, Send, Info, Plus, X, Check, LayoutGrid, 
  User, Star, Hash, Activity 
} from 'lucide-react'

export default function NuovoTicketPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<{id: string, email: string} | null>(null)
  const [clienti, setClienti] = useState<{ id: string; nome: string }[]>([])
  const [colleghi, setColleghi] = useState<{ id: string; nome_completo: string }[]>([])
  
  const [isAddingNewCliente, setIsAddingNewCliente] = useState(false)
  const [newClienteName, setNewClienteName] = useState('')

  // STATO FORM
  const [formData, setFormData] = useState({
    titolo: '',
    descrizione: '',
    cliente_id: '',
    priorita: '10', // Default come da screen
    assignee: '',
    n_tag: '',
    applicativo: [] as string[],
    tipo_di_attivita: '',
    sprint_type: 'sprint' // 'sprint' o 'opex'
  })

  const isEsselunga = clienti.find(c => c.id === formData.cliente_id)?.nome.toLowerCase().includes('esselunga');

  useEffect(() => {
    async function initData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser({ id: user.id, email: user.email || '' })
        setFormData(prev => ({ ...prev, assignee: user.id }))
      }
      const { data: dataClienti } = await supabase.from('clienti').select('*').order('nome')
      if (dataClienti) setClienti(dataClienti)
      const { data: dataColleghi } = await supabase.from('profili').select('id, nome_completo').order('nome_completo')
      if (dataColleghi) setColleghi(dataColleghi)
    }
    initData()
  }, [supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessione scaduta");

      const ticketToInsert = {
        titolo: formData.titolo,
        descrizione: formData.descrizione,
        priorita: formData.priorita,
        stato: 'Aperto',
        utente_id: user.id,
        cliente_id: formData.cliente_id || null,
        assignee: formData.assignee || user.id,
        percentuale_avanzamento: 0,
        // Logica sprint basata sullo switch o sul cliente
        sprint: !isEsselunga ? 'sprint' : (formData.sprint_type === 'sprint' ? 'sprint' : 'opex'),
        n_tag: isEsselunga ? formData.n_tag : null,
        applicativo: isEsselunga ? formData.applicativo : null,
        tipo_di_attivita: isEsselunga ? formData.tipo_di_attivita : null,
        i_ping: false,
        escalation_donatello: false,
        attivita_attive: false
      };

      const { error } = await supabase.from('ticket').insert([ticketToInsert]);
      if (error) throw error;
      router.push('/');
      router.refresh(); 
    } catch (err: any) {
      alert(`Errore: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans">
      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
            <div className="text-[12px] text-gray-400 font-medium">Default: <span className="text-gray-600">Esselunga ✓</span></div>
            <button type="submit" disabled={loading} className="bg-[#0055A5] text-white px-6 py-2 rounded-lg font-bold text-sm uppercase tracking-wider shadow-md hover:bg-[#004488] transition-all">
               {loading ? 'Caricamento...' : 'Crea'}
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* BOX SINISTRO: DETTAGLI ATTIVITÀ */}
          <div className="lg:col-span-7">
            <div className="bg-white p-8 rounded-[24px] shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="absolute top-6 right-8 w-10 h-10 bg-[#E0F2FE] rounded-full opacity-20"></div>
              
              <h2 className="text-xl font-black text-[#0F172A] mb-1">Dettagli Attività</h2>
              <p className="text-[11px] text-gray-400 mb-8">Crea una nuova riga in tabella "ticket"</p>

              <div className="grid grid-cols-2 gap-x-6 gap-y-8">
                
                {/* Titolo */}
                <div className="col-span-1 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-tighter">Titolo</label>
                    <span className="text-[9px] text-[#CBD5E1]">obbligatorio</span>
                  </div>
                  <input name="titolo" required value={formData.titolo} onChange={handleChange} className="w-full p-4 bg-white border border-[#F1F5F9] rounded-2xl text-sm focus:ring-2 focus:ring-blue-100 outline-none placeholder:text-gray-300" placeholder="Es. Fix checkout - timeout..." />
                </div>

                {/* Cliente */}
                <div className="col-span-1 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-tighter">Cliente</label>
                    <span className="text-[9px] text-[#CBD5E1]">FK su tabella clienti</span>
                  </div>
                  <select name="cliente_id" required value={formData.cliente_id} onChange={handleChange} className="w-full p-4 bg-white border border-[#F1F5F9] rounded-2xl text-sm font-bold text-[#0F172A] outline-none appearance-none">
                    <option value="">Seleziona...</option>
                    {clienti.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>

                {/* SPRINT SWITCH (Come da immagine) */}
                <div className="col-span-1 space-y-2">
                  <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-tighter">Sprint</label>
                  <div className="flex bg-[#F8FAFC] p-1 rounded-xl border border-[#F1F5F9]">
                    <button type="button" onClick={() => setFormData(p => ({...p, sprint_type: 'sprint'}))} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${formData.sprint_type === 'sprint' ? 'bg-[#0055A5] text-white shadow-sm' : 'text-[#94A3B8]'}`}>
                      Sprint
                    </button>
                    <button type="button" onClick={() => setFormData(p => ({...p, sprint_type: 'opex'}))} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${formData.sprint_type === 'opex' ? 'bg-[#0055A5] text-white shadow-sm' : 'text-[#94A3B8]'}`}>
                      Opex
                    </button>
                  </div>
                </div>

                {/* Priorità */}
                <div className="col-span-1 space-y-2">
                  <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-tighter">Priorità (Numero)</label>
                  <input name="priorita" type="number" value={formData.priorita} onChange={handleChange} className="w-full p-4 bg-[#F8FAFC] border border-[#F1F5F9] rounded-2xl text-sm font-bold" />
                </div>

                {/* Assignee */}
                <div className="col-span-1 space-y-2">
                  <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-tighter">Assignee</label>
                  <select name="assignee" value={formData.assignee} onChange={handleChange} className="w-full p-4 bg-white border border-[#F1F5F9] rounded-2xl text-sm font-bold outline-none">
                    <option value="">Senza assegnatario</option>
                    {colleghi.map(col => <option key={col.id} value={col.id}>{col.nome_completo}</option>)}
                  </select>
                </div>

                {/* In Lavorazione (Estetica) */}
                <div className="col-span-1 space-y-2">
                  <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-tighter">In lavorazione ora</label>
                  <div className="flex items-center justify-between p-4 bg-white border border-[#F1F5F9] rounded-2xl">
                    <span className="text-sm font-bold text-[#0F172A]">Work</span>
                    <div className="bg-[#0055A5] text-white text-[9px] font-bold px-3 py-1 rounded-md">TRUE</div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* BOX DESTRO: APPLICATIVI (Condizionale) */}
          <div className="lg:col-span-5">
            <div className={`bg-white p-8 rounded-[24px] shadow-sm border border-gray-100 min-h-full transition-opacity ${!isEsselunga ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
              <div className="absolute top-6 right-8 w-10 h-10 bg-[#E0F2FE] rounded-full opacity-20"></div>
              
              <h2 className="text-xl font-black text-[#0F172A] mb-1">Applicativi interessati</h2>
              <p className="text-[11px] text-gray-400 mb-8">Visibile solo per Esselunga</p>

              <div className="space-y-8">
                {/* N° TAG */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-tighter">N° TAG</label>
                  <input name="n_tag" value={formData.n_tag} onChange={handleChange} className="w-full p-3 bg-white border border-[#F1F5F9] rounded-xl text-sm outline-none" placeholder="es. 3" />
                </div>

                {/* Griglia Applicativi */}
                <div className="space-y-4">
                  <label className="text-[11px] font-bold text-[#475569]">Seleziona l'applicativo dell'attività</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['APPECOM','ECOM35','EOL','ESB','IST35','GCW', 'PARAFARMACIA'].map(app => {
                      const isSelected = formData.applicativo.includes(app);
                      return (
                        <button key={app} type="button" onClick={() => {
                          const nextApps = isSelected ? formData.applicativo.filter(a => a !== app) : [...formData.applicativo, app];
                          setFormData(p => ({...p, applicativo: nextApps}));
                        }} className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase border transition-all text-left ${isSelected ? 'bg-white border-[#0055A5] text-[#0055A5] ring-1 ring-[#0055A5]' : 'bg-white border-[#F1F5F9] text-[#94A3B8]'}`}>
                          {app}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Riassunto Selezionato */}
                <div className="mt-8 p-6 bg-[#F8FAFC] rounded-2xl border border-[#F1F5F9]">
                   <label className="text-[9px] font-black text-[#94A3B8] uppercase tracking-widest block mb-2">Selezionato</label>
                   <div className="text-[12px] font-bold text-[#0F172A]">
                    {formData.applicativo.length > 0 ? formData.applicativo.join(', ') : '—'}
                   </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </form>
    </div>
  )
}