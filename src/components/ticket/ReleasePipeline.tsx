'use client'

import { Bell, Rocket } from 'lucide-react'

interface PipelineProps {
  ticketData: any
  onUpdate: (field: string, value: any) => Promise<void>
}

export default function ReleasePipeline({ ticketData, onUpdate }: PipelineProps) {
  const steps = [
    { 
      label: 'Collaudo', 
      statusField: 'rilascio_collaudo_eseguito', 
      dateField: 'rilascio_in_collaudo', 
      icon: Bell, 
      activeClass: 'bg-purple-50/50 border-purple-100 text-purple-700',
      btnClass: 'bg-purple-600 shadow-purple-100'
    },
    { 
      label: 'Produzione', 
      statusField: 'rilascio_production_eseguito', // Verifica il nome esatto nel DB
      dateField: 'rilascio_in_produzione', 
      icon: Rocket, 
      activeClass: 'bg-green-50/50 border-green-100 text-green-700',
      btnClass: 'bg-green-600 shadow-green-100'
    }
  ]

  return (
    <div className="p-8 bg-white border border-gray-100 rounded-[10px] shadow-sm space-y-6">
      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50 pb-4">
        Release Pipeline
      </h3>
      <div className="space-y-4">
        {steps.map((step) => {
          const isDone = !!ticketData[step.statusField]
          return (
            <div key={step.label} className={`p-4 rounded-l border transition-all ${isDone ? step.activeClass : 'bg-gray-50/50 border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isDone ? 'bg-white/50' : 'bg-white text-gray-300'}`}>
                    <step.icon size={14} />
                  </div>
                  <span className={`text-[11px] font-black uppercase tracking-widest ${isDone ? '' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
                <button 
                  onClick={() => onUpdate(step.statusField, !isDone)}
                  className={`px-4 py-1.5 rounded-full text-[9px] font-black border uppercase transition-all ${
                    isDone ? `${step.btnClass} text-white border-transparent shadow-lg` : 'bg-white text-gray-400 border-gray-200'
                  }`}
                >
                  {isDone ? 'DEPLOYED' : 'Mark'}
                </button>
              </div>
              <input 
                type="date" 
                value={ticketData[step.dateField] || ''} 
                onChange={(e) => onUpdate(step.dateField, e.target.value)} 
                className="w-full text-xs font-black bg-white/80 border border-gray-100 p-3 rounded-2xl outline-none"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}