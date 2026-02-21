'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { 
  BellRing, Rocket, ChevronRight, 
  AlertCircle, Calendar, ArrowRight,
  Clock, CheckCircle2, Activity, Zap
} from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const { data } = await supabase
        .from('ticket')
        .select('*, clienti(nome)')
        .order('ultimo_ping', { ascending: true }) // Mettiamo i più vecchi in cima
      
      if (data) setTickets(data)
      setLoading(false)
    }
    fetchData()
  }, [supabase])

  // --- LOGICA DATE ---
  const oggi = new Date()
  const unaSettimanaFa = new Date(oggi.getTime() - 7 * 24 * 60 * 60 * 1000)
  const quindiciGiorniFa = new Date(oggi.getTime() - 15 * 24 * 60 * 60 * 1000)

  // 1. Rilasci Settimanali (Collaudo o Produzione negli ultimi 7gg)
  const rilasciSettimana = tickets.filter(t => {
    const dColl = t.rilascio_in_collaudo ? new Date(t.rilascio_in_collaudo) : null
    const dProd = t.rilascio_in_produzione ? new Date(t.rilascio_in_produzione) : null
    return (dColl && dColl >= unaSettimanaFa) || (dProd && dProd >= unaSettimanaFa)
  })

  // 2. Alert Ping (> 15 giorni dall'ultimo ping, escludendo i completati)
  const pingAlerts = tickets.filter(t => {
    if (t.stato === 'Completato' || t.stato === 'Completato - In attesa di chiusura') return false
    if (!t.ultimo_ping) return true // Mai pingato = Alert immediato
    return new Date(t.ultimo_ping) < quindiciGiorniFa
  })

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#FBFBFB]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Loading Control Center...</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FBFBFB] p-8 font-sans">
      <div className="max-w-[1400px] mx-auto">
        
        {/* WELCOME HEADER */}
        <div className="flex items-end justify-between mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">System Live</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-gray-900">
              Bentornato<span className="text-blue-600">.</span>
            </h1>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Intl.DateTimeFormat('it-IT', { dateStyle: 'full' }).format(oggi)}</p>
          </div>
        </div>

        {/* TOP GRID: CRITICAL ALERTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          
          {/* SEZIONE PING ALERTS */}
          <section className="bg-white border-2 border-red-50 rounded-[32px] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500 text-white rounded-2xl shadow-lg shadow-red-100">
                  <BellRing size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-gray-800">Alert Ping</h2>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-tighter italic">Nessun contatto da oltre 15gg</p>
                </div>
              </div>
              <div className="text-4xl font-black text-red-500 tracking-tighter">{pingAlerts.length}</div>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {pingAlerts.length > 0 ? pingAlerts.map(t => (
                <Link href={`/ticket/${t.id}`} key={t.id} className="flex items-center justify-between p-4 bg-red-50/30 hover:bg-red-50 rounded-2xl border border-red-50 transition-all group">
                  <div className="flex flex-col gap-1 overflow-hidden mr-4">
                    <span className="text-[9px] font-black text-red-400 uppercase tracking-tighter">Cliente: {t.clienti?.nome}</span>
                    <span className="text-[13px] font-bold text-gray-800 truncate">{t.titolo}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0 gap-2">
                    <span className="text-[10px] font-black bg-white px-3 py-1 rounded-full border border-red-100 text-red-600 shadow-sm">
                      {t.ultimo_ping ? `Ultimo: ${new Date(t.ultimo_ping).toLocaleDateString()}` : 'MAI PINGATO'}
                    </span>
                    <ArrowRight size={16} className="text-red-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              )) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 size={40} className="text-green-500 mb-2 opacity-20" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tutti i clienti sono seguiti</p>
                </div>
              )}
            </div>
          </section>

          {/* SEZIONE RILASCI SETTIMANA */}
          <section className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
                  <Rocket size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-gray-800">Rilasci Settimanali</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Output degli ultimi 7 giorni</p>
                </div>
              </div>
              <div className="text-4xl font-black text-blue-600 tracking-tighter">{rilasciSettimana.length}</div>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {rilasciSettimana.length > 0 ? rilasciSettimana.map(t => (
                <Link href={`/ticket/${t.id}`} key={t.id} className="flex items-center justify-between p-4 border border-gray-100 hover:border-blue-200 hover:bg-blue-50/10 rounded-2xl transition-all group">
                  <div className="flex flex-col gap-1 overflow-hidden mr-4">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">{t.clienti?.nome}</span>
                    <span className="text-[13px] font-bold text-gray-800 truncate">{t.titolo}</span>
                  </div>
                  <div className="flex gap-2">
                    {t.rilascio_in_produzione && (
                        <div className="px-2 py-1 bg-green-100 text-green-700 text-[9px] font-black rounded-lg">PROD</div>
                    )}
                    {t.rilascio_in_collaudo && (
                        <div className="px-2 py-1 bg-purple-100 text-purple-700 text-[9px] font-black rounded-lg">COLL</div>
                    )}
                  </div>
                </Link>
              )) : (
                <div className="flex flex-col items-center justify-center py-10 text-center text-gray-300">
                   <Clock size={40} className="mb-2 opacity-10" />
                   <p className="text-xs font-bold uppercase tracking-widest">In attesa di rilasci...</p>
                </div>
              )}
            </div>
          </section>

        </div>

        {/* QUICK ACTIONS / NAVIGATION BOTTOM */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/board" className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-3xl group relative overflow-hidden">
                <Zap className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32" />
                <h3 className="text-white font-black uppercase text-xs tracking-widest mb-1">Board Attività</h3>
                <p className="text-white/60 text-[10px] uppercase font-bold">Gestisci gli Sprint</p>
                <div className="mt-8 text-white group-hover:translate-x-2 transition-transform">
                    <ArrowRight size={20} />
                </div>
            </Link>
            
            <Link href="/ticket" className="bg-white border border-gray-100 p-6 rounded-3xl group hover:border-blue-600 transition-all">
                <h3 className="text-gray-900 font-black uppercase text-xs tracking-widest mb-1">Archivio Ticket</h3>
                <p className="text-gray-400 text-[10px] uppercase font-bold">Cronologia completa</p>
                <div className="mt-8 text-blue-600 group-hover:translate-x-2 transition-transform">
                    <ArrowRight size={20} />
                </div>
            </Link>

            <div className="bg-blue-50 p-6 rounded-3xl flex items-center justify-between">
                <div>
                    <h3 className="text-blue-900 font-black uppercase text-xs tracking-widest mb-1">Salute Sistema</h3>
                    <p className="text-blue-600 text-[10px] uppercase font-bold">Database & Sync</p>
                </div>
                <Activity className="text-blue-300" />
            </div>
        </div>

      </div>
    </div>
  )
}