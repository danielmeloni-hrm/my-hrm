'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { FileText, Send, Info, Plus, X, Check, LayoutGrid } from 'lucide-react'

export default function NuovoTicketPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<{id: string, email: string} | null>(null)
  const [clienti, setClienti] = useState<{ id: string; nome: string }[]>([])
  const [colleghi, setColleghi] = useState<{ id: string; nome_completo: string }[]>([])
  
  const [isAddingNewCliente, setIsAddingNewCliente] = useState(false)
  const [newClienteName, setNewClienteName] = useState('')

  const [formData, setFormData] = useState({
    titolo: '',
    descrizione: '',
    cliente_id: '',
    priorita: 'Media',
    assignee: '',
    n_tag: '',
    applicativo: '',
    tipo_di_attivita: '',
  })

  // Controllo se il cliente selezionato è Esselunga
  const isEsselunga = clienti.find(c => c.id === formData.cliente_id)?.nome.toLowerCase().includes('esselunga');

  useEffect(() => {
    async function initData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUser({ id: user.id, email: user.email || '' })
        // Imposta l'assignee di default su se stessi
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

  const handleAddNewCliente = async () => {
    if (!newClienteName.trim()) return
    const { data, error } = await supabase.from('clienti').insert([{ nome: newClienteName.trim() }]).select().single()
    if (data) {
      setClienti(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
      setFormData(prev => ({ ...prev, cliente_id: data.id }))
      setIsAddingNewCliente(false)
      setNewClienteName('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere loggato per creare un ticket.");

      // Mapping esatto sui nomi delle colonne del tuo DB (public.ticket)
      const ticketToInsert = {
        titolo: formData.titolo,
        descrizione: formData.descrizione,
        priorita: formData.priorita,
        stato: 'Aperto',
        utente_id: user.id,            // Obbligatorio (FK profili)
        cliente_id: formData.cliente_id || null, // UUID del cliente
        assignee: formData.assignee || user.id,  // Collega assegnato
        // Campi Esselunga (saranno stringhe vuote o valori scelti)
        n_tag: isEsselunga ? formData.n_tag : null,
        applicativo: isEsselunga ? formData.applicativo : null,
        tipo_di_attivita: isEsselunga ? formData.tipo_di_attivita : null,
        // Default booleani
        i_ping: false,
        escalation_donatello: false,
        attivita_attive: false
      };

      const { error } = await supabase
        .from('ticket')
        .insert([ticketToInsert]);

      if (error) throw error;

      router.push('/');
      router.refresh(); 

    } catch (err: any) {
      console.error("Errore database:", err);
      alert(`Errore durante il salvataggio: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6 text-black">
        
        {/* Header con pulsante Salva */}
        <div className="flex justify-between items-center border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-blue-600" /> Nuovo Ticket Operativo
          </h1>
          <button 
            type="submit" 
            disabled={loading} 
            className="bg-blue-600 text-white px-8 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {loading ? 'Salvataggio...' : <><Send size={18}/> Crea Ticket</>}
          </button>
        </div>

        {/* PROPRIETÀ PRINCIPALI */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-2 text-blue-600 font-bold mb-4">
            <Info size={18} /> <span>Proprietà Principali</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cliente */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-400 uppercase ml-1">Cliente</label>
              {!isAddingNewCliente ? (
                <div className="flex gap-2 items-center bg-gray-50 p-1 rounded-lg border">
                  <select 
                    name="cliente_id" 
                    required 
                    value={formData.cliente_id} 
                    onChange={handleChange} 
                    className="flex-1 p-2 outline-none bg-transparent"
                  >
                    <option value="">Seleziona cliente...</option>
                    {clienti.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <button type="button" onClick={() => setIsAddingNewCliente(true)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-md transition"><Plus size={18}/></button>
                </div>
              ) : (
                <div className="flex gap-2 items-center p-1 rounded-lg border border-blue-500 bg-white">
                  <input autoFocus className="flex-1 p-2 outline-none" placeholder="Nome nuovo cliente..." value={newClienteName} onChange={(e) => setNewClienteName(e.target.value)} />
                  <button type="button" onClick={handleAddNewCliente} className="p-2 text-green-600 hover:bg-green-50 rounded-md"><Check size={18}/></button>
                  <button type="button" onClick={() => setIsAddingNewCliente(false)} className="p-2 text-red-600 hover:bg-red-50 rounded-md"><X size={18}/></button>
                </div>
              )}
            </div>

            {/* Assegnato (Assignee) */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-400 uppercase ml-1">Assegnato a</label>
              <div className="bg-gray-50 p-1 rounded-lg border">
                <select name="assignee" required value={formData.assignee} onChange={handleChange} className="w-full p-2 outline-none bg-transparent">
                  <option value={currentUser?.id}>Me ({currentUser?.email})</option>
                  {colleghi.filter(c => c.id !== currentUser?.id).map(col => (
                    <option key={col.id} value={col.id}>{col.nome_completo}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Titolo Attività */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-gray-400 uppercase ml-1">Titolo Attività</label>
              <input name="titolo" required value={formData.titolo} onChange={handleChange} className="w-full p-3 bg-gray-50 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition" placeholder="Esempio: Analisi tracciamento checkout" />
            </div>

            {/* Priorità */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-400 uppercase ml-1">Priorità</label>
              <div className="bg-gray-50 p-1 rounded-lg border">
                <select name="priorita" value={formData.priorita} onChange={handleChange} className="w-full p-2 outline-none bg-transparent">
                  <option>Bassa</option><option>Media</option><option>Alta</option><option>Urgente</option>
                </select>
              </div>
            </div>

            {/* Descrizione */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-gray-400 uppercase ml-1">Descrizione (Opzionale)</label>
              <textarea name="descrizione" value={formData.descrizione} onChange={handleChange} className="w-full p-3 border rounded-lg h-24 outline-none bg-gray-50 focus:ring-2 focus:ring-blue-500 transition" placeholder="Aggiungi dettagli tecnici o note sull'attività..." />
            </div>
          </div>
        </section>

        {/* SEZIONE DINAMICA ESSELUNGA */}
        {isEsselunga && (
          <section className="bg-blue-600 p-6 rounded-2xl shadow-xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 text-white">
            <div className="flex items-center gap-2 font-bold mb-2">
              <LayoutGrid size={20} /> <span>Dettagli Tecnici Esselunga</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase opacity-80">N° TAG</label>
                <input name="n_tag" value={formData.n_tag} onChange={handleChange} className="w-full p-2 bg-white/10 border-b border-white/30 outline-none placeholder:text-blue-200" placeholder="TAG-XXX" />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase opacity-80">Applicativo</label>
                <select name="applicativo" value={formData.applicativo} onChange={handleChange} className="w-full p-2 bg-white/10 border-b border-white/30 outline-none">
                  <option value="" className="text-black">Seleziona...</option>
                  {['APPECOM','ECOM35','IST35','EOL','GCW','ESB','APPIST','PROGETTO'].map(app => (
                    <option key={app} value={app} className="text-black">{app}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase opacity-80">Tipo Attività</label>
                <select name="tipo_di_attivita" value={formData.tipo_di_attivita} onChange={handleChange} className="w-full p-2 bg-white/10 border-b border-white/30 outline-none">
                  <option value="" className="text-black">Seleziona...</option>
                  {['Preanalisi','Evolutiva GA4','Evolutiva BQ','Incident Resolution','Reporting','Formazione','Supporto Funzionale Business','Analisi degli Impatti','Supporto Tecnico'].map(tipo => (
                    <option key={tipo} value={tipo} className="text-black">{tipo}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}
      </form>
    </div>
  )
}