'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '../../lib/supabase'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { 
  Rocket, ChevronLeft, ChevronRight, 
  AlertCircle, Filter
} from 'lucide-react'
import Link from 'next/link'

export default function ReleaseCalendar() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<any[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [clienteFilter, setClienteFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)

  const fetchReleases = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('ticket')
      .select('*, clienti(nome)')
      .or('rilascio_in_collaudo.not.is.null,rilascio_in_produzione.not.is.null')
    setTickets(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchReleases() }, [fetchReleases])

  const formatDateKey = (date: Date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  }

  const listaClienti = useMemo(() => {
    const nomi = tickets.map(t => t.clienti?.nome).filter(Boolean)
    return Array.from(new Set(nomi)).sort()
  }, [tickets])

  // LOGICA GIORNI: Lunedì come primo giorno + riempimento mese
  const days = useMemo(() => {
    const result = []
    const d = new Date(currentDate)
    
    if (viewMode === 'week') {
      const day = d.getDay()
      const diff = d.getDate() - (day === 0 ? 6 : day - 1) // Offset per Lunedì
      const monday = new Date(d.setDate(diff))
      for (let i = 0; i < 7; i++) {
        const nextDay = new Date(monday); 
        nextDay.setDate(monday.getDate() + i)
        result.push(nextDay)
      }
    } else {
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1)
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      
      let firstDayIndex = startOfMonth.getDay() 
      const prefixDays = firstDayIndex === 0 ? 6 : firstDayIndex - 1 // Quanti giorni del mese prima

      for (let i = 1 - prefixDays; i <= endOfMonth.getDate(); i++) {
        result.push(new Date(d.getFullYear(), d.getMonth(), i))
      }
      
      while (result.length % 7 !== 0) {
        const lastDay = result[result.length - 1]
        result.push(new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1))
      }
    }
    return result
  }, [currentDate, viewMode])

  const getReleasesForDate = (d: Date) => {
    const target = formatDateKey(d)
    const results: any[] = []
    tickets.forEach(t => {
      if (clienteFilter !== 'ALL' && t.clienti?.nome !== clienteFilter) return
      if (t.rilascio_in_collaudo === target) results.push({ ...t, type: 'COLLAUDO', dndId: `${t.id}:COLLAUDO` })
      if (t.rilascio_in_produzione === target) results.push({ ...t, type: 'PROD', dndId: `${t.id}:PROD` })
    })
    return results
  }

  const onDragEnd = async (result: any) => {
    const { destination, draggableId } = result
    if (!destination || (destination.droppableId === result.source.droppableId)) return

    const [ticketId, type] = draggableId.split(':') 
    const newDateStr = destination.droppableId
    const column = type === 'PROD' ? 'rilascio_in_produzione' : 'rilascio_in_collaudo'

    const oldTickets = [...tickets]
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, [column]: newDateStr } : t))

    const { error } = await supabase.from('ticket').update({ [column]: newDateStr }).eq('id', ticketId)
    if (error) { setTickets(oldTickets); alert("Errore salvataggio"); }
  }

  const navigate = (direction: number) => {
    const next = new Date(currentDate)
    viewMode === 'week' ? next.setDate(currentDate.getDate() + (direction * 7)) : next.setMonth(currentDate.getMonth() + direction)
    setCurrentDate(next)
  }

  const stats = useMemo(() => {
    return days.reduce((acc, day) => {
      // Calcoliamo le statistiche solo per il mese corrente per coerenza visiva
      if (day.getMonth() !== currentDate.getMonth() && viewMode === 'month') return acc;
      getReleasesForDate(day).forEach(r => {
        if (r.type === 'PROD') acc.prod++; else acc.coll++
      })
      return acc
    }, { prod: 0, coll: 0 })
  }, [days, tickets, clienteFilter, currentDate, viewMode])

  return (
    <div className="min-h-screen bg-[#FBFBFB] p-4 md:p-8 text-black">
      <div className="max-w-[1800px] mx-auto">
        
        {/* HEADER */}
        <div className="mb-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3 italic underline decoration-blue-500/20 uppercase">
              <Rocket className="text-blue-600" size={36} /> RILASCI - {currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
            </h1>
            <div className="flex items-center gap-4 mt-2">
              
              <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-2 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">PROD: {stats.prod}</span>
              </div>
              <div className="flex items-center gap-2 bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">COLLAUDO: {stats.coll}</span>
              
            </div>
          </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
              <Filter size={14} className="text-gray-400" />
              <select value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)} className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer min-w-[120px]">
                <option value="ALL">TUTTI I CLIENTI</option>
                {listaClienti.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
              {['week', 'month'].map(mode => (
                <button key={mode} onClick={() => setViewMode(mode as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === mode ? 'bg-black text-white' : 'text-gray-400'}`}>
                  {mode === 'week' ? 'Settimana' : 'Mese'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate(-1)} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors shadow-sm"><ChevronLeft size={18}/></button>
              <button onClick={() => navigate(1)} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors shadow-sm"><ChevronRight size={18}/></button>
            </div>
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            <div className="xl:col-span-3">
              <div className={`grid gap-4 ${viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-7'}`}>
                {days.map((day) => {
                  const dayRels = getReleasesForDate(day)
                  const dateId = formatDateKey(day)
                  const isToday = dateId === formatDateKey(new Date())
                  const isSelected = selectedDate && formatDateKey(selectedDate) === dateId
                  // NUOVO: Controllo se il giorno appartiene al mese corrente
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth()

                  return (
                    <Droppable droppableId={dateId} key={dateId}>
                      {(provided, snapshot) => (
                        <div 
                          {...provided.droppableProps} ref={provided.innerRef}
                          onClick={() => setSelectedDate(day)}
                          className={`min-h-[200px] p-4 rounded-[2.5rem] border transition-all duration-300 ${
                            snapshot.isDraggingOver ? 'bg-blue-50/50 border-blue-300 scale-[1.02]' :
                            isSelected ? 'border-black bg-white ring-4 ring-black/5 shadow-xl z-10' : 
                            isToday ? 'bg-blue-50/30 border-blue-100' : 'bg-white border-gray-100'
                          } ${!isCurrentMonth && viewMode === 'month' ? 'opacity-30 grayscale-[0.5] bg-gray-50/50' : 'opacity-100'}`}
                        >
                          <div className="flex flex-col mb-4">
                            <span className="text-[9px] font-black text-gray-300 uppercase italic">{day.toLocaleDateString('it-IT', { weekday: 'short' })}</span>
                            <span className={`text-xl font-black ${isToday ? 'text-blue-600' : isCurrentMonth ? 'text-black' : 'text-gray-300'}`}>{day.getDate()}</span>
                          </div>

                          <div className="space-y-2">
                            {dayRels.map((rel, rIdx) => (
                              <Draggable key={rel.dndId} draggableId={rel.dndId} index={rIdx}>
                                {(p) => (
                                  <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}
                                    className={`flex items-center gap-2 p-2 rounded-xl transition-all group bg-white border border-transparent shadow-sm ${!isCurrentMonth ? 'opacity-50' : ''}`}
                                  >
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${rel.type === 'PROD' ? 'bg-red-500' : 'bg-purple-500'}`} />
                                    <span className="text-[8px] font-black uppercase truncate text-gray-700">{rel.clienti?.nome}</span>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        </div>
                      )}
                    </Droppable>
                  )
                })}
              </div>
            </div>

            {/* SIDEBAR DETTAGLIO */}
            <div className="xl:col-span-1">
              <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-sm sticky top-8 max-h-[85vh] overflow-y-auto">
                <h3 className="text-2xl font-black italic uppercase mb-1 text-black">Dettaglio</h3>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-8 border-b pb-4">
                  {selectedDate?.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>

                <div className="space-y-4">
                  {selectedDate && getReleasesForDate(selectedDate).map((t, i) => (
                    <div key={i} className="p-5 rounded-[2rem] border border-gray-50 bg-[#FBFBFB] hover:border-blue-100 transition-all">
                      <div className="flex justify-between mb-4">
                        <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase ${t.type === 'PROD' ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
                          {t.type}
                        </span>
                        <Link href={`/ticket/${t.id}`} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-black hover:text-white transition-all">
                          <ChevronRight size={14}/>
                        </Link>
                      </div>
                      <h4 className="text-[13px] font-black uppercase mb-1 text-black">{t.clienti?.nome}</h4>
                      <p className="text-[11px] text-gray-500 italic mb-4 line-clamp-3">"{t.titolo}"</p>
                      <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                         <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-md">{t.stato}</span>
                         <span className="text-[9px] font-bold text-gray-300 tracking-widest">#{t.n_tag}</span>
                      </div>
                    </div>
                  ))}
                  {selectedDate && getReleasesForDate(selectedDate).length === 0 && (
                    <div className="py-20 text-center text-[10px] font-black opacity-10 uppercase italic">Nessun rilascio</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DragDropContext>
      </div>
    </div>
  )
}