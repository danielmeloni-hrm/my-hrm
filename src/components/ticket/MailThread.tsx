'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Link2,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import {
  formatDate,
  formatDateTime,
  groupRowsIntoThreads,
  isThreadLinkRow,
  normalizeThreadName,
  stripOutlookPrefixes,
  type MailThreadRow,
  type ThreadGroup,
  type ThreadNote,
} from '@/lib/mail-thread-utils'

interface MailThreadProps {
  ticketData: any
  onUpdate: (field: string, value: any) => Promise<void>
  saving: boolean
}

export default function MailThread({
  ticketData,
  onUpdate,
  saving,
}: MailThreadProps) {
  const supabase = createClient()
  const threadNameRef = useRef<HTMLInputElement | null>(null)

  const [nomeThread, setNomeThread] = useState('')
  const [nuovaNota, setNuovaNota] = useState('')
  const [threadSelezionato, setThreadSelezionato] = useState('')
  const [dataInvioMail, setDataInvioMail] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [dataNota, setDataNota] = useState(
    new Date().toISOString().split('T')[0]
  )

  const [rows, setRows] = useState<MailThreadRow[]>([])
  const [openThreadKeys, setOpenThreadKeys] = useState<string[]>([])
  const [loadingThreads, setLoadingThreads] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [showNewThreadForm, setShowNewThreadForm] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const nTag = ticketData?.n_tag

  /**
   * Carica le righe del ticket e, per i thread che hanno un topic, anche le
   * righe che stanno sotto altri ticket: un thread è globale, quindi la data
   * dell'ultima mail va calcolata su tutto il thread, non solo sulla parte
   * agganciata a questo ticket.
   */
  const fetchThreads = useCallback(async () => {
    if (!nTag) {
      setRows([])
      return
    }

    setLoadingThreads(true)
    setErrore(null)

    const { data: righeTicket, error: erroreTicket } = await supabase
      .from('mail_threads')
      .select('*')
      .eq('n_tag', String(nTag))

    if (erroreTicket) {
      console.error('Errore fetch thread del ticket:', erroreTicket)
      setErrore(erroreTicket.message)
      setRows([])
      setLoadingThreads(false)
      return
    }

    const base = (righeTicket || []) as MailThreadRow[]

    const topics = Array.from(
      new Set(
        base
          .map((row) => (row.topic || '').trim())
          .filter((topic) => topic.length > 0)
      )
    )

    let righeCorrelate: MailThreadRow[] = []

    if (topics.length > 0) {
      const { data: correlate, error: erroreCorrelate } = await supabase
        .from('mail_threads')
        .select('*')
        .in('topic', topics)

      if (erroreCorrelate) {
        // Non è un errore bloccante: senza le righe degli altri ticket la
        // data mostrata resta quella calcolata sul solo ticket corrente.
        console.error('Errore fetch righe correlate:', erroreCorrelate)
      } else {
        righeCorrelate = (correlate || []) as MailThreadRow[]
      }
    }

    const perId = new Map<string, MailThreadRow>()
    for (const row of [...base, ...righeCorrelate]) {
      perId.set(row.id, row)
    }

    setRows(Array.from(perId.values()))
    setLoadingThreads(false)
  }, [supabase, nTag])

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  /** Chiavi dei thread effettivamente agganciati a QUESTO ticket. */
  const chiaviDelTicket = useMemo(() => {
    const chiavi = new Set<string>()

    for (const row of rows) {
      if (String(row.n_tag || '') !== String(nTag)) continue

      const key =
        normalizeThreadName(row.topic) ||
        normalizeThreadName(row.subject) ||
        normalizeThreadName(row.tread?.nome_thread) ||
        `riga:${row.id}`

      chiavi.add(key)
    }

    return chiavi
  }, [rows, nTag])

  const threads = useMemo<ThreadGroup[]>(() => {
    return groupRowsIntoThreads(rows).filter((group) =>
      chiaviDelTicket.has(group.key)
    )
  }, [rows, chiaviDelTicket])

  /**
   * Thread selezionato per la nota. È derivato, non sincronizzato con un
   * effect: se la selezione non esiste più (thread scollegato) si ricade
   * sul primo disponibile senza un giro di render in più.
   */
  const threadSelezionatoEffettivo = useMemo(() => {
    if (threads.some((thread) => thread.key === threadSelezionato)) {
      return threadSelezionato
    }

    return threads[0]?.key ?? ''
  }, [threads, threadSelezionato])

  const toggleThread = (key: string) => {
    setOpenThreadKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    )
  }

  /**
   * Ultima mail del ticket: la più recente fra TUTTI i thread collegati,
   * non quella del primo thread. Con più thread è l'unico dato che dice
   * davvero da quanto il ticket è fermo.
   */
  const ultimaMailDelTicket = useMemo(() => {
    let migliore: {
      data: string
      direzione: 'inbound' | 'outbound'
      thread: string
    } | null = null

    for (const thread of threads) {
      const ultima = thread.emails[thread.emails.length - 1]
      if (!thread.ultimaMail || !ultima) continue

      if (
        !migliore ||
        new Date(thread.ultimaMail).getTime() >
          new Date(migliore.data).getTime()
      ) {
        migliore = {
          data: thread.ultimaMail,
          direzione: ultima.direction === 'outbound' ? 'outbound' : 'inbound',
          thread: thread.nome,
        }
      }
    }

    return migliore
  }, [threads])

  /**
   * Riallineamento di ticket.ultimo_ping.
   *
   * Le mail vengono inserite in mail_threads da un flusso esterno, che non
   * tocca la tabella ticket: all'arrivo di una mail ultimo_ping restava al
   * valore vecchio. Il rimedio strutturale è il trigger in
   * supabase/ultimo_ping_da_mail.sql; questo è la rete di sicurezza per le
   * righe già a database e per le mail arrivate prima del trigger.
   *
   * Si muove solo in avanti e una volta sola per montaggio, così un ping
   * registrato a mano (una telefonata) non viene mai arretrato e non si
   * innesca un ciclo di scritture.
   */
  const pingRiallineato = useRef(false)

  useEffect(() => {
    pingRiallineato.current = false
  }, [nTag])

  useEffect(() => {
    if (pingRiallineato.current || loadingThreads) return

    const ultima = ultimaMailDelTicket?.data
    if (!ultima) return

    const attuale = ticketData?.ultimo_ping
      ? new Date(ticketData.ultimo_ping).getTime()
      : 0

    const nuova = new Date(ultima).getTime()
    if (Number.isNaN(nuova) || nuova <= attuale) return

    pingRiallineato.current = true
    void onUpdate('ultimo_ping', ultima)
  }, [
    ultimaMailDelTicket,
    ticketData?.ultimo_ping,
    loadingThreads,
    onUpdate,
  ])

  const isOverdue = useMemo(() => {
    const riferimento = ultimaMailDelTicket?.data || ticketData?.ultimo_ping
    if (!riferimento) return false

    const lastPing = new Date(riferimento)
    if (Number.isNaN(lastPing.getTime())) return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    lastPing.setHours(0, 0, 0, 0)

    const diffDays = Math.floor(
      (today.getTime() - lastPing.getTime()) / (1000 * 60 * 60 * 24)
    )

    return diffDays >= 15
  }, [ultimaMailDelTicket, ticketData?.ultimo_ping])

  const threadCount = threads.length

  const noteCount = useMemo(
    () => threads.reduce((totale, thread) => totale + thread.notes.length, 0),
    [threads]
  )

  const handleAddClick = () => {
    setIsCollapsed(false)
    setShowNewThreadForm(true)
    setShowNoteForm(false)

    setTimeout(() => {
      threadNameRef.current?.focus()
    }, 100)
  }

  /**
   * Collega un thread al ticket.
   *
   * Il thread è globale: se esiste già sotto un altro ticket NON gli si
   * cambia n_tag (lo si sposterebbe, scollegandolo da dove stava). Si crea
   * invece una riga di collegamento per questo ticket.
   */
  const collegaThreadAlTicket = async () => {
    const nomePulito = stripOutlookPrefixes(nomeThread) || nomeThread.trim()
    const chiave = normalizeThreadName(nomeThread)

    if (!nomePulito || !chiave || !nTag) return

    setErrore(null)

    // Già collegato a questo ticket? Non si duplica il collegamento.
    if (chiaviDelTicket.has(chiave)) {
      setErrore('Questo thread è già collegato al ticket.')
      return
    }

    // Si cercano le righe esistenti del thread per riusarne il nome corretto
    // e la data dell'ultima mail. Il confronto finale avviene sulla chiave
    // normalizzata, non sul subject esatto: "R: ..." e "I: ..." sono lo
    // stesso thread e un confronto esatto non li troverebbe mai.
    //
    // Per non scaricare l'intera tabella si pre-filtra a database sul token
    // più lungo del nome (tipicamente il codice TAG). Il token è solo
    // alfanumerico, quindi non può rompere la sintassi di or().
    const tokenRicerca = (nomePulito.match(/[A-Za-z0-9]{4,}/g) || []).sort(
      (a, b) => b.length - a.length
    )[0]

    const ricerca = tokenRicerca
      ? supabase
          .from('mail_threads')
          .select('*')
          .or(`topic.ilike.%${tokenRicerca}%,subject.ilike.%${tokenRicerca}%`)
          .limit(500)
      : supabase
          .from('mail_threads')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500)

    const { data: candidati, error: erroreRicerca } = await ricerca

    if (erroreRicerca) {
      console.error('Errore ricerca thread:', erroreRicerca)
      setErrore(erroreRicerca.message)
      return
    }

    const righeThread = ((candidati || []) as MailThreadRow[]).filter((row) => {
      const key =
        normalizeThreadName(row.topic) ||
        normalizeThreadName(row.subject) ||
        normalizeThreadName(row.tread?.nome_thread)

      return key === chiave
    })

    const gruppoEsistente = righeThread.length
      ? groupRowsIntoThreads(righeThread)[0]
      : null

    const nomeCanonico = gruppoEsistente?.nome || nomePulito
    const dataCollegamento = new Date().toISOString()

    const { error: erroreInsert } = await supabase.from('mail_threads').insert({
      n_tag: String(nTag),
      topic: nomeCanonico,
      subject: nomeCanonico,
      contenuto: nomeCanonico,
      data_invio: dataInvioMail,
      linked_manually: true,
      linked_at: dataCollegamento,
      link_status: 'manual',
      tread: {
        type: 'thread_link',
        tipo: 'mail',
        nome_thread: nomeCanonico,
        note: [],
      },
    })

    if (erroreInsert) {
      console.error('Errore collegamento thread:', erroreInsert)
      setErrore(erroreInsert.message)
      return
    }

    // L'ultimo ping segue la mail più recente del thread, se c'è; solo in
    // mancanza di mail datate si ripiega sulla data scelta a mano.
    const ultimoPing = gruppoEsistente?.ultimaMail || dataInvioMail
    await onUpdate('ultimo_ping', ultimoPing)

    setNomeThread('')
    setShowNewThreadForm(false)
    setIsCollapsed(false)

    await fetchThreads()
  }

  const aggiungiNotaAlThread = async () => {
    const notaPulita = nuovaNota.trim()
    if (!notaPulita || !threadSelezionatoEffettivo) return

    const thread = threads.find(
      (item) => item.key === threadSelezionatoEffettivo
    )
    if (!thread) return

    // La nota va sulla riga di questo ticket, così resta dove l'utente
    // la sta scrivendo anche se il thread è condiviso con altri ticket.
    const rigaBersaglio =
      thread.rows.find(
        (row) => String(row.n_tag || '') === String(nTag) && isThreadLinkRow(row)
      ) ||
      thread.rows.find((row) => String(row.n_tag || '') === String(nTag)) ||
      thread.rows[0]

    if (!rigaBersaglio) return

    const nuovaNotaObj: ThreadNote = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}`,
      nota: notaPulita,
      created_at: new Date(dataNota).toISOString(),
    }

    const treadAggiornato = {
      ...(rigaBersaglio.tread || {}),
      tipo: rigaBersaglio.tread?.tipo || 'mail',
      nome_thread: rigaBersaglio.tread?.nome_thread || thread.nome,
      note: [...(rigaBersaglio.tread?.note || []), nuovaNotaObj],
    }

    const { error } = await supabase
      .from('mail_threads')
      .update({ tread: treadAggiornato })
      .eq('id', rigaBersaglio.id)

    if (error) {
      console.error('Errore salvataggio nota:', error)
      setErrore(error.message)
      return
    }

    setNuovaNota('')
    setOpenThreadKeys((prev) =>
      prev.includes(thread.key) ? prev : [...prev, thread.key]
    )

    await fetchThreads()
  }

  /**
   * Scollega il thread da QUESTO ticket: elimina solo le righe con questo
   * n_tag. Le mail importate sotto altri ticket non vengono toccate.
   */
  const scollegaThread = async (thread: ThreadGroup) => {
    const idsDelTicket = thread.rows
      .filter((row) => String(row.n_tag || '') === String(nTag))
      .map((row) => row.id)

    if (idsDelTicket.length === 0) return

    const confermato = window.confirm(
      `Vuoi scollegare questo thread dal ticket ${String(nTag)}?\n\n` +
        `${thread.nome}\n\n` +
        `Verranno rimosse ${idsDelTicket.length} righe collegate a questo ticket. ` +
        `Le mail collegate ad altri ticket restano al loro posto.`
    )

    if (!confermato) return

    const { data, error } = await supabase
      .from('mail_threads')
      .delete()
      .in('id', idsDelTicket)
      .select('id')

    if (error) {
      console.error('Errore scollegamento thread:', error)
      setErrore(error.message)
      return
    }

    if (!data || data.length === 0) {
      setErrore(
        'Nessuna riga eliminata: controlla le policy RLS DELETE su mail_threads.'
      )
      return
    }

    setOpenThreadKeys((prev) => prev.filter((key) => key !== thread.key))
    await fetchThreads()
  }

  const eliminaNota = async (rowId: string, noteId: string) => {
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

  /** Direzione dell'ultima mail del thread, per l'etichetta inviata/ricevuta. */
  const direzioneUltimaMail = (thread: ThreadGroup) => {
    const ultima = thread.emails[thread.emails.length - 1]
    if (!ultima) return null
    return ultima.direction === 'outbound' ? 'outbound' : 'inbound'
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
            title="Thread collegati"
          >
            {threadCount}
          </span>

          {noteCount > 0 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-yellow-50 text-yellow-600 border-yellow-100">
              {noteCount} note
            </span>
          )}

          {/* Ultima mail su tutti i thread collegati, non solo sul primo. */}
          {ultimaMailDelTicket && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${
                isOverdue
                  ? 'bg-red-50 text-red-600 border-red-100'
                  : 'bg-slate-50 text-slate-500 border-slate-100'
              }`}
              title={
                threadCount > 1
                  ? `Mail più recente fra i ${threadCount} thread collegati, dal thread "${ultimaMailDelTicket.thread}"`
                  : ultimaMailDelTicket.thread
              }
            >
              {ultimaMailDelTicket.direzione === 'outbound' ? (
                <ArrowUpRight size={11} />
              ) : (
                <ArrowDownLeft size={11} />
              )}
              Ultima mail {formatDate(ultimaMailDelTicket.data)}
              {threadCount > 1 && (
                <span className="font-bold text-slate-400">
                  · su {threadCount} thread
                </span>
              )}
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
            title="Collega thread email"
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
        <div className="px-5 pb-5 space-y-4">
          {errore && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[10px] font-bold text-red-600">
              {errore}
            </div>
          )}

          {showNewThreadForm && (
            <div className="border border-blue-100 bg-blue-50/30 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-blue-600">
                  <Link2 size={14} />
                  Collega thread email
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

              <div className="relative">
                <input
                  ref={threadNameRef}
                  type="text"
                  value={nomeThread}
                  onChange={(e) => setNomeThread(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      collegaThreadAlTicket()
                    }

                    if (e.key === 'Escape') {
                      setNomeThread('')
                      setShowNewThreadForm(false)
                    }
                  }}
                  placeholder="Nome thread, es. TAG01588307 -> Proposta accesso degli interessati (GDPR)"
                  className="w-full bg-white rounded-xl px-4 py-3 pr-14 text-[12px] outline-none border border-blue-100"
                />

                <button
                  type="button"
                  onClick={collegaThreadAlTicket}
                  disabled={
                    !nomeThread.trim() || saving || loadingThreads || !nTag
                  }
                  className={`absolute top-1/2 right-2 -translate-y-1/2 p-2.5 rounded-lg disabled:opacity-50 ${
                    isOverdue ? 'bg-red-600' : 'bg-blue-600'
                  } text-[#ffffff]`}
                  title="Collega thread al ticket"
                >
                  <Send size={14} />
                </button>
              </div>

              <div className="mt-2 text-[10px] text-gray-400">
                I prefissi <span className="font-black">R:</span>,{' '}
                <span className="font-black">I:</span>,{' '}
                <span className="font-black">RE:</span> e{' '}
                <span className="font-black">FW:</span> vengono ignorati: se il
                thread esiste già viene riusato invece di crearne un doppione.
              </div>
            </div>
          )}

          {/* Elenco dei thread: nome + data dell'ultima mail. */}
          {loadingThreads && threads.length === 0 ? (
            <div className="text-[10px] text-gray-300 text-center py-4">
              Caricamento thread...
            </div>
          ) : threads.length > 0 ? (
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
              {threads.map((thread) => {
                const isOpen = openThreadKeys.includes(thread.key)
                const direzione = direzioneUltimaMail(thread)
                const altriTicket = thread.nTags.filter(
                  (tag) => tag !== String(nTag)
                )

                return (
                  <div key={thread.key}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleThread(thread.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleThread(thread.key)
                        }
                      }}
                      className="flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 transition-all cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-slate-800 truncate">
                          {thread.nome}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider ${
                              thread.ultimaMail
                                ? 'text-blue-600'
                                : 'text-gray-300'
                            }`}
                          >
                            {direzione === 'outbound' ? (
                              <ArrowUpRight size={11} />
                            ) : (
                              <ArrowDownLeft size={11} />
                            )}
                            {thread.ultimaMail
                              ? `Ultima mail ${
                                  direzione === 'outbound'
                                    ? 'inviata'
                                    : 'ricevuta'
                                }: ${formatDate(thread.ultimaMail)}`
                              : 'Nessuna mail importata'}
                          </span>

                          {thread.emails.length > 0 && (
                            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[9px] font-black text-slate-400">
                              {thread.emails.length} email
                            </span>
                          )}

                          {thread.notes.length > 0 && (
                            <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[9px] font-black text-yellow-600">
                              {thread.notes.length} note
                            </span>
                          )}

                          {altriTicket.length > 0 && (
                            <span
                              className="rounded-full bg-purple-50 px-2 py-0.5 text-[9px] font-black text-purple-600"
                              title={`Thread condiviso con: ${altriTicket.join(', ')}`}
                            >
                              anche su {altriTicket.length} altro
                              {altriTicket.length > 1 ? 'i' : ''} ticket
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            scollegaThread(thread)
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 transition-all"
                          title="Scollega il thread da questo ticket"
                        >
                          <Trash2 size={13} />
                        </button>

                        {isOpen ? (
                          <ChevronUp size={14} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={14} className="text-gray-400" />
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t border-gray-100 bg-gray-50/60 p-4">
                        {thread.notes.length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-[9px] font-black uppercase tracking-[0.15em] text-yellow-600">
                              Note associate
                            </div>

                            {thread.notes.map((note) => (
                              <div
                                key={note.id}
                                className="relative rounded-lg border border-yellow-100 bg-yellow-50 p-3 pr-9"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    eliminaNota(note.sourceRowId, note.id)
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
                        ) : (
                          <div className="text-[10px] text-gray-400">
                            Nessuna nota su questo thread. Il contenuto delle
                            mail si consulta nella pagina Email.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            !showNewThreadForm && (
              <div className="text-[10px] text-gray-300 text-center py-4">
                Nessun thread collegato. Clicca il pulsante + per collegarne uno.
              </div>
            )
          )}

          {threads.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowNoteForm(!showNoteForm)}
                className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.15em] text-yellow-600 hover:text-yellow-700"
              >
                <StickyNote size={13} />
                {showNoteForm ? 'Chiudi nota' : 'Aggiungi nota a un thread'}
              </button>

              {showNoteForm && (
                <div className="mt-3 border border-yellow-100 bg-yellow-50/40 rounded-xl p-4">
                  <select
                    value={threadSelezionatoEffettivo}
                    onChange={(e) => setThreadSelezionato(e.target.value)}
                    className="w-full bg-white rounded-xl px-3 py-2 mb-3 text-[11px] font-bold text-gray-500 outline-none border border-yellow-100"
                  >
                    {threads.map((thread) => (
                      <option key={thread.key} value={thread.key}>
                        {thread.nome}
                      </option>
                    ))}
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
                        !threadSelezionatoEffettivo ||
                        saving ||
                        loadingThreads
                      }
                      className="absolute bottom-3 right-3 p-2.5 rounded-lg disabled:opacity-50 bg-yellow-500 hover:bg-yellow-600 text-[#ffffff]"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
