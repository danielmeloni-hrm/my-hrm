'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Mail,
  Search,
  User,
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronUp,
  StickyNote,
  Tag,
  ExternalLink,
  Inbox,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

const supabase = createClient()

interface ThreadNote {
  id: string
  nota: string
  created_at: string
}

interface MailThread {
  id: string
  n_tag: string
  topic: string | null
  data_invio: string
  contenuto: string
  created_at: string
  tread: {
    tipo?: string
    note?: ThreadNote[]
    [key: string]: any
  } | null
  ticket?: {
    id: string
    n_tag: string
    cliente: string | null
    assegnato: string | null
    assegnato_id: string | null
  } | null
}

export default function MailThreadsPage() {
  const [threads, setThreads] = useState<MailThread[]>([])
  const [openThreadIds, setOpenThreadIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [clienteFilter, setClienteFilter] = useState('tutti')
  const [assegnatoFilter, setAssegnatoFilter] = useState('tutti')
  const [topicFilter, setTopicFilter] = useState('tutti')

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user?.id) {
        setCurrentUserId(user.id)
        setAssegnatoFilter(user.id)
      }
    }

    loadUser()
  }, [])

  const fetchThreads = async () => {
    setLoading(true)

    const { data: mailData, error: mailError } = await supabase
      .from('mail_threads')
      .select('*')
      .order('data_invio', { ascending: false })
      .order('created_at', { ascending: false })

    if (mailError) {
      console.error('Errore mail_threads:', mailError)
      setThreads([])
      setLoading(false)
      return
    }

    const nTags = Array.from(new Set((mailData || []).map((item) => item.n_tag)))

    if (nTags.length === 0) {
      setThreads([])
      setLoading(false)
      return
    }

    const { data: ticketData, error: ticketError } = await supabase
      .from('ticket')
      .select('id, n_tag, cliente_id, assignee')
      .in('n_tag', nTags)

    if (ticketError) {
      console.error('Errore ticket:', ticketError)
      setThreads((mailData || []) as MailThread[])
      setLoading(false)
      return
    }

    const clienteIds = Array.from(
      new Set((ticketData || []).map((t) => t.cliente_id).filter(Boolean))
    )

    const profiloIds = Array.from(
      new Set((ticketData || []).map((t) => t.assignee).filter(Boolean))
    )

    const { data: clientiData } =
      clienteIds.length > 0
        ? await supabase.from('clienti').select('id, nome').in('id', clienteIds)
        : { data: [] }

    const { data: profiliData } =
      profiloIds.length > 0
        ? await supabase.from('profili').select('id, nome').in('id', profiloIds)
        : { data: [] }

    const clientiMap = new Map(
      (clientiData || []).map((cliente) => [cliente.id, cliente.nome])
    )

    const profiliMap = new Map(
      (profiliData || []).map((profilo) => [profilo.id, profilo.nome])
    )

    const ticketMap = new Map(
      (ticketData || []).map((ticket) => [
        ticket.n_tag,
        {
          id: ticket.id,
          n_tag: ticket.n_tag,
          cliente: clientiMap.get(ticket.cliente_id) || null,
          assegnato: profiliMap.get(ticket.assignee) || null,
          assegnato_id: ticket.assignee || null,
        },
      ])
    )

    const mergedThreads = (mailData || []).map((thread) => ({
      ...thread,
      ticket: ticketMap.get(thread.n_tag) || null,
    }))

    setThreads(mergedThreads as MailThread[])
    setLoading(false)
  }

  useEffect(() => {
    fetchThreads()
  }, [])

  const toggleThread = (id: string) => {
    setOpenThreadIds((prev) =>
      prev.includes(id)
        ? prev.filter((threadId) => threadId !== id)
        : [...prev, id]
    )
  }

  const deleteThread = async (threadId: string) => {
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
  }

  const deleteNote = async (threadId: string, noteId: string) => {
    const confirmed = window.confirm('Vuoi eliminare questa nota?')
    if (!confirmed) return

    const thread = threads.find((item) => item.id === threadId)
    if (!thread) return

    const updatedNotes =
      thread.tread?.note?.filter((note) => note.id !== noteId) || []

    const updatedTread = {
      ...(thread.tread || {}),
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

  const clienti = useMemo(() => {
    return Array.from(
      new Set(threads.map((thread) => thread.ticket?.cliente).filter(Boolean))
    ) as string[]
  }, [threads])

  const assegnati = useMemo(() => {
    return Array.from(
      new Map(
        threads
          .filter((thread) => thread.ticket?.assegnato_id)
          .map((thread) => [
            thread.ticket!.assegnato_id!,
            thread.ticket!.assegnato || 'Senza nome',
          ])
      )
    )
  }, [threads])

  const topics = useMemo(() => {
    return Array.from(
      new Set(threads.map((thread) => thread.topic).filter(Boolean))
    ) as string[]
  }, [threads])

  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      const cliente = thread.ticket?.cliente || ''
      const assegnato = thread.ticket?.assegnato || ''
      const topic = thread.topic || ''
      const contenuto = thread.contenuto || ''
      const nTag = thread.n_tag || ''
      const noteText =
        thread.tread?.note?.map((note) => note.nota).join(' ') || ''

      const query = search.toLowerCase()

      const matchSearch =
        search.trim() === '' ||
        contenuto.toLowerCase().includes(query) ||
        noteText.toLowerCase().includes(query) ||
        nTag.toLowerCase().includes(query) ||
        cliente.toLowerCase().includes(query) ||
        assegnato.toLowerCase().includes(query) ||
        topic.toLowerCase().includes(query)

      const matchCliente =
        clienteFilter === 'tutti' || cliente === clienteFilter

      const matchAssegnato =
        assegnatoFilter === 'tutti' ||
        thread.ticket?.assegnato_id === assegnatoFilter

      const matchTopic = topicFilter === 'tutti' || topic === topicFilter

      return matchSearch && matchCliente && matchAssegnato && matchTopic
    })
  }, [threads, search, clienteFilter, assegnatoFilter, topicFilter])

  const totalNotes = useMemo(() => {
    return filteredThreads.reduce((total, thread) => {
      return total + (thread.tread?.note?.length || 0)
    }, 0)
  }, [filteredThreads])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-l border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-l bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                <Mail size={15} />
                Thread Email
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                Storico Thread Mail
              </h1>

              <p className="mt-2 text-sm font-medium text-slate-400">
                Consulta i thread, apri i ticket collegati e filtra per cliente,
                assegnato o topic.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-l border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Thread
                </div>
                <div className="mt-1 text-2xl font-black text-slate-900">
                  {filteredThreads.length}
                </div>
              </div>

              <div className="rounded-l border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Note
                </div>
                <div className="mt-1 text-2xl font-black text-yellow-600">
                  {totalNotes}
                </div>
              </div>

              <div className="rounded-l border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Topic
                </div>
                <div className="mt-1 text-2xl font-black text-purple-600">
                  {topics.length}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-l border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca testo, topic, note, n_tag..."
                className="h-12 w-full rounded-2xl border border-transparent bg-slate-50 pl-11 pr-4 text-xs font-bold text-slate-600 outline-none transition-all placeholder:text-slate-300 focus:border-blue-100 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div className="relative">
              <Briefcase
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
              />

              <select
                value={clienteFilter}
                onChange={(e) => setClienteFilter(e.target.value)}
                className="h-12 w-full appearance-none rounded-xl border border-transparent bg-slate-50 pl-11 pr-4 text-xs font-bold text-slate-600 outline-none transition-all focus:border-blue-100 focus:bg-white focus:ring-4 focus:ring-blue-50"
              >
                <option value="tutti">Tutti i clienti</option>
                {clienti.map((cliente) => (
                  <option key={cliente} value={cliente}>
                    {cliente}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <User
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
              />

              <select
                value={assegnatoFilter}
                onChange={(e) => setAssegnatoFilter(e.target.value)}
                className="h-12 w-full appearance-none rounded-2xl border border-transparent bg-slate-50 pl-11 pr-4 text-xs font-bold text-slate-600 outline-none transition-all focus:border-blue-100 focus:bg-white focus:ring-4 focus:ring-blue-50"
              >
                <option value="tutti">Tutti gli assegnati</option>

                {currentUserId && (
                  <option value={currentUserId}>I miei ticket</option>
                )}

                {assegnati.map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Tag
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
              />

              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="h-12 w-full appearance-none rounded-2xl border border-transparent bg-slate-50 pl-11 pr-4 text-xs font-bold text-slate-600 outline-none transition-all focus:border-blue-100 focus:bg-white focus:ring-4 focus:ring-blue-50"
              >
                <option value="tutti">Tutti i topic</option>
                {topics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-l border border-slate-200 bg-white p-10 text-center text-xs font-black uppercase tracking-widest text-slate-400 shadow-sm">
              Caricamento thread...
            </div>
          ) : filteredThreads.length > 0 ? (
            filteredThreads.map((thread) => {
              const isThreadOpen = openThreadIds.includes(thread.id)
              const noteCount = thread.tread?.note?.length || 0

              return (
                <div
                  key={thread.id}
                  className="overflow-hidden rounded-l border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => toggleThread(thread.id)}
                    className="w-full p-5 text-left transition-all hover:bg-slate-50/70"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          {thread.ticket?.id ? (
                            <Link
                              href={`/ticket/${thread.ticket.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-600 transition-all hover:bg-blue-100"
                            >
                              Ticket #{thread.n_tag}
                              <ExternalLink size={10} />
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                              Ticket #{thread.n_tag}
                            </span>
                          )}

                          {noteCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-100 bg-yellow-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-yellow-600">
                              <StickyNote size={11} />
                              {noteCount} note
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteThread(thread.id)
                            }}
                            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-red-400 transition-all hover:bg-red-50 hover:text-red-600"
                            title="Elimina thread"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <h2 className="text-lg font-black leading-snug text-slate-950">
                          {thread.topic || 'Senza topic'}
                        </h2>

                        <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-500">
                          {thread.contenuto}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500">
                            Cliente: {thread.ticket?.cliente || 'N/D'}
                          </span>

                          <span className="rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500">
                            Assegnato: {thread.ticket?.assegnato || 'N/D'}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center justify-between gap-3 lg:justify-end">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <Calendar size={13} />
                          Ultima mail: {formatDate(thread.data_invio)}
                        </div>

                        <div className="rounded-full bg-slate-100 p-2 text-slate-400">
                          {isThreadOpen ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  {isThreadOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-5">
                      {thread.tread?.note && thread.tread.note.length > 0 && (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-yellow-600">
                            <StickyNote size={13} />
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
                                className="relative rounded-2xl border border-yellow-100 bg-yellow-50 p-4 pr-10"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteNote(thread.id, note.id)
                                  }}
                                  className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full text-red-400 transition-all hover:bg-red-100 hover:text-red-600"
                                  title="Elimina nota"
                                >
                                  <Trash2 size={12} />
                                </button>

                                <div className="mb-2 text-[10px] font-black text-yellow-700">
                                  {formatDateTime(note.created_at)}
                                </div>

                                <div className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700">
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
            })
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-white p-12 text-center shadow-sm">
              <Inbox size={32} className="mx-auto text-slate-300" />
              <div className="mt-4 text-sm font-black text-slate-400">
                Nessun thread trovato.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}