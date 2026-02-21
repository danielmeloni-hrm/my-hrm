'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { 
  Rocket, ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, Info
} from 'lucide-react'

export default function GoogleOnlyCalendar() {
  const [enabled, setEnabled] = useState(false)
  const [googleEvents, setGoogleEvents] = useState<any[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setEnabled(true)
  }, [])

  // FETCH SOLO DA GOOGLE CALENDAR
  const fetchGoogleEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/calendar-esselunga');
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) return;

      const data = await res.json();
      if (data.error) return;
      setGoogleEvents(data);
    } catch (err) {
      console.error("Errore fetch Google:", err);
    } finally {
      setLoading(false)
    }
  }, []);

  useEffect(() => { 
    if (enabled) fetchGoogleEvents() 
  }, [enabled, fetchGoogleEvents])

  // --- LOGICA UTILS ---
  const formatDateKey = (date: Date) => {
    const d = new Date(date)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().split('T')[0]
  }

  // CONTATORI ESCLUSIVI GOOGLE
  const stats = useMemo(() => {
    return googleEvents.reduce((acc, e) => {
      if (e.type === 'PROD') acc.prod++
      else acc.coll++
      return acc
    }, { prod: 0, coll: 0 })
  }, [googleEvents])

  const days = useMemo(() => {
    const result = []
    const d = new Date(currentDate)
    if (viewMode === 'week') {
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d.setDate(diff))
      for (let i = 0; i < 7; i++) {
        const nextDay = new Date(monday); nextDay.setDate(monday.getDate() + i)
        result.push(nextDay)
      }
    } else {
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1)
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      
      // Calcoliamo quanti giorni del mese precedente mostrare per arrivare al lunedì
      // getDay(): 0=Dom, 1=Lun, ..., 6=Sab
      let firstDayIndex = startOfMonth.getDay() 
      const prefixDays = firstDayIndex === 0 ? 6 : firstDayIndex - 1

      // Aggiungiamo i giorni del mese corrente
      for (let i = 1 - prefixDays; i <= endOfMonth.getDate(); i++) {
        result.push(new Date(d.getFullYear(), d.getMonth(), i))
      }
      
      // Opzionale: aggiungiamo giorni del mese successivo per completare l'ultima riga da 7
      while (result.length % 7 !== 0) {
        const lastDay = result[result.length - 1]
        result.push(new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1))
      }
    }
    return result
  }, [currentDate, viewMode])

  const getReleasesForDate = useCallback((d: Date) => {
    const target = formatDateKey(d)
    return googleEvents
      .filter(e => e.data === target)
      .map(e => ({ ...e, dndId: `${e.id}:EXTERNAL` }))
  }, [googleEvents])

  if (!enabled) return <div className="min-h-screen bg-[#FBFBFB] p-8 font-black italic opacity-20 text-black uppercase">Caricamento Calendario...</div>

  return (
    <div className="min-h-screen bg-[#FBFBFB] p-4 md:p-8 text-black font-sans">
      <div className="max-w-[1800px] mx-auto">
        
        {/* HEADER E STATISTICHE GOOGLE */}
        <div className="mb-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3 italic underline decoration-blue-500/20 uppercase">
              <CalendarIcon className="text-blue-600" size={36} /> Rilasci Change - {currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
            </h1>
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

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
              <button onClick={() => setViewMode('week')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'week' ? 'bg-black text-white' : 'text-gray-400'}`}>Settimana</button>
              <button onClick={() => setViewMode('month')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'month' ? 'bg-black text-white' : 'text-gray-400'}`}>Mese</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { const n = new Date(currentDate); n.setDate(n.getDate() - (viewMode === 'week' ? 7 : 30)); setCurrentDate(n); }} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition-all shadow-sm"><ChevronLeft size={18}/></button>
              <button onClick={() => { const n = new Date(currentDate); n.setDate(n.getDate() + (viewMode === 'week' ? 7 : 30)); setCurrentDate(n); }} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition-all shadow-sm"><ChevronRight size={18}/></button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* GRIGLIA CALENDARIO */}
          <div className="xl:col-span-3">
            <div className={`grid gap-4 ${viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-4 lg:grid-cols-7'}`}>
              {days.map((day) => {
                const dateId = formatDateKey(day);
                const dayRels = getReleasesForDate(day);
                const isToday = dateId === formatDateKey(new Date());
                const isSelected = selectedDate && formatDateKey(selectedDate) === dateId;
                
                // CONTROLLO: Il giorno appartiene al mese che stiamo visualizzando?
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();

                return (
                    <div 
                    key={dateId}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[180px] p-4 rounded-[2.5rem] border transition-all cursor-pointer ${
                        isSelected ? 'border-black bg-white shadow-xl scale-[1.02] z-10' : 
                        isToday ? 'bg-blue-50/30 border-blue-100' : 'bg-white border-gray-100'
                    } ${
                        // Se non è il mese corrente, rendiamo il box più chiaro e leggermente trasparente
                        !isCurrentMonth ? 'opacity-40 grayscale-[0.5] bg-gray-50/50' : 'opacity-100'
                    }`}
                    >
                    <span className={`text-[9px] font-black uppercase italic block ${
                        !isCurrentMonth ? 'text-gray-300' : 'text-gray-400'
                    }`}>
                        {day.toLocaleDateString('it-IT', { weekday: 'short' })}
                    </span>
                    
                    <span className={`text-xl font-black mb-4 block ${
                        isToday ? 'text-blue-600' : 
                        !isCurrentMonth ? 'text-gray-300' : 'text-black'
                    }`}>
                        {day.getDate()}
                    </span>

                    <div className="space-y-2">
                        {dayRels.map((rel) => (
                        <div 
                            key={rel.dndId} 
                            className={`flex items-center gap-2 p-2 rounded-xl border border-transparent text-[8px] font-black uppercase ${
                            !isCurrentMonth ? 'bg-gray-100/50 text-gray-400' : 'bg-gray-50 text-black shadow-sm'
                            }`}
                        >
                            <div className={`w-2 h-2 rounded-full ${
                            !isCurrentMonth ? 'bg-gray-300' : (rel.type === 'PROD' ? 'bg-red-500' : 'bg-purple-500')
                            }`} />
                            <span className="truncate">{rel.titolo || 'Senza Titolo'}</span>
                        </div>
                        ))}
                    </div>
                    </div>
                );
                })}
            </div>
          </div>

          {/* SIDEBAR DETTAGLIO: FOCUS SUL TITOLO */}
          <div className="xl:col-span-1">
            <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-sm sticky top-8">
              <h3 className="text-2xl font-black italic uppercase mb-1">Evento</h3>
              <p className="text-[10px] font-black text-gray-300 uppercase border-b pb-4 mb-6">
                {selectedDate?.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {selectedDate && getReleasesForDate(selectedDate).map((t, i) => (
                  <div key={i} className="p-6 rounded-[2rem] border border-gray-100 bg-[#FDFDFD] shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase ${
                        t.type === 'PROD' ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'
                      }`}>
                        {t.type}
                      </span>
                      <span className="text-[8px] font-black text-blue-500 flex items-center gap-1">
                        <CalendarIcon size={10} /> GOOGLE
                      </span>
                    </div>
                    
                    <h4 className="text-[11px] font-black text-gray-400 uppercase mb-1 tracking-widest">
                      Titolo Evento:
                    </h4>
                    <p className="text-[16px] font-black text-black leading-tight italic">
                      {t.titolo || 'Nessun titolo specificato'}
                    </p>

                    <div className="mt-6 pt-4 border-t border-dashed border-gray-100 flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                          <Info size={14} />
                       </div>
                       <p className="text-[9px] font-bold text-gray-400 uppercase leading-none">
                         Sincronizzato <br/>da Esselunga
                       </p>
                    </div>
                  </div>
                ))}

                {selectedDate && getReleasesForDate(selectedDate).length === 0 && (
                  <div className="py-20 text-center opacity-20">
                    <AlertCircle className="mx-auto mb-2" size={32} />
                    <p className="text-[10px] font-black uppercase italic">Nessun evento in questa data</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}