'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase'
import { 
  History, 
  Search, 
  Filter, 
  ArrowLeft, 
  ChevronRight,
  Building2,
  Clock,
  AlertCircle
} from 'lucide-react'

export default function StoricoTicketPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    async function fetchAllTickets() {
      const { data, error } = await supabase
        .from('ticket')
        .select(`
            id, 
            titolo, 
            stato, 
            priorita, 
            ultimo_ping, 
            clienti (nome)
        `)
        .order('ultimo_ping', { ascending: false }) // Corretto qui
        .limit(5);

      if (!error && data) setTickets(data)
      setLoading(false)
    }
    fetchAllTickets()
  }, [supabase])

  // Filtro dinamico per la ricerca
  const filteredTickets = tickets.filter(t => 
    t.titolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.clienti?.nome.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <div className="max-w-6xl mx-auto">
        
        {/* Header con Navigazione */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition mb-2 text-sm font-bold uppercase tracking-wider">
              <ArrowLeft size={16} /> Torna alla Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <History className="text-blue-600" /> Storico Ticket
            </h1>
          </div>

          {/* Barra di Ricerca */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input 
              type="text"
              placeholder="Cerca per titolo o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm transition"
            />
          </div>
        </div>

        {/* Tabella / Lista Ticket */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Info Ticket</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Stato</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-400 font-medium">Caricamento storico in corso...</td>
                  </tr>
                ) : filteredTickets.length > 0 ? (
                  filteredTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-blue-50/30 transition group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{t.titolo}</span>
                          <span className={`text-[10px] font-bold uppercase mt-1 ${t.priorita === 'Urgente' ? 'text-red-500' : 'text-gray-400'}`}>
                            {t.priorita}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-600">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-gray-400" />
                          {t.clienti?.nome}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <Clock size={14} />
                          {new Date(t.ultimo_ping).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100">
                          {t.stato || 'Aperto'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          href={`/ticket/${t.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 font-bold text-sm hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg transition"
                        >
                          Dettaglio <ChevronRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500 font-medium">
                      <AlertCircle className="mx-auto mb-2 text-gray-300" size={32} />
                      Nessun ticket trovato con questi criteri.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-sm text-gray-400 font-medium italic">
          * Mostrando {filteredTickets.length} ticket totali presenti nel database.
        </div>
      </div>
    </div>
  )
}