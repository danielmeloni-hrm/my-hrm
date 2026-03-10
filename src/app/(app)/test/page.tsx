"use client";
import { useEffect, useState } from 'react';
import SublimeEmbed from '@/components/sublimeEmbed';
import { Terminal, Zap } from 'lucide-react';

export default function MonitorPage() {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // Recupera lo stesso ID usato nel note_board
    const storedId = localStorage.getItem('sublime_user_id');
    setUserId(storedId);
  }, []);

  if (!userId) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#121212] text-white">
        <p className="animate-pulse">Inizializzazione sessione...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] p-8 text-white font-sans">
      <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <Terminal className="text-amber-500" />
            SUBLIME LIVE MONITOR
          </h1>
          <p className="text-sm text-gray-400">Streaming in tempo reale dal tuo editor locale</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
          <Zap size={16} className="text-green-500" />
          <span className="text-xs font-mono opacity-70">ID: {userId}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto">
        <SublimeEmbed userId="user_zqpo01l" />
        
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-white/5 p-4 rounded-lg border border-white/5">
            <h3 className="text-[10px] font-bold uppercase text-amber-500 mb-1">Stato Server</h3>
            <p className="text-sm text-gray-300">Render Cloud: Online</p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg border border-white/5">
            <h3 className="text-[10px] font-bold uppercase text-amber-500 mb-1">Bridge Locale</h3>
            <p className="text-sm text-gray-300">In ascolto su .js</p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg border border-white/5">
            <h3 className="text-[10px] font-bold uppercase text-amber-500 mb-1">Latenza</h3>
            <p className="text-sm text-gray-300">~150ms (Real-time)</p>
          </div>
        </div>
      </main>
    </div>
  );
}