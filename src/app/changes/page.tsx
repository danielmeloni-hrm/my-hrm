'use client';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';

export default function ChangesDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [changes, setChanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Stati per i filtri
  const [filterStato, setFilterStato] = useState<string>('');
  const [filterApp, setFilterApp] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>(''); // Barra di ricerca

  const APPLICATIVI_OPTIONS = ["APPECOM", "ECOM35", "EOL", "ESB", "IST35", "GCW", "Parafarmacia"];

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [emailText, setEmailText] = useState("");
  const fetchChanges = async () => {
    const { data } = await supabase
      .from('changes')
      .select('*')
      .order('rilascio_in_produzione', { ascending: false });
    if (data) setChanges(data);
    setLoading(false);
  };

  useEffect(() => { fetchChanges(); }, [supabase]);

  // --- LOGICA DI FILTRO (Il cuore del funzionamento) ---
  const filteredChanges = useMemo(() => {
    return changes.filter(chg => {
      const matchesStato = filterStato === '' || chg.stato === filterStato;
      
      // Filtro per applicativo (cerca nell'array)
      const matchesApp = filterApp === '' || (Array.isArray(chg.applicativo) && chg.applicativo.includes(filterApp));
      
      // Filtro ricerca testuale (opzionale)
      const matchesSearch = searchTerm === '' || 
        chg.breve_descrizione?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chg.change_id?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesStato && matchesApp && matchesSearch;
    });
  }, [changes, filterStato, filterApp, searchTerm]);

  // Aggiornamento campi (stessa logica di prima)
  const updateField = async (id: string, field: string, value: any) => {
    const { error } = await supabase.from('changes').update({ [field]: value }).eq('id', id);
    if (!error) setChanges(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

const toggleApplicativo = async (chg: any, app: string) => {
  // Specifichiamo che currentApps è un array di stringhe
  const currentApps: string[] = Array.isArray(chg.applicativo) ? chg.applicativo : [];
  
  // Ora TypeScript sa che 'a' è una stringa e non darà più errore
  const newApps = currentApps.includes(app) 
    ? currentApps.filter((a: string) => a !== app) 
    : [...currentApps, app];
  
  await updateField(chg.id, 'applicativo', newApps);
};
  const generatePreview = () => {
  const pendingChanges = filteredChanges.filter((chg: Change) => {
    const nota = chg.note_hrm?.toUpperCase() || "";
    return nota !== "COMPLETATA" && nota !== "CHIUSO SENZA TICKET PROD";
  });

  if (pendingChanges.length === 0) {
    alert("Nessuna change pendente trovata con i filtri attuali.");
    return;
  }

  const draft = pendingChanges.map((chg: Change) => {
    return `${chg.change_id}` + " - " + `${Array.isArray(chg.applicativo) ? chg.applicativo.join(", ") : "N/D"}\n` +
           `DESCRIZIONE: ${chg.breve_descrizione}\n` +
           `STATO: ${chg.stato}\n` +
           `------------------------------------------`;
  }).join("\n\n");

  const header = `REPORTE AGGIORNAMENTO CHANGE - ${new Date().toLocaleDateString('it-IT')}\n` +
                 `Elementi in elenco: ${pendingChanges.length}\n\n`;
  
  setEmailText(header + draft);
  setIsPreviewOpen(true);
};

  const stats = useMemo(() => {
  return {
    produzione: filteredChanges.filter(c => c.stato === 'In Produzione').length,
    collaudo: filteredChanges.filter(c => c.stato === 'In Collaudo').length,
    attesa: filteredChanges.filter(c => c.stato === 'In Attesa').length,
    totale: filteredChanges.length
  };
}, [filteredChanges]);

  if (loading) return <div className="p-10 text-center font-bold text-slate-500 uppercase">Caricamento...</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen pb-24">
      
      {/* SEZIONE TITOLO E FILTRI */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Gestione Change</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
              Visualizzate: {filteredChanges.length} di {changes.length}
            </p>
          </div>
          <div className="flex items-center gap-4">
  {/* Qui ci sono i tuoi select Stato e App */}
          
          <button 
            onClick={generatePreview}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-blue-600 transition-all shadow-md active:scale-95"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Anteprima Email
          </button>
          {isPreviewOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              
              {/* Header Modale */}
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                <h3 className="font-black text-slate-900 uppercase tracking-tight">Anteprima Bozza Email</h3>
                <button onClick={() => setIsPreviewOpen(false)} className="text-slate-400 hover:text-red-500 font-bold">✕</button>
              </div>

              {/* Corpo Email (Questa parte mancava nel tuo snippet) */}
              <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                <pre className="text-[11px] font-mono text-slate-700 whitespace-pre-wrap bg-white p-5 rounded-2xl border border-slate-200 shadow-inner">
                  {emailText}
                </pre>
              </div>

              {/* Footer (I tuoi bottoni sistemati) */}
              <div className="p-6 border-t border-slate-100 flex gap-3 bg-white">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(emailText);
                    alert("Copiato!");
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Copia negli appunti
                </button>
                <button 
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-6 py-3 bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-xs hover:bg-slate-300 transition-all"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
          {/* Barra di Ricerca Testuale */}
          <input 
            type="text"
            placeholder="Cerca ID o Descrizione..."
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* SEZIONE FILTRI + CONTATORI (Nello stesso rigo) */}
<div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-3 rounded-3xl shadow-sm border border-slate-200">
  
  {/* FILTRI (Allineati a sinistra) */}
  <div className="flex items-center gap-4">
    

    <div className="flex items-center gap-2 px-3">
      <span className="text-[10px] font-black text-slate-400 uppercase">Applicativo:</span>
      <select 
        value={filterApp}
        onChange={(e) => setFilterApp(e.target.value)}
        className="text-xs font-bold bg-transparent border-none outline-none text-slate-700 cursor-pointer"
      >
        <option value="">Tutti</option>
        {APPLICATIVI_OPTIONS.map(app => <option key={app} value={app}>{app}</option>)}
      </select>
    </div>
  </div>

  {/* CONTATORI NEL RETTANGOLO ROSSO (Allineati a destra) */}
  <div className="flex items-center gap-2">
    {/* Risultati Totali */}
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
      <span className="text-[10px] font-black text-slate-400 uppercase">Risultati:</span>
      <span className="text-sm font-black text-slate-900">{stats.totale}</span>
    </div>

    {/* In Produzione */}
    <button 
      onClick={() => setFilterStato(filterStato === 'In Produzione' ? '' : 'In Produzione')}
      className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all ${
        filterStato === 'In Produzione' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-300'
      }`}
    >
      <span className="text-[10px] font-black uppercase">Produzione</span>
      <span className="text-sm font-black">{stats.produzione}</span>
    </button>

    {/* In Collaudo */}
    <button 
      onClick={() => setFilterStato(filterStato === 'In Collaudo' ? '' : 'In Collaudo')}
      className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all ${
        filterStato === 'In Collaudo' ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-300'
      }`}
    >
      <span className="text-[10px] font-black uppercase">Collaudo</span>
      <span className="text-sm font-black">{stats.collaudo}</span>
    </button>

    {/* In Attesa */}
    <button 
      onClick={() => setFilterStato(filterStato === 'In Attesa' ? '' : 'In Attesa')}
      className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all ${
        filterStato === 'In Attesa' ? 'bg-sky-500 text-white border-sky-600' : 'bg-sky-50 text-sky-700 border-sky-100 hover:border-sky-300'
      }`}
    >
      <span className="text-[10px] font-black uppercase">Attesa</span>
      <span className="text-sm font-black">{stats.attesa}</span>
    </button>
  </div>
</div>
               
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-4 py-5 w-10 text-center">#</th>
              <th className="px-6 py-5">ID / Applicativi</th>
              <th className="px-6 py-5 w-1/3">Breve Descrizione</th>
              <th className="px-6 py-5">Stato</th>
              <th className="px-6 py-5 text-center">Data Prod</th>
              <th className="px-6 py-5 text-center">Ticket</th>
              <th className="px-6 py-5 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* MOLTO IMPORTANTE: Qui usiamo filteredChanges, 
               non l'array originale changes! 
            */}
            {filteredChanges.map((chg) => (
              <tr key={chg.id} className="hover:bg-slate-50/50 transition-all">
                <td className="px-4 py-4 text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(chg.id)} 
                    onChange={() => setSelectedIds(prev => prev.includes(chg.id) ? prev.filter(i => i !== chg.id) : [...prev, chg.id])} 
                    className="w-4 h-4 rounded accent-blue-600" 
                  />
                </td>
                
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-2">
                    <span className="font-mono font-bold text-blue-600 text-sm">{chg.change_id}</span>
                    <div className="flex flex-wrap gap-1">
                        {/* Badge esistenti - FIX: aggiunto tipo esplicito (app: string) */}
                        {Array.isArray(chg.applicativo) && chg.applicativo.map((app: string) => (
                          <span 
                            key={app} 
                            onClick={() => toggleApplicativo(chg, app)} 
                            className="px-2 py-0.5 bg-slate-800 text-white rounded text-[9px] font-black uppercase cursor-pointer hover:bg-red-500 transition-colors"
                          >
                            {app}
                          </span>
                        ))}
                        
                        {/* Tasto + per aggiungere */}
                        <div className="relative">
                          <select 
                            value="" 
                            onChange={(e) => toggleApplicativo(chg, e.target.value)}
                            className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold appearance-none outline-none cursor-pointer text-center hover:bg-blue-600 hover:text-white transition-all"
                          >
                            <option value="">+</option>
                            {APPLICATIVI_OPTIONS.map((opt: string) => (
                              <option key={opt} value={opt} disabled={chg.applicativo?.includes(opt)}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                  </div>
                </td>

                <td className="px-6 py-4">
                  <textarea 
                    rows={1}
                    className="w-full text-sm text-slate-700 bg-transparent border-none focus:ring-1 focus:ring-blue-100 rounded resize-none"
                    value={chg.breve_descrizione || ''}
                    onChange={(e) => updateField(chg.id, 'breve_descrizione', e.target.value)}
                  />
                </td>

                <td className="px-6 py-4">
                  <select 
                    value={chg.stato || ''}
                    onChange={(e) => updateField(chg.id, 'stato', e.target.value)}
                    className="text-[10px] font-black uppercase tracking-wider border rounded-full px-3 py-1 outline-none cursor-pointer"
                  >
                    <option value="In Attesa">In Attesa</option>
                    <option value="In Collaudo">In Collaudo</option>
                    <option value="In Produzione">In Produzione</option>
                  </select>
                </td>

                <td className="px-6 py-4 text-center">
                  <input 
                    type="date"
                    value={chg.rilascio_in_produzione || ''}
                    onChange={(e) => updateField(chg.id, 'rilascio_in_produzione', e.target.value)}
                    className="text-xs font-mono bg-slate-50 px-2 py-1 rounded border-none"
                  />
                </td>

                <td className="px-6 py-4">
                   <div className="flex justify-center gap-2">
                    <button onClick={() => updateField(chg.id, 'ticket_analisi', !chg.ticket_analisi)} className={`w-3 h-3 rounded-full ${chg.ticket_analisi ? 'bg-green-500' : 'bg-slate-200'}`} />
                    <button onClick={() => updateField(chg.id, 'ticket_test', !chg.ticket_test)} className={`w-3 h-3 rounded-full ${chg.ticket_test ? 'bg-blue-500' : 'bg-slate-200'}`} />
                    <button onClick={() => updateField(chg.id, 'ticket_rilascio', !chg.ticket_rilascio)} className={`w-3 h-3 rounded-full ${chg.ticket_rilascio ? 'bg-purple-500' : 'bg-slate-200'}`} />
                  </div>
                </td>

                <td className="px-6 py-4 text-right">
                  <Link href={`/changes/${chg.id}`} className="text-slate-400 hover:text-blue-600 font-bold">→</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

