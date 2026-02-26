'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';

interface Change {
  id: string;
  change_id: string;
  breve_descrizione?: string;

  // sprint: "sprint" | "opex"
  sprint?: 'sprint' | 'opex' | null;

  // FK -> profili.id
  assignee?: string | null;

  // ordinamento
  numero_priorita?: number;

  // evidenza
  in_lavorazione_ora?: boolean;

  // join profili
  profili?: { nome_completo?: string | null } | null;

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

type AssigneeKey = string; // "unassigned" | actual uuid string

export default function ChangesDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [filterStato, setFilterStato] = useState<string>('');
  const [filterApp, setFilterApp] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [filterAnalisi, setFilterAnalisi] = useState<boolean | null>(null);
  const [filterTest, setFilterTest] = useState<boolean | null>(null);
  const [filterRilascio, setFilterRilascio] = useState<boolean | null>(null);

  const APPLICATIVI_OPTIONS = ['APPECOM', 'ECOM35', 'EOL', 'ESB', 'IST35', 'GCW', 'Parafarmacia'];

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [emailText, setEmailText] = useState('');

  const fetchChanges = async () => {
    // ✅ Se la relazione non funziona, prova a cambiare la riga profili:assignee in profili(nome_completo)
    const { data, error } = await supabase
      .from('changes')
      .select(
        `
        *,
        profili:assignee ( nome_completo )
      `
      )
      .order('numero_priorita', { ascending: true });

    if (!error && data) setChanges(data as Change[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const filteredChanges = useMemo(() => {
    return changes.filter((chg) => {
      const matchesStato = filterStato === '' || chg.stato === filterStato;
      const matchesApp =
        filterApp === '' || (Array.isArray(chg.applicativo) && chg.applicativo.includes(filterApp));
      const matchesSearch =
        searchTerm === '' ||
        chg.breve_descrizione?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chg.change_id?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAnalisi = filterAnalisi === null || chg.ticket_analisi === filterAnalisi;
      const matchesTest = filterTest === null || chg.ticket_test === filterTest;
      const matchesRilascio = filterRilascio === null || chg.ticket_rilascio === filterRilascio;

      return matchesStato && matchesApp && matchesSearch && matchesAnalisi && matchesTest && matchesRilascio;
    });
  }, [changes, filterStato, filterApp, searchTerm, filterAnalisi, filterTest, filterRilascio]);

  const updateField = async (id: string, field: string, value: any) => {
    const { error } = await supabase.from('changes').update({ [field]: value }).eq('id', id);
    if (!error) setChanges((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const toggleApplicativo = async (chg: Change, app: string) => {
    const currentApps: string[] = Array.isArray(chg.applicativo) ? chg.applicativo : [];
    const newApps = currentApps.includes(app) ? currentApps.filter((a) => a !== app) : [...currentApps, app];
    await updateField(chg.id, 'applicativo', newApps);
  };

  const generatePreview = () => {
    const selectedChanges = filteredChanges.filter((chg) => selectedIds.includes(chg.id));
    if (selectedChanges.length === 0) {
      alert('Seleziona almeno una attività (checkbox).');
      return;
    }

    const draft = selectedChanges
      .map((chg) => {
        const flags = [chg.ticket_analisi ? '[A]' : '', chg.ticket_test ? '[T]' : '', chg.ticket_rilascio ? '[R]' : '']
          .filter(Boolean)
          .join(' ');

        return (
          `${chg.change_id} ${flags} - ${Array.isArray(chg.applicativo) ? chg.applicativo.join(', ') : 'N/D'}\n` +
          `DESCRIZIONE: ${chg.breve_descrizione || 'N/D'}\n` +
          `STATO: ${chg.stato || 'N/D'}\n` +
          `COLLAUDO: ${chg.data_collaudo || 'N/D'}\n` +
          `PRODUZIONE: ${chg.rilascio_in_produzione || 'N/D'}\n` +
          `ASSEGNATARIO: ${chg.profili?.nome_completo || 'Senza Assegnatario'}\n` +
          `------------------------------------------`
        );
      })
      .join('\n\n');

    setEmailText(`REPORT CHANGE SELEZIONATE - ${new Date().toLocaleDateString('it-IT')}\n\n` + draft);
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

  // ✅ Board: solo sprint === "sprint"
  const sprintChanges = useMemo(() => filteredChanges.filter((c) => c.sprint === 'sprint'), [filteredChanges]);

  // ✅ Raggruppo per assignee id (più solido), visualizzo nome_completo
  const assigneeColumns = useMemo(() => {
    const map = new Map<AssigneeKey, { key: AssigneeKey; name: string; items: Change[] }>();

    const keyOf = (c: Change): AssigneeKey => (c.assignee ? String(c.assignee) : 'unassigned');
    const nameOf = (c: Change): string => (c.profili?.nome_completo || 'Senza Assegnatario').trim();

    for (const c of sprintChanges) {
      const k = keyOf(c);
      if (!map.has(k)) map.set(k, { key: k, name: nameOf(c), items: [] });
      map.get(k)!.items.push(c);
    }

    // ordino le colonne per nome
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sprintChanges]);

  if (loading) {
    return (
      <div className="p-10 text-center font-bold text-slate-500 uppercase animate-pulse">
        Caricamento...
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen pb-24 text-slate-900">
      {/* HEADER E FILTRI */}
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Gestione Change</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
              Filtri attivi: {filteredChanges.length} / {changes.length} — Sprint: {sprintChanges.length}
            </p>
          </div>

          <div className="flex gap-2">
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

      {/* BOARD PER DIPENDENTE */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {assigneeColumns.length === 0 ? (
          <div className="w-full bg-white border border-slate-200 rounded-3xl p-8 text-center text-slate-500 font-bold">
            Nessuna attività con sprint = "sprint".
          </div>
        ) : (
          assigneeColumns.map((col) => (
            <EmployeeColumn
              key={col.key}
              supabase={supabase}
              title={col.name}
              assigneeKey={col.key}
              allForAssignee={col.items}
              setChanges={setChanges}
              updateField={updateField}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              toggleApplicativo={toggleApplicativo}
              applicativiOptions={APPLICATIVI_OPTIONS}
            />
          ))
        )}
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

function EmployeeColumn({
  title,
  assigneeKey,
  allForAssignee,
  supabase,
  setChanges,
  updateField,
  selectedIds,
  setSelectedIds,
  toggleApplicativo,
  applicativiOptions,
}: {
  title: string;
  assigneeKey: AssigneeKey; // "unassigned" or uuid
  allForAssignee: Change[];
  supabase: any;
  setChanges: React.Dispatch<React.SetStateAction<Change[]>>;
  updateField: (id: string, field: string, value: any) => Promise<void>;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleApplicativo: (chg: Change, app: string) => Promise<void>;
  applicativiOptions: string[];
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const working = useMemo(
    () => allForAssignee.filter((c) => c.in_lavorazione_ora).sort((a, b) => (a.numero_priorita ?? 0) - (b.numero_priorita ?? 0)),
    [allForAssignee]
  );

  const notWorking = useMemo(
    () => allForAssignee.filter((c) => !c.in_lavorazione_ora).sort((a, b) => (a.numero_priorita ?? 0) - (b.numero_priorita ?? 0)),
    [allForAssignee]
  );

  const computePriority = (list: Change[], dropIndex: number, draggingIdLocal: string) => {
    const base = list.filter((x) => x.id !== draggingIdLocal);
    if (base.length === 0) return 0;

    // dropIndex: 0 = sopra al primo
    if (dropIndex <= 0) {
      const minP = Math.min(...base.map((x) => x.numero_priorita ?? 0));
      return minP - 1;
    }

    // drop in mezzo: prendi la "precedente" e fai -1
    if (dropIndex < base.length) {
      const prev = base[dropIndex - 1];
      return (prev?.numero_priorita ?? 0) - 1;
    }

    // drop in fondo: metti dopo l'ultimo
    const maxP = Math.max(...base.map((x) => x.numero_priorita ?? 0));
    return maxP + 1;
  };

  const applyMove = async (changeId: string, targetList: Change[], dropIndex: number) => {
    const newPriority = computePriority(targetList, dropIndex, changeId);

    // se droppo su una colonna con assignee diverso, assegno anche l'assignee
    const targetAssignee = assigneeKey === 'unassigned' ? null : assigneeKey;

    const { error } = await supabase
      .from('changes')
      .update({
        numero_priorita: newPriority,
        assignee: targetAssignee,
      })
      .eq('id', changeId);

    if (error) return;

    setChanges((prev) =>
      prev.map((c) =>
        c.id === changeId
          ? {
              ...c,
              numero_priorita: newPriority,
              assignee: targetAssignee,
            }
          : c
      )
    );
  };

  return (
    <div className="min-w-[360px] max-w-[420px] bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Dipendente</div>
            <div className="text-lg font-black text-slate-900">{title}</div>
          </div>
          <div className="text-[10px] font-black uppercase text-slate-500">{allForAssignee.length} attività</div>
        </div>
      </div>

      <div
        className="p-4 flex flex-col gap-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData('text/plain');
          if (!id) return;
          // droppo sul vuoto: in fondo alle NOT WORKING (scelta più naturale)
          applyMove(id, notWorking, notWorking.length);
          setDraggingId(null);
        }}
      >
        <SectionLabel label="IN LAVORAZIONE ORA" count={working.length} />
        <DropList
          items={working}
          draggingId={draggingId}
          setDraggingId={setDraggingId}
          onDropAt={(id, idx) => applyMove(id, working, idx)}
          updateField={updateField}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          toggleApplicativo={toggleApplicativo}
          applicativiOptions={applicativiOptions}
        />

        <SectionLabel label="IN SPRINT" count={notWorking.length} />
        <DropList
          items={notWorking}
          draggingId={draggingId}
          setDraggingId={setDraggingId}
          onDropAt={(id, idx) => applyMove(id, notWorking, idx)}
          updateField={updateField}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          toggleApplicativo={toggleApplicativo}
          applicativiOptions={applicativiOptions}
        />
      </div>
    </div>
  );
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-1">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-[9px] font-black text-slate-500">{count}</span>
    </div>
  );
}

function DropList({
  items,
  draggingId,
  setDraggingId,
  onDropAt,
  updateField,
  selectedIds,
  setSelectedIds,
  toggleApplicativo,
  applicativiOptions,
}: {
  items: Change[];
  draggingId: string | null;
  setDraggingId: (v: string | null) => void;
  onDropAt: (id: string, index: number) => void;

  updateField: (id: string, field: string, value: any) => Promise<void>;

  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;

  toggleApplicativo: (chg: Change, app: string) => Promise<void>;
  applicativiOptions: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((chg, idx) => (
        <div
          key={chg.id}
          className={`rounded-2xl border border-slate-200 p-3 bg-white shadow-sm transition-all ${
            draggingId === chg.id ? 'opacity-50' : 'opacity-100'
          }`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', chg.id);
            setDraggingId(chg.id);
          }}
          onDragEnd={() => setDraggingId(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain');
            if (!id) return;
            // droppo "sopra" questa card -> idx
            onDropAt(id, idx);
            setDraggingId(null);
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-[11px] font-bold text-blue-600 truncate">{chg.change_id}</div>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(chg.id)}
                  onChange={() =>
                    setSelectedIds((prev) => (prev.includes(chg.id) ? prev.filter((x) => x !== chg.id) : [...prev, chg.id]))
                  }
                  className="accent-blue-600 cursor-pointer"
                  title="Seleziona per report"
                />
              </div>

              <div className="text-xs text-slate-700 font-semibold leading-snug mt-1">
                {chg.breve_descrizione || '—'}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-500">
                <span className="px-2 py-0.5 rounded-full bg-slate-100">P: {chg.numero_priorita ?? 0}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100">{chg.stato || '—'}</span>
              </div>

              {/* Applicativi */}
              <div className="mt-2 flex flex-wrap gap-1">
                {chg.applicativo?.map((app: string) => (
                  <span
                    key={app}
                    onClick={() => toggleApplicativo(chg, app)}
                    className="px-1.5 py-0.5 bg-slate-800 text-white rounded text-[7px] font-black uppercase cursor-pointer hover:bg-red-500 transition-colors"
                    title="Rimuovi applicativo"
                  >
                    {app}
                  </span>
                ))}
                <select
                  value=""
                  onChange={(e) => toggleApplicativo(chg, e.target.value)}
                  className="w-4 h-4 bg-slate-200 rounded-full text-[8px] font-bold outline-none cursor-pointer text-center hover:bg-slate-300"
                  title="Aggiungi applicativo"
                >
                  <option value="">+</option>
                  {applicativiOptions.map((opt) => (
                    <option key={opt} value={opt} disabled={chg.applicativo?.includes(opt)}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {/* Toggle in_lavorazione_ora */}
              <button
                onClick={() => updateField(chg.id, 'in_lavorazione_ora', !chg.in_lavorazione_ora)}
                className={`w-8 h-8 rounded-xl border flex items-center justify-center font-black text-xs transition-all ${
                  chg.in_lavorazione_ora
                    ? 'bg-emerald-500 text-white border-transparent'
                    : 'bg-white text-slate-300 border-slate-200 hover:bg-slate-50'
                }`}
                title="Toggle in_lavorazione_ora"
              >
                ⚡
              </button>

              <Link
                href={`/changes/${chg.id}`}
                className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-all"
                title="Apri dettaglio"
              >
                →
              </Link>
            </div>
          </div>
        </div>
      ))}

      {items.length === 0 && <div className="text-[10px] text-slate-400 font-bold px-2 py-2">Nessuna attività</div>}
    </div>
  );
}