'use client';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';

interface Change {
  id: string;
  change_id: string;
  tipo_change?: 'Regressione' | 'Impattante' | 'Richiesta dal Business' | 'Non_impattante' | string; // ✅
  breve_descrizione?: string;
  applicativo?: string[];
  stato?: string;
  rilascio_in_produzione?: string;
  data_collaudo?: string;
  ticket_analisi?: boolean;
  ticket_test?: boolean;
  ticket_rilascio?: boolean;
  note_hrm?: string;
  [key: string]: any;
}

const TIPO_CHANGE_OPTIONS = ['Regressione', 'Impattante', 'Richiesta dal Business', 'Non_impattante'] as const;

export default function ChangesDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [filterStato, setFilterStato] = useState<string>('');
  const [filterApp, setFilterApp] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // ✅ filtro tipo change
  const [filterTipoChange, setFilterTipoChange] = useState<string>('');

  const [filterAnalisi, setFilterAnalisi] = useState<boolean | null>(null);
  const [filterTest, setFilterTest] = useState<boolean | null>(null);
  const [filterRilascio, setFilterRilascio] = useState<boolean | null>(null);

  // STATO PER PERSONALIZZAZIONE COLONNE
  const [showColSettings, setShowColSettings] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    idApp: true,
    tipoChange: true, // ✅ NEW
    descrizione: true,
    info: true,
    stato: true,
    collaudo: true,
    produzione: true,
    ticket: true,
  });

  const APPLICATIVI_OPTIONS = ['APPECOM', 'ECOM35', 'EOL', 'ESB', 'IST35', 'GCW', 'Parafarmacia'];
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [emailText, setEmailText] = useState('');

  const fetchChanges = async () => {
    const { data } = await supabase.from('changes').select('*').order('rilascio_in_produzione', { ascending: false });
    if (data) setChanges(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchChanges();
  }, [supabase]);

  const filteredChanges = useMemo(() => {
    return changes.filter((chg) => {
      const matchesStato = filterStato === '' || chg.stato === filterStato;
      const matchesApp = filterApp === '' || (Array.isArray(chg.applicativo) && chg.applicativo.includes(filterApp));
      const matchesSearch =
        searchTerm === '' ||
        chg.breve_descrizione?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chg.change_id?.toLowerCase().includes(searchTerm.toLowerCase());

      // ✅ filtro Tipo Change (esatto)
      const matchesTipo = filterTipoChange === '' || (chg.tipo_change || '') === filterTipoChange;

      const matchesAnalisi = filterAnalisi === null || chg.ticket_analisi === filterAnalisi;
      const matchesTest = filterTest === null || chg.ticket_test === filterTest;
      const matchesRilascio = filterRilascio === null || chg.ticket_rilascio === filterRilascio;

      return matchesStato && matchesApp && matchesSearch && matchesTipo && matchesAnalisi && matchesTest && matchesRilascio;
    });
  }, [changes, filterStato, filterApp, searchTerm, filterTipoChange, filterAnalisi, filterTest, filterRilascio]);

  const updateField = async (id: string, field: string, value: any) => {
    const { error } = await supabase.from('changes').update({ [field]: value }).eq('id', id);
    if (!error) setChanges((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const toggleApplicativo = async (chg: Change, app: string) => {
    const currentApps: string[] = Array.isArray(chg.applicativo) ? chg.applicativo : [];
    const newApps = currentApps.includes(app) ? currentApps.filter((a: string) => a !== app) : [...currentApps, app];
    await updateField(chg.id, 'applicativo', newApps);
  };

  const generatePreview = () => {
  const selectedChanges = filteredChanges.filter((chg: Change) => selectedIds.includes(chg.id));
  if (selectedChanges.length === 0) {
    alert("Seleziona almeno una riga tramite checkbox.");
    return;
  }

  const TYPE_ORDER = ["Regressione", "Impattante", "Richiesta dal Business", "Non_impattante"] as const;

  const norm = (s?: string) => (s || "").trim();

  // date: se vuoi formato diverso, cambia qui
  const fmtDate = (d?: string) => (d && String(d).trim() ? String(d).trim() : "");
  const fmtColl = (chg: Change) => `coll ${fmtDate(chg.data_collaudo)}`;
  const fmtProd = (chg: Change) => `prod ${fmtDate(chg.rilascio_in_produzione)}`;

  // descrizione "pulita" su una riga (niente newline)
  const fmtDesc = (s?: string) => {
    const t = norm(s);
    if (!t) return "—";
    return t.replace(/\s+/g, " ");
  };

  // key per ordinamento (mettiamo N/D in fondo)
  const timeOrMax = (d?: string) => {
    const t = norm(d);
    if (!t) return Number.MAX_SAFE_INTEGER;
    const dt = new Date(t);
    const ms = dt.getTime();
    return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
  };

  // espande: se più applicativi -> duplica
  const expandRows = (chg: Change) => {
    const apps =
      Array.isArray(chg.applicativo) && chg.applicativo.length > 0
        ? chg.applicativo
        : ["N/D"];

    return apps.map((app) => ({
      tipo: norm(chg.tipo_change) || "Non_impattante",
      prodMs: timeOrMax(chg.rilascio_in_produzione),
      collMs: timeOrMax(chg.data_collaudo),
      changeId: norm(chg.change_id),
      app: norm(app) || "N/D",
      line: `• ${norm(chg.change_id)} | ${norm(app) || "N/D"} | ${fmtColl(chg)} | ${fmtProd(chg)} | ${fmtDesc(chg.breve_descrizione)}`,
    }));
  };

  const rows = selectedChanges.flatMap(expandRows);

  // raggruppo per tipo
  const byType = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byType.has(r.tipo)) byType.set(r.tipo, []);
    byType.get(r.tipo)!.push(r);
  }

  // build sezioni nell'ordine richiesto, omettendo quelle vuote
  const sections: string[] = [];

  const pushSection = (tipo: string, list: typeof rows) => {
    if (!list || list.length === 0) return;

    // ordina: prima prod (più recente sopra), poi collaudo (più recente sopra), poi changeId/app
    list.sort((a, b) => {
  const numA = parseInt(a.changeId.replace(/\D/g, "")) || 0;
  const numB = parseInt(b.changeId.replace(/\D/g, "")) || 0;

  if (numA !== numB) return numA - numB;

  return a.app.localeCompare(b.app, "it");
});

    sections.push([tipo, ...list.map((x) => x.line)].join("\n"));
  };

  for (const t of TYPE_ORDER) {
    pushSection(t, byType.get(t) || []);
  }

  // eventuali tipi fuori lista (non dovrebbero esserci, ma li gestiamo)
  const extra = Array.from(byType.keys()).filter((t) => !TYPE_ORDER.includes(t as any));
  extra.sort((a, b) => a.localeCompare(b, "it"));
  for (const t of extra) pushSection(t, byType.get(t) || []);

  const header = `REPORT CHANGE SELEZIONATE - ${new Date().toLocaleDateString("it-IT")}`;
  setEmailText(`${header}\n\n${sections.join("\n\n")}`);
  setIsPreviewOpen(true);
};

  const stats = useMemo(
    () => ({
      produzione: filteredChanges.filter((c) => c.stato === 'In Produzione').length,
      collaudo: filteredChanges.filter((c) => c.stato === 'In Collaudo').length,
      attesa: filteredChanges.filter((c) => c.stato === 'In Attesa').length,
      regressione: filteredChanges.filter((c) => c.stato === 'In Produzione + Regressione').length,
    }),
    [filteredChanges]
  );

  if (loading) return <div className="p-10 text-center font-bold text-slate-500 uppercase animate-pulse">Caricamento...</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen pb-24 text-slate-900">
      {/* HEADER E FILTRI */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Gestione Change</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
              Filtri attivi: {filteredChanges.length} / {changes.length}
            </p>
          </div>
          <div className="flex gap-2 relative">
            <button
              onClick={() => setShowColSettings(!showColSettings)}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
            >
              ⚙️ Colonne
            </button>

            {showColSettings && (
              <div className="absolute top-12 right-0 w-52 bg-white border border-slate-200 shadow-xl rounded-2xl p-4 z-[110] flex flex-col gap-2">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Visibilità Colonne</p>
                {Object.keys(visibleCols).map((col) => (
                  <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors">
                    <input
                      type="checkbox"
                      checked={visibleCols[col as keyof typeof visibleCols]}
                      onChange={() =>
                        setVisibleCols((prev) => ({ ...prev, [col]: !prev[col as keyof typeof visibleCols] }))
                      }
                      className="accent-blue-600 w-3 h-3"
                    />
                    <span className="text-[10px] font-bold uppercase text-slate-600">{col}</span>
                  </label>
                ))}
              </div>
            )}

            <button
              onClick={generatePreview}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-blue-600 transition-all shadow-lg"
            >
              Anteprima Email
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-200">
          <input
            type="text"
            placeholder="Cerca ID o Descrizione..."
            className="px-4 py-2 rounded-xl border border-slate-100 text-xs outline-none focus:ring-2 focus:ring-blue-500 w-64 bg-slate-50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            value={filterApp}
            onChange={(e) => setFilterApp(e.target.value)}
            className="text-[10px] font-black uppercase bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 outline-none cursor-pointer"
          >
            <option value="">Tutte le App</option>
            {APPLICATIVI_OPTIONS.map((app) => (
              <option key={app} value={app}>
                {app}
              </option>
            ))}
          </select>

          {/* ✅ FILTRO TIPO CHANGE */}
          <select
            value={filterTipoChange}
            onChange={(e) => setFilterTipoChange(e.target.value)}
            className="text-[10px] font-black uppercase bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 outline-none cursor-pointer min-w-[200px]"
            title="Filtra per Tipo Change"
          >
            <option value="">Tutti i tipi</option>
            {TIPO_CHANGE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
            <button
              onClick={() => setFilterAnalisi(filterAnalisi === true ? null : true)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                filterAnalisi === true ? 'bg-green-500 text-white' : 'text-slate-400 hover:bg-slate-200'
              }`}
            >
              Analisi
            </button>
            <button
              onClick={() => setFilterTest(filterTest === true ? null : true)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                filterTest === true ? 'bg-blue-500 text-white' : 'text-slate-400 hover:bg-slate-200'
              }`}
            >
              Test
            </button>
            <button
              onClick={() => setFilterRilascio(filterRilascio === true ? null : true)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                filterRilascio === true ? 'bg-purple-500 text-white' : 'text-slate-400 hover:bg-slate-200'
              }`}
            >
              Rilascio
            </button>
          </div>

          <div className="flex-1" />

          <div className="flex gap-2">
            {Object.entries(stats).map(([key, val]) => (
              <button
                key={key}
                onClick={() =>
                  setFilterStato(
                    filterStato.toLowerCase().includes(key)
                      ? ''
                      : key === 'produzione'
                      ? 'In Produzione'
                      : key === 'collaudo'
                      ? 'In Collaudo'
                      : key === 'regressione'
                      ? 'In Produzione + Regressione'
                      : 'In Attesa'
                  )
                }
                className={`px-3 py-2 rounded-2xl border text-[9px] font-black uppercase transition-all ${
                  filterStato.toLowerCase().includes(key)
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {key}: {val}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TABELLA */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-4 py-5 w-10 text-center">#</th>
              {visibleCols.idApp && <th className="px-6 py-5 w-44">ID / Applicativi</th>}
              {visibleCols.tipoChange && <th className="px-6 py-5 w-56">Tipo Change</th>}
              {visibleCols.descrizione && <th className="px-6 py-5">Breve Descrizione</th>}
              {visibleCols.info && <th className="px-6 py-5 ">Info</th>}
              {visibleCols.stato && <th className="px-6 py-5 w-40">Stato</th>}
              {visibleCols.collaudo && <th className="px-6 py-5 text-center w-40">Rilascio in Collaudo</th>}
              {visibleCols.produzione && <th className="px-6 py-5 text-center w-40">Rilascio in Produzione</th>}
              {visibleCols.ticket && <th className="px-6 py-5 text-center w-40">Ticket</th>}
              <th className="px-6 py-5 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredChanges.map((chg) => (
              <tr key={chg.id} className="hover:bg-slate-50/50 transition-all">
                <td className="px-4 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(chg.id)}
                    onChange={() =>
                      setSelectedIds((prev) =>
                        prev.includes(chg.id) ? prev.filter((i) => i !== chg.id) : [...prev, chg.id]
                      )
                    }
                    className="accent-blue-600 cursor-pointer"
                  />
                </td>

                {visibleCols.idApp && (
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono font-bold text-blue-600 text-xs tracking-tight">{chg.change_id}</span>
                      <div className="flex flex-wrap gap-1">
                        {chg.applicativo?.map((app: string) => (
                          <span
                            key={app}
                            onClick={() => toggleApplicativo(chg, app)}
                            className="px-1.5 py-0.5 bg-slate-800 text-white rounded text-[7px] font-black uppercase cursor-pointer hover:bg-red-500 transition-colors"
                          >
                            {app}
                          </span>
                        ))}
                        <select
                          value=""
                          onChange={(e) => toggleApplicativo(chg, e.target.value)}
                          className="w-4 h-4 bg-slate-200 rounded-full text-[8px] font-bold outline-none cursor-pointer text-center hover:bg-slate-300"
                        >
                          <option value="">+</option>
                          {APPLICATIVI_OPTIONS.map((opt) => (
                            <option key={opt} value={opt} disabled={chg.applicativo?.includes(opt)}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </td>
                )}

                {/* ✅ TIPO CHANGE: SELECT con valori fissi */}
                {visibleCols.tipoChange && (
                  <td className="px-6 py-4">
                    <select
                      value={chg.tipo_change || ''}
                      onChange={(e) => updateField(chg.id, 'tipo_change', e.target.value)}
                      className="text-[9px] font-black uppercase border border-slate-200 rounded-full px-3 py-1.5 outline-none bg-white shadow-sm w-full cursor-pointer"
                    >
                      <option value="">—</option>
                      {TIPO_CHANGE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                )}

                {visibleCols.descrizione && (
                  <td className="px-6 py-4">
                    <textarea
                      rows={1}
                      className="w-full text-xs text-slate-700 bg-transparent border-none focus:ring-1 focus:ring-blue-100 rounded resize-none p-1 min-h-[32px]"
                      value={chg.breve_descrizione || ''}
                      onChange={(e) => updateField(chg.id, 'breve_descrizione', e.target.value)}
                    />
                  </td>
                )}

                {visibleCols.info && (
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      value={chg.note_hrm || ''}
                      onChange={(e) => updateField(chg.id, 'note_hrm', e.target.value)}
                      placeholder="Note HRM..."
                      className="w-full text-xs text-slate-700 bg-transparent border-none focus:ring-1 focus:ring-blue-100 rounded p-1 min-h-[32px]"
                    />
                  </td>
                )}

                {visibleCols.stato && (
                  <td className="px-6 py-4">
                    <select
                      value={chg.stato || ''}
                      onChange={(e) => updateField(chg.id, 'stato', e.target.value)}
                      className="text-[9px] font-black uppercase border rounded-full px-3 py-1.5 outline-none bg-white shadow-sm w-full cursor-pointer"
                    >
                      <option value="In Attesa">In Attesa</option>
                      <option value="In Collaudo">In Collaudo</option>
                      <option value="In Produzione">In Produzione</option>
                      <option value="In Produzione + Regressione">In Produzione + Regressione</option>
                    </select>
                  </td>
                )}

                {visibleCols.collaudo && (
                  <td className="px-6 py-4 text-center">
                    <input
                      type="date"
                      value={chg.data_collaudo || ''}
                      onChange={(e) => updateField(chg.id, 'data_collaudo', e.target.value)}
                      className="text-[10px] font-mono bg-amber-50 px-2 py-1 rounded border border-amber-100 text-amber-700"
                    />
                  </td>
                )}

                {visibleCols.produzione && (
                  <td className="px-6 py-4 text-center">
                    <input
                      type="date"
                      value={chg.rilascio_in_produzione || ''}
                      onChange={(e) => updateField(chg.id, 'rilascio_in_produzione', e.target.value)}
                      className="text-[10px] font-mono bg-emerald-50 px-2 py-1 rounded border border-emerald-100 text-emerald-700"
                    />
                  </td>
                )}

                {visibleCols.ticket && (
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-1.5">
                      {['Analisi', 'Test', 'Rilascio'].map((label) => {
                        const field = `ticket_${label.toLowerCase()}`;
                        const active = chg[field];
                        const colors =
                          label === 'Analisi' ? 'bg-green-500' : label === 'Test' ? 'bg-blue-500' : 'bg-purple-500';
                        return (
                          <button
                            key={label}
                            title={label}
                            onClick={() => updateField(chg.id, field, !active)}
                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                              active ? `${colors} border-transparent text-white` : 'bg-transparent border-slate-200 text-slate-300'
                            }`}
                          >
                            <span className="text-[9px] font-black">{label[0].toUpperCase()}</span>
                          </button>
                        );
                      })}
                    </div>
                  </td>
                )}

                <td className="px-6 py-4 text-right">
                  <Link href={`/changes/${chg.id}`} className="p-2 hover:bg-slate-100 rounded-full inline-block transition-colors">
                    <span className="text-slate-400 hover:text-blue-600 font-bold">→</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODALE ANTEPRIMA */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h3 className="font-black text-slate-900 uppercase tracking-tight">Anteprima Report</h3>
              <button onClick={() => setIsPreviewOpen(false)} className="text-slate-400 hover:text-red-500 font-bold text-xl">
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
              <pre className="text-[11px] font-mono text-slate-700 whitespace-pre-wrap bg-white p-5 rounded-2xl border border-slate-200 shadow-inner">
                {emailText}
              </pre>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 bg-white">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(emailText);
                  alert('Copiato!');
                }}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-xs hover:bg-blue-700 transition-all"
              >
                Copia negli appunti
              </button>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="px-6 py-3 bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-xs hover:bg-slate-300 transition-all"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}