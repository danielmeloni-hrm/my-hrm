'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Tag, 
  Clock, 
  AlertCircle, 
  Building2,
  Cpu,
  CheckCircle2
} from 'lucide-react'

export default function TicketDettaglioPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTicket() {
      const { data, error } = await supabase
        .from('ticket')
        .select(`
          *,
          clienti (nome),
          profili:assignee (nome_completo)
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error(error)
        router.push('/')
      } else {
        setTicket(data)
      }
      setLoading(false)
    }

    if (id) fetchTicket()
  }, [id, supabase, router])

  if (loading) return <div className="p-8 text-center text-gray-500">Caricamento...</div>
  if (!ticket) return <div className="p-8 text-center text-red-500">Ticket non trovato.</div>

  const isEsselunga = ticket.clienti?.nome?.toLowerCase().includes('esselunga')

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <div className="max-w-4xl mx-auto">
        
        {/* Torna indietro */}
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition mb-6 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Torna alla lista</span>
        </button>

        {/* Header Ticket */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  ticket.priorita === 'Urgente' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {ticket.priorita}
                </span>
                <span className="text-gray-400 text-sm font-medium">#{ticket.id.slice(0, 8)}</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{ticket.titolo}</h1>
            </div>
            <div className="flex flex-col items-end">
              <span className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-bold text-sm border border-green-200">
                {ticket.stato || 'Aperto'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 border-t border-b border-gray-50">
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase">Cliente</p>
              <div className="flex items-center gap-2 font-semibold">
                <Building2 size={16} className="text-blue-500" />
                {ticket.clienti?.nome}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase">Assegnato a</p>
              <div className="flex items-center gap-2 font-semibold">
                <User size={16} className="text-purple-500" />
                {ticket.profili?.nome_completo || 'Non assegnato'}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase">Data Creazione</p>
              <div className="flex items-center gap-2 font-semibold text-gray-700">
                <Calendar size={16} />
                {new Date(ticket.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase">Tag</p>
              <div className="flex items-center gap-2 font-semibold text-gray-700">
                <Tag size={16} />
                {ticket.n_tag || 'N/D'}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Descrizione Attività</h3>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-700 leading-relaxed min-h-[100px]">
              {ticket.descrizione || 'Nessuna descrizione fornita.'}
            </div>
          </div>
        </div>

        {/* Sezione Esselunga (se applicabile) */}
        {isEsselunga && (
          <div className="bg-blue-600 rounded-2xl shadow-lg p-6 text-white mb-6 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Cpu size={20} /> Dettagli Tecnici Esselunga
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                  <p className="text-blue-200 text-xs font-bold uppercase">Applicativo</p>
                  <p className="font-semibold text-lg">{ticket.applicativo || 'N/D'}</p>
                </div>
                <div className="bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                  <p className="text-blue-200 text-xs font-bold uppercase">Tipo Attività</p>
                  <p className="font-semibold text-lg">{ticket.tipo_di_attivita || 'N/D'}</p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <Building2 size={120} />
            </div>
          </div>
        )}

        {/* Checkbox di stato rapido */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-4 rounded-xl border flex items-center justify-between ${ticket.escalation_donatello ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
             <span className="font-bold text-sm">Escalation Donatello</span>
             {ticket.escalation_donatello ? <AlertCircle className="text-orange-600" /> : <div className="w-5 h-5 border rounded-full" />}
          </div>
          <div className={`p-4 rounded-xl border flex items-center justify-between ${ticket.i_ping ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
             <span className="font-bold text-sm">I° Ping Eseguito</span>
             {ticket.i_ping ? <CheckCircle2 className="text-green-600" /> : <div className="w-5 h-5 border rounded-full" />}
          </div>
        </div>

      </div>
    </div>
  )
}