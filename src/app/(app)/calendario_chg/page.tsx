'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, Info
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

  const fetchGoogleEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/calendar-esselunga');
      const data = await res.json();
      if (!data.error) setGoogleEvents(data);
    } catch (err) {
      console.error("Errore fetch Google:", err);
    } finally {
      setLoading(false)
    }
  }, []);

  useEffect(() => { 
    if (enabled) fetchGoogleEvents() 
  }, [enabled, fetchGoogleEvents])

  const formatDateKey = (date: Date) => {
    const d = new Date(date)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().split('T')[0]
  }

  const getReleasesForDate = useCallback((d: Date) => {
    const target = formatDateKey(d)
    return googleEvents
      .filter(e => e.data === target)
      .map(e => ({ ...e, dndId: `${e.id}:EXTERNAL` }))
  }, [googleEvents])

  // LOGICA GIORNI: Lunedì primo giorno + Fix Type Error per Vercel
  const days = useMemo(() => {
    const result: Date[] = []
    const d = new Date(currentDate)
    
    if (viewMode === 'week') {
      const day = d.getDay()
      const diff = d.getDate() - (day === 0 ? 6 : day - 1)
      const monday = new Date(d.getFullYear(), d.getMonth(), diff)
      for (let i = 0; i < 7; i++) {
        const nextDay = new Date(monday);
        nextDay.setDate(monday.getDate() + i)
        result.push(nextDay)
      }
    } else {
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1)
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      const firstDayIndex = startOfMonth.getDay() 
      const prefixDays = firstDayIndex === 0 ? 6 : firstDayIndex - 1

      for (let i = 1 - prefixDays; i <= endOfMonth.getDate(); i++) {
        result.push(new Date(d.getFullYear(), d.getMonth(), i))
      }
      
      while (result.length % 7 !== 0) {
        const currentLast = result[result.length - 1];
        if (currentLast) {
          const nextDay = new Date(currentLast);
          nextDay.setDate(currentLast.getDate() + 1);
          result.push(nextDay);
        }
      }
    }
    return result
  }, [currentDate, viewMode])

  // CONTATORI: Solo periodo visibile (e solo mese corrente se in vista Month)
  const stats = useMemo(() => {
    return days.reduce((acc, day) => {
      if (viewMode === 'month' && day.getMonth() !== currentDate.getMonth()) return acc;
      
      const dayRels = getReleasesForDate(day);
      dayRels.forEach(r => {
        if (r.type === 'PROD') acc.prod++;
        else acc.coll++;
      });
      return acc;
    }, { prod: 0, coll: 0 });
  }, [days, currentDate, getReleasesForDate, viewMode]);

  if (!enabled) return <div className="min-h-screen bg-[#FBFBFB] p-8 font-black italic opacity-20 text-black uppercase">Caricamento...</div>

  return (
    <div className="min-h-screen bg-[#FBFBFB] p-4 md:p-8 text-black font-sans">
      <div className="max-w-[1800px] mx-auto">
        
        {/* HEADER */}
        <div className="mb-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex flex-wrap items-center gap-3 italic underline decoration-blue-500/20 uppercase">
              <CalendarIcon className="text-blue-600" size={36} /> 
              Rilasci Change - {currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-4">
              
              <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black text-red-600 uppercase">PROD: {stats.prod}</span>
              </div>
              <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-full border border-purple-100">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span className="text-[10px] font-black text-purple-600 uppercase">COLLAUDO: {stats.coll}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
              <button onClick={() => setViewMode('week')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'week' ? 'bg-black text-white' : 'text-gray-400'}`}>Settimana</button>
              <button onClick={() => setViewMode('month')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'month' ? 'bg-black text-white' : 'text-gray-400'}`}>Mese</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { const n = new Date(currentDate); viewMode === 'week' ? n.setDate(n.getDate()-7) : n.setMonth(n.getMonth()-1); setCurrentDate(n); }} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 shadow-sm"><ChevronLeft size={18}/></button>
              <button onClick={() => { const n = new Date(currentDate); viewMode === 'week' ? n.setDate(n.getDate()+7) : n.setMonth(n.getMonth()+1); setCurrentDate(n); }} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 shadow-sm"><ChevronRight size={18}/></button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-3">
            <div className={`grid gap-4 ${viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-7'}`}>
              {days.map((day) => {
                const dateId = formatDateKey(day);
                const dayRels = getReleasesForDate(day);
                const isToday = dateId === formatDateKey(new Date());
                const isSelected = selectedDate && formatDateKey(selectedDate) === dateId;
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();

                return (
                  <div 
                    key={dateId}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[200px] p-4 rounded-[2.5rem] border transition-all cursor-pointer relative ${
                      isSelected ? 'border-black bg-white shadow-2xl scale-[1.02] z-10' : 
                      isToday ? 'bg-blue-50/30 border-blue-200' : 'bg-white border-gray-100 hover:border-gray-300'
                    } ${!isCurrentMonth ? 'opacity-30 grayscale-[0.8] bg-gray-50/50' : ''}`}
                  >
                    <div className="flex flex-col mb-4">
                      <span className="text-[9px] font-black text-gray-300 uppercase italic">{day.toLocaleDateString('it-IT', { weekday: 'short' })}</span>
                      <span className={`text-2xl font-black ${isToday ? 'text-blue-600' : 'text-black'}`}>{day.getDate()}</span>
                    </div>

                    <div className="space-y-2">
                      {dayRels.map((rel, i) => (
                        <div key={i} className="flex flex-col gap-1 p-2.5 rounded-2xl bg-white border border-gray-100 shadow-sm">
                          <div className={`w-full h-1 rounded-full mb-1 ${rel.type === 'PROD' ? 'bg-red-500' : 'bg-purple-500'}`} />
                          <span className="text-[11px] font-[900] leading-tight uppercase italic text-black line-clamp-2">
                            {rel.titolo}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SIDEBAR */}
          <div className="xl:col-span-1">
            <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-sm sticky top-8">
              <h3 className="text-2xl font-black italic uppercase mb-1">Dettaglio</h3>
              <p className="text-[10px] font-black text-gray-300 uppercase border-b pb-4 mb-6 tracking-widest">
                {selectedDate?.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {selectedDate && getReleasesForDate(selectedDate).map((t, i) => (
                  <div key={i} className="p-6 rounded-[2.2rem] border border-gray-100 bg-[#FDFDFD] shadow-sm hover:border-blue-200 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase ${t.type === 'PROD' ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'}`}>
                        {t.type}
                      </span>
                      <span className="text-[8px] font-black text-blue-500 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md">
                        <CalendarIcon size={10} /> GOOGLE
                      </span>
                    </div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Titolo:</h4>
                    <p className="text-[18px] font-black text-black leading-tight italic uppercase">
                      {t.titolo}
                    </p>
                    <div className="mt-6 pt-4 border-t border-dashed border-gray-100 flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shadow-inner">
                          <Info size={16} />
                       </div>
                       <p className="text-[9px] font-black text-gray-400 uppercase leading-none">
                         Sync: Esselunga <br/><span className="text-blue-600">Calendario Esterno</span>
                       </p>
                    </div>
                  </div>
                ))}
                {(!selectedDate || getReleasesForDate(selectedDate).length === 0) && (
                  <div className="py-20 text-center opacity-20">
                    <AlertCircle className="mx-auto mb-2" size={32} />
                    <p className="text-[10px] font-black uppercase italic">Nessun evento</p>
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