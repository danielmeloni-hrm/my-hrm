'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useTicket } from '../../hooks/useTicket'
import MailThread from '@/components/ticket/MailThread'
import ReleasePipeline from '@/components/ticket/ReleasePipeline'
import {
  ArrowLeft,
  MessageSquare,
  Activity,
  Layers,
  Star,
  User,
  Trash2,
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

export default function TicketDettaglioPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const { ticketData, handleUpdate, loading, saving, colleghi, clienti } = useTicket(id)
  const [deleting, setDeleting] = useState(false)

  const getProgressColor = (percent: number) => {
    if (percent < 30) return 'bg-emerald-200'
    if (percent < 70) return 'bg-emerald-400'
    return 'bg-emerald-600'
  }

  const isEsselunga = Boolean(
    clienti.find((c) => c.id === ticketData?.cliente_id)?.nome?.toLowerCase().includes('esselunga')
  )

  const toggleApplicativo = (app: string) => {
    const current = Array.isArray(ticketData.applicativo) ? ticketData.applicativo : []
    const updated = current.includes(app)
      ? current.filter((a: string) => a !== app)
      : [...current, app]

    handleUpdate('applicativo', updated)
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Sei sicuro di voler eliminare questo ticket? Questa azione non può essere annullata.'
    )
    if (!confirmed) return

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
      <div className="p-10 text-xs font-mono text-gray-400 animate-pulse text-center uppercase tracking-widest">
        Inizializzazione...
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-12 py-8 lg:py-12 min-h-screen">
      <div className="max-w-[1600px] mx-auto pb-20">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.back()}
            className="group flex items-center gap-2 text-gray-400 hover:text-blue-600 transition-all font-black uppercase text-[10px] tracking-widest"
          >
            <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100">
              <ArrowLeft size={14} />
            </div>
            Torna alla Dashboard
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-2xl border border-red-200 shadow-sm font-black uppercase text-[10px] tracking-widest transition-all disabled:opacity-50"
            >
              <Trash2 size={14} />
              {deleting ? 'Eliminazione...' : 'Elimina ticket'}
            </button>

            <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 border-r border-gray-100 pr-4">
                <div
                  className={`w-2 h-2 rounded-full ${
                    saving ? 'bg-blue-500 animate-pulse' : 'bg-green-500'
                  }`}
                />
                <span className="text-[10px] font-black uppercase text-gray-500">
                  {saving ? 'Sincronizzazione...' : 'Dati Salvati'}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-gray-300 tracking-widest">
                ID: {id?.toString().slice(0, 8)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-[32px] p-8 lg:p-10 shadow-sm mb-8">
          <input
            type="text"
            value={ticketData.titolo || ''}
            onChange={(e) => handleUpdate('titolo', e.target.value)}
            className="text-3xl lg:text-4xl font-black bg-transparent outline-none focus:bg-gray-50 rounded-xl w-full tracking-tighter mb-6 transition-all"
            placeholder="Titolo del ticket..."
          />

          {/* PRIMA RIGA */}
          <div className="flex flex-wrap items-end gap-y-6 pt-6 border-t border-gray-50">
            <div className="flex flex-col gap-1 pr-6 border-r border-gray-100">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <Layers size={10} /> Cliente
              </span>
              <select
                value={ticketData.cliente_id || ''}
                onChange={(e) => handleUpdate('cliente_id', e.target.value)}
                className="bg-transparent font-bold text-xs text-blue-600 outline-none appearance-none cursor-pointer"
              >
                {clienti.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 px-6 border-r border-gray-100">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <Star size={10} /> Priorità
              </span>
              <select
                value={ticketData.priorita || 'Media'}
                onChange={(e) => handleUpdate('priorita', e.target.value)}
                className={`bg-transparent font-black text-xs outline-none cursor-pointer ${
                  ticketData.priorita === 'Urgente' ? 'text-red-500' : 'text-gray-900'
                }`}
              >
                {['Bassa', 'Media', 'Alta', 'Urgente'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 px-6 border-r border-gray-100 min-w-[170px]">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                Stato
              </span>
              <select
                value={ticketData.stato || ''}
                onChange={(e) => handleUpdate('stato', e.target.value)}
                className="bg-transparent font-bold text-xs text-gray-900 outline-none cursor-pointer"
              >
                <option value="">Seleziona stato</option>
                {STATO_OPTIONS.map((stato) => (
                  <option key={stato} value={stato}>
                    {stato}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 px-6 border-r border-gray-100 min-w-[130px]">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                Tool
              </span>
              <select
                value={ticketData.tool || ''}
                onChange={(e) => handleUpdate('tool', e.target.value)}
                className="bg-transparent font-bold text-xs text-gray-900 outline-none cursor-pointer"
              >
                <option value="">Seleziona tool</option>
                {TOOL_OPTIONS.map((tool) => (
                  <option key={tool} value={tool}>
                    {tool}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 px-6 border-r border-gray-100 min-w-[150px]">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                In lavorazione
              </span>
              <button
                type="button"
                onClick={() => handleUpdate('in_lavorazione_ora', !ticketData.in_lavorazione_ora)}
                className="flex items-center gap-2 text-xs font-bold text-left"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    ticketData.in_lavorazione_ora ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
                  }`}
                />
                <span
                  className={ticketData.in_lavorazione_ora ? 'text-red-500' : 'text-gray-500'}
                >
                  {ticketData.in_lavorazione_ora ? 'Attivo' : 'Non attivo'}
                </span>
              </button>
            </div>

            <div className="flex flex-col gap-2 px-6 border-r border-gray-100 min-w-[180px]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                  <Activity size={10} /> Avanzamento
                </span>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {ticketData.percentuale_avanzamento || 0}%
                </span>
              </div>
              <div className="relative w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
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
                    handleUpdate('percentuale_avanzamento', parseInt(e.target.value))
                  }
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 pl-6">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <User size={10} /> Assegnato
              </span>
              <select
                value={ticketData.assignee || ''}
                onChange={(e) => handleUpdate('assignee', e.target.value)}
                className="bg-transparent font-bold text-xs text-blue-600 outline-none appearance-none cursor-pointer"
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

          {/* SECONDA RIGA SOLO ESSELUNGA */}
          {isEsselunga && (
            <div className="flex flex-wrap items-end gap-y-6 pt-6 border-t border-gray-50 mt-6">
              <div className="flex flex-col gap-2 pr-6 border-r border-gray-100 min-w-[260px]">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                  Applicativo
                </span>

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
                        className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border transition-all ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-500 border-gray-200'
                        }`}
                      >
                        {app}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1 px-6 border-r border-gray-100 min-w-[150px]">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                  Sprint
                </span>

                <select
                  value={ticketData.sprint || ''}
                  onChange={(e) => handleUpdate('sprint', e.target.value)}
                  className="bg-transparent font-bold text-xs text-gray-900 outline-none cursor-pointer"
                >
                  <option value="">Seleziona sprint</option>
                  {SPRINT_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 px-6 min-w-[220px]">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                  Tipo attività
                </span>

                <select
                  value={ticketData.tipo_di_attivita || ''}
                  onChange={(e) => handleUpdate('tipo_di_attivita', e.target.value)}
                  className="bg-transparent font-bold text-xs text-gray-900 outline-none cursor-pointer"
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white border border-gray-100 rounded-[32px] shadow-sm overflow-hidden flex flex-col h-[650px]">
              <div className="px-8 py-4 border-b border-gray-50 flex items-center gap-2 bg-gray-50/30">
                <MessageSquare size={16} className="text-gray-400" />
                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                  Documentazione & Brief
                </span>
              </div>
              <textarea
                value={ticketData.note_importante || ''}
                onChange={(e) => handleUpdate('note_importante', e.target.value)}
                placeholder="Brief principale..."
                className="flex-1 p-8 text-[16px] leading-relaxed outline-none resize-none bg-white text-gray-800 font-medium border-b border-gray-50"
              />
              <textarea
                value={ticketData.note || ''}
                onChange={(e) => handleUpdate('note', e.target.value)}
                placeholder="Dettagli tecnici..."
                className="flex-1 p-8 text-[16px] leading-relaxed outline-none resize-none bg-white text-gray-500"
              />
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <MailThread ticketData={ticketData} onUpdate={handleUpdate} saving={saving} />

            <div className="p-8 bg-white border border-gray-100 rounded-[32px] shadow-sm space-y-6">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-4">
                Project Metrics
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase">Story ID</label>
                  <input
                    value={ticketData.numero_storia || ''}
                    onChange={(e) => handleUpdate('numero_storia', e.target.value)}
                    className="w-full bg-gray-50 p-3 rounded-xl border border-gray-100 font-black text-xs outline-none"
                    placeholder="#0000"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase">
                    Slot Sprint
                  </label>
                  <select
                    value={ticketData.sprint || ''}
                    onChange={(e) => handleUpdate('sprint', e.target.value)}
                    className="w-full bg-gray-50 p-3 rounded-xl border border-gray-100 font-black text-xs outline-none"
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
            </div>

            <ReleasePipeline ticketData={ticketData} onUpdate={handleUpdate} />
          </div>
        </div>
      </div>
    </div>
  )
}