'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (type: 'LOGIN' | 'SIGNUP') => {
    setLoading(true)
    const { error } = type === 'LOGIN' 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: 'Nuovo Utente' } } })

    if (error) alert(error.message)
    else {
      alert(type === 'LOGIN' ? 'Accesso eseguito!' : 'Controlla la mail per confermare!')
      if (type === 'LOGIN') router.push('/')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white shadow-xl rounded-2xl w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">MyHRM Accedi</h1>
        <input 
          type="email" placeholder="Email" 
          className="w-full p-2 mb-4 border rounded text-black"
          onChange={(e) => setEmail(e.target.value)}
        />
        <input 
          type="password" placeholder="Password" 
          className="w-full p-2 mb-6 border rounded text-black"
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex gap-2">
          <button 
            onClick={() => handleAuth('LOGIN')}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Accedi
          </button>
          <button 
            onClick={() => handleAuth('SIGNUP')}
            disabled={loading}
            className="flex-1 border border-blue-600 text-blue-600 py-2 rounded hover:bg-blue-50"
          >
            Registrati
          </button>
        </div>
      </div>
    </div>
  )
}