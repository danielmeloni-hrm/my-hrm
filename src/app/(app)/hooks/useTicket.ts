'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

export function useTicket(id: string | string[] | undefined) {
  const supabase = createClient()
  
  const [ticketData, setTicketData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [colleghi, setColleghi] = useState<any[]>([])
  const [clienti, setClienti] = useState<any[]>([])

  // Fetch dati iniziale
  useEffect(() => {
    if (!id) return

    async function loadData() {
      setLoading(true)
      
      const { data: ticket } = await supabase
        .from('ticket')
        .select(`*, clienti (nome, id), profili:assignee (nome_completo, id)`)
        .eq('id', id)
        .single()
      
      const { data: dataColleghi } = await supabase.from('profili').select('id, nome_completo')
      const { data: dataClienti } = await supabase.from('clienti').select('id, nome')
      
      if (ticket) setTicketData(ticket)
      if (dataColleghi) setColleghi(dataColleghi)
      if (dataClienti) setClienti(dataClienti)
      
      setLoading(false)
    }

    loadData()
  }, [id])

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
      .from('ticket')
      .update({ [field]: sanitizedValue }) // Usa il valore pulito qui
      .eq('id', id)
    
    if (error) {
      console.error("Errore durante l'aggiornamento:", error.message)
    }

    setTimeout(() => setSaving(false), 400)
  }, [id, clienti, supabase])

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