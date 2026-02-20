'use client'
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  User, 
  LogOut, 
  ChevronDown 
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);

  // Statistiche di esempio
  const stats = [
    { label: 'Ticket Aperti', value: '2', color: 'text-blue-600' },
    { label: 'In Lavorazione', value: '1', color: 'text-yellow-600' },
    { label: 'Risolti', value: '12', color: 'text-green-600' },
  ];

  // Funzione di Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex text-black">
      {/* Sidebar Laterale */}
      <aside className="w-64 bg-white border-r hidden md:block">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600">MyHRM</h1>
        </div>
        <nav className="mt-6 space-y-1 px-4">
          <Link href="/" className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium">
            <LayoutDashboard className="mr-3 h-5 w-5" /> Dashboard
          </Link>
          <Link href="/nuovo-ticket" className="flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
            <PlusCircle className="mr-3 h-5 w-5" /> Nuovo Ticket
          </Link>
          <Link href="/i-miei-ticket" className="flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
            <History className="mr-3 h-5 w-5" /> Storico
          </Link>
        </nav>
      </aside>

      {/* Contenuto Principale */}
      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Bentornato!</h2>
            <p className="text-gray-500">Ecco cosa sta succedendo con le tue richieste.</p>
          </div>

          {/* Menu Utente con Logout */}
          <div className="relative">
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 bg-white p-2 pr-4 rounded-full border shadow-sm hover:bg-gray-50 transition"
            >
              <div className="bg-blue-100 p-1.5 rounded-full">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow-xl p-2 z-50 animate-in fade-in zoom-in duration-150">
                <div className="px-4 py-2 mb-1 border-b">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Account</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition font-semibold"
                >
                  <LogOut size={16} />
                  Sconnetti
                </button>
              </div>
            )}
            
            {/* Overlay per chiudere il menu cliccando fuori */}
            {menuOpen && (
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setMenuOpen(false)}
              ></div>
            )}
          </div>
        </header>

        {/* Griglia Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">{stat.label}</p>
              <p className={`text-3xl font-bold mt-2 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Azioni Rapide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-600 p-8 rounded-2xl text-white shadow-lg relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="text-2xl font-bold mb-2">Hai bisogno di assistenza?</h3>
              <p className="mb-6 opacity-90 text-blue-50">Apri un nuovo ticket per buste paga, ferie o supporto tecnico.</p>
              <Link href="/nuovo-ticket" className="inline-flex items-center bg-white text-blue-600 px-8 py-3 rounded-xl font-bold hover:bg-blue-50 transition-all transform hover:scale-105 shadow-md">
                <PlusCircle className="mr-2 h-5 w-5" /> Crea Richiesta
              </Link>
            </div>
            {/* Decorazione estetica */}
            <div className="absolute -right-10 -bottom-10 bg-blue-500 w-40 h-40 rounded-full opacity-20 group-hover:scale-150 transition-transform duration-700"></div>
          </div>
          
          <div className="bg-white p-8 rounded-2xl border shadow-sm">
            <h3 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
              <History className="text-blue-500" /> Ultime Comunicazioni
            </h3>
            <ul className="space-y-4">
              <li className="flex gap-4 border-b border-gray-50 pb-4">
                <span className="text-blue-600 font-bold text-sm whitespace-nowrap">20 Feb</span>
                <p className="text-sm text-gray-600">Aggiornamento polizza sanitaria disponibile sul portale</p>
              </li>
              <li className="flex gap-4 border-b border-gray-50 pb-4">
                <span className="text-blue-600 font-bold text-sm whitespace-nowrap">15 Feb</span>
                <p className="text-sm text-gray-600">Caricamento CU 2026 completato: scaricabile da oggi</p>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}