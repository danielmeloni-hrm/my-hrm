import Link from 'next/link';
import { LayoutDashboard, PlusCircle, History, User } from 'lucide-react';

export default function DashboardPage() {
  // Statistiche di esempio (le collegheremo al DB nel prossimo step)
  const stats = [
    { label: 'Ticket Aperti', value: '2', color: 'text-blue-600' },
    { label: 'In Lavorazione', value: '1', color: 'text-yellow-600' },
    { label: 'Risolti', value: '12', color: 'text-green-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Laterale */}
      <aside className="w-64 bg-white border-r hidden md:block">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600">MyHRM</h1>
        </div>
        <nav className="mt-6 space-y-1 px-4">
          <Link href="/" className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
            <LayoutDashboard className="mr-3 h-5 w-5" /> Dashboard
          </Link>
          <Link href="/nuovo-ticket" className="flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <PlusCircle className="mr-3 h-5 w-5" /> Nuovo Ticket
          </Link>
          <Link href="/i-miei-ticket" className="flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
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
          <div className="bg-white p-2 rounded-full border shadow-sm">
            <User className="h-6 w-6 text-gray-600" />
          </div>
        </header>

        {/* Griglia Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border">
              <p className="text-sm font-medium text-gray-500 uppercase">{stat.label}</p>
              <p className={`text-3xl font-bold mt-2 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Azioni Rapide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-600 p-6 rounded-xl text-white shadow-lg">
            <h3 className="text-xl font-semibold mb-2">Hai bisogno di assistenza?</h3>
            <p className="mb-4 opacity-90">Apri un nuovo ticket per buste paga, ferie o supporto tecnico.</p>
            <Link href="/nuovo-ticket" className="inline-block bg-white text-blue-600 px-6 py-2 rounded-lg font-bold hover:bg-blue-50 transition">
              Crea Richiesta
            </Link>
          </div>
          
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Ultime Comunicazioni</h3>
            <ul className="space-y-3">
              <li className="text-sm text-gray-600 border-b pb-2">📅 20 Feb - Aggiornamento polizza sanitaria disponibile</li>
              <li className="text-sm text-gray-600 border-b pb-2">📅 15 Feb - Caricamento CU 2026 completato</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}