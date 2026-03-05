'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Check, Loader2, Save, User, Lock, LayoutGrid } from 'lucide-react'

type MenuItem = { name: string; path: string }

export default function SettingsPage() {
  const supabase = createClient()

  const allMenuItems: MenuItem[] = useMemo(
    () => [
      { name: 'Nuova Attività', path: '/new_ticket' },
      { name: 'Attività in Lavorazione', path: '/dashboard_in_lavorazione' },
      { name: 'Note Board', path: '/note_board' },
      { name: 'Sprint Board', path: '/dashboard' },
      { name: 'Opex Board', path: '/dashboard_opex' },
      { name: 'I miei Ticket', path: '/i-miei-ticket' },
      { name: 'Tutti Ticket', path: '/tutti-i-ticket' },
      { name: 'Tutte le Change', path: '/changes' },
      { name: 'Calendario Rilasci', path: '/calendario' },
      { name: 'Calendario Rilasci CHG', path: '/calendario_chg' },
      { name: 'Report', path: '/report_progetti' },
    ],
    []
  )

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [userEmail, setUserEmail] = useState<string>('')
  const [userId, setUserId] = useState<string>('')

  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [saveMsg, setSaveMsg] = useState<string>('')

  const [newPassword, setNewPassword] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<string>('')

  useEffect(() => {
    let mounted = true

    async function init() {
      setLoading(true)
      setSaveMsg('')
      setPwdMsg('')

      const { data: u } = await supabase.auth.getUser()
      if (!mounted) return

      setUserEmail(u.user?.email ?? '')
      setUserId(u.user?.id ?? '')

      // carica preferenze sidebar da API (server-side, cookie-safe)
      const res = await fetch('/api/settings/sidebar', { method: 'GET' })
      const json = await res.json().catch(() => null)

      // se non esiste ancora, default: tutte visibili
      const stored = json?.sidebar_visible_paths
      if (Array.isArray(stored) && stored.length > 0) {
        setSelectedPaths(stored)
      } else {
        setSelectedPaths(allMenuItems.map(m => m.path))
      }

      setLoading(false)
    }

    init()
    return () => {
      mounted = false
    }
  }, [supabase, allMenuItems])

  const togglePath = (path: string) => {
    setSaveMsg('')
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    )
  }

  const saveSidebar = async () => {
  const res = await fetch('/api/settings/sidebar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sidebar_visible_paths: selectedPaths })
  })

  if (!res.ok) return

  // 🔔 aggiorna sidebar in tempo reale
  window.dispatchEvent(new Event('sidebar-updated'))
}

  const changePassword = async () => {
    setPwdLoading(true)
    setPwdMsg('')

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    })

    const j = await res.json().catch(() => null)

    if (!res.ok) {
      setPwdMsg(j?.message || 'Errore cambio password.')
      setPwdLoading(false)
      return
    }

    setPwdMsg('Password aggiornata con successo.')
    setNewPassword('')
    setPwdLoading(false)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="animate-spin" />
          Caricamento impostazioni...
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-6">Impostazioni</h1>

      {/* ACCOUNT */}
      <section className="bg-white border border-gray-100 rounded-3xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-2xl bg-gray-100">
            <User className="text-gray-700" />
          </div>
          <h2 className="font-black text-gray-900">Dettagli account</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Email</div>
            <div className="font-bold text-gray-900 break-all">{userEmail || '-'}</div>
          </div>
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">User ID</div>
            <div className="font-mono text-xs text-gray-800 break-all">{userId || '-'}</div>
          </div>
        </div>
      </section>

      {/* SIDEBAR */}
      <section className="bg-white border border-gray-100 rounded-3xl p-6 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-gray-100">
              <LayoutGrid className="text-gray-700" />
            </div>
            <div>
              <h2 className="font-black text-gray-900">Sidebar</h2>
              <p className="text-xs text-gray-500">Scegli quali pagine mostrare nel menu.</p>
            </div>
          </div>

          <button
            onClick={saveSidebar}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#0150a0] hover:bg-[#013d7a] text-white font-black text-xs flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Salva
          </button>
        </div>

        {saveMsg && (
          <div className="mb-4 text-sm font-bold text-gray-700">{saveMsg}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {allMenuItems.map((item) => {
            const checked = selectedPaths.includes(item.path)
            return (
              <button
                key={item.path}
                onClick={() => togglePath(item.path)}
                className={`flex items-center justify-between p-4 rounded-2xl border transition ${
                  checked ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 hover:bg-gray-50'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold text-gray-900 text-sm">{item.name}</div>
                  <div className="text-xs text-gray-400">{item.path}</div>
                </div>

                <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                  checked ? 'bg-[#0150a0] text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  <Check size={16} />
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* PASSWORD */}
      <section className="bg-white border border-gray-100 rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-2xl bg-gray-100">
            <Lock className="text-gray-700" />
          </div>
          <div>
            <h2 className="font-black text-gray-900">Password</h2>
            <p className="text-xs text-gray-500">Cambia la password dell’account.</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#0150a0] text-black"
            placeholder="Nuova password (min 8 caratteri)"
          />

          <button
            onClick={changePassword}
            disabled={pwdLoading || newPassword.length < 8}
            className="px-4 py-3 rounded-2xl bg-[#0150a0] hover:bg-[#013d7a] text-white font-black text-xs disabled:opacity-60"
          >
            {pwdLoading ? 'Aggiornamento...' : 'Aggiorna password'}
          </button>
        </div>

        {pwdMsg && <div className="mt-3 text-sm font-bold text-gray-700">{pwdMsg}</div>}
      </section>
    </div>
  )
}