'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { sendTicketChangeNotification } from '@/lib/ticket-notifications'

export function useTicket(id: string | string[] | undefined) {
  const supabase = createClient()

  const [ticketData, setTicketData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [colleghi, setColleghi] = useState<any[]>([])
  const [clienti, setClienti] = useState<any[]>([])

  // Il record può stare nei ticket (attività) o negli incident: teniamo
  // traccia della tabella d'origine per scrivere gli aggiornamenti al posto giusto.
  const tabellaRef = useRef<'ticket' | 'incident'>('ticket')

  // Fetch dati iniziale
  useEffect(() => {
    if (!id) return

    async function loadData() {
      setLoading(true)

      const selezione = `*, clienti (nome, id), profili:assignee (nome_completo, id)`

      // Prima cerchiamo tra i ticket; se non c'è, tra gli incident.
      let ticket: any = null

      const ticketRes = await supabase
        .from('ticket')
        .select(selezione)
        .eq('id', id)
        .maybeSingle()

      if (ticketRes.data) {
        ticket = ticketRes.data
        tabellaRef.current = 'ticket'
      } else {
        const incidentRes = await supabase
          .from('incident')
          .select(selezione)
          .eq('id', id)
          .maybeSingle()

        if (incidentRes.data) {
          ticket = incidentRes.data
          tabellaRef.current = 'incident'
        }
      }

      const { data: dataColleghi } = await supabase.from('profili').select('id, nome_completo')
      const { data: dataClienti } = await supabase.from('clienti').select('id, nome')

      if (ticket) setTicketData(ticket)
      if (dataColleghi) setColleghi(dataColleghi)
      if (dataClienti) setClienti(dataClienti)

      setLoading(false)
    }

    loadData()
  }, [id, supabase])

  // Funzione di aggiornamento centralizzata (memoizzata con useCallback)
  const handleUpdate = useCallback(async (field: string, value: any) => {
    if (!id) return

    // TRUCCO: Se il valore è una stringa vuota, trasformalo in null
    // Questo evita l'errore "invalid input syntax for type date"
    const sanitizedValue = value === "" ? null : value;

    setTicketData((prev: any) => {
      const newData = { ...prev, [field]: sanitizedValue }
      if (field === 'cliente_id') {
        const c = clienti.find(item => String(item.id) === String(sanitizedValue))
        if (newData.clienti) newData.clienti.nome = c?.nome
      }
      return newData
    })

    setSaving(true)

    const { error } = await supabase
      .from(tabellaRef.current)
      .update({ [field]: sanitizedValue }) // Usa il valore pulito qui
      .eq('id', id)

    if (error) {
      console.error("Errore durante l'aggiornamento:", error.message)
    } else if (ticketData) {
      // Notifica realtime agli assegnatari (ticket pre-modifica + patch)
      void sendTicketChangeNotification(
        supabase,
        { ...ticketData, id: String(id) },
        { [field]: sanitizedValue }
      )
    }

    setTimeout(() => setSaving(false), 400)
  }, [id, clienti, supabase, ticketData])

  return {
    ticketData,
    handleUpdate,
    loading,
    saving,
    colleghi,
    clienti,
    setTicketData // Utile se servono update manuali complessi
  }
}
