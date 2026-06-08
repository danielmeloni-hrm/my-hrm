'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import {
  Rocket, ChevronLeft, ChevronRight,
  AlertCircle, Filter, Calendar as CalendarIcon, X
} from 'lucide-react'
import Link from 'next/link'

const GOOGLE_CALENDARS = [
  {
    id: 'assenze',
    label: 'Assenze',
    bg: 'bg-amber-100',
    border: 'border-amber-300',
    text: 'text-amber-900',
    dot: 'bg-amber-500',
    calendarId: '66d24b1d19fd7adedefabcae03dddafa97bee68e68cb46e2ecc8dbc9d10bdbaf@group.calendar.google.com'
  },
  {
    id: 'webanalytics',
    label: 'WebAnalytics Call',
    bg: 'bg-emerald-100',
    border: 'border-emerald-300',
    text: 'text-emerald-900',
    dot: 'bg-emerald-500',
    calendarId: '926d04a992e7d85fe3f8a14ab3d63e7e760c63e8233a221e59a429295ba9aedc@group.calendar.google.com'
  },
  {
    id: 'prod',
    label: 'Rilasci Change Produzione',
    bg: 'bg-rose-100',
    border: 'border-rose-300',
    text: 'text-rose-900',
    dot: 'bg-rose-500',
    calendarId: '732eacb1f9fc6f955a9f912ef7a4c840e72bc1214c4583ff9cee9a3879d4d3d9@group.calendar.google.com'
  },
  {
    id: 'collaudo',
    label: 'Rilasci Change Collaudo',
    bg: 'bg-violet-100',
    border: 'border-violet-300',
    text: 'text-violet-900',
    dot: 'bg-violet-500',
    calendarId: 'e1b8680caf760dcc73c31959828d8525072c9432f6bc0be0b12f484c1265a2eb@group.calendar.google.com'
  }
]

const START_HOUR = 7
const END_HOUR = 20
const HOUR_HEIGHT = 88
const DAY_MINUTES = (END_HOUR - START_HOUR) * 60

