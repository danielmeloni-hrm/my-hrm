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
  MessageSquare,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AppPage from '@/components/ui/AppPage'
import AppCard from '@/components/ui/AppCard'
import AppButton from '@/components/ui/AppButton'

const supabase = createClient()

interface ThreadNote {
  id: string
  nota: string
  created_at: string
}

interface TicketInfo {
  id: string
  n_tag: string
  cliente: string | null
  assegnato: string | null
  assegnato_id: string | null
}

interface MailThread {
  id: string
  n_tag: string
  topic: string | null
  subject: string | null
  data_invio: string
  contenuto: string
  created_at: string
  body_html: string | null
  from_email: string | null
  to_emails: any[] | null
  cc_emails: any[] | null
  outlook_message_id: string | null
  internet_message_id: string | null
  direction: 'inbound' | 'outbound' | null
  received_at: string | null
  sent_at: string | null
  linked_manually: boolean
  linked_at: string | null
  link_status: 'auto' | 'manual' | 'unlinked'
  tread: {
    type?: string
    tipo?: string
    note?: ThreadNote[]
    [key: string]: any
  } | null
  ticket?: TicketInfo | null
  emails: StoredEmail[] | null 
}
interface StoredEmail {
  html?: string | null
  text?: string | null
  index?: number
  subject?: string | null
  direction?: 'inbound' | 'outbound' | null
  from_email?: string | null
  received_at?: string | null
  sent_at?: string | null
  body_preview?: string | null
  outlook_message_id?: string | null
  internet_message_id?: string | null
  [key: string]: any
}

interface ThreadEmail extends StoredEmail {
  uniqueId: string
  parentThreadId: string
  parentThread: MailThread
}

interface MailThreadGroup {
  key: string
  topic: string
  n_tag: string
  ticket: TicketInfo | null
  rows: MailThread[]
  linkRows: MailThread[]
  emails: ThreadEmail[]
  notes: Array<ThreadNote & { sourceThreadId: string }>
  lastDate: string
}

