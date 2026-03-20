'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useTicket } from '../../hooks/useTicket'
import MailThread from '@/components/ticket/MailThread'
import ReleasePipeline from '@/components/ticket/ReleasePipeline'
import { SectionLabel, PrimaryTextarea } from '@/components/ui/ticket-ui'
import {
  ArrowLeft,
  MessageSquare,
  Activity,
  Layers,
  Star,
  User,
  Pencil,
  ExternalLink,
  Trash2,
  TriangleAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

const STATO_OPTIONS = [
  'Attività Sospesa',
  'In lavorazione',
  'In attesa Sviluppo',
  'In attesa risposta Sviluppatore',
  'Attenzione Business',
  'Attenzione Andrea',
  'Completato - In attesa di chiusura TAG',
  'Completato',
]

const TOOL_OPTIONS = ['GA4', 'GTM', 'BigQuery', 'Databricks']
const SPRINT_OPTIONS = ['Sprint', 'Opex', 'Backlog', 'Progetto Separato']

const TIPO_ATTIVITA_OPTIONS = [
  'Preanalisi',
  'Evolutive GA4',
  'Evolutiva BQ',
  'Incident Resolution',
  'Reporting',
  'Formazione',
  'Supporto Funzionale Business',
  'Analisi degli impatti',
  'Supporto Tecnico',
]

const APPLICATIVI_OPTIONS = [
  'APPECOM',
  'ECOM35',
  'EOL',
  'ESB',
  'IST35',
  'GCW',
  'Parafarmacia',
]

const MONTH_NAMES = [
  'GENNAIO',
  'FEBBRAIO',
  'MARZO',
  'APRILE',
  'MAGGIO',
  'GIUGNO',
  'LUGLIO',
  'AGOSTO',
  'SETTEMBRE',
  'OTTOBRE',
  'NOVEMBRE',
  'DICEMBRE',
]

const PRIORITA_OPTIONS = ['Bassa', 'Media', 'Alta', 'Urgente']

const ui = {
  card: 'bg-white border border-gray-200 rounded-xl shadow-sm',
  sectionTitle:
    'text-xs font-black text-[#0150a0] uppercase tracking-widest border-b border-gray-100 pb-3',
  label: 'text-[10px] font-black uppercase tracking-widest text-gray-400',
  field:
    'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition-all focus:ring-2 focus:ring-[#0150a0]/20 focus:border-[#0150a0]/30',
  select:
    'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition-all focus:ring-2 focus:ring-[#0150a0]/20 focus:border-[#0150a0]/30',
  textarea:
    'w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 outline-none resize-none transition-all focus:ring-2 focus:ring-[#0150a0]/20 focus:border-[#0150a0]/30',
  metaBlock: 'flex flex-col gap-2',
}

type FileLink = {
  nome_file: string
  link: string
}

const defaultSections = {
  storiaAttivita: true,
  noteTecniche: true,
  noteImportanti: true,
  projectMetrics: true,
  mailThread: true,
  releasePipeline: true,
}

function groupLogsByMonth(logs: string[]) {
  const grouped: Record<string, string[]> = {}

  logs.forEach((log) => {
    const match = log.match(/^\[(\d{4})-(\d{2})-(\d{2})\]/)
    if (!match) return

    const [, year, month, day] = match
    const key = `${year}-${month}`

    if (!grouped[key]) grouped[key] = []
    grouped[key].push(`${day}/${month} ${log.replace(match[0], '').trim()}`)
  })

  return grouped
}

export default function TicketDettaglioPage() {
  const params = useParams()
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id
  const [tagHours, setTagHours] = useState<number | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const { ticketData, handleUpdate, loading, saving, colleghi, clienti } = useTicket(id)
  useEffect(() => {
  const fetchTagHours = async () => {
    if (!ticketData?.n_tag) {
      setTagHours(null)
      return
    }

    try {
      const sheetId = '1HrbA7vxZOuCK2bR6XQIy5nq4fVJhYh-SYsmDVGUGbco'
      const gid = '1523798548'

      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?gid=${gid}&tqx=out:json`

      const res = await fetch(url)
      const text = await res.text()

      // Google restituisce una callback JS, non JSON puro
      const jsonText = text.substring(47, text.length - 2)
      const data = JSON.parse(jsonText)

      const rows = data.table.rows || []

      const normalizeNumber = (value: unknown) => {
        if (typeof value === 'number') return value
        if (typeof value === 'string') {
          return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0
        }
        return 0
      }

      const total = rows.reduce((sum: number, row: any) => {
        const tag = row?.c?.[0]?.v?.toString()?.trim()
        const hoursValue = row?.c?.[1]?.v

        if (tag === ticketData.n_tag?.trim()) {
          return sum + normalizeNumber(hoursValue)
        }

        return sum
      }, 0)

      setTagHours(total)
    } catch (error) {
      console.error('Errore caricamento ore tag:', error)
      setTagHours(null)
    }
  }

  fetchTagHours()
}, [ticketData?.n_tag])
  const [deleting, setDeleting] = useState(false)
  const [showTagEditor, setShowTagEditor] = useState(false)
  const [showVisibilityPanel, setShowVisibilityPanel] = useState(false)

  const [tempTag, setTempTag] = useState('')
  const [tempLink, setTempLink] = useState('')
  const [tempTicketCollegato, setTempTicketCollegato] = useState('')
  const [tempTicketCollegatoLink, setTempTicketCollegatoLink] = useState('')

  const [newLogNote, setNewLogNote] = useState('')
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split('T')[0])

  const [openSections, setOpenSections] = useState(defaultSections)

  const [showFileModal, setShowFileModal] = useState(false)
  const [newFiles, setNewFiles] = useState<FileLink[]>([{ nome_file: '', link: '' }])

  useEffect(() => {
    if (!ticketData) return

    setTempTag(ticketData.n_tag || '')
    setTempLink(ticketData.link_tag || '')
    setTempTicketCollegato(ticketData.ticket_collegato || '')
    setTempTicketCollegatoLink(ticketData.ticket_collegato_link || '')
  }, [ticketData])

  useEffect(() => {
    const loadTicketSettings = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const { data, error } = await supabase
          .from('profili')
          .select('tickek_setting_colonne')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Errore caricamento impostazioni ticket:', error.message)
          return
        }

        if (data?.tickek_setting_colonne) {
          setOpenSections({
            ...defaultSections,
            ...data.tickek_setting_colonne,
          })
        }
      } catch (error) {
        console.error('Errore imprevisto caricamento impostazioni ticket:', error)
      }
    }

    loadTicketSettings()
  }, [supabase])

  const saveTicketSettings = async (settings: typeof defaultSections) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { error } = await supabase
        .from('profili')
        .update({ tickek_setting_colonne: settings })
        .eq('id', user.id)

      if (error) {
        console.error('Errore salvataggio impostazioni ticket:', error.message)
      }
    } catch (error) {
      console.error('Errore imprevisto salvataggio impostazioni ticket:', error)
    }
  }

  const toggleSection = async (section: keyof typeof openSections) => {
    const updated = {
      ...openSections,
      [section]: !openSections[section],
    }

    setOpenSections(updated)
    await saveTicketSettings(updated)
  }

  const addFileRow = () => {
    setNewFiles((prev) => [...prev, { nome_file: '', link: '' }])
  }

  const removeFile = async (index: number) => {
    if (!ticketData) return

    const currentFiles = Array.isArray(ticketData.files_link)
      ? (ticketData.files_link as FileLink[])
      : []

    const updated = currentFiles.filter((_, i) => i !== index)
    await handleUpdate('files_link', updated)
  }

  const saveNewFiles = async () => {
    if (!ticketData) return

    const validFiles = newFiles.filter((f) => f.nome_file.trim() && f.link.trim())
    if (validFiles.length === 0) return

    const currentFiles = Array.isArray(ticketData.files_link)
      ? (ticketData.files_link as FileLink[])
      : []

    await handleUpdate('files_link', [...currentFiles, ...validFiles])
    setNewFiles([{ nome_file: '', link: '' }])
    setShowFileModal(false)
  }

  const getProgressColor = (percent: number) => {
    if (percent < 30) return 'bg-[#dbeafe]'
    if (percent < 70) return 'bg-[#4f8fd8]'
    return 'bg-[#0150a0]'
  }

  const formatDisplayDate = (value?: string | null) => {
    if (!value) return '—'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    return date.toLocaleDateString('it-IT')
  }

  const isEsselunga = Boolean(
    clienti.find((c) => c.id === ticketData?.cliente_id)?.nome?.toLowerCase().includes('esselunga')
  )

  const isIncident = ticketData?.tipologia_ticket === 'Incident'

  const summaryCards = [
     {
    label: 'Numero di ore',
    value: tagHours !== null ? tagHours.toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) : '—',
  },
    {
      label: 'Ultimo Ping',
      value: formatDisplayDate(ticketData?.ultimo_ping),
    }
  ]

  const toggleApplicativo = (app: string) => {
    const current = Array.isArray(ticketData?.applicativo) ? ticketData.applicativo : []
    const updated = current.includes(app)
      ? current.filter((a: string) => a !== app)
      : [...current, app]

    handleUpdate('applicativo', updated)
  }

  const addLogNote = async () => {
    if (!ticketData || !newLogNote.trim()) return

    const newEntry = `[${logDate}] ${newLogNote.trim()}`

    const updatedLog = Array.isArray(ticketData.storia_ticket)
      ? [...ticketData.storia_ticket, newEntry]
      : [newEntry]

    updatedLog.sort((a, b) => {
      const dateA = a.match(/^\[(\d{4}-\d{2}-\d{2})\]/)?.[1] || ''
      const dateB = b.match(/^\[(\d{4}-\d{2}-\d{2})\]/)?.[1] || ''
      return dateA.localeCompare(dateB)
    })

    await handleUpdate('storia_ticket', updatedLog)
    setNewLogNote('')
  }

  const removeLogNote = async (noteToRemove: string) => {
    if (!ticketData) return

    const updatedLog = Array.isArray(ticketData.storia_ticket)
      ? ticketData.storia_ticket.filter((entry: string) => entry !== noteToRemove)
      : []

    await handleUpdate('storia_ticket', updatedLog)
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Sei sicuro di voler eliminare questo ticket? Questa azione non può essere annullata.'
    )
    if (!confirmed || !id) return

    try {
      setDeleting(true)

      const { error } = await supabase.from('ticket').delete().eq('id', id)

      if (error) throw error

      router.push('/tutti-i-ticket')
      router.refresh()
    } catch (error: any) {
      alert(`Errore durante l'eliminazione: ${error.message}`)
    } finally {
      setDeleting(false)
    }
  }

  if (loading || !ticketData) {
    return (
      <div className="p-10 text-xs font-black text-gray-400 animate-pulse text-center uppercase tracking-widest">
        Inizializzazione...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-8 lg:px-12 lg:py-12">
      <div className="max-w-[1600px] mx-auto pb-20">
        <div className="flex flex-col gap-4 mb-8 xl:flex-row xl:items-center xl:justify-between">
          <button
            onClick={() => router.back()}
            className="group inline-flex items-center gap-3 text-gray-500 hover:text-[#0150a0] transition-all font-black uppercase text-[10px] tracking-widest"
          >
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-200 group-hover:border-[#0150a0]/20">
              <ArrowLeft size={14} />
            </div>
            Torna alla Dashboard
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <div className={`${ui.card} px-4 py-3 min-w-[180px]`}>
              <button
                type="button"
                onClick={() => handleUpdate('in_lavorazione_ora', !ticketData.in_lavorazione_ora)}
                className="flex items-center gap-2 text-sm font-semibold text-left"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    ticketData.in_lavorazione_ora ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
                  }`}
                />
                <span
                  className={ticketData.in_lavorazione_ora ? 'text-red-500' : 'text-gray-500'}
                >
                  {ticketData.in_lavorazione_ora ? 'In Lavorazione' : 'Non attivo'}
                </span>
              </button>
            </div>

            <div className={`${ui.card} flex items-center gap-4 px-4 py-3`}>
              <div className="flex items-center gap-2 border-r border-gray-200 pr-4">
                <div
                  className={`w-2 h-2 rounded-full ${
                    saving ? 'bg-[#0150a0] animate-pulse' : 'bg-emerald-500'
                  }`}
                />
                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                  {saving ? 'Sincronizzazione...' : 'Dati salvati'}
                </span>
              </div>

              <span className="text-[10px] font-mono font-bold text-gray-300 tracking-widest">
                ID: {id?.toString().slice(0, 8)}
              </span>
            </div>

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-600 shadow-sm font-black uppercase text-[10px] tracking-widest transition-all hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {deleting ? 'Eliminazione...' : 'Elimina ticket'}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowVisibilityPanel((prev) => !prev)}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm font-black uppercase text-[10px] tracking-widest transition-all hover:bg-gray-50"
              >
                {showVisibilityPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Componenti
              </button>

              {showVisibilityPanel && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-xl p-3 z-50">
                  <div className="space-y-2">
                    {[
                      ['storiaAttivita', 'Storia attività'],
                      ['noteTecniche', 'Note tecniche'],
                      ['noteImportanti', 'Note importanti'],
                      ['projectMetrics', 'Dettagli Ticket SN'],
                      ['mailThread', 'Mail thread'],
                      ['releasePipeline', 'Release pipeline'],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleSection(key as keyof typeof openSections)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 text-sm"
                      >
                        <span className="text-gray-700 font-semibold">{label}</span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            openSections[key as keyof typeof openSections]
                              ? 'bg-emerald-500'
                              : 'bg-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`${ui.card} p-8 lg:p-10 mb-2`}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6 items-start">
            <div>
              <input
                type="text"
                value={ticketData.titolo || ''}
                onChange={(e) => handleUpdate('titolo', e.target.value)}
                className="w-full bg-transparent rounded-xl text-3xl lg:text-4xl font-black tracking-tighter text-gray-900 outline-none px-2 py-2 focus:bg-gray-50"
                placeholder="Titolo del ticket..."
              />
            </div>

            <div className="space-y-3 self-start -mt-1 lg:-mt-2">
              <div className="flex items-center gap-2">
                {ticketData.link_tag ? (
                  <a
                    href={ticketData.link_tag}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-[#0150a0] hover:bg-[#f5f9ff] transition-all"
                  >
                    <span className="truncate">{ticketData.n_tag || '#0000'}</span>
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-500">
                    {ticketData.n_tag || '#0000'}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowTagEditor(true)}
                  className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-all"
                >
                  <Pencil size={14} />
                </button>
              </div>

              <div>
                {ticketData.ticket_collegato &&
                  (ticketData.ticket_collegato_link ? (
                    <a
                      href={ticketData.ticket_collegato_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-[#0150a0] hover:bg-[#f5f9ff] transition-all"
                    >
                      <span className="truncate">{ticketData.ticket_collegato}</span>
                      <ExternalLink size={14} />
                    </a>
                  ) : (
                    <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-500">
                      {ticketData.ticket_collegato}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6 pt-6">
            <div className={ui.metaBlock}>
              <span className={`${ui.label} flex items-center gap-1`}>
                <Layers size={10} /> Cliente
              </span>
              <select
                value={ticketData.cliente_id || ''}
                onChange={(e) => handleUpdate('cliente_id', e.target.value)}
                className={ui.select}
              >
                {clienti.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className={ui.metaBlock}>
              <span className={`${ui.label} flex items-center gap-1`}>
                <Star size={10} /> Priorità
              </span>
              <select
                value={ticketData.priorita || 'Media'}
                onChange={(e) => handleUpdate('priorita', e.target.value)}
                className={`${ui.select} ${
                  ticketData.priorita === 'Urgente' ? 'text-red-500 border-red-200 bg-red-50' : ''
                }`}
              >
                {PRIORITA_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className={ui.metaBlock}>
              <span className={ui.label}>Stato</span>
              <select
                value={ticketData.stato || ''}
                onChange={(e) => handleUpdate('stato', e.target.value)}
                className={ui.select}
              >
                <option value="">Seleziona stato</option>
                {STATO_OPTIONS.map((stato) => (
                  <option key={stato} value={stato}>
                    {stato}
                  </option>
                ))}
              </select>
            </div>

            <div className={ui.metaBlock}>
              <span className={ui.label}>Tool</span>
              <select
                value={ticketData.tool || ''}
                onChange={(e) => handleUpdate('tool', e.target.value)}
                className={ui.select}
              >
                <option value="">Seleziona tool</option>
                {TOOL_OPTIONS.map((tool) => (
                  <option key={tool} value={tool}>
                    {tool}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${ui.metaBlock} xl:col-span-1`}>
              <div className="flex items-center justify-between">
                <span className={`${ui.label} text-[#0150a0] flex items-center gap-1`}>
                  <Activity size={10} /> Avanzamento
                </span>
                <span className="text-[10px] font-black text-[#0150a0] bg-[#e6eef8] px-2 py-1 rounded-md">
                  {ticketData.percentuale_avanzamento || 0}%
                </span>
              </div>

              <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-1">
                <div
                  className={`absolute left-0 top-0 h-full transition-all duration-500 ${getProgressColor(
                    ticketData.percentuale_avanzamento || 0
                  )}`}
                  style={{ width: `${ticketData.percentuale_avanzamento || 0}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={ticketData.percentuale_avanzamento || 0}
                  onChange={(e) =>
                    handleUpdate('percentuale_avanzamento', parseInt(e.target.value, 10))
                  }
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
              </div>
            </div>

            <div className={ui.metaBlock}>
              <span className={`${ui.label} flex items-center gap-1`}>
                <User size={10} /> Assegnato
              </span>
              <select
                value={ticketData.assignee || ''}
                onChange={(e) => handleUpdate('assignee', e.target.value)}
                className={ui.select}
              >
                <option value="">Non assegnato</option>
                {colleghi.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.nome_completo}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
<div className="grid grid-cols-1 grid-cols-9 gap-4 mb-2">
  {summaryCards.map((card) => (
    <div
      key={card.label}
      className="rounded-lg border border-[#d9e7f7] bg-white px-3 py-2 shadow-sm"
    >
      <div className="text-[8px] font-black uppercase tracking-[0.14em] text-[#7a93b2] mb-1">
        {card.label}
      </div>

      <div className="text-sm lg:text-base font-black tracking-tight text-[#0150a0] leading-none">
        {card.value}
      </div>
    </div>
  ))}
</div>


        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          <div className="lg:col-span-8 space-y-6">
            {openSections.storiaAttivita && (
              <div className={`${ui.card} overflow-hidden flex flex-col h-[650px]`}>
                <div className="px-8 py-4 border-b border-gray-100 flex items-center gap-2 bg-[#f8fbff]">
                  <MessageSquare size={16} className="text-[#0150a0]" />
                  <span className="text-[10px] font-black uppercase text-[#0150a0] tracking-widest">
                    Storia dell'attività
                  </span>
                </div>

                <div className="flex flex-col flex-1 border-b border-gray-100">
                  <div className="flex-1 overflow-y-auto p-8 text-[14px] leading-relaxed text-gray-700 space-y-5 bg-gray-50">
                    {(() => {
                      const grouped = groupLogsByMonth(ticketData.storia_ticket || [])
                      const sortedKeys = Object.keys(grouped).sort()

                      return sortedKeys.map((key) => {
                        const [year, month] = key.split('-')

                        return (
                          <div key={key} className="space-y-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-[#0150a0]">
                              {MONTH_NAMES[parseInt(month, 10) - 1]} {year}
                            </div>

                            <ul className="space-y-2">
                              {grouped[key].map((note, i) => {
                                const rawLog = ((ticketData.storia_ticket || []) as string[]).find(
                                  (entry: string) => {
                                    const match = entry.match(/^\[(\d{4})-(\d{2})-(\d{2})\]/)
                                    if (!match) return false

                                    const [, , logMonth, day] = match
                                    const formatted = `${day}/${logMonth} ${entry
                                      .replace(match[0], '')
                                      .trim()}`
                                    return formatted === note
                                  }
                                )

                                return (
                                  <li
                                    key={`${key}-${i}`}
                                    className="flex items-start justify-between gap-4 rounded-lg px-4 py-3"
                                  >
                                    <span className="text-sm text-gray-700">{note}</span>

                                    <button
                                      type="button"
                                      onClick={() => rawLog && removeLogNote(rawLog)}
                                      className="shrink-0 text-red-500 text-xs font-black hover:text-red-600"
                                    >
                                      ✕
                                    </button>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        )
                      })
                    })()}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-3 px-6 py-3 bg-white border-t border-gray-100 items-center">
                    <input
                      type="date"
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                      className={`${ui.field} py-2 text-xs`}
                    />

                    <textarea
                      value={newLogNote}
                      onChange={(e) => setNewLogNote(e.target.value)}
                      placeholder="Aggiungi nota..."
                      className={`${ui.textarea} py-2 text-sm`}
                      rows={1}
                    />

                    <button
                      onClick={addLogNote}
                      className="px-4 py-2 rounded-md bg-[#0150a0] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#013f82] transition-all shadow-sm"
                    >
                      Aggiungi
                    </button>
                  </div>
                </div>
              </div>
            )}

            {openSections.noteTecniche && (
              <div className={`${ui.card} overflow-hidden flex flex-col h-[200px]`}>
                <textarea
                  value={ticketData.note || ''}
                  onChange={(e) => handleUpdate('note', e.target.value)}
                  placeholder="Dettagli tecnici..."
                  className="flex-1 p-8 text-[15px] leading-relaxed outline-none resize-none bg-white text-gray-600"
                />
              </div>
            )}
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {Array.isArray(ticketData.files_link) &&
                  ticketData.files_link.map((file: FileLink, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 transition-all group"
                    >
                      <ExternalLink size={14} className="text-[#0150a0]" />
                      <a
                        href={file.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-gray-700 hover:underline"
                      >
                        {file.nome_file}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="ml-2 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                <button
                  type="button"
                  onClick={() => setShowFileModal(true)}
                  className="w-12 h-12 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-[#0150a0] hover:text-[#0150a0] hover:bg-blue-50 transition-all"
                >
                  <span className="text-2xl font-light">+</span>
                </button>
              </div>
            </div>

            {showFileModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8 space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#0150a0]">
                      Aggiungi Documenti
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowFileModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="max-h-[40vh] overflow-y-auto space-y-4 pr-2">
                    {newFiles.map((f, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100"
                      >
                        <div className="space-y-1">
                          <label className={ui.label}>Nome File</label>
                          <input
                            type="text"
                            value={f.nome_file}
                            onChange={(e) => {
                              setNewFiles((prev) =>
                                prev.map((item, index) =>
                                  index === i ? { ...item, nome_file: e.target.value } : item
                                )
                              )
                            }}
                            className={ui.field}
                            placeholder="es. Brief Progetto"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className={ui.label}>Link File</label>
                          <input
                            type="url"
                            value={f.link}
                            onChange={(e) => {
                              setNewFiles((prev) =>
                                prev.map((item, index) =>
                                  index === i ? { ...item, link: e.target.value } : item
                                )
                              )
                            }}
                            className={ui.field}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addFileRow}
                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-all"
                  >
                    + Aggiungi un altro documento
                  </button>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowFileModal(false)
                        setNewFiles([{ nome_file: '', link: '' }])
                      }}
                      className="px-6 py-2 text-xs font-black uppercase text-gray-400"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={saveNewFiles}
                      className="px-8 py-3 bg-[#0150a0] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#013f82] shadow-lg shadow-blue-900/20"
                    >
                      Salva Documenti
                    </button>
                  </div>
                </div>
              </div>
            )}

            {openSections.noteImportanti && (
              <div className={ui.card}>
                <button
                  type="button"
                  onClick={() => toggleSection('noteImportanti')}
                  className="w-full p-6 flex items-center justify-between text-left"
                >
                  <SectionLabel className="flex items-center gap-1 text-[#0150a0]">
                    <TriangleAlert size={10} />
                    Note importanti
                  </SectionLabel>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {saving ? 'Salvataggio...' : 'Salvato'}
                    </span>
                    {openSections.noteImportanti ? (
                      <ChevronUp size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                  </div>
                </button>

                {openSections.noteImportanti && (
                  <div className="px-6 pb-6">
                    <PrimaryTextarea
                      value={ticketData.note_importanti || ''}
                      onChange={(e) => handleUpdate('note_importanti', e.target.value)}
                      placeholder="Inserisci note importanti..."
                      rows={4}
                      className="bg-amber-50 border-amber-200 text-gray-800"
                    />
                  </div>
                )}
              </div>
            )}

            {isEsselunga && openSections.projectMetrics && (
              <div className={ui.card}>
                <button
                  type="button"
                  onClick={() => toggleSection('projectMetrics')}
                  className="w-full p-8 flex items-center justify-between text-left"
                >
                  <h3 className={`${ui.sectionTitle} border-b-0 pb-0`}>Dettagli Ticket SN</h3>
                  {openSections.projectMetrics ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>

                {openSections.projectMetrics && (
                  <div className="px-8 pb-8 space-y-8">
                    <div className="flex flex-col gap-3">
                      <span className={ui.label}>Applicativo</span>

                      <div className="flex flex-wrap gap-2">
                        {APPLICATIVI_OPTIONS.map((app) => {
                          const active = Array.isArray(ticketData.applicativo)
                            ? ticketData.applicativo.includes(app)
                            : false

                          return (
                            <button
                              key={app}
                              type="button"
                              onClick={() => toggleApplicativo(app)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${
                                active
                                  ? 'bg-[#0150a0] text-white border-[#0150a0] shadow-sm'
                                  : 'bg-[#e6eef8] text-[#0150a0] border-[#d3e0f3] hover:bg-[#d9e7f7]'
                              }`}
                            >
                              {app}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className={ui.label}>Story ID</label>
                        <input
                          value={ticketData.numero_storia || ''}
                          onChange={(e) => handleUpdate('numero_storia', e.target.value)}
                          className={ui.field}
                          placeholder="#0000"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className={ui.label}>Slot Sprint</label>
                        <select
                          value={ticketData.sprint || ''}
                          onChange={(e) => handleUpdate('sprint', e.target.value)}
                          className={ui.select}
                        >
                          <option value="">Nessuno</option>
                          {SPRINT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className={ui.label}>Tipo attività</label>
                      <select
                        value={ticketData.tipo_di_attivita || ''}
                        onChange={(e) => handleUpdate('tipo_di_attivita', e.target.value)}
                        className={ui.select}
                      >
                        <option value="">Seleziona tipo</option>
                        {TIPO_ATTIVITA_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {openSections.mailThread && (
              <MailThread ticketData={ticketData} onUpdate={handleUpdate} saving={saving} />
            )}

            {openSections.releasePipeline && (
              <ReleasePipeline ticketData={ticketData} onUpdate={handleUpdate} />
            )}
          </div>
        </div>

        {showTagEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-6 space-y-5">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#0150a0]">
                Modifica Ticket
              </h3>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">
                    {isIncident ? 'Numero Incident' : 'Numero Tag'}
                  </label>
                  <input
                    type="text"
                    value={tempTag}
                    onChange={(e) => setTempTag(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0150a0]/20"
                    placeholder="#0000"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">
                    {isIncident ? 'Link Incident' : 'Link Ticket'}
                  </label>
                  <input
                    type="url"
                    value={tempLink}
                    onChange={(e) => setTempLink(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-[#0150a0]/20"
                    placeholder="https://..."
                  />
                </div>

                <div className="pt-2 border-t border-gray-100" />

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">
                    {isIncident ? 'Incident Padre' : 'Change collegata'}
                  </label>
                  <input
                    type="text"
                    value={tempTicketCollegato}
                    onChange={(e) => setTempTicketCollegato(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0150a0]/20"
                    placeholder="es. TAG0123456"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">
                    {isIncident ? 'Link Incident Padre' : 'Link Change collegata'}
                  </label>
                  <input
                    type="url"
                    value={tempTicketCollegatoLink}
                    onChange={(e) => setTempTicketCollegatoLink(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-[#0150a0]/20"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTagEditor(false)}
                  className="px-4 py-2 text-xs font-black uppercase text-gray-500 hover:text-gray-700"
                >
                  Annulla
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await handleUpdate('n_tag', tempTag)
                    await handleUpdate('link_tag', tempLink)
                    await handleUpdate('ticket_collegato', tempTicketCollegato)
                    await handleUpdate('ticket_collegato_link', tempTicketCollegatoLink)
                    setShowTagEditor(false)
                  }}
                  className="px-4 py-2 rounded-lg bg-[#0150a0] text-white text-xs font-black uppercase tracking-widest hover:bg-[#013f82]"
                >
                  Salva
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}