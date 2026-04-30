'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Mail,
  Calendar,
  Send,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface MailThreadProps {
  ticketData: any
  onUpdate: (field: string, value: any) => Promise<void>
  saving: boolean
}

interface ThreadNote {
  id: string
  nota: string
  created_at: string
}

interface MailThreadItem {
  id: string
  n_tag: string
  data_invio: string
  contenuto: string
  topic: string | null
  created_at: string
  tread: {
    tipo?: string
    note?: ThreadNote[]
    [key: string]: any
  } | null
}

export default function MailThread({
  ticketData,
  onUpdate,
  saving,
}: MailThreadProps) {
  const supabase = createClient()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [nuovoThread, setNuovoThread] = useState('')
  const [topicThread, setTopicThread] = useState('')
  const [nuovaNota, setNuovaNota] = useState('')
  const [threadSelezionato, setThreadSelezionato] = useState('')
  const [dataInvioMail, setDataInvioMail] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [dataNota, setDataNota] = useState(
    new Date().toISOString().split('T')[0]
  )

  const [threads, setThreads] = useState<MailThreadItem[]>([])
  const [openThreadIds, setOpenThreadIds] = useState<string[]>([])
  const [loadingThreads, setLoadingThreads] = useState(false)
  const [isLogOpen, setIsLogOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [showNewThreadForm, setShowNewThreadForm] = useState(false)

  const nTag = ticketData?.n_tag

  const fetchThreads = async () => {
    if (!nTag) return

    setLoadingThreads(true)

    const { data, error } = await supabase
      .from('mail_threads')
      .select('*')
      .eq('n_tag', nTag)
      .order('data_invio', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Errore fetch threads:', error)
    } else {
      const result = data || []
      setThreads(result)

      if (result.length > 0 && !threadSelezionato) {
        setThreadSelezionato(result[0].id)
      }
    }

    setLoadingThreads(false)
  }

  useEffect(() => {
    fetchThreads()
  }, [nTag])

  const toggleThread = (id: string) => {
    setOpenThreadIds((prev) =>
      prev.includes(id)
        ? prev.filter((threadId) => threadId !== id)
        : [...prev, id]
    )
  }

  const ultimoPing = useMemo(() => {
    if (ticketData?.ultimo_ping) return ticketData.ultimo_ping
    if (threads.length > 0) return threads[0].data_invio
    return null
  }, [ticketData?.ultimo_ping, threads])

  const isOverdue = useMemo(() => {
    if (!ultimoPing) return false

    const lastPing = new Date(ultimoPing)
    const today = new Date()

    today.setHours(0, 0, 0, 0)
    lastPing.setHours(0, 0, 0, 0)

    const diffTime = today.getTime() - lastPing.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    return diffDays >= 15
  }, [ultimoPing])

  const emailCount = threads.length

  const noteCount = useMemo(() => {
    return threads.reduce((total, thread) => {
      return total + (thread.tread?.note?.length || 0)
    }, 0)
  }, [threads])

  const handleAddClick = () => {
    setIsCollapsed(false)
    setShowNewThreadForm(true)
    setIsLogOpen(false)

    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }

  const aggiungiThreadEUpdatePing = async () => {
    const testoPulito = nuovoThread.trim()
    const topicPulito = topicThread.trim()

    if (!testoPulito || !nTag) return

    const { data, error } = await supabase
      .from('mail_threads')
      .insert({
        n_tag: String(nTag),
        data_invio: dataInvioMail,
        contenuto: testoPulito,
        topic: topicPulito || null,
        tread: null,
      })
      .select()
      .single()

    if (error) {
      console.error('Errore salvataggio thread:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      return
    }

    console.log('Thread salvato:', data)

    await onUpdate('ultimo_ping', dataInvioMail)

    setNuovoThread('')
    setTopicThread('')
    setShowNewThreadForm(false)
    setIsLogOpen(true)
    setIsCollapsed(false)

    await fetchThreads()
  }

  const aggiungiNotaAlThread = async () => {
    const notaPulita = nuovaNota.trim()

    if (!notaPulita || !threadSelezionato) return

    const thread = threads.find((item) => item.id === threadSelezionato)
    if (!thread) return

    const nuovaNotaObj: ThreadNote = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}`,
      nota: notaPulita,
      created_at: new Date(dataNota).toISOString(),
    }

    const treadAggiornato = {
      ...(thread.tread || {}),
      tipo: 'mail',
      note: [...(thread.tread?.note || []), nuovaNotaObj],
    }

    const { error } = await supabase
      .from('mail_threads')
      .update({ tread: treadAggiornato })
      .eq('id', threadSelezionato)

    if (error) {
      console.error('Errore salvataggio nota:', error)
      return
    }

    setNuovaNota('')
    setIsLogOpen(true)

    await fetchThreads()
  }

  const eliminaThread = async (threadId: string) => {
    const confirmed = window.confirm('Vuoi eliminare questo thread?')
    if (!confirmed) return

    const { error } = await supabase
      .from('mail_threads')
      .delete()
      .eq('id', threadId)

    if (error) {
      console.error('Errore eliminazione thread:', error)
      return
    }

    setThreads((prev) => prev.filter((thread) => thread.id !== threadId))
    setOpenThreadIds((prev) => prev.filter((id) => id !== threadId))

    if (threadSelezionato === threadId) {
      const nextThread = threads.find((thread) => thread.id !== threadId)
      setThreadSelezionato(nextThread?.id || '')
    }
  }

  const eliminaNota = async (threadId: string, noteId: string) => {
    const confirmed = window.confirm('Vuoi eliminare questa nota?')
    if (!confirmed) return

    const thread = threads.find((item) => item.id === threadId)
    if (!thread) return

    const updatedNotes =
      thread.tread?.note?.filter((note) => note.id !== noteId) || []

    const updatedTread = {
      ...(thread.tread || {}),
      tipo: 'mail',
      note: updatedNotes,
    }

    const { error } = await supabase
      .from('mail_threads')
      .update({ tread: updatedTread })
      .eq('id', threadId)

    if (error) {
      console.error('Errore eliminazione nota:', error)
      return
    }

    setThreads((prev) =>
      prev.map((item) =>
        item.id === threadId ? { ...item, tread: updatedTread } : item
      )
    )
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div
      className={`bg-white border transition-all duration-300 rounded-[10px] shadow-sm overflow-hidden flex flex-col ${
        isOverdue ? 'border-red-200 ring-2 ring-red-50' : 'border-gray-100'
      }`}
    >
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full p-5 flex items-center justify-between text-left hover:bg-gray-50 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 font-black uppercase text-[9px] tracking-[0.15em] ${
              isOverdue ? 'text-red-600' : 'text-blue-600'
            }`}
          >
            {isOverdue ? (
              <AlertCircle size={20} className="animate-pulse" />
            ) : (
              <Mail size={18} />
            )}
            <span>Thread Mail</span>
          </div>

          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
              isOverdue
                ? 'bg-red-50 text-red-600 border-red-100'
                : 'bg-blue-50 text-blue-600 border-blue-100'
            }`}
          >
            {emailCount}
          </span>

          {noteCount > 0 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-yellow-50 text-yellow-600 border-yellow-100">
              {noteCount} note
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleAddClick()
            }}
            className={`p-1.5 rounded-md transition-all active:scale-95 ${
              isOverdue
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            <Plus size={14} />
          </button>

          {isOverdue && (
            <span className="text-[10px] font-black uppercase tracking-widest text-red-500">
              Overdue
            </span>
          )}

          {isCollapsed ? (
            <ChevronDown size={16} className="text-gray-400" />
          ) : (
            <ChevronUp size={16} className="text-gray-400" />
          )}
        </div>
      </div>

      <div
        className={`transition-all duration-500 ${
          isCollapsed
            ? 'max-h-0 opacity-0 overflow-hidden'
            : 'max-h-[1400px] opacity-100'
        }`}
      >
        <div className="px-5 pb-3 space-y-4">
          {showNewThreadForm && (
            <div className="border border-blue-100 bg-blue-50/30 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600">
                  Nuovo thread email
                </div>

                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-gray-300" />
                  <input
                    type="date"
                    value={dataInvioMail}
                    onChange={(e) => setDataInvioMail(e.target.value)}
                    className="text-[10px] font-black text-gray-400 bg-transparent cursor-pointer"
                  />
                </div>
              </div>

              <input
                type="text"
                value={topicThread}
                onChange={(e) => setTopicThread(e.target.value)}
                placeholder="Topic della mail..."
                className="w-full bg-white rounded-xl px-4 py-3 mb-3 text-[12px] outline-none border border-blue-100"
              />

              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={nuovoThread}
                  onChange={(e) => setNuovoThread(e.target.value)}
                  placeholder="Thread email..."
                  className="w-full bg-white rounded-xl p-4 pr-14 text-[12px] min-h-[100px] outline-none resize-none border border-blue-100"
                />

                <button
                  type="button"
                  onClick={aggiungiThreadEUpdatePing}
                  disabled={!nuovoThread.trim() || saving || loadingThreads || !nTag}
                  className={`absolute bottom-3 right-3 p-2.5 rounded-lg disabled:opacity-50 ${
                    isOverdue ? 'bg-red-600' : 'bg-blue-600'
                  } text-white`}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}

          {threads.length > 0 && (
            <div className="border border-yellow-100 bg-yellow-50/40 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-yellow-600">
                <StickyNote size={14} />
                Aggiungi nota a un thread
              </div>

              <select
                value={threadSelezionato}
                onChange={(e) => setThreadSelezionato(e.target.value)}
                className="w-full bg-white rounded-xl px-3 py-2 mb-3 text-[11px] font-bold text-gray-500 outline-none border border-yellow-100"
              >
                {threads.map((thread) => {
                  const preview =
                    thread.contenuto.length > 80
                      ? `${thread.contenuto.slice(0, 80)}...`
                      : thread.contenuto

                  return (
                    <option key={thread.id} value={thread.id}>
                      {thread.topic ? `${thread.topic} - ` : ''}
                      {preview}
                    </option>
                  )
                })}
              </select>

              <div className="flex justify-end mb-3">
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-gray-300" />
                  <input
                    type="date"
                    value={dataNota}
                    onChange={(e) => setDataNota(e.target.value)}
                    className="text-[10px] font-black text-gray-400 bg-transparent cursor-pointer"
                  />
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={nuovaNota}
                  onChange={(e) => setNuovaNota(e.target.value)}
                  placeholder="Scrivi una nota interna da associare al thread selezionato..."
                  className="w-full bg-white rounded-xl p-4 text-[12px] min-h-[90px] outline-none resize-none border border-yellow-100"
                />

                <button
                  type="button"
                  onClick={aggiungiNotaAlThread}
                  disabled={
                    !nuovaNota.trim() ||
                    !threadSelezionato ||
                    saving ||
                    loadingThreads
                  }
                  className="absolute bottom-3 right-3 p-2.5 rounded-lg disabled:opacity-50 bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}

          {!showNewThreadForm && threads.length === 0 && (
            <div className="text-[10px] text-gray-300 text-center py-4">
              Nessun thread registrato. Clicca il pulsante + per crearne uno.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsLogOpen(!isLogOpen)}
          className="w-full py-3 text-[9px] font-black text-gray-400 uppercase"
        >
          {isLogOpen
            ? 'Chiudi Log Storico'
            : `Vedi Storico Completo (${emailCount})`}
        </button>

        <div
          className={`transition-all ${
            isLogOpen
              ? 'max-h-[450px] p-5 overflow-y-auto'
              : 'max-h-0 overflow-hidden'
          }`}
        >
          {threads.length > 0 ? (
            <div className="space-y-4">
              {threads.map((thread) => {
                const isThreadOpen = openThreadIds.includes(thread.id)

                return (
                  <div
                    key={thread.id}
                    className="border rounded-xl bg-white overflow-hidden"
                  >
                    <div
                        onClick={() => toggleThread(thread.id)}
                        className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-gray-50 transition-all cursor-pointer"
                      >
                      <div className="min-w-0 flex-1">
                        {thread.topic && (
                          <div className="mb-2 text-[9px] font-black uppercase tracking-[0.15em] text-blue-600">
                            {thread.topic}
                          </div>
                        )}

                        <div className="text-[10px] whitespace-pre-wrap text-gray-600 line-clamp-2">
                          {thread.contenuto}
                        </div>

                        <div className="mt-2 text-[9px] font-black text-blue-600 uppercase">
                          Ultima mail: {formatDate(thread.data_invio)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            eliminaThread(thread.id)
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 transition-all"
                          title="Elimina thread"
                        >
                          <Trash2 size={13} />
                        </button>

                        {isThreadOpen ? (
                          <ChevronUp size={14} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={14} className="text-gray-400" />
                        )}
                      </div>
                    </div>

                    {isThreadOpen && (
                      <div className="p-4 border-t border-gray-100">
                        {thread.topic && (
                          <div className="mb-3 text-[9px] font-black uppercase tracking-[0.15em] text-blue-600">
                            {thread.topic}
                          </div>
                        )}

                        <div className="text-[10px] whitespace-pre-wrap text-gray-600">
                          {thread.contenuto}
                        </div>

                        {thread.tread?.note && thread.tread.note.length > 0 && (
                          <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                            <div className="text-[9px] font-black text-yellow-600 uppercase tracking-[0.15em]">
                              Note associate
                            </div>

                            {[...thread.tread.note]
                              .sort(
                                (a, b) =>
                                  new Date(a.created_at).getTime() -
                                  new Date(b.created_at).getTime()
                              )
                              .map((note) => (
                                <div
                                  key={note.id}
                                  className="relative bg-yellow-50 border border-yellow-100 rounded-lg p-3 pr-9"
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      eliminaNota(thread.id, note.id)
                                    }}
                                    className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-100 hover:text-red-600 transition-all"
                                    title="Elimina nota"
                                  >
                                    <Trash2 size={12} />
                                  </button>

                                  <div className="text-[9px] font-black text-yellow-600 mb-1">
                                    {formatDateTime(note.created_at)}
                                  </div>

                                  <div className="text-[10px] whitespace-pre-wrap text-gray-600">
                                    {note.nota}
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-[10px] text-gray-300 text-center">
              Nessun thread registrato.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}