export default function ReleaseCalendar() {
  const supabase = createClient()

  const [tickets, setTickets] = useState<any[]>([])
  const [googleEvents, setGoogleEvents] = useState<any[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [clienteFilter, setClienteFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)

  const [activeCalendars, setActiveCalendars] = useState<Record<string, boolean>>({
    assenze: true,
    webanalytics: true,
    prod: true,
    collaudo: true
  })

  const formatDateKey = (date: Date) => {
    const d = new Date(date)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().split('T')[0]
  }

  const days = useMemo(() => {
    const result: Date[] = []
    const d = new Date(currentDate)

    if (viewMode === 'week') {
      const day = d.getDay()
      const diff = d.getDate() - (day === 0 ? 6 : day - 1)
      const monday = new Date(d.getFullYear(), d.getMonth(), diff)

      for (let i = 0; i < 7; i++) {
        const nextDay = new Date(monday)
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
        const currentLast = result[result.length - 1]
        const nextDay = new Date(currentLast)
        nextDay.setDate(currentLast.getDate() + 1)
        result.push(nextDay)
      }
    }

    return result
  }, [currentDate, viewMode])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedDate(null)
    }

    if (selectedDate) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleEsc)
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleEsc)
    }
  }, [selectedDate])

  const fetchReleases = useCallback(async () => {
    setLoading(true)

    const { data } = await supabase
      .from('ticket')
      .select('*, clienti(nome)')
      .or('rilascio_in_collaudo.not.is.null,rilascio_in_produzione.not.is.null')

    setTickets(data || [])
    setLoading(false)
  }, [supabase])

  const fetchGoogleEvents = useCallback(async () => {
    const enabledCalendars = GOOGLE_CALENDARS.filter(c => activeCalendars[c.id])

    if (days.length === 0) return

    const timeMin = new Date(days[0])
    timeMin.setHours(0, 0, 0, 0)

    const timeMax = new Date(days[days.length - 1])
    timeMax.setHours(23, 59, 59, 999)

    const allEvents = await Promise.allSettled(
      enabledCalendars.map(async cal => {
        const params = new URLSearchParams({
          calendarId: cal.calendarId,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString()
        })

        const res = await fetch(`/api/google-calendar?${params.toString()}`)
        const text = await res.text()

        let data: any = {}
        try {
          data = text ? JSON.parse(text) : {}
        } catch {
          data = {}
        }

        if (!res.ok) {
          console.warn(`Calendario non caricato: ${cal.label}`, data)
          return []
        }

        return (data.events || []).map((event: any) => ({
          ...event,
          calendarLabel: cal.label,
          calendarBg: cal.bg,
          calendarBorder: cal.border,
          calendarText: cal.text,
          calendarDot: cal.dot,
          calendarKey: cal.id
        }))
      })
    )

    const validEvents = allEvents.flatMap(result =>
      result.status === 'fulfilled' ? result.value : []
    )

    setGoogleEvents(validEvents)
  }, [activeCalendars, days])

  useEffect(() => {
    fetchReleases()
  }, [fetchReleases])

  useEffect(() => {
    fetchGoogleEvents()
  }, [fetchGoogleEvents])

  const listaClienti = useMemo(() => {
    const nomi = tickets.map(t => t.clienti?.nome).filter(Boolean)
    return Array.from(new Set(nomi)).sort()
  }, [tickets])

  const getReleasesForDate = useCallback((d: Date) => {
    const target = formatDateKey(d)
    const results: any[] = []

    tickets.forEach(t => {
      if (clienteFilter !== 'ALL' && t.clienti?.nome !== clienteFilter) return

      if (t.rilascio_in_collaudo === target) {
        results.push({ ...t, type: 'COLLAUDO', dndId: `${t.id}:COLLAUDO` })
      }

      if (t.rilascio_in_produzione === target) {
        results.push({ ...t, type: 'PROD', dndId: `${t.id}:PROD` })
      }
    })

    return results
  }, [tickets, clienteFilter])

  const getGoogleEventsForDate = useCallback((d: Date) => {
    const target = formatDateKey(d)

    return googleEvents.filter(event => {
      const eventDate = event.start?.date
        ? event.start.date
        : formatDateKey(new Date(event.start?.dateTime))

      return eventDate === target
    })
  }, [googleEvents])

  const getTimedEventsForDate = useCallback((d: Date) => {
    return getGoogleEventsForDate(d)
      .filter(event => event.start?.dateTime && event.end?.dateTime)
      .map(event => {
        const start = new Date(event.start.dateTime)
        const end = new Date(event.end.dateTime)

        const startMinutes = start.getHours() * 60 + start.getMinutes()
        const endMinutes = end.getHours() * 60 + end.getMinutes()

        const clampedStart = Math.max(startMinutes, START_HOUR * 60)
        const clampedEnd = Math.min(endMinutes, END_HOUR * 60)

        return {
          ...event,
          startObj: start,
          endObj: end,
          startMinutes,
          endMinutes,
          top: ((clampedStart - START_HOUR * 60) / DAY_MINUTES) * 100,
          height: Math.max(((clampedEnd - clampedStart) / DAY_MINUTES) * 100, 5)
        }
      })
      .filter(event => event.endMinutes > START_HOUR * 60 && event.startMinutes < END_HOUR * 60)
  }, [getGoogleEventsForDate])

  const getAllDayGoogleEventsForDate = useCallback((d: Date) => {
    return getGoogleEventsForDate(d).filter(event => !event.start?.dateTime)
  }, [getGoogleEventsForDate])

  const layoutTimedEvents = (events: any[]) => {
    const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes)

    const groups: any[][] = []
    let currentGroup: any[] = []
    let currentGroupEnd = -1

    sorted.forEach(event => {
      if (currentGroup.length === 0 || event.startMinutes < currentGroupEnd) {
        currentGroup.push(event)
        currentGroupEnd = Math.max(currentGroupEnd, event.endMinutes)
      } else {
        groups.push(currentGroup)
        currentGroup = [event]
        currentGroupEnd = event.endMinutes
      }
    })

    if (currentGroup.length > 0) groups.push(currentGroup)

    return groups.flatMap(group => {
      const columns: any[][] = []

      group.forEach(event => {
        let placed = false

        for (let i = 0; i < columns.length; i++) {
          const last = columns[i][columns[i].length - 1]

          if (last.endMinutes <= event.startMinutes) {
            columns[i].push(event)
            event.column = i
            placed = true
            break
          }
        }

        if (!placed) {
          columns.push([event])
          event.column = columns.length - 1
        }
      })

      return group.map(event => ({
        ...event,
        width: 100 / columns.length,
        left: (event.column * 100) / columns.length
      }))
    })
  }

  const onDragEnd = async (result: any) => {
    const { destination, draggableId } = result

    if (!destination || destination.droppableId === result.source.droppableId) return

    const [ticketId, type] = draggableId.split(':')
    const newDateStr = destination.droppableId
    const column = type === 'PROD' ? 'rilascio_in_produzione' : 'rilascio_in_collaudo'

    const oldTickets = [...tickets]

    setTickets(prev =>
      prev.map(t =>
        String(t.id) === String(ticketId)
          ? { ...t, [column]: newDateStr }
          : t
      )
    )

    const { error } = await supabase
      .from('ticket')
      .update({ [column]: newDateStr })
      .eq('id', ticketId)

    if (error) {
      setTickets(oldTickets)
      alert('Errore salvataggio')
    }
  }

  const navigate = (direction: number) => {
    const next = new Date(currentDate)

    if (viewMode === 'week') {
      next.setDate(currentDate.getDate() + direction * 7)
    } else {
      next.setMonth(currentDate.getMonth() + direction)
    }

    setCurrentDate(next)
  }

  const stats = useMemo(() => {
    return days.reduce((acc, day) => {
      if (day.getMonth() !== currentDate.getMonth() && viewMode === 'month') return acc

      getReleasesForDate(day).forEach(r => {
        if (r.type === 'PROD') acc.prod++
        else acc.coll++
      })

      return acc
    }, { prod: 0, coll: 0 })
  }, [days, getReleasesForDate, currentDate, viewMode])

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

  return (
    <div className="min-h-screen bg-[#F6F7FB] p-4 md:p-8 text-black">
      <div className="max-w-[1900px] mx-auto">

        <div className="mb-8 flex flex-col gap-6">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
            <div>
              <h1 className="text-2xl font-black tracking-tighter flex items-center gap-3 italic uppercase">
                <Rocket className="text-blue-600" size={34} />
                Calendario Operativo
              </h1>

              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-2">
                {currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-4">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-red-600 uppercase">PROD: {stats.prod}</span>
                </div>

                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
                  <span className="w-2 h-2 bg-purple-500 rounded-full" />
                  <span className="text-[10px] font-black text-purple-600 uppercase">COLLAUDO: {stats.coll}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
                <Filter size={14} className="text-gray-400" />
                <select
                  value={clienteFilter}
                  onChange={(e) => setClienteFilter(e.target.value)}
                  className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer min-w-[130px]"
                >
                  <option value="ALL">TUTTI I CLIENTI</option>
                  {listaClienti.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
                {['week', 'month'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode as 'week' | 'month')}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                      viewMode === mode ? 'bg-black text-white' : 'text-gray-400 hover:text-black'
                    }`}
                  >
                    {mode === 'week' ? 'Settimana' : 'Mese'}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={() => navigate(-1)} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 shadow-sm">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={() => navigate(1)} className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 shadow-sm">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {GOOGLE_CALENDARS.map(cal => (
              <button
                key={cal.id}
                onClick={() =>
                  setActiveCalendars(prev => ({
                    ...prev,
                    [cal.id]: !prev[cal.id]
                  }))
                }
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-[9px] font-black uppercase transition-all shadow-sm ${
                  activeCalendars[cal.id]
                    ? `${cal.bg} ${cal.text} ${cal.border}`
                    : 'bg-white text-gray-300 border-gray-100 opacity-60'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${cal.dot}`} />
                {cal.label}
              </button>
            ))}
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          {viewMode === 'week' ? (
            <div className="bg-white border border-gray-100 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="grid grid-cols-[72px_repeat(7,1fr)] border-b border-gray-100 sticky top-0 z-20 bg-white">
                <div className="bg-gray-50" />

                {days.map(day => {
                  const dateId = formatDateKey(day)
                  const isToday = dateId === formatDateKey(new Date())

                  return (
                    <div
                      key={dateId}
                      onClick={() => setSelectedDate(day)}
                      className={`p-4 border-l border-gray-100 cursor-pointer transition-all ${
                        isToday ? 'bg-blue-50/70' : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-[9px] font-black uppercase text-gray-400">
                        {day.toLocaleDateString('it-IT', { weekday: 'short' })}
                      </div>
                      <div className={`text-2xl font-black ${isToday ? 'text-blue-600' : 'text-black'}`}>
                        {day.getDate()}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-[72px_repeat(7,1fr)] border-b border-gray-100">
                <div className="p-3 text-[9px] font-black text-gray-300 uppercase bg-gray-50">
                  Day
                </div>

                {days.map(day => {
                  const dateId = formatDateKey(day)
                  const dayRels = getReleasesForDate(day)
                  const allDayEvents = getAllDayGoogleEventsForDate(day)

                  return (
                    <Droppable droppableId={dateId} key={dateId}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="min-h-[130px] p-2 border-l border-gray-100 space-y-2 bg-white"
                        >
                          {dayRels.map((rel, rIdx) => (
                            <Draggable key={rel.dndId} draggableId={rel.dndId} index={rIdx}>
                              {(p) => (
                                <div
                                  ref={p.innerRef}
                                  {...p.draggableProps}
                                  {...p.dragHandleProps}
                                  className={`p-2.5 rounded-2xl border shadow-sm ${
                                    rel.type === 'PROD'
                                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                                      : 'bg-violet-50 border-violet-200 text-violet-900'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full ${rel.type === 'PROD' ? 'bg-rose-500' : 'bg-violet-500'}`} />
                                    <span className="text-[7px] font-black uppercase opacity-70 truncate">
                                      {rel.type}
                                    </span>
                                  </div>
                                  <div className="text-[10px] font-black uppercase truncate">
                                    #{rel.n_tag}
                                  </div>
                                  <div className="text-[8px] font-bold italic truncate opacity-80">
                                    {rel.titolo}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}

                          {allDayEvents.map((event, idx) => (
                            <div
                              key={`${event.id}-allday-${idx}`}
                              className={`p-2.5 rounded-2xl border ${event.calendarBorder} ${event.calendarBg} ${event.calendarText} shadow-sm`}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`w-2 h-2 rounded-full ${event.calendarDot}`} />
                                <span className="text-[7px] font-black uppercase opacity-70 truncate">
                                  {event.calendarLabel}
                                </span>
                              </div>

                              <div className="text-[10px] font-black uppercase truncate">
                                {event.summary || 'Evento senza titolo'}
                              </div>
                            </div>
                          ))}

                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  )
                })}
              </div>

              <div
                className="grid grid-cols-[72px_repeat(7,1fr)] relative"
                style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}
              >
                <div className="bg-gray-50 border-r border-gray-100">
                  {hours.slice(0, -1).map(hour => (
                    <div
                      key={hour}
                      className="border-b border-gray-100 text-[10px] font-black text-gray-300 text-center pt-2"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                    >
                      {String(hour).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {days.map(day => {
                  const dateId = formatDateKey(day)
                  const timedEvents = layoutTimedEvents(getTimedEventsForDate(day))
                  const isToday = dateId === formatDateKey(new Date())

                  return (
                    <div
                      key={dateId}
                      className={`relative border-l border-gray-100 cursor-pointer ${
                        isToday ? 'bg-blue-50/20' : 'bg-white'
                      }`}
                      onClick={() => setSelectedDate(day)}
                    >
                      {hours.slice(0, -1).map(hour => (
                        <div
                          key={hour}
                          className="border-b border-gray-100 hover:bg-gray-50/50 transition-all"
                          style={{ height: `${HOUR_HEIGHT}px` }}
                        />
                      ))}

                      {timedEvents.map((event, idx) => (
                        <div
                          key={`${event.id}-timed-${idx}`}
                          className="absolute px-1"
                          style={{
                            top: `${event.top}%`,
                            height: `${event.height}%`,
                            left: `${event.left}%`,
                            width: `${event.width}%`
                          }}
                        >
                          <div
                            className={`h-full overflow-hidden rounded-2xl border ${event.calendarBorder} ${event.calendarBg} ${event.calendarText} shadow-sm p-3 hover:shadow-lg hover:scale-[1.01] transition-all`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${event.calendarDot}`} />
                                <span className="text-[7px] font-black uppercase truncate opacity-70">
                                  {event.calendarLabel}
                                </span>
                              </div>

                              <span className="text-[8px] font-black opacity-70 whitespace-nowrap">
                                {event.startObj.toLocaleTimeString('it-IT', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>

                            <div className="text-[11px] font-black uppercase leading-tight line-clamp-2">
                              {event.summary || 'Evento senza titolo'}
                            </div>

                            <div className="text-[8px] font-bold opacity-70 mt-1">
                              {event.startObj.toLocaleTimeString('it-IT', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                              {' - '}
                              {event.endObj.toLocaleTimeString('it-IT', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
              {days.map(day => {
                const dayRels = getReleasesForDate(day)
                const dayGoogleEvents = getGoogleEventsForDate(day)
                const dateId = formatDateKey(day)
                const isToday = dateId === formatDateKey(new Date())
                const isCurrentMonth = day.getMonth() === currentDate.getMonth()

                return (
                  <Droppable droppableId={dateId} key={dateId}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        onClick={() => setSelectedDate(day)}
                        className={`min-h-[240px] p-4 rounded-[2.5rem] border transition-all cursor-pointer ${
                          snapshot.isDraggingOver ? 'bg-blue-50/50 border-blue-300 scale-[1.02]' :
                          isToday ? 'bg-blue-50/40 border-blue-200' :
                          'bg-white border-gray-100 hover:border-gray-300'
                        } ${!isCurrentMonth ? 'opacity-30 grayscale-[0.8] bg-gray-50/50' : 'opacity-100'}`}
                      >
                        <div className="flex flex-col mb-4">
                          <span className="text-[9px] font-black text-gray-300 uppercase italic">
                            {day.toLocaleDateString('it-IT', { weekday: 'short' })}
                          </span>
                          <span className={`text-2xl font-black ${isToday ? 'text-blue-600' : isCurrentMonth ? 'text-black' : 'text-gray-300'}`}>
                            {day.getDate()}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {dayRels.map((rel, rIdx) => (
                            <Draggable key={rel.dndId} draggableId={rel.dndId} index={rIdx}>
                              {(p) => (
                                <div
                                  ref={p.innerRef}
                                  {...p.draggableProps}
                                  {...p.dragHandleProps}
                                  className={`p-3 rounded-[1.2rem] border shadow-sm ${
                                    rel.type === 'PROD'
                                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                                      : 'bg-violet-50 border-violet-200 text-violet-900'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full ${rel.type === 'PROD' ? 'bg-rose-500' : 'bg-violet-500'}`} />
                                    <span className="text-[7px] font-black uppercase opacity-70 truncate">
                                      {rel.clienti?.nome}
                                    </span>
                                  </div>
                                  <h5 className="text-[11px] font-black uppercase line-clamp-1">#{rel.n_tag}</h5>
                                  <span className="text-[9px] font-bold line-clamp-1 italic opacity-80">{rel.titolo}</span>
                                </div>
                              )}
                            </Draggable>
                          ))}

                          {dayGoogleEvents.map((event, idx) => (
                            <div
                              key={`${event.id}-${idx}`}
                              className={`p-3 rounded-[1.2rem] border ${event.calendarBorder} ${event.calendarBg} ${event.calendarText} shadow-sm`}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`w-2 h-2 rounded-full ${event.calendarDot}`} />
                                <span className="text-[7px] font-black uppercase opacity-70 truncate">
                                  {event.calendarLabel}
                                </span>
                              </div>

                              <h5 className="text-[11px] font-black uppercase line-clamp-2">
                                {event.summary || 'Evento senza titolo'}
                              </h5>

                              {event.start?.dateTime && (
                                <span className="text-[8px] font-bold opacity-70">
                                  {new Date(event.start.dateTime).toLocaleTimeString('it-IT', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              )}
                            </div>
                          ))}

                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                )
              })}
            </div>
          )}
        </DragDropContext>

        {selectedDate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setSelectedDate(null)}
            />

            <div className="relative bg-white border border-gray-100 rounded-[3rem] p-8 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-3xl font-black italic uppercase leading-none text-black">Dettaglio</h3>
                  <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest mt-2 flex items-center gap-2">
                    <CalendarIcon size={12} />
                    {selectedDate.toLocaleDateString('it-IT', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-3 bg-gray-50 hover:bg-gray-100 rounded-full text-black transition-all hover:rotate-90"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {getReleasesForDate(selectedDate).map((t, i) => (
                  <div
                    key={`ticket-${i}`}
                    className={`p-6 rounded-[2.2rem] border shadow-sm ${
                      t.type === 'PROD'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-violet-50 border-violet-200 text-violet-900'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[9px] font-black px-3 py-1 rounded-full uppercase bg-white/70">
                        {t.type}
                      </span>

                      <Link href={`/ticket/${t.id}`} className="p-2.5 bg-white rounded-full shadow-sm border border-white/60 hover:bg-black hover:text-white transition-all">
                        <ChevronRight size={16} />
                      </Link>
                    </div>

                    <h4 className="text-[10px] font-black uppercase mb-1 tracking-widest opacity-70">
                      {t.clienti?.nome}
                    </h4>

                    <h2 className="text-[20px] font-black leading-tight italic uppercase mb-4">
                      "{t.titolo}"
                    </h2>

                    <div className="flex justify-between items-center pt-4 border-t border-dashed border-current/20">
                      <span className="text-[10px] font-black uppercase bg-white/70 px-2.5 py-1 rounded-lg">
                        {t.stato}
                      </span>
                      <span className="text-[10px] font-bold tracking-[0.2em] opacity-60">
                        #{t.n_tag}
                      </span>
                    </div>
                  </div>
                ))}

                {getGoogleEventsForDate(selectedDate).map((event, i) => (
                  <div
                    key={`google-${event.id}-${i}`}
                    className={`p-6 rounded-[2.2rem] border ${event.calendarBorder} ${event.calendarBg} ${event.calendarText} shadow-sm`}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`w-2.5 h-2.5 rounded-full ${event.calendarDot}`} />
                      <span className="text-[9px] font-black uppercase opacity-70">
                        {event.calendarLabel}
                      </span>
                    </div>

                    <h2 className="text-[20px] font-black leading-tight italic uppercase mb-3">
                      "{event.summary || 'Evento senza titolo'}"
                    </h2>

                    <div className="text-[10px] font-black uppercase opacity-70">
                      {event.start?.dateTime
                        ? `${new Date(event.start.dateTime).toLocaleTimeString('it-IT', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })} - ${new Date(event.end.dateTime).toLocaleTimeString('it-IT', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}`
                        : 'Tutto il giorno'}
                    </div>
                  </div>
                ))}

                {getReleasesForDate(selectedDate).length === 0 &&
                  getGoogleEventsForDate(selectedDate).length === 0 && (
                    <div className="py-20 text-center opacity-20">
                      <AlertCircle className="mx-auto mb-2" size={48} />
                      <p className="text-[12px] font-black uppercase italic">
                        Nessun evento programmato
                      </p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}