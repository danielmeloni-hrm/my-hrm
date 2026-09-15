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
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AppPage from '@/components/ui/AppPage'
import AppCard from '@/components/ui/AppCard'
import AppButton from '@/components/ui/AppButton'
import {
  formatDate,
  formatDateTime,
  getStoredEmailText,
  groupRowsIntoThreads,
  type MailThreadRow,
  type ThreadGroup,
} from '@/lib/mail-thread-utils'

const supabase = createClient()

interface TicketInfo {
  id: string
  n_tag: string
  cliente: string | null
  assegnato: string | null
  assegnato_id: string | null
}

/** Thread arricchito con i ticket a cui risulta collegato. */
interface ThreadGroupConTicket extends ThreadGroup {
  tickets: TicketInfo[]
}

export default function MailThreadsPage() {
  const [rows, setRows] = useState<MailThreadRow[]>([])
  const [ticketMap, setTicketMap] = useState<Map<string, TicketInfo>>(new Map())
  const [openGroupKeys, setOpenGroupKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
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
    setErrore(null)

    const { data: mailData, error: mailError } = await supabase
      .from('mail_threads')
      .select('*')
      .order('created_at', { ascending: false })

    if (mailError) {
      console.error('Errore mail_threads:', mailError)
      setErrore(mailError.message)
      setRows([])
      setLoading(false)
      return
    }

    const righe = (mailData || []) as MailThreadRow[]

    const nTags = Array.from(
      new Set(
        righe
          .map((row) => (row.n_tag || '').trim())
          .filter((tag) => tag.length > 0)
      )
    )

    if (nTags.length === 0) {
      setRows(righe)
      setTicketMap(new Map())
      setLoading(false)
      return
    }

    const { data: ticketData, error: ticketError } = await supabase
      .from('ticket')
      .select('id, n_tag, cliente_id, assignee')
      .in('n_tag', nTags)

    if (ticketError) {
      console.error('Errore ticket:', ticketError)
      setErrore(ticketError.message)
      // Le mail restano consultabili anche senza i dati del ticket.
      setRows(righe)
      setTicketMap(new Map())
      setLoading(false)
      return
    }

    const clienteIds = Array.from(
      new Set((ticketData || []).map((t) => t.cliente_id).filter(Boolean))
    )

    const profiloIds = Array.from(
      new Set((ticketData || []).map((t) => t.assignee).filter(Boolean))
    )

    const [clientiRes, profiliRes] = await Promise.all([
      clienteIds.length > 0
        ? supabase.from('clienti').select('id, nome').in('id', clienteIds)
        : Promise.resolve({ data: [], error: null }),
      profiloIds.length > 0
        ? supabase
            .from('profili')
            .select('id, nome, nome_completo')
            .in('id', profiloIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    // Gli errori qui non bloccano la pagina, ma vanno segnalati: prima
    // venivano ignorati e i nomi risultavano vuoti senza spiegazione.
    if (clientiRes.error) console.error('Errore clienti:', clientiRes.error)
    if (profiliRes.error) console.error('Errore profili:', profiliRes.error)

    const clientiMap = new Map(
      (clientiRes.data || []).map((cliente) => [cliente.id, cliente.nome])
    )

    const profiliMap = new Map(
      (profiliRes.data || []).map((profilo) => [
        profilo.id,
        profilo.nome_completo || profilo.nome || null,
      ])
    )

    setTicketMap(
      new Map(
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
    )

    setRows(righe)
    setLoading(false)
  }

  useEffect(() => {
    fetchThreads()
  }, [])

  /**
   * I thread sono globali: il raggruppamento non passa da n_tag, così lo
   * stesso thread collegato a più ticket resta una voce sola con l'elenco
   * dei ticket. I prefissi R:/I:/RE:/FW: sono già tolti dalla chiave.
   */
  const threadGroups = useMemo<ThreadGroupConTicket[]>(() => {
    return groupRowsIntoThreads(rows).map((group) => ({
      ...group,
      tickets: group.nTags
        .map((tag) => ticketMap.get(tag))
        .filter((ticket): ticket is TicketInfo => Boolean(ticket)),
    }))
  }, [rows, ticketMap])

  const clienti = useMemo(() => {
    const set = new Set<string>()

    for (const group of threadGroups) {
      for (const ticket of group.tickets) {
        if (ticket.cliente) set.add(ticket.cliente)
      }
    }

    return Array.from(set).sort()
  }, [threadGroups])

  const assegnati = useMemo(() => {
    const map = new Map<string, string>()

    for (const group of threadGroups) {
      for (const ticket of group.tickets) {
        if (ticket.assegnato_id) {
          map.set(ticket.assegnato_id, ticket.assegnato || 'Senza nome')
        }
      }
    }

    return Array.from(map).sort((a, b) => a[1].localeCompare(b[1]))
  }, [threadGroups])

  const filteredGroups = useMemo(() => {
    return threadGroups.filter((group) => {
      const query = search.trim().toLowerCase()

      const testoEmail = group.emails
        .map(
          (email) =>
            `${email.subject || ''} ${getStoredEmailText(email)} ${
              email.from_email || ''
            }`
        )
        .join(' ')

      const testoNote = group.notes.map((note) => note.nota).join(' ')
      const clientiGruppo = group.tickets
        .map((ticket) => ticket.cliente || '')
        .join(' ')
      const assegnatiGruppo = group.tickets
        .map((ticket) => ticket.assegnato || '')
        .join(' ')

      const matchSearch =
        query === '' ||
        group.nome.toLowerCase().includes(query) ||
        group.nTags.join(' ').toLowerCase().includes(query) ||
        testoEmail.toLowerCase().includes(query) ||
        testoNote.toLowerCase().includes(query) ||
        clientiGruppo.toLowerCase().includes(query) ||
        assegnatiGruppo.toLowerCase().includes(query)

      // Un thread passa il filtro se ALMENO UNO dei suoi ticket lo soddisfa.
      const matchCliente =
        clienteFilter === 'tutti' ||
        group.tickets.some((ticket) => ticket.cliente === clienteFilter)

      const matchAssegnato =
        assegnatoFilter === 'tutti' ||
        group.tickets.some((ticket) => ticket.assegnato_id === assegnatoFilter)

      const matchOlderThanDate =
        !olderThanDateFilter ||
        (group.ultimaMail !== null &&
          new Date(group.ultimaMail) <
            new Date(`${olderThanDateFilter}T23:59:59`))

      return matchSearch && matchCliente && matchAssegnato && matchOlderThanDate
    })
  }, [threadGroups, search, clienteFilter, assegnatoFilter, olderThanDateFilter])

  const totalEmails = useMemo(
    () =>
      filteredGroups.reduce((totale, group) => totale + group.emails.length, 0),
    [filteredGroups]
  )

  const totalNotes = useMemo(
    () =>
      filteredGroups.reduce((totale, group) => totale + group.notes.length, 0),
    [filteredGroups]
  )

  const olderThanCount = useMemo(() => {
    if (!olderThanDateFilter) return 0

    return threadGroups.filter(
      (group) =>
        group.ultimaMail !== null &&
        new Date(group.ultimaMail) < new Date(`${olderThanDateFilter}T23:59:59`)
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
    const confermato = window.confirm('Vuoi eliminare questa riga?')
    if (!confermato) return

    const { data, error } = await supabase
      .from('mail_threads')
      .delete()
      .eq('id', rowId)
      .select('id')

    if (error) {
      console.error('Errore eliminazione mail_threads:', error)
      setErrore(error.message)
      return
    }

    if (!data || data.length === 0) {
      setErrore(
        'Nessuna riga eliminata: controlla le policy RLS DELETE su mail_threads.'
      )
      return
    }

    setRows((prev) => prev.filter((row) => row.id !== rowId))
  }

  const deleteGroup = async (group: ThreadGroupConTicket) => {
    const ids = group.rows.map((row) => row.id).filter(Boolean)

    if (ids.length === 0) return

    const elencoTicket = group.nTags.length
      ? `\n\nIl thread è collegato a: ${group.nTags.join(', ')}.`
      : ''

    const confermato = window.confirm(
      `Vuoi eliminare il thread "${group.nome}" con tutte le email e i collegamenti?` +
        elencoTicket +
        `\n\nVerranno eliminate ${ids.length} righe. L'operazione non è reversibile.`
    )

    if (!confermato) return

    const { data, error } = await supabase
      .from('mail_threads')
      .delete()
      .in('id', ids)
      .select('id')

    if (error) {
      console.error('Errore eliminazione gruppo thread:', error)
      setErrore(error.message)
      return
    }

    if (!data || data.length === 0) {
      setErrore(
        'Nessuna riga eliminata: controlla le policy RLS DELETE su mail_threads.'
      )
      return
    }

    setRows((prev) => prev.filter((row) => !ids.includes(row.id)))
    setOpenGroupKeys((prev) => prev.filter((key) => key !== group.key))
  }

  const deleteNote = async (rowId: string, noteId: string) => {
    const confermato = window.confirm('Vuoi eliminare questa nota?')
    if (!confermato) return

    const riga = rows.find((item) => item.id === rowId)
    if (!riga) return

    const noteAggiornate =
      riga.tread?.note?.filter((note) => note.id !== noteId) || []

    const treadAggiornato = {
      ...(riga.tread || {}),
      note: noteAggiornate,
    }

    const { error } = await supabase
      .from('mail_threads')
      .update({ tread: treadAggiornato })
      .eq('id', rowId)

    if (error) {
      console.error('Errore eliminazione nota:', error)
      setErrore(error.message)
      return
    }

    setRows((prev) =>
      prev.map((item) =>
        item.id === rowId ? { ...item, tread: treadAggiornato } : item
      )
    )
  }

  return (
    <AppPage
      title="Storico Thread Mail"
      subtitle="Resoconto delle email raggruppate per thread. Un thread è unico anche se collegato a più ticket e anche se Outlook ha aggiunto R:, I:, RE: o FW: all'oggetto."
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
              placeholder="Cerca testo, thread, note, n_tag..."
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

      {errore && (
        <AppCard className="border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600">
          {errore}
        </AppCard>
      )}

      <div className="space-y-4">
        {loading ? (
          <AppCard className="p-10 text-center text-xs font-black uppercase tracking-widest text-slate-400">
            Caricamento thread...
          </AppCard>
        ) : filteredGroups.length > 0 ? (
          filteredGroups.map((group) => {
            const isGroupOpen = openGroupKeys.includes(group.key)
            const ultimaEmail = group.emails[group.emails.length - 1]
            const direzioneUltima =
              ultimaEmail?.direction === 'outbound' ? 'outbound' : 'inbound'

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
                        {group.nTags.length > 0 ? (
                          group.nTags.map((tag) => {
                            const ticket = group.tickets.find(
                              (item) => item.n_tag === tag
                            )

                            return ticket?.id ? (
                              <Link
                                key={tag}
                                href={`/ticket/${ticket.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-600 transition-all hover:bg-blue-100"
                              >
                                Ticket #{tag}
                                <ExternalLink size={10} />
                              </Link>
                            ) : (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400"
                                title="Nessun ticket con questo n_tag"
                              >
                                Ticket #{tag}
                              </span>
                            )
                          })
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Nessun ticket collegato
                          </span>
                        )}

                        {Array.from(
                          new Set(
                            group.tickets
                              .map((ticket) => ticket.cliente)
                              .filter(Boolean) as string[]
                          )
                        ).map((cliente) => (
                          <span
                            key={cliente}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600"
                          >
                            <Briefcase size={11} />
                            {cliente}
                          </span>
                        ))}

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
                          title="Elimina il thread completo da Supabase"
                        >
                          <Trash2 size={14} color="white" />
                        </AppButton>
                      </div>

                      <h2 className="text-lg font-black leading-snug text-slate-950">
                        {group.nome}
                      </h2>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {Array.from(
                          new Set(
                            group.tickets
                              .map((ticket) => ticket.assegnato)
                              .filter(Boolean) as string[]
                          )
                        ).map((assegnato) => (
                          <span
                            key={assegnato}
                            className="rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500"
                          >
                            Assegnato: {assegnato}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 lg:justify-end">
                      <div
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-wider ${
                          group.ultimaMail
                            ? 'bg-slate-50 text-slate-500'
                            : 'bg-slate-50 text-slate-300'
                        }`}
                      >
                        {group.ultimaMail ? (
                          <>
                            {direzioneUltima === 'outbound' ? (
                              <ArrowUpRight size={13} />
                            ) : (
                              <ArrowDownLeft size={13} />
                            )}
                            Ultima mail{' '}
                            {direzioneUltima === 'outbound'
                              ? 'inviata'
                              : 'ricevuta'}
                            : {formatDate(group.ultimaMail)}
                          </>
                        ) : (
                          <>
                            <Calendar size={13} />
                            Nessuna mail importata
                          </>
                        )}
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
                          {group.emails.map((email) => (
                            <div
                              key={email.uniqueId}
                              className="rounded-2xl border border-slate-200 bg-white p-4"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                  {email.direction === 'outbound'
                                    ? 'Inviata'
                                    : 'Ricevuta'}
                                </span>

                                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-600">
                                  {formatDateTime(email.date)}
                                </span>

                                {email.from_email && (
                                  <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500">
                                    Da: {email.from_email}
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 text-sm font-black text-slate-900">
                                {email.subject || group.nome}
                              </div>

                              <div className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-600">
                                {getStoredEmailText(email)}
                              </div>
                            </div>
                          ))}
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
                                Ticket #{link.n_tag || 'N/D'}
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
                                  deleteNote(note.sourceRowId, note.id)
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
