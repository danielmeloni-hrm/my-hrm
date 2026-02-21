'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { 
  LayoutGrid, 
  Kanban, 
  BarChart3, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight,
  Filter
} from 'lucide-react'
import Link from 'next/link'

export default function GeneralDashboard() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSprint, setSelectedSprint] = useState('Sprint')

  // Definizione colonne e raggruppamento stati
  const boardColumns = [
    { 
      id: 'todo', 
      label: 'To-do / Stand-by', 
      color: 'bg-gray-100 text-gray-500', 
      statuses: ['Attività Sospesa', 'Non Iniziato', 'In stand-by'] 
    },
    { 
      id: 'progress', 
      label: 'In Lavorazione', 
      color: 'bg-blue-50 text-blue-600', 
      statuses: ['In lavorazione', 'In attesa Sviluppo', 'In attesa risposta Sviluppatore', 'Attenzione Business', 'Attenzione di Andrea'] 
    },
    { 
      id: 'done', 
      label: 'Completati', 
      color: 'bg-green-50 text-green-600', 
      statuses: ['Completato - In attesa di chiusura', 'Completato'] 
    }
  ]

  useEffect(() => {
    async function fetchBoardData() {
      setLoading(true)
      const { data } = await supabase
        .from('ticket')
        .select('*, clienti(nome)')
        .eq('sprint', selectedSprint)
        .order('created_at', { ascending: false })
      
      if (data) setTickets(data)
      setLoading(false)
    }
    fetchBoardData()
  }, [selectedSprint, supabase])

  // Statistiche rapide
  const stats = {
    total: tickets.length,
    urgent: tickets.filter(t => t.priorita === 'Urgente').length,
    completed: tickets.filter(t => t.stato.includes('Completato')).length
  }

  if (loading) return <div className="p-10 font-mono text-xs animate-pulse tracking-widest text-gray-400">LOADING ECOSYSTEM DASHBOARD...</div>

  return (
    <div className="min-h-screen bg-[#FBFBFB] p-8 font-sans">
      
      {/* HEADER & NAV */}
      <div className="max-w-[1600px] mx-auto mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-gray-900 flex items-center gap-3">
              <BarChart3 size={28} className="text-blue-600" /> DASHBOARD HUB
            </h1>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.3em] mt-1">Management & Sprint Tracking</p>
          </div>

          <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm">
            <div className="px-3 py-2 border-r border-gray-100 flex items-center gap-2 text-gray-400">
              <Filter size={14} /> <span className="text-[10px] font-black uppercase">Filtra per:</span>
            </div>
            {['Sprint', 'Opex', 'Backlog', 'Backlog Opex'].map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSprint(s)}
                className={`px-5 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${
                  selectedSprint === s ? 'bg-black text-white shadow-lg shadow-gray-200' : 'text-gray-400 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* SIDEBAR: KPI & QUICK INFO */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 border-b pb-2">Overview {selectedSprint}</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Ticket Totali</span>
                <span className="text-xl font-black">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium text-red-500">Urgenti</span>
                <span className="text-xl font-black text-red-500 underline underline-offset-4">{stats.urgent}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium text-green-600">Completati</span>
                <span className="text-xl font-black text-green-600">{stats.completed}</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-600 p-6 rounded-3xl shadow-xl text-white">
            <Clock size={24} className="mb-4 opacity-50" />
            <p className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">Status Progetto</p>
            <h3 className="text-xl font-black mb-4">In Linea con lo Sprint</h3>
            <div className="w-full bg-blue-400/30 h-2 rounded-full overflow-hidden">
                <div 
                    className="bg-white h-full transition-all duration-1000" 
                    style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                />
            </div>
          </div>
        </div>

        {/* BOARD KANBAN PRINCIPALE */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 h-fit">
          {boardColumns.map((col) => (
            <div key={col.id} className="flex flex-col gap-4">
              <div className={`px-4 py-2 rounded-2xl ${col.color} border border-transparent flex items-center justify-between`}>
                <span className="text-[11px] font-black uppercase tracking-widest">{col.label}</span>
                <span className="text-xs font-black opacity-60">
                  {tickets.filter(t => col.statuses.includes(t.stato)).length}
                </span>
              </div>

              <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-2 scrollbar-hide">
                {tickets
                  .filter(t => col.statuses.includes(t.stato))
                  .map((ticket) => (
                    <Link href={`/ticket/${ticket.id}`} key={ticket.id}>
                      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group active:scale-95">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-md uppercase">
                            {ticket.clienti?.nome}
                          </span>
                          <span className="text-[9px] font-mono font-bold text-gray-300">
                            #{ticket.n_tag}
                          </span>
                        </div>
                        
                        <h4 className="text-[13px] font-bold text-gray-800 leading-snug mb-4 group-hover:text-blue-600">
                          {ticket.titolo}
                        </h4>

                        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              ticket.priorita === 'Urgente' ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
                            }`} />
                            <span className="text-[10px] font-bold text-gray-400 uppercase truncate max-w-[100px]">
                              {ticket.stato}
                            </span>
                          </div>
                          <ChevronRight size={14} className="text-gray-200 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}