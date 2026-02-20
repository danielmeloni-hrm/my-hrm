'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NuovoTicketPage() {
  const [titolo, setTitolo] = useState('')
  const [categoria, setCategoria] = useState('Busta Paga')
  const [descrizione, setDescrizione] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Recuperiamo l'utente attuale
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      alert("Devi essere loggato per inviare un ticket")
      return
    }

    const { error } = await supabase.from('ticket').insert([
      { 
        utente_id: user.id, 
        titolo, 
        descrizione, 
        categoria,
        stato: 'Aperto'
      }
    ])

    if (error) alert(error.message)
    else {
      alert("Ticket inviato con successo!")
      router.push('/')
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-black">Apri un Nuovo Ticket</h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow border">
        <div>
          <label className="block text-sm font-medium text-gray-700">Titolo</label>
          <input 
            required
            className="w-full p-2 border rounded text-black"
            onChange={(e) => setTitolo(e.target.value)} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Categoria</label>
          <select 
            className="w-full p-2 border rounded text-black"
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option>Busta Paga</option>
            <option>Ferie</option>
            <option>Hardware</option>
            <option>Altro</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Descrizione</label>
          <textarea 
            required
            className="w-full p-2 border rounded text-black h-32"
            onChange={(e) => setDescrizione(e.target.value)}
          />
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">
          Invia Richiesta
        </button>
      </form>
    </div>
  )
}