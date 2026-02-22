import { createClient } from '@/lib/supabase';
import Link from 'next/link';

export default async function ChangesDashboard() {
  const supabase = createClient();

  // Recuperiamo tutti i campi necessari dalla tabella 'changes'
  const { data: changes, error } = await supabase
    .from('changes')
    .select('*')
    .order('data_creazione', { ascending: false });

  if (error) return <div className="p-6 text-red-500">Errore caricamento dati: {error.message}</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans">
      {/* Header Statistiche */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">CHANGES LOG</h1>
          <p className="text-slate-500 font-medium">Monitoraggio evolutive e rilasci applicativi</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 text-center min-w-[100px]">
            <p className="text-[10px] text-slate-400 uppercase font-bold">Totali</p>
            <p className="text-xl font-black text-slate-800">{changes?.length}</p>
          </div>
          <div className="bg-green-50 p-3 rounded-xl shadow-sm border border-green-100 text-center min-w-[100px]">
            <p className="text-[10px] text-green-400 uppercase font-bold">In Prod</p>
            <p className="text-xl font-black text-green-700">
              {changes?.filter(c => c.stato === 'In Produzione').length}
            </p>
          </div>
        </div>
      </div>

      {/* Tabella Principale */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">ID / Tag</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Applicativo</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Descrizione</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Stato</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Rilascio</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {changes?.map((chg) => (
                <tr key={chg.id} className="hover:bg-slate-50/80 transition-all group">
                  {/* ID Change */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-mono font-bold text-blue-600 text-sm">
                        {chg.change_id || 'N/D'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {chg.ticket_ref || 'Nessun Tag'}
                      </span>
                    </div>
                  </td>

                  {/* Applicativo */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      {chg.applicativo || 'GENERIC'}
                    </span>
                  </td>

                  {/* Descrizione */}
                  <td className="px-6 py-4 max-w-md">
                    <p className="text-sm text-slate-700 font-medium line-clamp-1 group-hover:line-clamp-none transition-all">
                      {chg.breve_descrizione}
                    </p>
                  </td>

                  {/* Stato con Colore Dinamico */}
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(chg.stato)}`}>
                      {chg.stato}
                    </span>
                  </td>

                  {/* Date di Rilascio */}
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Prod</span>
                      <span className="text-xs font-mono text-slate-600">
                        {chg.rilascio_in_produzione || '---'}
                      </span>
                    </div>
                  </td>

                  {/* Tasto Dettaglio */}
                  <td className="px-6 py-4 text-right">
                    <Link 
                      href={`/changes/${chg.id}`}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all shadow-sm"
                    >
                      <span className="text-lg">→</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Funzione per mappare gli stati ai colori (basata sul CSV)
function getStatusColor(stato: string) {
  const s = stato?.toLowerCase();
  if (s?.includes('produzione')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (s?.includes('collaudo')) return 'bg-amber-50 text-amber-700 border-amber-100';
  if (s?.includes('annullata')) return 'bg-rose-50 text-rose-700 border-rose-100';
  if (s?.includes('attesa')) return 'bg-sky-50 text-sky-700 border-sky-100';
  return 'bg-slate-50 text-slate-500 border-slate-200';
}