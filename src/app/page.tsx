'use client'
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  User, 
  LogOut, 
  ChevronDown,
  ExternalLink,
  Clock,
  ArrowRight
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Recupero Ticket reali dal DB
  useEffect(() => {
    async function fetchTickets() {
      const { data, error } = await supabase
        .from('ticket')
        .select(`
          id, 
          titolo, 
          stato, 
          priorita, 
          creato_at,
          clienti (nome)
        `)
        .order('creato_at', { ascending: false }) // Corretto qui
        .limit(5);

      if (!error && data) setRecentTickets(data);
      setLoading(false);
    }
    fetchTickets();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex text-black">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r hidden md:block">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600 tracking-tight">MyHRM</h1>
        </div>
        <nav className="mt-6 space-y-1 px-4">
          <Link href="/" className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-bold transition">
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

      {/* Main Content */}
      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900">Dashboard</h2>
            <p className="text-gray-500 font-medium">Monitora lo stato delle tue attività operative.</p>
          </div>

          {/* User Menu */}
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 bg-white p-2 pr-4 rounded-full border shadow-sm hover:shadow-md transition">
              <div className="bg-blue-600 p-1.5 rounded-full text-white">
                <User size={18} />
              </div>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-bold">
                  <LogOut size={16} /> Sconnetti
                </button>
              </div>
            )}
            {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}></div>}
          </div>
        </header>

        {/* Lista Ticket Recenti (Ciccabili) */}
        <section className="mb-10">
          <div className="flex justify-between items-end mb-6">
            <h3 className="text-xl font-bold text-gray-800">Attività Recenti</h3>
            <Link href="/i-miei-ticket" className="text-sm text-blue-600 font-bold hover:underline flex items-center gap-1">
              Vedi tutti <ArrowRight size={14}/>
            </Link>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Caricamento attività...</div>
            ) : recentTickets.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {recentTickets.map((t) => (
                  <Link 
                    key={t.id} 
                    href={`/ticket/${t.id}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition group"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{t.clienti?.nome}</span>
                      <span className="text-base font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{t.titolo}</span>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                         <span className="flex items-center gap-1"><Clock size={12}/> {new Date(t.created_at).toLocaleDateString()}</span>
                         <span className={`font-bold ${t.priorita === 'Urgente' ? 'text-red-500' : 'text-gray-500'}`}>• {t.priorita}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100">
                        {t.stato || 'Aperto'}
                      </span>
                      <ExternalLink size={18} className="text-gray-300 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center">
                <p className="text-gray-400 font-medium">Nessun ticket trovato.</p>
                <Link href="/nuovo-ticket" className="text-blue-600 font-bold mt-2 inline-block">Creane uno ora</Link>
              </div>
            )}
          </div>
        </section>

        {/* Azione Rapida */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 rounded-2xl text-white shadow-lg flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-bold mb-1">Hai una nuova attività?</h3>
            <p className="opacity-90 font-medium">Registra subito un nuovo ticket operativo per il team.</p>
          </div>
          <Link href="/nuovo-ticket" className="bg-white text-blue-600 px-8 py-3 rounded-xl font-bold hover:bg-blue-50 transition shadow-md">
            Nuovo Ticket
          </Link>
        </div>
      </main>
    </div>
  );
}