'use client'

import { useState, useMemo } from 'react'
import { Mail, Calendar, Send, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react'

interface MailThreadProps {
  ticketData: any
  onUpdate: (field: string, value: any) => Promise<void>
  saving: boolean
}

export default function MailThread({ ticketData, onUpdate, saving }: MailThreadProps) {
  const [nuovoThread, setNuovoThread] = useState('')
  const [dataInvioMail, setDataInvioMail] = useState(new Date().toISOString().split('T')[0])
  const [isLogOpen, setIsLogOpen] = useState(false)

  // --- LOGICA OVERDUE (15 GIORNI) ---
  const isOverdue = useMemo(() => {
    if (!ticketData?.ultimo_ping) return false
    const lastPing = new Date(ticketData.ultimo_ping)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    lastPing.setHours(0, 0, 0, 0)
    
    const diffTime = today.getTime() - lastPing.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays >= 15
  }, [ticketData?.ultimo_ping])

  // Conteggio mail basato sul pattern dello storico
  const emailCount = useMemo(() => {
    if (!ticketData?.aggiornamento_storia) return 0
    const matches = ticketData.aggiornamento_storia.match(/\[MAIL DEL/g)
    return matches ? matches.length : 0
  }, [ticketData?.aggiornamento_storia])

  const aggiungiThreadEUpdatePing = async () => {
    const testoPulito = nuovoThread.trim()
    if (!testoPulito) return
    
    const dateObj = new Date(dataInvioMail)
    const dataFormattata = dateObj.toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit' 
    })
    
    const logEntry = `[MAIL DEL ${dataFormattata}]\n${testoPulito}\n\n`
    const nuovoStorico = logEntry + (ticketData.aggiornamento_storia || '')
    
    // Usiamo una funzione specifica per aggiornare più campi o passiamo un oggetto se handleUpdate lo supporta
    // Qui assumiamo che handleUpdate aggiorni i campi singolarmente come nel tuo codice originale
    await onUpdate('aggiornamento_storia', nuovoStorico)
    await onUpdate('ultimo_ping', dataInvioMail)

    setNuovoThread('')
    setIsLogOpen(true)
  }

  return (
    <div className={`bg-white border transition-all duration-300 rounded-[10px] shadow-sm overflow-hidden flex flex-col ${
      isOverdue ? 'border-red-200 ring-2 ring-red-50' : 'border-gray-100'
    }`}>
      
      {/* HEADER E INPUT */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 font-black uppercase text-[9px] tracking-[0.15em] ${
              isOverdue ? 'text-red-600' : 'text-blue-600'
            }`}>
              {isOverdue ? <AlertCircle size={20} className="animate-pulse" /> : <Mail size={18} />}
              <span>Thread Mail</span>
            </div>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border transition-colors ${
              isOverdue ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'
            }`}>
              {emailCount}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar size={12} className="text-gray-300" />
            <input
              type="date"
              value={dataInvioMail}
              onChange={(e) => setDataInvioMail(e.target.value)}
              className="text-[10px] font-black text-gray-400 outline-none bg-transparent cursor-pointer hover:text-gray-600"
            />
          </div>
        </div>

        <div className="relative">
          <textarea
            value={nuovoThread}
            onChange={(e) => setNuovoThread(e.target.value)}
            placeholder="Incolla qui il contenuto della mail..."
            className="w-full bg-gray-50 rounded-xl p-4 text-[12px] min-h-[100px] outline-none resize-none font-medium border border-transparent focus:border-blue-100 focus:bg-white transition-all placeholder:text-gray-300"
          />
          <button
            onClick={aggiungiThreadEUpdatePing}
            disabled={!nuovoThread.trim() || saving}
            className={`absolute bottom-3 right-3 p-2.5 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 ${
              isOverdue ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Send size={14} className={saving ? 'animate-pulse' : ''} />
          </button>
        </div>
      </div>

      {/* TOGGLE STORICO */}
      <button
        onClick={() => setIsLogOpen(!isLogOpen)}
        className="w-full py-3 bg-gray-50/50 border-t border-gray-50 flex items-center justify-center gap-2 text-[9px] font-black text-gray-400 uppercase hover:text-gray-600 hover:bg-gray-100/50 transition-all"
      >
        {isLogOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {isLogOpen ? 'Chiudi Log Storico' : `Vedi Storico Completo (${emailCount})`}
      </button>
      
      {/* AREA LOG ESPANDIBILE */}
      <div className={`transition-all duration-500 ease-in-out bg-[#FDFDFD] ${
        isLogOpen ? 'max-h-[300px] p-5 border-t border-gray-50 opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        {ticketData.aggiornamento_storia ? (
          <div className="font-mono text-[10px] text-gray-500 whitespace-pre-wrap leading-relaxed">
            {ticketData.aggiornamento_storia}
          </div>
        ) : (
          <div className="text-[10px] text-gray-300 italic text-center py-4">
            Nessun thread registrato.
          </div>
        )}
      </div>
    </div>
  )
}