'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import AppPage from '@/components/ui/AppPage'
import HomeDashboard from '@/components/home/HomeDashboard'
import type { HomeData } from '@/components/home/widgets'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'

/**
 * `ticket` ha più chiavi esterne verso `profili` (assignee, utente_id): in quel
 * caso PostgREST rifiuta l'embed ambiguo. Proviamo con le relazioni e, se
 * fallisce, ricadiamo su una select semplice risolvendo i clienti a mano.
 */
const TICKET_SELECT_WITH_RELATIONS = '*, clienti(nome)'

export default function HomePage() {
  const supabase = useMemo(() => createClient(), [])

  const [tickets, setTickets] = useState<any[]>([])
  const [profili, setProfili] = useState<any[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [nomeUtente, setNomeUtente] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)

  const fetchTickets = useCallback(async () => {
    const conRelazioni = await supabase
      .from('ticket')
      .select(TICKET_SELECT_WITH_RELATIONS)
      .order('creato_at', { ascending: false })

    if (!conRelazioni.error) {
      setErrore(null)
      setTickets(conRelazioni.data ?? [])
      return
    }

    console.warn(
      'Embed clienti non disponibile, uso il fallback:',
      conRelazioni.error.message
    )

    const [ticketResult, clientiResult] = await Promise.all([
      supabase.from('ticket').select('*').order('creato_at', { ascending: false }),
      supabase.from('clienti').select('*'),
    ])

    if (ticketResult.error) {
      console.error('Errore caricamento ticket home:', ticketResult.error)
      setErrore(ticketResult.error.message)
      return
    }

    if (clientiResult.error) {
      console.warn('Errore caricamento clienti:', clientiResult.error.message)
    }

    const nomePerCliente = new Map(
      (clientiResult.data ?? []).map((cliente: any) => [
        cliente.id,
        cliente.nome ?? cliente.ragione_sociale ?? cliente.nome_cliente ?? null,
      ])
    )

    setErrore(null)
    setTickets(
      (ticketResult.data ?? []).map((ticket: any) => ({
        ...ticket,
        clienti: ticket.cliente_id
          ? { nome: nomePerCliente.get(ticket.cliente_id) ?? null }
          : null,
      }))
    )
  }, [supabase])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setUserId(user.id)

        const { data: profile, error: profileError } = await supabase
          .from('profili')
          .select('nome, nome_completo, email')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) {
          console.error('Errore caricamento profilo:', profileError)
        }

        setNomeUtente(
          profile?.nome ||
            profile?.nome_completo?.split(' ')[0] ||
            profile?.email?.split('@')[0] ||
            user.email?.split('@')[0] ||
            null
        )
      }

      const [{ data: profiliData, error: profiliError }] = await Promise.all([
        supabase.from('profili').select('id, nome, nome_completo, email, ruolo'),
        fetchTickets(),
      ])

      if (profiliError) {
        console.error('Errore caricamento profili:', profiliError)
      }

      setProfili(profiliData ?? [])
      setLoading(false)
    }

    fetchData()
  }, [supabase, fetchTickets])

  useRealtimeTable({
    supabase,
    table: 'ticket',
    onChange: fetchTickets,
  })

  const data: HomeData = useMemo(
    () => ({ tickets, profili, userId }),
    [tickets, profili, userId]
  )

  const oggi = new Date()

  if (loading) {
    return (
      <AppPage maxWidth="full">
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
            Loading Control Center...
          </span>
        </div>
      </AppPage>
    )
  }

  return (
    <AppPage maxWidth="full">
      <div className="w-full">
        <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2 sm:mb-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400 sm:text-[10px]">
                System Live
              </span>
            </div>

            <h1 className="truncate text-2xl font-black tracking-tighter text-gray-900 sm:text-3xl lg:text-4xl">
              Benvenuto {nomeUtente || 'Utente'}
            </h1>
          </div>

          <p className="shrink-0 text-[9px] font-black uppercase tracking-widest text-gray-400 sm:text-[10px]">
            {new Intl.DateTimeFormat('it-IT', { dateStyle: 'full' }).format(oggi)}
          </p>
        </div>

        {errore && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
            Non sono riuscito a caricare i ticket: {errore}
          </div>
        )}

        <HomeDashboard data={data} />
      </div>
    </AppPage>
  )
}
