'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { 
  User, Users, ChevronRight, Hash, Activity, 
  LayoutDashboard, Search, Filter, Settings2, X, Check,
  Plus, Minus, Maximize2, Circle, PlayCircle,Layers
} from 'lucide-react'
import Link from 'next/link'
import { formatDateShort, getPingStyles, isPingExpired } from '@/lib/ticket-utils'

export default function GeneralDashboard() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSprint, setSelectedSprint] = useState('Opex')
  const [filterMe, setFilterMe] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCliente, setSelectedCliente] = useState('Tutti')
  const [clientiList, setClientiList] = useState<string[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(3)
  const [filterOnlyExpired, setFilterOnlyExpired] = useState(false)

  const allBoardColumns = [
    { id: 'sospesa', label: 'Attività Sospesa', group: 'To-do', color: 'text-gray-500 bg-gray-100', statuses: ['Attività Sospesa'] },
    { id: 'non_iniziato', label: 'Non Iniziato', group: 'To-do', color: 'text-gray-500 bg-gray-100', statuses: ['Non Iniziato'] },
    { id: 'standby', label: 'In stand-by', group: 'To-do', color: 'text-gray-500 bg-gray-100', statuses: ['In stand-by'] },
    { id: 'lavorazione', label: 'In lavorazione', group: 'In progress', color: 'text-blue-600 bg-blue-50', statuses: ['In lavorazione'] },
    { id: 'attesa_sviluppo', label: 'In attesa Sviluppo', group: 'In progress', color: 'text-amber-600 bg-amber-50', statuses: ['In attesa Sviluppo'] },
    { id: 'risposta_sviluppatore', label: 'In attesa risposta Sviluppatore', group: 'In progress', color: 'text-amber-700 bg-amber-100', statuses: ['In attesa risposta Sviluppatore'] },
    { id: 'business', label: 'Attenzione Business', group: 'In progress', color: 'text-purple-600 bg-purple-50', statuses: ['Attenzione Business'] },
    { id: 'andrea', label: 'Attenzione di Andrea', group: 'In progress', color: 'text-pink-600 bg-pink-50', statuses: ['Attenzione di Andrea'] },
    { id: 'chiusura', label: 'In attesa di chiusura', group: 'Complete', color: 'text-emerald-600 bg-emerald-50', statuses: ['Completato - In attesa di chiusura'] },
    { id: 'completato', label: 'Completato', group: 'Complete', color: 'text-emerald-700 bg-emerald-100', statuses: ['Completato'] }
  ]

  const [visibleColumns, setVisibleColumns] = useState<string[]>(allBoardColumns.map(c => c.id))

  const getZoomStyles = () => {
    const columnWidths = [220, 260, 310, 380, 460]
    const cardPaddings = ['p-2', 'p-3', 'p-4', 'p-5', 'p-6']
    const titleSizes = ['text-[9px]', 'text-[10px]', 'text-[11px]', 'text-[13px]', 'text-[15px]']
    return { colWidth: columnWidths[zoomLevel - 1], padding: cardPaddings[zoomLevel - 1], title: titleSizes[zoomLevel - 1] }
  }

  const currentStyles = getZoomStyles()

  // --- AGGIORNAMENTO SUPABASE ---
  const handleUpdateTicket = async (id: string, updates: any) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    const { error } = await supabase.from('ticket').update(updates).eq('id', id)
    if (error) console.error("Errore salvataggio:", error)
  }

  const fetchUserPreferences = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profili').select('kanban_columns').eq('id', user.id).single()
    if (data?.kanban_columns) setVisibleColumns(data.kanban_columns)
  }, [supabase])

