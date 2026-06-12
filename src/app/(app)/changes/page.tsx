"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import AppPage from '@/components/ui/AppPage';
import AppCard from '@/components/ui/AppCard';
import AppButton from '@/components/ui/AppButton';

interface Change {
  id: string;
  change_id: string;
  tipo_change?:
    | "Regressione"
    | "Impattante"
    | "Richiesta dal Business"
    | "Non_impattante"
    | string;
  breve_descrizione?: string;
  applicativo?: string[];
  stato?: string;
  rilascio_in_produzione?: string;
  rilascio_in_collaudo?: string;
  data_collaudo?: string;
  ticket_analisi?: boolean;
  ticket_test?: boolean;
  ticket_rilascio?: boolean;
  note_hrm?: string;
  [key: string]: any;
}

const TIPO_CHANGE_OPTIONS = [
  "Regressione",
  "Impattante",
  "Richiesta dal Business",
  "Non_impattante",
] as const;

const APPLICATIVI_OPTIONS = [
  "APPECOM",
  "ECOM35",
  "EOL",
  "ESB",
  "IST35",
  "GCW",
  "Parafarmacia",
];

export default function ChangesDashboard() {
  const supabase = useMemo(() => createClient(), []);

  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [filterStato, setFilterStato] = useState("");
  const [filterApp, setFilterApp] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipoChange, setFilterTipoChange] = useState("");

  const [filterAnalisi, setFilterAnalisi] = useState<boolean | null>(null);
  const [filterTest, setFilterTest] = useState<boolean | null>(null);
  const [filterRilascio, setFilterRilascio] = useState<boolean | null>(null);

  const [showColSettings, setShowColSettings] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    idApp: true,
    tipoChange: true,
    descrizione: true,
    info: true,
    stato: true,
    collaudo: true,
    produzione: true,
    ticket: true,
  });

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [emailText, setEmailText] = useState("");

  const fetchChanges = async () => {
    const { data } = await supabase
      .from("changes")
      .select("*")
      .order("rilascio_in_produzione", { ascending: false });

    if (data) setChanges(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchChanges();
  }, [supabase]);

  const filteredChanges = useMemo(() => {
    return changes.filter((chg) => {
      const matchesStato = filterStato === "" || chg.stato === filterStato;
      const matchesApp =
        filterApp === "" ||
        (Array.isArray(chg.applicativo) && chg.applicativo.includes(filterApp));
      const matchesSearch =
        searchTerm === "" ||
        chg.breve_descrizione?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chg.change_id?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTipo =
        filterTipoChange === "" || (chg.tipo_change || "") === filterTipoChange;
      const matchesAnalisi = filterAnalisi === null || chg.ticket_analisi === filterAnalisi;
      const matchesTest = filterTest === null || chg.ticket_test === filterTest;
      const matchesRilascio = filterRilascio === null || chg.ticket_rilascio === filterRilascio;

      return (
        matchesStato &&
        matchesApp &&
        matchesSearch &&
        matchesTipo &&
        matchesAnalisi &&
        matchesTest &&
        matchesRilascio
      );
    });
  }, [
    changes,
    filterStato,
    filterApp,
    searchTerm,
    filterTipoChange,
    filterAnalisi,
    filterTest,
    filterRilascio,
  ]);

  const updateField = async (id: string, field: string, value: any) => {
    const { error } = await supabase.from("changes").update({ [field]: value }).eq("id", id);

    if (!error) {
      setChanges((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    }
  };

  const toggleApplicativo = async (chg: Change, app: string) => {
    if (!app) return;

    const currentApps = Array.isArray(chg.applicativo) ? chg.applicativo : [];
    const newApps = currentApps.includes(app)
      ? currentApps.filter((a) => a !== app)
      : [...currentApps, app];

    await updateField(chg.id, "applicativo", newApps);
  };

  const generatePreview = () => {
    const selectedChanges = filteredChanges.filter((chg) => selectedIds.includes(chg.id));

    if (selectedChanges.length === 0) {
      alert("Seleziona almeno una riga tramite checkbox.");
      return;
    }

    const TYPE_ORDER = [
      "Regressione",
      "Impattante",
      "Richiesta dal Business",
      "Non_impattante",
    ] as const;

    const norm = (s?: string) => (s || "").trim();
    const fmtDate = (d?: string) => (d && String(d).trim() ? String(d).trim() : "");
    const fmtColl = (chg: Change) => `coll ${fmtDate(chg.rilascio_in_collaudo)}`;
    const fmtProd = (chg: Change) => `prod ${fmtDate(chg.rilascio_in_produzione)}`;

    const fmtDesc = (s?: string) => {
      const t = norm(s);
      if (!t) return "—";
      return t.replace(/\s+/g, " ");
    };

    const timeOrMax = (d?: string) => {
      const t = norm(d);
      if (!t) return Number.MAX_SAFE_INTEGER;
      const dt = new Date(t);
      const ms = dt.getTime();
      return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
    };

    const expandRows = (chg: Change) => {
      const apps =
        Array.isArray(chg.applicativo) && chg.applicativo.length > 0
          ? chg.applicativo
          : ["N/D"];

      return apps.map((app) => ({
        tipo: norm(chg.tipo_change) || "Non_impattante",
        prodMs: timeOrMax(chg.rilascio_in_produzione),
        collMs: timeOrMax(chg.rilascio_in_collaudo),
        changeId: norm(chg.change_id),
        app: norm(app) || "N/D",
        line: `• ${norm(chg.change_id)} | ${norm(app) || "N/D"} | ${fmtColl(chg)} | ${fmtProd(
          chg
        )} | ${fmtDesc(chg.breve_descrizione)}`,
      }));
    };

    const rows = selectedChanges.flatMap(expandRows);
    const byType = new Map<string, typeof rows>();

    for (const r of rows) {
      if (!byType.has(r.tipo)) byType.set(r.tipo, []);
      byType.get(r.tipo)!.push(r);
    }

    const sections: string[] = [];

    const pushSection = (tipo: string, list: typeof rows) => {
      if (!list || list.length === 0) return;

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

    const extra = Array.from(byType.keys()).filter((t) => !TYPE_ORDER.includes(t as any));
    extra.sort((a, b) => a.localeCompare(b, "it"));
    for (const t of extra) pushSection(t, byType.get(t) || []);

    const header = `REPORT CHANGE SELEZIONATE - ${new Date().toLocaleDateString("it-IT")}`;
    setEmailText(`${header}\n\n${sections.join("\n\n")}`);
    setIsPreviewOpen(true);
  };

  const stats = useMemo(
    () => ({
      produzione: filteredChanges.filter((c) => c.stato === "In Produzione").length,
      collaudo: filteredChanges.filter((c) => c.stato === "In Collaudo").length,
      attesa: filteredChanges.filter((c) => c.stato === "In Attesa").length,
      regressione: filteredChanges.filter((c) => c.stato === "In Produzione + Regressione").length,
    }),
    [filteredChanges]
  );

  if (loading) {
    return (
      <AppPage>
        <div className="p-10 text-center font-bold text-slate-500 uppercase animate-pulse">
          Caricamento...
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <div className="flex flex-col gap-6 pb-24 text-slate-900">
        <div className="flex flex-col gap-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
                Gestione Change
              </h1>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Filtri attivi: {filteredChanges.length} / {changes.length}
              </p>
            </div>

            <div className="relative flex gap-2">
              <AppButton type="button" variant="secondary" onClick={() => setShowColSettings(!showColSettings)}>
                ⚙️ Colonne
              </AppButton>

              {showColSettings && (
                <AppCard className="absolute right-0 top-12 z-[110] flex w-52 flex-col gap-2 p-4 shadow-xl">
                  <p className="mb-1 text-[9px] font-black uppercase text-slate-400">
                    Visibilità Colonne
                  </p>
                  {Object.keys(visibleCols).map((col) => (
                    <label
                      key={col}
                      className="flex cursor-pointer items-center gap-2 rounded-lg p-1 transition-colors hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={visibleCols[col as keyof typeof visibleCols]}
                        onChange={() =>
                          setVisibleCols((prev) => ({
                            ...prev,
                            [col]: !prev[col as keyof typeof visibleCols],
                          }))
                        }
                        className="h-3 w-3 accent-blue-600"
                      />
                      <span className="text-[10px] font-bold uppercase text-slate-600">{col}</span>
                    </label>
                  ))}
                </AppCard>
              )}

              <AppButton type="button" onClick={generatePreview}>
                Anteprima Email
              </AppButton>
            </div>
          </div>

          <AppCard className="flex flex-wrap items-center gap-4 p-4">
            <input
              type="text"
              placeholder="Cerca ID o Descrizione..."
              className="w-64 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <select
              value={filterApp}
              onChange={(e) => setFilterApp(e.target.value)}
              className="cursor-pointer rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase outline-none"
            >
              <option value="">Tutte le App</option>
              {APPLICATIVI_OPTIONS.map((app) => (
                <option key={app} value={app}>
                  {app}
                </option>
              ))}
            </select>

            <select
              value={filterTipoChange}
              onChange={(e) => setFilterTipoChange(e.target.value)}
              className="min-w-[200px] cursor-pointer rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase outline-none"
              title="Filtra per Tipo Change"
            >
              <option value="">Tutti i tipi</option>
              {TIPO_CHANGE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-1">
              <AppButton
                type="button"
                variant={filterAnalisi === true ? "primary" : "ghost"}
                onClick={() => setFilterAnalisi(filterAnalisi === true ? null : true)}
                className="px-3 py-1.5 text-[9px]"
              >
                Analisi
              </AppButton>
              <AppButton
                type="button"
                variant={filterTest === true ? "primary" : "ghost"}
                onClick={() => setFilterTest(filterTest === true ? null : true)}
                className="px-3 py-1.5 text-[9px]"
              >
                Test
              </AppButton>
              <AppButton
                type="button"
                variant={filterRilascio === true ? "primary" : "ghost"}
                onClick={() => setFilterRilascio(filterRilascio === true ? null : true)}
                className="px-3 py-1.5 text-[9px]"
              >
                Rilascio
              </AppButton>
            </div>

            <div className="flex-1" />

            <div className="flex flex-wrap gap-2">
              {Object.entries(stats).map(([key, val]) => {
                const active = filterStato.toLowerCase().includes(key);

                return (
                  <AppButton
                    key={key}
                    type="button"
                    variant={active ? "primary" : "secondary"}
                    onClick={() =>
                      setFilterStato(
                        active
                          ? ""
                          : key === "produzione"
                            ? "In Produzione"
                            : key === "collaudo"
                              ? "In Collaudo"
                              : key === "regressione"
                                ? "In Produzione + Regressione"
                                : "In Attesa"
                      )
                    }
                    className="px-3 py-2 text-[9px]"
                  >
                    {key}: {val}
                  </AppButton>
                );
              })}
            </div>
          </AppCard>
        </div>

        <AppCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="w-10 px-4 py-5 text-center">#</th>
                  {visibleCols.idApp && <th className="w-44 px-6 py-5">ID / Applicativi</th>}
                  {visibleCols.tipoChange && <th className="w-56 px-6 py-5">Tipo Change</th>}
                  {visibleCols.descrizione && <th className="px-6 py-5">Breve Descrizione</th>}
                  {visibleCols.info && <th className="px-6 py-5">Info</th>}
                  {visibleCols.stato && <th className="w-40 px-6 py-5">Stato</th>}
                  {visibleCols.collaudo && (
                    <th className="w-40 px-6 py-5 text-center">Rilascio in Collaudo</th>
                  )}
                  {visibleCols.produzione && (
                    <th className="w-40 px-6 py-5 text-center">Rilascio in Produzione</th>
                  )}
                  {visibleCols.ticket && <th className="w-40 px-6 py-5 text-center">Ticket</th>}
                  <th className="px-6 py-5 text-right">Azioni</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredChanges.map((chg) => (
                  <tr key={chg.id} className="transition-all hover:bg-slate-50/50">
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(chg.id)}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(chg.id)
                              ? prev.filter((i) => i !== chg.id)
                              : [...prev, chg.id]
                          )
                        }
                        className="cursor-pointer accent-blue-600"
                      />
                    </td>

                    {visibleCols.idApp && (
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-mono text-xs font-bold tracking-tight text-blue-600">
                            {chg.change_id}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {chg.applicativo?.map((app) => (
                              <button
                                type="button"
                                key={app}
                                onClick={() => toggleApplicativo(chg, app)}
                                className="rounded bg-slate-800 px-1.5 py-0.5 text-[7px] font-black uppercase text-white transition-colors hover:bg-red-500"
                              >
                                {app}
                              </button>
                            ))}
                            <select
                              value=""
                              onChange={(e) => toggleApplicativo(chg, e.target.value)}
                              className="h-4 w-4 cursor-pointer rounded-full bg-slate-200 text-center text-[8px] font-bold outline-none hover:bg-slate-300"
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

                    {visibleCols.tipoChange && (
                      <td className="px-6 py-4">
                        <select
                          value={chg.tipo_change || ""}
                          onChange={(e) => updateField(chg.id, "tipo_change", e.target.value)}
                          className="w-full cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-black uppercase shadow-sm outline-none"
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
                          className="min-h-[32px] w-full resize-none rounded border-none bg-transparent p-1 text-xs text-slate-700 focus:ring-1 focus:ring-blue-100"
                          value={chg.breve_descrizione || ""}
                          onChange={(e) => updateField(chg.id, "breve_descrizione", e.target.value)}
                        />
                      </td>
                    )}

                    {visibleCols.info && (
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={chg.note_hrm || ""}
                          onChange={(e) => updateField(chg.id, "note_hrm", e.target.value)}
                          placeholder="Note HRM..."
                          className="min-h-[32px] w-full rounded border-none bg-transparent p-1 text-xs text-slate-700 focus:ring-1 focus:ring-blue-100"
                        />
                      </td>
                    )}

                    {visibleCols.stato && (
                      <td className="px-6 py-4">
                        <select
                          value={chg.stato || ""}
                          onChange={(e) => updateField(chg.id, "stato", e.target.value)}
                          className="w-full cursor-pointer rounded-full border bg-white px-3 py-1.5 text-[9px] font-black uppercase shadow-sm outline-none"
                        >
                          <option value="In Attesa">In Attesa</option>
                          <option value="In Collaudo">In Collaudo</option>
                          <option value="In Produzione">In Produzione</option>
                          <option value="In Produzione + Regressione">
                            In Produzione + Regressione
                          </option>
                        </select>
                      </td>
                    )}

                    {visibleCols.collaudo && (
                      <td className="px-6 py-4 text-center">
                        <input
                          type="date"
                          value={chg.rilascio_in_collaudo || ""}
                          onChange={(e) => updateField(chg.id, "rilascio_in_collaudo", e.target.value)}
                          className={`rounded border px-2 py-1 font-mono text-[10px] ${
                            chg.rilascio_in_collaudo
                              ? "border-amber-100 bg-amber-50 text-amber-700"
                              : "border-gray-200 bg-white text-gray-600"
                          }`}
                        />
                      </td>
                    )}

                    {visibleCols.produzione && (
                      <td className="px-6 py-4 text-center">
                        <input
                          type="date"
                          value={chg.rilascio_in_produzione || ""}
                          onChange={(e) => updateField(chg.id, "rilascio_in_produzione", e.target.value)}
                          className={`rounded border px-2 py-1 font-mono text-[10px] ${
                            chg.rilascio_in_produzione
                              ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                              : "border-gray-200 bg-white text-gray-600"
                          }`}
                        />
                      </td>
                    )}

                    {visibleCols.ticket && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-1.5">
                          {["Analisi", "Test", "Rilascio"].map((label) => {
                            const field = `ticket_${label.toLowerCase()}`;
                            const active = chg[field];
                            const colors =
                              label === "Analisi"
                                ? "bg-green-500"
                                : label === "Test"
                                  ? "bg-blue-500"
                                  : "bg-purple-500";

                            return (
                              <button
                                type="button"
                                key={label}
                                title={label}
                                onClick={() => updateField(chg.id, field, !active)}
                                className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition-all ${
                                  active
                                    ? `${colors} border-transparent text-white`
                                    : "border-slate-200 bg-transparent text-slate-300"
                                }`}
                              >
                                <span className="text-[9px] font-black">
                                  {label[0].toUpperCase()}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    )}

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/changes/${chg.id}`}
                        className="inline-block rounded-full p-2 transition-colors hover:bg-slate-100"
                      >
                        <span className="font-bold text-slate-400 hover:text-blue-600">→</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>

        {isPreviewOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <AppCard className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] p-0 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 bg-white p-6">
                <h3 className="font-black uppercase tracking-tight text-slate-900">Anteprima Report</h3>
                <AppButton type="button" variant="ghost" onClick={() => setIsPreviewOpen(false)}>
                  ✕
                </AppButton>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-5 font-mono text-[11px] text-slate-700 shadow-inner">
                  {emailText}
                </pre>
              </div>

              <div className="flex gap-3 border-t border-slate-100 bg-white p-6">
                <AppButton
                  type="button"
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText(emailText);
                    alert("Copiato!");
                  }}
                >
                  Copia negli appunti
                </AppButton>
                <AppButton type="button" variant="secondary" onClick={() => setIsPreviewOpen(false)}>
                  Chiudi
                </AppButton>
              </div>
            </AppCard>
          </div>
        )}
      </div>
    </AppPage>
  );
}
