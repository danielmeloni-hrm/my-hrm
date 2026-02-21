'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../lib/supabase'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { 
  Trello, User, Users, ChevronRight, Hash, Activity, AppWindow 
} from 'lucide-react'
import Link from 'next/link'

export default function GeneralDashboard() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSprint, setSelectedSprint] = useState('Opex') // Default solo Sprint attivo
  const [filterMe, setFilterMe] = useState(false)

  const formatDate = (dateString: string) => {
    if (!dateString) return '--/--/----';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) { return dateString; }
  };

  const boardColumns = [
    { id: 'todo', label: 'To-do / Stand-by', color: 'bg-gray-100 text-gray-500', statuses: ['Non Iniziato', 'In stand-by', 'Attività Sospesa'] },
    { id: 'in_lavorazione', label: 'In lavorazione', color: 'bg-blue-50 text-blue-600', statuses: ['In lavorazione'] },
    { id: 'in_attesa_sviluppo', label: 'In attesa Sviluppo', color: 'bg-yellow-50 text-yellow-600', statuses: ['In attesa Sviluppo'] },
    { id: 'in_attesa_risposta_sviluppatore', label: 'In attesa risposta Sviluppatore', color: 'bg-yellow-100 text-yellow-700', statuses: ['In attesa risposta Sviluppatore'] },
    { id: 'attention_business', label: 'Attenzione Business', color: 'bg-purple-50 text-purple-600', statuses: ['Attenzione Business'] },
    { id: 'attention_andrea', label: 'Attenzione Andrea', color: 'bg-orange-50 text-orange-600', statuses: ['Attenzione di Andrea'] },
    { id: 'completato_attesa', label: 'In Chiusura', color: 'bg-green-50 text-green-700', statuses: ['Completato - In attesa di chiusura'] },
    { id: 'completato', label: 'Completati', color: 'bg-green-100 text-green-800', statuses: ['Completato'] }
  ]

  const fetchBoardData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    // Query base
    let query = supabase.from('ticket').select('*, clienti(nome)').order('creato_at', { ascending: false })

    // LOGICA FILTRO: Solo quelli in Sprint (esclude Backlog e nulli)
    if (selectedSprint === 'Opex') {
      query = query.eq('opex', 'Opex')
    } else {
      query = query.eq('opex', selectedSprint)
    }

    if (filterMe && user) query = query.eq('assignee', user.id)

    const { data } = await query
    setTickets(data || [])
    setLoading(false)
  }, [selectedSprint, filterMe, supabase])

  useEffect(() => { fetchBoardData() }, [fetchBoardData])

  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return
    const destCol = boardColumns.find(c => c.id === destination.droppableId)
    if (!destCol) return 

    const nuovoStato = destCol.statuses[0]
    const oraISO = new Date().toISOString()
    
    const updated = [...tickets]
    const index = updated.findIndex(t => t.id === draggableId)
    updated[index].stato = nuovoStato
    updated[index].ultimo_ping = oraISO
    setTickets(updated)

    await supabase.from('ticket').update({ stato: nuovoStato, ultimo_ping: oraISO }).eq('id', draggableId)
  }

  const getTicketsByColumn = (col: any) => tickets.filter(t => col.statuses.includes(t.stato))

  if (loading) return <div className="p-20 text-center font-black animate-pulse text-gray-300 italic uppercase">Loading Sprint...</div>

  return (
    <div className="min-h-screen bg-[#FBFBFB] p-4 md:p-8">
      <div className="max-w-[2200px] mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3 text-black italic">
              <Trello className="text-blue-600" size={36} /> OPEX BOARD
            </h1>
            <p className="text-[10px] font-bold text-blue-600/50 uppercase tracking-[0.3em]">Solo attività in corso</p>
          </div>

          <div className="flex gap-3">
            {/* Selettore Sprint (rimosso "Tutti" e "Backlog" per pulizia) */}
            <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
              {['Opex'].map(s => (
                <button key={s} onClick={() => setSelectedSprint(s)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${selectedSprint === s ? 'bg-black text-white' : 'text-gray-400'}`}>
                  {s}
                </button>
              ))}
            </div>
            
            <button onClick={() => setFilterMe(!filterMe)} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${filterMe ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border-gray-100'}`}>
              {filterMe ? <User size={14} /> : <Users size={14} />} {filterMe ? 'I Miei' : 'Tutti'}
            </button>
          </div>
        </div>

        {/* KANBAN AREA */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-6 overflow-x-auto pb-10 scrollbar-hide">
            {boardColumns.map((col) => {
              const columnTickets = getTicketsByColumn(col)
              return (
                <div key={col.id} className="flex-shrink-0 w-80 flex flex-col gap-4 bg-gray-50/50 p-3 rounded-[2.5rem] min-h-[700px] border border-gray-100">
                  <div className={`flex items-center justify-between px-5 py-4 rounded-2xl ${col.color} shadow-sm`}>
                    <span className="text-[10px] font-black uppercase tracking-widest">{col.label}</span>
                    <span className="text-xs font-black bg-white/40 px-2 py-0.5 rounded-lg">{columnTickets.length}</span>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="flex-1 space-y-4">
                        {columnTickets.map((ticket, index) => (
                          <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all">
                                  
                                  <div className="flex flex-wrap gap-2 items-center mb-3">
                                    <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase italic">
                                      {ticket.clienti?.nome || 'N/D'}
                                    </span>
                                    {ticket.applicativo && (
                                      <span className="text-[9px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md flex items-center gap-1">
                                        <AppWindow size={10} />
                                        {ticket.applicativo}
                                      </span>
                                    )}
                                  </div>

                                  <h3 className="text-[13px] font-bold text-gray-800 leading-tight mb-4">{ticket.titolo}</h3>

                                  <div className="flex items-center gap-4 bg-gray-50/80 p-3 rounded-2xl mb-4 text-[10px] font-bold text-gray-600">
                                    <div className="flex items-center gap-1.5">
                                      <Hash size={12} className="text-gray-400" />
                                      <span>{ticket.n_tag || '---'}</span>
                                    </div>
                                    <div className="h-3 w-[1px] bg-gray-200" />
                                    <div className="flex items-center gap-1.5">
                                      <Activity size={12} className="text-gray-400" />
                                      <span>{formatDate(ticket.ultimo_ping)}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{ticket.stato}</span>
                                    <Link href={`/ticket/${ticket.id}`} className="p-2 bg-black text-white rounded-xl hover:scale-110 transition-transform">
                                      <ChevronRight size={14} />
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  )
}