const fetchBoardData = useCallback(async () => {
  setLoading(true)
  await fetchUserPreferences()
  const { data: { user } } = await supabase.auth.getUser()
  
  let query = supabase.from('ticket')
    .select('*, clienti(nome)')
    .order('creato_at', { ascending: false })
    .eq('sprint', 'Opex') // <--- FORZA IL FILTRO OPEX QUI

  if (filterMe && user) query = query.eq('assignee', user.id)
  
  const { data } = await query
  setTickets(data || [])
  setClientiList(Array.from(new Set(data?.map((t: any) => t.clienti?.nome).filter(Boolean))))
  setLoading(false)
}, [filterMe, supabase, fetchUserPreferences]) // Rimosso selectedSprint dalle dipendenze

  useEffect(() => { fetchBoardData() }, [fetchBoardData])

  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return
    const destCol = allBoardColumns.find(c => c.id === destination.droppableId)
    if (!destCol) return 
    const nuovoStato = destCol.statuses[0]
    const oraISO = new Date().toISOString()
    handleUpdateTicket(draggableId, { stato: nuovoStato, ultimo_ping: oraISO })
  }

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.titolo?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.n_tag?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCliente = selectedCliente === 'Tutti' || t.clienti?.nome === selectedCliente;
    const matchesExpired = filterOnlyExpired ? isPingExpired(t.ultimo_ping) : true;
    return matchesSearch && matchesCliente && matchesExpired;
  })

  const activeColumns = allBoardColumns.filter(col => visibleColumns.includes(col.id))

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#FBFBFB]"><div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 animate-pulse">Sincronizzazione Board...</div></div>

  return (
    <div className="min-h-screen bg-[#FBFBFB] px-4 pt-8 pb-24 relative overflow-x-hidden">
      
      {/* MODALE SETTINGS (Invariata) */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-black uppercase tracking-tight">Layout Board</h2>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
            </div>
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1 scrollbar-hide">
              {allBoardColumns.map(col => (
                <button key={col.id} onClick={async () => {
                   const next = visibleColumns.includes(col.id) ? visibleColumns.filter(i => i !== col.id) : [...visibleColumns, col.id]
                   setVisibleColumns(next)
                   const { data: { user } } = await supabase.auth.getUser()
                   if (user) await supabase.from('profili').update({ kanban_columns: next }).eq('id', user.id)
                }} className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${visibleColumns.includes(col.id) ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-transparent opacity-50'}`}>
                  <div>
                    <p className="text-[7px] font-black text-gray-400 uppercase leading-none">{col.group}</p>
                    <p className={`text-[10px] font-bold uppercase ${col.color.split(' ')[0]}`}>{col.label}</p>
                  </div>
                  {visibleColumns.includes(col.id) && <Check size={14} className="text-blue-600"/>}
                </button>
              ))}
            </div>
            <button onClick={() => setShowSettings(false)} className="w-full mt-4 bg-gray-900 text-white py-3 rounded-xl font-black uppercase text-[9px] tracking-widest">Chiudi</button>
          </div>
        </div>
      )}

      <div className="max-w-[2800px] mx-auto">
        {/* HEADER CON TUTTI I FILTRI RIPRISTINATI */}
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100"><LayoutDashboard size={18} className="text-blue-600" /></div>
              <div>
                <h1 className="text-xl font-black tracking-tighter text-gray-900 uppercase italic leading-none">Open Board</h1>
                <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mt-1 italic">
                  {filterOnlyExpired ? '⚠️ Focus: Da Pingare' : (filterMe ? 'I Miei Task' : 'Tutti i Task')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Cerca */}
              <div className="min-w-[220px] relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                <input 
                  type="text" 
                  placeholder="Cerca titolo o tag..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-50/50 rounded-xl text-[11px] font-bold outline-none border border-transparent focus:bg-white focus:border-blue-100 transition-all"
                />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"><X size={14} /></button>}
              </div>

              {/* Cliente */}
              <div className="relative min-w-[160px]">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={12} />
                <select 
                  value={selectedCliente} 
                  onChange={(e) => setSelectedCliente(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 bg-gray-50/50 rounded-xl text-[10px] font-black uppercase outline-none border border-transparent appearance-none cursor-pointer hover:bg-gray-100 transition-all"
                >
                  <option value="Tutti">Tutti i Clienti</option>
                  {clientiList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              {/* Sprint Select */}
              <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                {['Opex', 'Backlog', 'Tutti'].map(s => (
                  <button key={s} onClick={() => setSelectedSprint(s)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all ${selectedSprint === s ? 'bg-gray-900 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>{s}</button>
                ))}
              </div>

              {/* Toggle Da Pingare */}
              <button 
                onClick={() => setFilterOnlyExpired(!filterOnlyExpired)} 
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase border transition-all ${filterOnlyExpired ? 'bg-red-500 text-white border-transparent' : 'bg-white text-gray-500 border-gray-100'}`}
              >
                <Activity size={12} className={filterOnlyExpired ? "animate-pulse" : ""} /> Da Pingare
              </button>

              {/* Toggle Miei/Tutti */}
              <button 
                onClick={() => setFilterMe(!filterMe)} 
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase border transition-all ${filterMe ? 'bg-blue-600 text-white border-transparent' : 'bg-white text-gray-500 border-gray-100'}`}
              >
                {filterMe ? <User size={12} /> : <Users size={12} />} {filterMe ? 'Miei' : 'Tutti'}
              </button>

              <button onClick={() => setShowSettings(true)} className="p-3 bg-white text-gray-400 rounded-xl border border-gray-100 hover:text-blue-600 transition-all shadow-sm"><Settings2 size={16} /></button>
            </div>
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-10 scrollbar-hide">
            {activeColumns.map((col) => {
              const columnTickets = filteredTickets.filter(t => col.statuses.includes(t.stato))
              const textColorClass = col.color.split(' ')[0]
              const bgColorClass = col.color.split(' ')[1]

              return (
                <div key={col.id} style={{ width: `${currentStyles.colWidth}px` }} className="flex-shrink-0 flex flex-col gap-3 transition-all duration-300">
                  <div className="px-1">
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1 ml-2">{col.group}</p>
                    <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${bgColorClass} border border-white/50 shadow-sm`}>
                      <span className={`text-[8.5px] font-black uppercase truncate ${textColorClass}`}>{col.label}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md bg-white/60 ${textColorClass}`}>{columnTickets.length}</span>
                    </div>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className={`flex-1 space-y-2.5 min-h-[600px] p-2 rounded-xl ${bgColorClass} bg-opacity-40 border border-transparent`}>
                        {columnTickets.map((ticket, index) => {
                          const pingStyles = getPingStyles(ticket.ultimo_ping);
                          return (
                            <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                              {(provided) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                  
                                  <div className={`bg-white ${currentStyles.padding} rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group`}>
                                    
                                    {/* ICONA: IN LAVORAZIONE ORA */}
                                    <button 
                                      onClick={() => handleUpdateTicket(ticket.id, { in_lavorazione_ora: !ticket.in_lavorazione_ora })}
                                      className="absolute top-2 right-2 z-10"
                                    >
                                      {ticket.in_lavorazione_ora ? (
                                        <PlayCircle size={18} className="text-red-500 red-50 animate-pulse" />
                                      ) : (
                                        <Circle size={18} className="text-gray-100 hover:text-red-200" />
                                      )}
                                    </button>

                                    <div className="flex items-center gap-2 mb-2 pr-6">
                                      <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-tighter truncate">
                                        {ticket.clienti?.nome || 'N/D'}
                                      </span>
                                      <input 
                                        className="text-[9px] font-black text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded uppercase outline-none border-none focus:bg-white w-20 text-center"
                                        value={ticket.applicativo || ''}
                                        placeholder="APP"
                                        onBlur={(e) => handleUpdateTicket(ticket.id, { applicativo: e.target.value })}
                                        onChange={(e) => setTickets(prev => prev.map(t => t.id === ticket.id ? {...t, applicativo: e.target.value} : t))}
                                      />
                                      {/* SELETTORE PERCENTUALE E PALLINO VERDE */}
                                    <div className="flex items-center justify-center py-1">
  <div className="relative group">
    {/* Glow rettangolare dinamico */}
    <div className={`absolute inset-0 rounded-md transition-all duration-500 ${
      ticket.percentuale_avanzamento > 0 ? 'bg-emerald-400/20 scale-105 blur-sm' : 'bg-transparent'
    }`} />
    
    <div className="relative flex items-center">
      <input 
        type="number"
        min="0"
        max="100"
        value={ticket.percentuale_avanzamento || 0}
        onChange={(e) => handleUpdateTicket(ticket.id, { 
          percentuale_avanzamento: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) 
        })}
        className={`
          relative w-12 h-6 text-[10px] font-black text-center
          rounded-md border transition-all duration-300 outline-none
          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
          ${ticket.percentuale_avanzamento > 0 
            ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm' 
            : 'border-gray-200 bg-gray-50 text-gray-400'
          }
          focus:scale-105 focus:ring-2 focus:ring-emerald-100 cursor-pointer
        `}
      />
      {ticket.percentuale_avanzamento > 0 && (
        <span className="absolute right-1.5 text-[8px] font-black text-white/80 pointer-events-none">
          %
        </span>
      )}
    </div>
  </div>
</div>
                                    </div>
                                        
                                    <div className="mb-3">
                                      <textarea 
                                        rows={2}
                                        className={`${currentStyles.title} w-full font-black text-gray-800 leading-tight italic outline-none border-none resize-none bg-transparent focus:text-blue-600`}
                                        value={ticket.titolo}
                                        onBlur={(e) => handleUpdateTicket(ticket.id, { titolo: e.target.value })}
                                        onChange={(e) => setTickets(prev => prev.map(t => t.id === ticket.id ? {...t, titolo: e.target.value} : t))}
                                      />
                                      <div className="flex items-center gap-1 mt-1 text-gray-400">
                                        <Hash size={7} />
                                        <input 
                                          className="text-[10px] font-bold uppercase outline-none border-none bg-transparent w-full"
                                          value={ticket.n_tag || ''}
                                          placeholder="TAG"
                                          onBlur={(e) => handleUpdateTicket(ticket.id, { n_tag: e.target.value })}
                                          onChange={(e) => setTickets(prev => prev.map(t => t.id === ticket.id ? {...t, n_tag: e.target.value} : t))}
                                        />
                                      </div>
                                    </div>

                                    

                                    <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                                      
                                      <div className="flex items-center gap-1">
                                        <Activity size={10} className={pingStyles.icon} />
                                        <span className={`text-[10px] font-black uppercase ${pingStyles.container}`}>
                                          {formatDateShort(ticket.ultimo_ping)}
                                        </span>
                                      </div>
                                      <Link href={`/ticket/${ticket.id}`} className="p-1 bg-gray-900 text-white rounded hover:bg-blue-600 transition-all"><ChevronRight size={10} /></Link>
                                    </div>
                                    
                                    {/* BARRA PROGRESSO DINAMICA */}
                                    <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full">
                                      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${ticket.percentuale_avanzamento}%` }} />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
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

      {/* CONTROLLI ZOOM */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-2 bg-gray-900/90 backdrop-blur-md p-2 rounded-2xl shadow-2xl border border-white/10">
          <button onClick={() => setZoomLevel(prev => Math.max(1, prev - 1))} className="p-2 text-white hover:bg-white/10 rounded-xl transition-colors disabled:opacity-30" disabled={zoomLevel === 1}><Minus size={16} /></button>
          <div className="flex items-center gap-1 px-3 border-x border-white/10">
            {[1, 2, 3, 4, 5].map((lvl) => (<div key={lvl} className={`w-1.5 h-1.5 rounded-full transition-all ${lvl <= zoomLevel ? 'bg-blue-500 scale-125' : 'bg-white/20'}`} />))}
          </div>
          <button onClick={() => setZoomLevel(prev => Math.min(5, prev + 1))} className="p-2 text-white hover:bg-white/10 rounded-xl transition-colors disabled:opacity-30" disabled={zoomLevel === 5}><Plus size={16} /></button>
          <button onClick={() => setZoomLevel(3)} className="p-2 text-white/40 hover:text-white transition-colors"><Maximize2 size={14} /></button>
        </div>
      </div>
    </div>
  )
}