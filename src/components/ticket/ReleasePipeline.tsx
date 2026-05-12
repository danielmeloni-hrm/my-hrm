'use client'

import { useState } from 'react'
import { Bell, Rocket, ChevronUp, ChevronDown, ClipboardCheck, CalendarDays } from 'lucide-react'

interface PipelineProps {
  ticketData: any
  onUpdate: (field: string, value: any) => Promise<void>
}

const STATO_COLLAUDO_OPTIONS = [
  'Non iniziato',
  '1% - 49%',
  '50% - 79%',
  '80% - 99%',
  '100% - In attesa di Produzione',
]

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'Non iniziato':
      return 'bg-gray-100 text-gray-600 border-gray-200'
    case '1% - 49%':
      return 'bg-red-50 text-red-500 border-red-200'
    case '50% - 79%':
      return 'bg-orange-50 text-orange-500 border-orange-200'
    case '80% - 99%':
      return 'bg-amber-50 text-amber-600 border-amber-200'
    case '100% - In attesa di Produzione':
      return 'bg-emerald-50 text-emerald-600 border-emerald-200'
    default:
      return 'bg-gray-50 text-gray-500 border-gray-200'
  }
}

export default function ReleasePipeline({ ticketData, onUpdate }: PipelineProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const steps = [
    {
      label: 'Collaudo',
      statusField: 'rilascio_collaudo_eseguito',
      dateField: 'rilascio_in_collaudo',
      icon: Bell,
      activeClass: 'border-violet-200 bg-violet-50',
      iconClass: 'bg-violet-600 text-white',
      badgeClass: 'bg-violet-600 text-white border-violet-600',
    },
    {
      label: 'Produzione',
      statusField: 'rilascio_production_eseguito',
      dateField: 'rilascio_in_produzione',
      icon: Rocket,
      activeClass: 'border-emerald-200 bg-emerald-50',
      iconClass: 'bg-emerald-600 text-white',
      badgeClass: 'bg-emerald-600 text-white border-emerald-600',
    },
  ]

  const completedCount = steps.filter((step) => !!ticketData?.[step.statusField]).length
  const statoCollaudo = ticketData?.stato_collaudo || ''

  return (
    <div className="overflow-hidden rounded-l border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="flex w-full items-center justify-between border-b border-gray-100 px-6 py-5 text-left transition-all hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0150a0]/10">
            <Rocket size={18} className="text-[#0150a0]" />
          </div>

          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-[#0150a0]">
              Release Pipeline
            </h3>
            <p className="mt-1 text-xs font-medium text-gray-400">
              Gestione collaudo e rilascio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
            {completedCount}/{steps.length} completati
          </span>

          {isCollapsed ? (
            <ChevronDown size={18} className="text-gray-400" />
          ) : (
            <ChevronUp size={18} className="text-gray-400" />
          )}
        </div>
      </button>

      <div
        className={`transition-all duration-500 ease-in-out ${
          isCollapsed ? 'max-h-0 overflow-hidden opacity-0' : 'max-h-[1200px] opacity-100'
        }`}
      >
        <div className="space-y-6 p-6">
          {/* Stato collaudo */}
          <div className="rounded-l border border-[#0150a0]/10 bg-gradient-to-br from-[#f5f9ff] to-white p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-l bg-[#0150a0] text-white shadow-sm">
                <ClipboardCheck size={18} />
              </div>

              <div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0150a0]">
                  Stato Collaudo
                </h4>
                <p className="mt-1 text-xs text-gray-500">
                  Aggiorna avanzamento e ultima verifica
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Avanzamento collaudo
                </label>

                <div
                  className={`rounded-l border p-[1px] transition-all ${getStatusStyle(statoCollaudo)}`}
                >
                  <select
                    value={statoCollaudo}
                    onChange={(e) => onUpdate('stato_collaudo', e.target.value)}
                    className="w-full rounded-l bg-white/80 px-4 py-3 text-xs font-black outline-none"
                  >
                    <option value="">Seleziona stato</option>
                    {STATO_COLLAUDO_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Ultimo controllo
                </label>

                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                  <CalendarDays size={16} className="text-[#0150a0]" />
                  <input
                    type="date"
                    value={ticketData?.ultimo_controllo_collaudo || ''}
                    onChange={(e) => onUpdate('ultimo_controllo_collaudo', e.target.value)}
                    className="w-full bg-transparent text-xs font-black text-gray-700 outline-none"
                  />
                </div>
              </div>
            </div>

            
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 gap-4">
            {steps.map((step) => {
              const isDone = !!ticketData?.[step.statusField]
              const Icon = step.icon

              return (
                <div
                  key={step.label}
                  className={`rounded-l border p-5 transition-all ${
                    isDone
                      ? `${step.activeClass} shadow-sm`
                      : 'border-gray-200 bg-gray-50/70'
                  }`}
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-l ${
                          isDone ? step.iconClass : 'bg-white text-gray-300 border border-gray-200'
                        }`}
                      >
                        <Icon size={18} />
                      </div>

                      <div>
                        <div
                          className={`text-[11px] font-black uppercase tracking-[0.18em] ${
                            isDone ? 'text-gray-800' : 'text-gray-400'
                          }`}
                        >
                          {step.label}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {step.label === 'Collaudo'
                            ? 'Verifica finale e approvazione'
                            : 'Rilascio in ambiente produttivo'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onUpdate(step.statusField, !isDone)}
                      className={`rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                        isDone
                          ? `${step.badgeClass} shadow-md`
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {isDone ? 'Completato' : 'Segna come fatto'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      Data {step.label.toLowerCase()}
                    </label>

                    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                      <CalendarDays size={16} className="text-gray-400" />
                      <input
                        type="date"
                        value={ticketData?.[step.dateField] || ''}
                        onChange={(e) => onUpdate(step.dateField, e.target.value)}
                        className="w-full bg-transparent text-xs font-black text-gray-700 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}