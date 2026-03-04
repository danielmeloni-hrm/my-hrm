'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react'
import ParticlesBackground from '@/components/ParticlesBackground'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setOkMsg(null)

    const cleanEmail = email.trim()

    if (password.length < 8) {
      setError('La password deve avere almeno 8 caratteri')
      setLoading(false)
      return
    }

    if (password !== confirm) {
      setError('Le password non coincidono')
      setLoading(false)
      return
    }

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    })

    const j = await res.json().catch(() => null)

    if (!res.ok) {
      setError(j?.message || 'Registrazione non riuscita')
      setLoading(false)
      return
    }

    // Se email confirmation è attivo: mostra messaggio
    setOkMsg('Account creato! Controlla la mail per confermare e poi accedi.')
    setLoading(false)

    // Se invece conferma email è OFF, puoi rimandare subito al dashboard
    // ma per sicurezza mandiamo al login:
    setTimeout(() => {
      router.replace('/login')
      router.refresh()
    }, 900)
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* SFONDO */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0150a0] via-[#1b66b3] to-[#0b3e7a]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.18),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-0 pointer-events-none">
          <ParticlesBackground />
        </div>
      </div>

      {/* CARD */}
      <div className="relative max-w-md w-full bg-white/100 backdrop-blur rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4 pointer-events-none">
            <Image
              src="/brand/hrmgroup_logo.jpg"
              alt="MyHRM"
              width={180}
              height={70}
              className="h-auto w-auto"
              priority
            />
          </div>

          <h1 className="text-2xl font-bold text-gray-800">Crea un account</h1>
          <p className="text-gray-500 text-sm">Registrati per accedere a MyHRM</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}

        {okMsg && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100">
            {okMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#0150a0] text-black"
                placeholder="nome@azienda.it"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#0150a0] text-black"
                placeholder="Min 8 caratteri"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700"
                aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Conferma password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                required
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-[#0150a0] text-black"
                placeholder="Ripeti password"
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0150a0] text-white py-3 rounded-xl font-bold hover:bg-[#013d7a] transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? 'Registrazione...' : 'Registrati'} <ArrowRight size={18} />
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Hai già un account?{' '}
          <Link href="/login" className="text-[#0150a0] font-bold hover:underline">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  )
}