import { createClient } from '@/lib/supabase';

export default async function ChangeDetail({ params }: { params: { id: string } }) {
  // 2. Inizializza il client Supabase all'interno del Server Component
  const supabase = createClient();

  // 3. Esegui la query con il join sui ticket
  const { data: change, error } = await supabase
    .from('changes')
    .select(`
      *,
      ticket (
        n_tag,
        ultimo_ping,
        aggiornamento_storia
      )
    `)
    .eq('id', params.id)
    .single();

  // Gestione errori
  if (error || !change) {
    return <div className="p-8 text-red-500">Errore: Change non trovata o problema di connessione.</div>;
  }
  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header Dettaglio */}
      <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-blue-500 mb-6">
        <div className="flex justify-between">
          <h2 className="text-3xl font-extrabold text-gray-900">{change.breve_descrizione}</h2>
          <p className="text-xl text-gray-400">{change.change_id}</p>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mt-6 border-t pt-4">
          <div>
            <p className="text-xs text-gray-400 uppercase">Applicativo</p>
            <p className="font-bold">{change.applicativo}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Tipo Attività</p>
            <p className="font-bold">{change.tipo_di_evolutiva}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Data Creazione</p>
            <p className="font-bold">{new Date(change.data_creazione).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Ticket Collegati */}
      <div className="mt-10">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Ticket Correlati (Automazione Outlook)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {change.ticket?.map((t: any) => (
            <div key={t.n_tag} className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono font-bold text-blue-800">{t.n_tag}</span>
                <span className="text-[10px] text-gray-500 italic">
                  Ping: {t.ultimo_ping ? new Date(t.ultimo_ping).toLocaleTimeString() : 'No data'}
                </span>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">
                {t.aggiornamento_storia || "Nessun log registrato via mail."}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}