function normalize(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .replace(/^(re|fw|fwd):\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripHtml(html?: string | null) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function getThreadTitle(thread: MailThread) {
  return thread.topic || thread.subject || thread.contenuto || 'Thread senza nome'
}

function getEmailText(thread: MailThread) {
  return thread.contenuto || stripHtml(thread.body_html) || thread.subject || ''
}

function getEmailDate(thread: MailThread) {
  return (
    thread.received_at ||
    thread.sent_at ||
    thread.data_invio ||
    thread.created_at ||
    new Date().toISOString()
  )
}

function isThreadLink(thread: MailThread) {
  return (
    thread.linked_manually === true ||
    thread.link_status === 'manual' ||
    thread.tread?.type === 'thread_link' ||
    thread.tread?.tipo === 'thread_link'
  )
}

function isImportedEmail(thread: MailThread) {
  return !isThreadLink(thread)
}

function getAddressLabel(value: any) {
  if (!value) return "—";

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.name || item?.email || "";
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    return value.name || value.email || "—";
  }

  return String(value);
}
function getStoredEmailDate(email: ThreadEmail) {
  return (
    email.received_at ||
    email.sent_at ||
    email.parentThread.received_at ||
    email.parentThread.sent_at ||
    email.parentThread.data_invio ||
    email.parentThread.created_at ||
    new Date().toISOString()
  )
}

function getStoredEmailText(email: ThreadEmail) {
  return (
    email.text ||
    email.body_preview ||
    stripHtml(email.html) ||
    email.parentThread.contenuto ||
    stripHtml(email.parentThread.body_html) ||
    ''
  )
}

function getEmailsFromThread(thread: MailThread): ThreadEmail[] {
  if (!Array.isArray(thread.emails) || thread.emails.length === 0) {
    return []
  }

  return thread.emails.map((email, index) => ({
    ...email,
    uniqueId: `${thread.id}-${email.outlook_message_id || email.internet_message_id || index}`,
    parentThreadId: thread.id,
    parentThread: thread,
  }))
}

export default function MailThreadsPage() {
  const [threads, setThreads] = useState<MailThread[]>([])
  const [openGroupKeys, setOpenGroupKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [clienteFilter, setClienteFilter] = useState('tutti')
  const [assegnatoFilter, setAssegnatoFilter] = useState('tutti')
  const [olderThanDateFilter, setOlderThanDateFilter] = useState('')

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
      setThreads([])
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

    const mergedThreads = (mailData || [])
      .map((thread) => ({
        ...thread,
        ticket: ticketMap.get(thread.n_tag) || null,
      }))
      .filter((thread) => thread.ticket !== null)

    setThreads(mergedThreads as MailThread[])
    setLoading(false)
  }

  useEffect(() => {
    fetchThreads()
  }, [])

  const threadGroups = useMemo<MailThreadGroup[]>(() => {
    const map = new Map<string, MailThreadGroup>()

    threads.forEach((thread) => {
      const title = getThreadTitle(thread)
      const key = `${thread.n_tag}-${normalize(title) || thread.id}`
      const currentDate = getEmailDate(thread)

      if (!map.has(key)) {
        map.set(key, {
          key,
          topic: title,
          n_tag: thread.n_tag,
          ticket: thread.ticket || null,
          rows: [],
          linkRows: [],
          emails: [],
          notes: [],
          lastDate: currentDate,
        })
      }

      const group = map.get(key)!
      group.rows.push(thread)

      if (isThreadLink(thread)) {
        group.linkRows.push(thread)
      } else {
        group.emails.push(...getEmailsFromThread(thread))
      }

      if (new Date(currentDate).getTime() > new Date(group.lastDate).getTime()) {
        group.lastDate = currentDate
      }

      ;(thread.tread?.note || []).forEach((note) => {
        group.notes.push({
          ...note,
          sourceThreadId: thread.id,
        })
      })
    })

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        rows: group.rows.sort(
          (a, b) => new Date(getEmailDate(a)).getTime() - new Date(getEmailDate(b)).getTime()
        ),
        emails: group.emails.sort(
          (a, b) => new Date(getStoredEmailDate(a)).getTime() - new Date(getStoredEmailDate(b)).getTime()
        ),
        linkRows: group.linkRows.sort(
          (a, b) => new Date(getEmailDate(a)).getTime() - new Date(getEmailDate(b)).getTime()
        ),
        notes: group.notes.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
      }))
      .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
  }, [threads])

  const clienti = useMemo(() => {
    return Array.from(
      new Set(threadGroups.map((group) => group.ticket?.cliente).filter(Boolean))
    ) as string[]
  }, [threadGroups])

  const assegnati = useMemo(() => {
    return Array.from(
      new Map(
        threadGroups
          .filter((group) => group.ticket?.assegnato_id)
          .map((group) => [
            group.ticket!.assegnato_id!,
            group.ticket!.assegnato || 'Senza nome',
          ])
      )
    )
  }, [threadGroups])

  const filteredGroups = useMemo(() => {
    return threadGroups.filter((group) => {
      const cliente = group.ticket?.cliente || ''
      const assegnato = group.ticket?.assegnato || ''
      const topic = group.topic || ''
      const groupLastDate = new Date(group.lastDate)
      const nTag = group.n_tag || ''
      const noteText = group.notes.map((note) => note.nota).join(' ')
      const emailText = group.emails
      .map((email) => {
        return `${email.subject || ''} ${getStoredEmailText(email)} ${email.from_email || ''}`
      })
      .join(' ')

      const query = search.toLowerCase()

      const matchSearch =
        search.trim() === '' ||
        emailText.toLowerCase().includes(query) ||
        noteText.toLowerCase().includes(query) ||
        nTag.toLowerCase().includes(query) ||
        cliente.toLowerCase().includes(query) ||
        assegnato.toLowerCase().includes(query) ||
        topic.toLowerCase().includes(query)

      const matchCliente =
        clienteFilter === 'tutti' || cliente === clienteFilter

      const matchAssegnato =
        assegnatoFilter === 'tutti' ||
        group.ticket?.assegnato_id === assegnatoFilter

      const matchOlderThanDate =
        !olderThanDateFilter ||
        groupLastDate < new Date(`${olderThanDateFilter}T23:59:59`)

      return matchSearch && matchCliente && matchAssegnato && matchOlderThanDate
    })
  }, [threadGroups, search, clienteFilter, assegnatoFilter, olderThanDateFilter])

  const totalEmails = useMemo(() => {
    return filteredGroups.reduce((total, group) => total + group.emails.length, 0)
  }, [filteredGroups])

  const totalNotes = useMemo(() => {
    return filteredGroups.reduce((total, group) => total + group.notes.length, 0)
  }, [filteredGroups])

  const olderThanCount = useMemo(() => {
    if (!olderThanDateFilter) return 0

    return threadGroups.filter(
      (group) => new Date(group.lastDate) < new Date(`${olderThanDateFilter}T23:59:59`)
    ).length
  }, [threadGroups, olderThanDateFilter])

  const toggleGroup = (key: string) => {
    setOpenGroupKeys((prev) =>
      prev.includes(key)
        ? prev.filter((groupKey) => groupKey !== key)
        : [...prev, key]
    )
  }

  const deleteRow = async (rowId: string) => {
    const confirmed = window.confirm('Vuoi eliminare questa email/thread?')
    if (!confirmed) return

    const { error } = await supabase
      .from('mail_threads')
      .delete()
      .eq('id', rowId)

    if (error) {
      console.error('Errore eliminazione mail_threads:', error)
      return
    }

    setThreads((prev) => prev.filter((thread) => thread.id !== rowId))
  }

  const deleteGroup = async (group: MailThreadGroup) => {
  const confirmed = window.confirm(
    `Vuoi eliminare il thread "${group.topic}" e tutte le email/collegamenti associati?`
  )

  if (!confirmed) return

  const ids = group.rows.map((row) => row.id).filter(Boolean)

  if (ids.length === 0) {
    console.error("Nessun ID trovato per il thread:", group)
    return
  }

  const { data, error } = await supabase
    .from("mail_threads")
    .delete()
    .in("id", ids)
    .select("id")

  if (error) {
    console.error("Errore eliminazione gruppo thread:", error)
    alert(`Errore eliminazione: ${error.message}`)
    return
  }

  if (!data || data.length === 0) {
    console.error("Nessuna riga eliminata. Possibile problema RLS o ID non autorizzati:", ids)
    alert("Nessuna riga eliminata da Supabase. Controlla le policy RLS DELETE su mail_threads.")
    return
  }

  setThreads((prev) => prev.filter((thread) => !ids.includes(thread.id)))
  setOpenGroupKeys((prev) => prev.filter((key) => key !== group.key))
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
    <AppPage
      title="Storico Thread Mail"
      subtitle="Consulta tutti i thread salvati e apri ogni conversazione per vedere le email importate."
      icon={<Mail size={20} />}
      maxWidth="full"
      actions={
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      
          <AppCard className="bg-slate-50 px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Thread
            </div>
            <div className="mt-1 text-2xl font-black text-slate-900">
              {filteredGroups.length}
            </div>
          </AppCard>

          <AppCard className="bg-slate-50 px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Email
            </div>
            <div className="mt-1 text-2xl font-black text-blue-600">
              {totalEmails}
            </div>
          </AppCard>

          <AppCard className="bg-slate-50 px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Note
            </div>
            <div className="mt-1 text-2xl font-black text-yellow-600">
              {totalNotes}
            </div>
          </AppCard>

          <AppCard className="bg-slate-50 px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Più vecchi
            </div>
            <div className="mt-1 text-2xl font-black text-purple-600">
              {olderThanDateFilter ? olderThanCount : '-'}
            </div>
          </AppCard>
        </div>
      }
    >
      <AppCard>
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
                className="h-12 w-full appearance-none rounded-2xl border border-transparent bg-slate-50 pl-11 pr-4 text-xs font-bold text-slate-600 outline-none transition-all focus:border-blue-100 focus:bg-white focus:ring-4 focus:ring-blue-50"
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
              <Calendar
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
              />

              <input
                type="date"
                value={olderThanDateFilter}
                onChange={(e) => setOlderThanDateFilter(e.target.value)}
                className="h-12 w-full rounded-2xl border border-transparent bg-slate-50 pl-11 pr-4 text-xs font-bold text-slate-600 outline-none transition-all focus:border-blue-100 focus:bg-white focus:ring-4 focus:ring-blue-50"
                title="Mostra solo thread con ultima mail più vecchia della data selezionata"
              />
            </div>
        </div>
      </AppCard>

      <div className="space-y-4">
            <div></div>
          {loading ? (
          <AppCard className="p-10 text-center text-xs font-black uppercase tracking-widest text-slate-400">
            Caricamento thread...
          </AppCard>
          ) : filteredGroups.length > 0 ? (
            filteredGroups.map((group) => {
              const isGroupOpen = openGroupKeys.includes(group.key)

              return (
              <AppCard
                key={group.key}
                padded={false}
                className="overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleGroup(group.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleGroup(group.key)
                      }
                    }}
                    className="w-full cursor-pointer p-5 text-left transition-all hover:bg-slate-50/70"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          {group.ticket?.id ? (
                            <Link
                              href={`/ticket/${group.ticket.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-600 transition-all hover:bg-blue-100"
                            >
                              Ticket #{group.n_tag}
                              <ExternalLink size={10} />
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                              Ticket #{group.n_tag}
                            </span>
                          )}

                          {group.ticket?.cliente && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600">
                              <Briefcase size={11} />
                              {group.ticket.cliente}
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-600">
                            <MessageSquare size={11} />
                            {group.emails.length} email
                          </span>

                          {group.notes.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-100 bg-yellow-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-yellow-600">
                              <StickyNote size={11} />
                              {group.notes.length} note
                            </span>
                          )}

                          <AppButton
                            type="button"
                            variant="danger"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteGroup(group)
                            }}
                            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full p-0 shadow-sm"
                            title="Elimina thread completo da Supabase"
                          >
                            <Trash2 size={14} color="white"/>
                          </AppButton>
                        </div>

                        <h2 className="text-lg font-black leading-snug text-slate-950">
                          {group.topic || 'Senza topic'}
                        </h2>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500">
                            Assegnato: {group.ticket?.assegnato || 'N/D'}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center justify-between gap-3 lg:justify-end">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <Calendar size={13} />
                          Ultima mail: {formatDate(group.lastDate)}
                        </div>

                        <div className="rounded-full bg-slate-100 p-2 text-slate-400">
                          {isGroupOpen ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isGroupOpen && (
                    <div className="space-y-5 border-t border-slate-100 bg-slate-50/60 p-5">
                      <div>
                        <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                          <Mail size={13} />
                          Email salvate
                        </div>

                        {group.emails.length > 0 ? (
                          <div className="space-y-3">
                            {group.emails.map((email) => {
  const emailText = getStoredEmailText(email)

  return (
    <div
  key={email.uniqueId}
  className="rounded-2xl border border-slate-200 bg-white p-4"
>
  <div className="flex flex-wrap items-center gap-2">
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
      {email.direction === 'outbound' ? 'Inviata' : 'Ricevuta'}
    </span>

    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-600">
      {formatDateTime(getStoredEmailDate(email))}
    </span>

    {email.from_email && (
      <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500">
        Da: {email.from_email}
      </span>
    )}
  </div>

  <div className="mt-3 text-sm font-black text-slate-900">
    {email.subject || group.topic}
  </div>

  <div className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-600">
    {emailText}
  </div>
</div>
  )
})}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                            Nessuna email importata per questo thread.
                          </div>
                        )}
                      </div>

                      {group.linkRows.length > 0 && (
                        <div>
                          <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            <Tag size={13} />
                            Collegamenti thread
                          </div>

                          <div className="space-y-2">
                            {group.linkRows.map((link) => (
                              <div
                                key={link.id}
                                className="relative rounded-2xl border border-slate-200 bg-white p-4 pr-11"
                              >
                                <AppButton
                                  type="button"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteRow(link.id)
                                  }}
                                  className="absolute right-3 top-3 h-6 w-6 rounded-full p-0 text-red-400 hover:bg-red-50 hover:text-red-600"
                                  title="Elimina collegamento"
                                >
                                  <Trash2 size={12} />
                                </AppButton>

                                <div className="text-sm font-black text-slate-800">
                                  {link.topic || link.subject || link.contenuto}
                                </div>

                                <div className="mt-1 text-xs font-medium text-slate-400">
                                  Collegato manualmente il{' '}
                                  {formatDateTime(link.linked_at || link.created_at)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {group.notes.length > 0 && (
                        <div>
                          <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-yellow-600">
                            <StickyNote size={13} />
                            Note associate
                          </div>

                          <div className="space-y-3">
                            {group.notes.map((note) => (
                              <div
                                key={note.id}
                                className="relative rounded-2xl border border-yellow-100 bg-yellow-50 p-4 pr-10"
                              >
                                <AppButton
                                  type="button"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteNote(note.sourceThreadId, note.id)
                                  }}
                                  className="absolute right-3 top-3 h-6 w-6 rounded-full p-0 text-red-400 hover:bg-red-100 hover:text-red-600"
                                  title="Elimina nota"
                                >
                                  <Trash2 size={12} />
                                </AppButton>

                                <div className="mb-2 text-[10px] font-black text-yellow-700">
                                  {formatDateTime(note.created_at)}
                                </div>

                                <div className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700">
                                  {note.nota}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                )}
              </AppCard>
            )
          })
          ) : (
          <AppCard className="p-12 text-center">
            <Inbox size={32} className="mx-auto text-slate-300" />
            <div className="mt-4 text-sm font-black text-slate-400">
              Nessun thread trovato.
            </div>
          </AppCard>
          )}
      </div>
    </AppPage>
  )
}
