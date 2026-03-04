'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, ArrowRight, Eye, EyeOff} from 'lucide-react'
import ParticlesBackground from "@/components/ParticlesBackground"

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()
const [showPassword, setShowPassword] = useState(false)
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)
  setError(null)

    const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Assicurati che i cookie vengano inviati
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
  setError("Email o password non corretti")
  setLoading(false)
  return
  }

  setLoading(false)
  router.replace('/dashboard')
  router.refresh()
}

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* SFONDO */}
     <div className="absolute inset-0 overflow-hidden z-0">
        {/* gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0150a0] via-[#1b66b3] to-[#0b3e7a]" />

        {/* luce morbida */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.18),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.10),transparent_55%)]" />

        {/* overlay SOLO sul background */}
        <div className="absolute inset-0 bg-black/10" />

        {/* particelle sopra il background (ma sotto la card) */}
        <div className="absolute inset-0 pointer-events-none">
          <ParticlesBackground />
        </div>
      </div>

      {/* CARD */}
      <div className="relative max-w-md w-full bg-white/100 backdrop-blur rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          {/* LOGO */}
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

          <h1 className="text-2xl font-bold text-gray-800">Accedi a MyHRM</h1>
          <p className="text-gray-500 text-sm">Inserisci le tue credenziali per continuare</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
                placeholder="m.rossi@azienda.it"
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
              placeholder="••••••••"
              autoComplete="current-password"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0150a0] text-white py-3 rounded-xl font-bold hover:bg-[#013d7a] transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? 'Accesso in corso...' : 'Entra'} <ArrowRight size={18} />
          </button>
          <p className="mt-6 text-center text-sm text-gray-500">
            Non hai un account?{' '}
            <Link href="/register" className="text-[#0150a0] font-bold hover:underline">
              Registrati ora
            </Link>
          </p>
        </form>

        
      </div>
    </div>
  )
}