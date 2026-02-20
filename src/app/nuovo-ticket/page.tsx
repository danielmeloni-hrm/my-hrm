'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { FileText, Paperclip, Send, Info, Plus, X, Check, User, LayoutGrid } from 'lucide-react'

export default function NuovoTicketPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<{id: string, email: string} | null>(null)
  const [file, setFile] = useState<File | null>(null)
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
    // Campi specifici Esselunga
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
    const { data } = await supabase.from('clienti').insert([{ nome: newClienteName.trim() }]).select().single()
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
      let documento_url = ''
      if (file) {
        const fileName = `${Math.random()}.${file.name.split('.').pop()}`
        await supabase.storage.from('documenti-ticket').upload(fileName, file)
        documento_url = fileName
      }

      const { error } = await supabase.from('ticket').insert([{
        ...formData,
        utente_id: currentUser?.id,
        documento_operativo_url: documento_url,
        stato: 'Aperto'
      }])

      if (error) throw error
      router.push('/')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6 text-black">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-blue-600" /> Nuovo Ticket Operativo
          </h1>
          <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition">
            {loading ? 'Salvataggio...' : 'Crea Ticket'}
          </button>
        </div>

        {/* PROPRIETÀ PRINCIPALI */}
        <section className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
          <div className="flex items-center gap-2 text-blue-600 font-bold mb-4">
            <Info size={18} /> <span>Proprietà Principali</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cliente */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-500 uppercase">Cliente</label>
              {!isAddingNewCliente ? (
                <div className="flex gap-2 border-b">
                  <select name="cliente_id" required value={formData.cliente_id} onChange={handleChange} className="flex-1 p-2 outline-none bg-transparent">
                    <option value="">Seleziona cliente...</option>
                    {clienti.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <button type="button" onClick={() => setIsAddingNewCliente(true)} className="p-2 text-blue-600"><Plus size={18}/></button>
                </div>
              ) : (
                <div className="flex gap-2 items-center border-b border-blue-500">
                  <input autoFocus className="flex-1 p-2 outline-none" placeholder="Nuovo cliente..." value={newClienteName} onChange={(e) => setNewClienteName(e.target.value)} />
                  <button type="button" onClick={handleAddNewCliente} className="p-2 text-green-600"><Check size={18}/></button>
                  <button type="button" onClick={() => setIsAddingNewCliente(false)} className="p-2 text-red-600"><X size={18}/></button>
                </div>
              )}
            </div>

            {/* Assegnato (Assignee) */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-500 uppercase">Assegnato a</label>
              <select name="assignee" required value={formData.assignee} onChange={handleChange} className="w-full p-2 border-b outline-none bg-transparent">
                <option value={currentUser?.id}>Me ({currentUser?.email})</option>
                {colleghi.filter(c => c.id !== currentUser?.id).map(col => (
                  <option key={col.id} value={col.id}>{col.nome_completo}</option>
                ))}
              </select>
            </div>

            {/* Titolo Attività */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-gray-500 uppercase">Titolo Attività</label>
              <input name="titolo" required value={formData.titolo} onChange={handleChange} className="w-full p-2 border-b outline-none" placeholder="Esempio: Analisi tracciamento checkout" />
            </div>

            {/* Priorità */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-500 uppercase">Priorità</label>
              <select name="priorita" value={formData.priorita} onChange={handleChange} className="w-full p-2 border-b outline-none bg-transparent">
                <option>Bassa</option><option>Media</option><option>Alta</option><option>Urgente</option>
              </select>
            </div>

            {/* Descrizione (Sposta qui come richiesto) */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-gray-500 uppercase">Descrizione (Opzionale)</label>
              <textarea name="descrizione" value={formData.descrizione} onChange={handleChange} className="w-full p-2 border rounded-md h-20 outline-none bg-gray-50/50" placeholder="Aggiungi dettagli..." />
            </div>
          </div>
        </section>

        {/* SEZIONE DINAMICA ESSELUNGA */}
        {isEsselunga && (
          <section className="bg-blue-50/30 p-6 rounded-xl shadow-sm border border-blue-200 space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-2 text-blue-700 font-bold mb-2">
              <LayoutGrid size={18} /> <span>Dettagli Esselunga</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-blue-600 uppercase">N° TAG</label>
                <input name="n_tag" value={formData.n_tag} onChange={handleChange} className="w-full p-2 border-b border-blue-200 outline-none bg-transparent" placeholder="TAG-XXX" />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-blue-600 uppercase">Applicativo</label>
                <select name="applicativo" value={formData.applicativo} onChange={handleChange} className="w-full p-2 border-b border-blue-200 outline-none bg-transparent">
                  <option value="">Seleziona...</option>
                  {['APPECOM','ECOM35','IST35','EOL','GCW','ESB','APPIST','PROGETTO'].map(app => (
                    <option key={app} value={app}>{app}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-blue-600 uppercase">Tipo Attività</label>
                <select name="tipo_di_attivita" value={formData.tipo_di_attivita} onChange={handleChange} className="w-full p-2 border-b border-blue-200 outline-none bg-transparent">
                  <option value="">Seleziona...</option>
                  {['Preanalisi','Evolutiva GA4','Evolutiva BQ','Incident Resolution','Reporting','Formazione','Supporto Funzionale Business','Analisi degli Impatti','Supporto Tecnico'].map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}

        {/* ALLEGATI */}
        <section className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center gap-2 text-green-600 font-bold mb-4">
            <Paperclip size={18} /> <span>Documento Operativo</span>
          </div>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 transition" />
        </section>

      </form>
    </div>
  )
}