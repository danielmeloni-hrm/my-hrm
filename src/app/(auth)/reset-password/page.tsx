'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()

  const [ready, setReady] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // Quando arrivi dal link email, Supabase mette la sessione “recovery”
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      // Se non c’è sessione, link non valido o redirect configurato male
      if (!data.session) {
        setErr('Link non valido o scaduto. Richiedi un nuovo reset password.')
      }
      setReady(true)
    })()
  }, [supabase])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setMsg(null)

    if (newPassword.length < 8) {
      setErr('Password troppo corta (minimo 8 caratteri).')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)

    if (error) {
      setErr(error.message)
      return
    }

    setMsg('Password aggiornata! Ora puoi accedere.')
    setTimeout(() => {
      router.replace('/login')
      router.refresh()
    }, 800)
  }

  if (!ready) return null

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h1 className="text-2xl font-black text-gray-900 mb-2">Reimposta password</h1>
        <p className="text-sm text-gray-500 mb-6">
          Inserisci la nuova password per completare il reset.
        </p>

        {err && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
            {err}
          </div>
        )}
        {msg && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-xl border border-green-100">
            {msg}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nuova password (min 8 caratteri)"
            className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-[#0150a0] text-black"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0150a0] text-white py-3 rounded-xl font-black hover:bg-[#013d7a] disabled:opacity-60"
          >
            {loading ? 'Aggiornamento...' : 'Aggiorna password'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="text-[#0150a0] font-black hover:underline">
            Torna al login
          </Link>
        </div>
      </div>
    </div>
  )
}