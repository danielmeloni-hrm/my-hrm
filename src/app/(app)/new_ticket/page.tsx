"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Mode = "attivita" | "change";

type Profile = { id: string; nome_completo: string | null };
type Cliente = { id: string; nome: string | null };

const BRAND = "#0150a0";
const BRAND_BG = "#eaf2fb";

const DEFAULT_CLIENTE_NAME = "Esselunga";

const APPLICATIVI_OPTIONS = ["APPECOM", "ECOM35", "EOL", "ESB", "IST35", "GCW", "Parafarmacia"] as const;
const TIPO_CHANGE_OPTIONS = ["Regressione", "Impattante", "Richiesta dal Business", "Non_impattante"] as const;
const STATO_CHANGE_OPTIONS = ["In Attesa", "In Collaudo", "In Produzione", "In Produzione + Regressione", "Annullata"] as const;
const SPRINT_OPTIONS = ["Sprint", "Opex"] as const;

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
      <div className="px-6 pt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-sm font-black text-slate-900">{title}</div>
            {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
          </div>
          <div className="h-10 w-10 rounded-2xl" style={{ background: BRAND_BG }} />
        </div>
      </div>
      <div className="px-6 pb-6 pt-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
        {hint ? <div className="text-[10px] text-slate-400">{hint}</div> : null}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function TicketSquare({
  label,
  title,
  active,
  color,
  onClick,
}: {
  label: string;
  title: string;
  active: boolean;
  color: "green" | "blue" | "purple";
  onClick: () => void;
}) {
  const palette =
    color === "green"
      ? { bg: "bg-green-500", border: "border-green-200", soft: "bg-green-50 text-green-700" }
      : color === "blue"
      ? { bg: "bg-blue-500", border: "border-blue-200", soft: "bg-blue-50 text-blue-700" }
      : { bg: "bg-purple-500", border: "border-purple-200", soft: "bg-purple-50 text-purple-700" };

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "w-10 h-10 rounded-xl border-2 flex items-center justify-center font-black text-sm transition-all",
        active ? `${palette.bg} border-transparent text-white shadow-sm` : `bg-white ${palette.border} text-slate-300 hover:${palette.soft}`
      )}
    >
      {label}
    </button>
  );
}

export default function CreateAttivitaOrChangePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("attivita");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [defaultClienteId, setDefaultClienteId] = useState<string>("");

  const [aForm, setAForm] = useState({
    titolo: "",
    applicativo: "",
    sprint: "Sprint" as (typeof SPRINT_OPTIONS)[number],
    assignee: "" as string,
    cliente_id: "" as string,
    numero_priorita: 10,
    in_lavorazione_ora: true,
    n_tag: "",
  });

  const [cForm, setCForm] = useState({
    change_id: "",
    tipo_change: "" as "" | (typeof TIPO_CHANGE_OPTIONS)[number],
    applicativo: [] as string[],
    breve_descrizione: "",
    stato: "In Attesa" as (typeof STATO_CHANGE_OPTIONS)[number],
    rilascio_in_collaudo: "",
    rilascio_in_produzione: "",
    ticket_analisi: false,
    ticket_test: false,
    ticket_rilascio: false,
    note_hrm: "",
    note_sviluppatori: "",
    n_tag: "", // ✅ AGGIUNTO
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const [{ data: pData, error: pErr }, { data: cData, error: cErr }] = await Promise.all([
        supabase.from("profili").select("id, nome_completo").order("nome_completo", { ascending: true }),
        supabase.from("clienti").select("id, nome").order("nome", { ascending: true }),
      ]);

      if (pErr) setError(pErr.message);
      if (cErr) setError((prev) => prev || cErr.message);

      const cl = (cData as Cliente[]) || [];
      setProfiles((pData as Profile[]) || []);
      setClienti(cl);

      const ess = cl.find((x) => (x.nome || "").trim().toLowerCase() === DEFAULT_CLIENTE_NAME.toLowerCase());
      const essId = ess?.id || "";
      setDefaultClienteId(essId);

      if (essId) setAForm((p) => ({ ...p, cliente_id: essId }));

      setLoading(false);
    })();
  }, [supabase]);

  const toggleChangeApp = (app: string) => {
    setCForm((p) => {
      const has = p.applicativo.includes(app);
      return { ...p, applicativo: has ? p.applicativo.filter((x) => x !== app) : [...p.applicativo, app] };
    });
  };

  const canSaveAttivita = useMemo(() => aForm.titolo.trim().length > 0, [aForm.titolo]);
  const canSaveChange = useMemo(
    () => cForm.change_id.trim().length > 0 && Boolean(cForm.tipo_change),
    [cForm.change_id, cForm.tipo_change]
  );

  const isEsselungaSelected = useMemo(() => {
    if (!defaultClienteId) return false;
    if (mode === "attivita") return aForm.cliente_id === defaultClienteId;
    return true; // change: sempre Esselunga di default
  }, [mode, aForm.cliente_id, defaultClienteId]);

  const save = async () => {
    setSaving(true);
    setError(null);

    try {
      const cliente_id = aForm.cliente_id || defaultClienteId || null;
      if (!cliente_id) throw new Error(`Cliente di default "${DEFAULT_CLIENTE_NAME}" non trovato nella tabella clienti.`);

      if (mode === "attivita") {
        if (!canSaveAttivita) throw new Error("Compila almeno il titolo dell'attività.");

        const payload: any = {
          titolo: aForm.titolo.trim(),
          applicativo: aForm.applicativo.trim() || null,
          sprint: aForm.sprint,
          assignee: aForm.assignee || null,
          cliente_id,
          numero_priorita: Number(aForm.numero_priorita) || 10,
          in_lavorazione_ora: Boolean(aForm.in_lavorazione_ora),
          n_tag: aForm.n_tag?.trim() || null, // ✅ SALVATO SU TICKET
        };

        const { error: insErr } = await supabase.from("ticket").insert(payload);
        if (insErr) throw new Error(insErr.message);

        router.refresh();
        router.push("/tickets");
        return;
      }

      if (!canSaveChange) throw new Error("Compila Change ID e Tipo Change.");

      const payload: any = {
        change_id: cForm.change_id.trim(),
        tipo_change: cForm.tipo_change,
        applicativo: Array.isArray(cForm.applicativo) ? cForm.applicativo : [],
        breve_descrizione: cForm.breve_descrizione.trim() || null,
        stato: cForm.stato,
        rilascio_in_collaudo: cForm.rilascio_in_collaudo || null,
        rilascio_in_produzione: cForm.rilascio_in_produzione || null,
        ticket_analisi: Boolean(cForm.ticket_analisi),
        ticket_test: Boolean(cForm.ticket_test),
        ticket_rilascio: Boolean(cForm.ticket_rilascio),
        note_hrm: cForm.note_hrm.trim() || null,
        note_sviluppatori: cForm.note_sviluppatori.trim() || null,
        n_tag: cForm.n_tag?.trim() || null, // ✅ SALVATO SU CHANGES (non più aForm)
        cliente_id, // se la colonna esiste in changes
      };

      const { error: insErr } = await supabase.from("changes").insert(payload);
      if (insErr) throw new Error(insErr.message);

      router.refresh();
      router.push("/changes");
      return;
    } catch (e: any) {
      setError(e?.message || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-5xl mx-auto bg-white rounded-[28px] border border-slate-100 shadow-sm p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-72 bg-slate-100 rounded-xl" />
            <div className="h-4 w-96 bg-slate-100 rounded-xl" />
            <div className="h-40 bg-slate-100 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.35em]" style={{ color: `${BRAND}AA` }}>
              Create
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
              Crea {mode === "attivita" ? "Attività" : "Change"}
            </h1>
            <div className="mt-2 text-xs text-slate-500">
              Default: <b>{DEFAULT_CLIENTE_NAME}</b> {defaultClienteId ? "✓" : "✕"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
              {(["attivita", "change"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all",
                    mode === m ? "text-white" : "text-slate-400 hover:text-slate-900"
                  )}
                  style={mode === m ? { background: BRAND } : {}}
                >
                  {m === "attivita" ? "Attività" : "Change"}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase border border-slate-200 bg-white hover:bg-slate-50 transition"
            >
              Indietro
            </button>

            <button
              type="button"
              onClick={save}
              disabled={saving || !defaultClienteId || (mode === "attivita" ? !canSaveAttivita : !canSaveChange)}
              className={cn("px-6 py-2 rounded-xl text-xs font-black uppercase text-white transition shadow-sm", saving ? "bg-slate-400" : "")}
              style={!saving ? { background: BRAND } : {}}
            >
              {saving ? "Salvataggio…" : "Crea"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <b>Errore:</b> {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            {mode === "attivita" ? (
              <Card title="Dettagli Attività" subtitle='Crea una nuova riga in tabella "ticket"'>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Titolo" hint="obbligatorio">
                    <input
                      value={aForm.titolo}
                      onChange={(e) => setAForm((p) => ({ ...p, titolo: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-800 outline-none"
                      placeholder="Es. Fix checkout - timeout…"
                    />
                  </Field>

                  <Field label="Cliente" hint="FK su tabella clienti">
                    <select
                      value={aForm.cliente_id}
                      onChange={(e) => setAForm((p) => ({ ...p, cliente_id: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-800 outline-none"
                    >
                      <option value="">—</option>
                      {clienti.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome || "Senza nome"}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Sprint">
                    <div className="flex bg-white border border-slate-200 rounded-2xl p-1">
                      {SPRINT_OPTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setAForm((p) => ({ ...p, sprint: s }))}
                          className={cn(
                            "flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition",
                            aForm.sprint === s ? "text-white" : "text-slate-400 hover:text-slate-900"
                          )}
                          style={aForm.sprint === s ? { background: BRAND } : {}}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Priorità (numero)">
                    <input
                      type="number"
                      value={aForm.numero_priorita}
                      onChange={(e) => setAForm((p) => ({ ...p, numero_priorita: Number(e.target.value) }))}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-mono text-slate-800 outline-none"
                    />
                  </Field>

                  <Field label="Assignee">
                    <select
                      value={aForm.assignee}
                      onChange={(e) => setAForm((p) => ({ ...p, assignee: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-800 outline-none"
                    >
                      <option value="">Senza assegnatario</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome_completo || p.id}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="In lavorazione ora">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-sm font-bold text-slate-800">Work</div>
                      <button
                        type="button"
                        onClick={() => setAForm((p) => ({ ...p, in_lavorazione_ora: !p.in_lavorazione_ora }))}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border transition",
                          aForm.in_lavorazione_ora ? "text-white border-transparent" : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                        )}
                        style={aForm.in_lavorazione_ora ? { background: BRAND } : {}}
                      >
                        {aForm.in_lavorazione_ora ? "TRUE" : "FALSE"}
                      </button>
                    </div>
                  </Field>
                </div>
              </Card>
            ) : (
              <>
                <Card title="Dettagli Change" subtitle='Crea una nuova riga in tabella "changes"'>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Change ID" hint="obbligatorio">
                      <input
                        value={cForm.change_id}
                        onChange={(e) => setCForm((p) => ({ ...p, change_id: e.target.value }))}
                        className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-mono font-bold text-slate-800 outline-none"
                        placeholder="Es. CHG123"
                      />
                    </Field>

                    <Field label="Tipo Change" hint="obbligatorio">
                      <select
                        value={cForm.tipo_change}
                        onChange={(e) => setCForm((p) => ({ ...p, tipo_change: e.target.value as any }))}
                        className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-800 outline-none"
                      >
                        <option value="">—</option>
                        {TIPO_CHANGE_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Stato">
                      <select
                        value={cForm.stato}
                        onChange={(e) => setCForm((p) => ({ ...p, stato: e.target.value as any }))}
                        className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-800 outline-none"
                      >
                        {STATO_CHANGE_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Applicativi" hint="selezione multipla">
                      <div className="flex flex-wrap gap-2">
                        {APPLICATIVI_OPTIONS.map((app) => {
                          const active = cForm.applicativo.includes(app);
                          return (
                            <button
                              type="button"
                              key={app}
                              onClick={() => toggleChangeApp(app)}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-[10px] font-black uppercase border transition",
                                active ? "text-white" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                              )}
                              style={active ? { background: BRAND, borderColor: `${BRAND}55` } : {}}
                            >
                              {app}
                            </button>
                          );
                        })}
                      </div>
                    </Field>

                    <div className="md:col-span-2">
                      <Field label="Breve descrizione">
                        <textarea
                          rows={3}
                          value={cForm.breve_descrizione}
                          onChange={(e) => setCForm((p) => ({ ...p, breve_descrizione: e.target.value }))}
                          className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 outline-none resize-none"
                          placeholder="Descrizione breve…"
                        />
                      </Field>
                    </div>
                  </div>
                </Card>

                <Card title="Note" subtitle="Info extra">
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Note HRM">
                      <textarea
                        rows={3}
                        value={cForm.note_hrm}
                        onChange={(e) => setCForm((p) => ({ ...p, note_hrm: e.target.value }))}
                        className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 outline-none resize-none"
                      />
                    </Field>
                    <Field label="Note sviluppatori">
                      <textarea
                        rows={4}
                        value={cForm.note_sviluppatori}
                        onChange={(e) => setCForm((p) => ({ ...p, note_sviluppatori: e.target.value }))}
                        className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 outline-none resize-none"
                      />
                    </Field>
                  </div>
                </Card>
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* ✅ Esselunga: N° TAG prima + applicativi nella stessa Card (niente errori JSX) */}
            {isEsselungaSelected ? (
              <Card title="Applicativi interessati" subtitle={`Visibile solo per ${DEFAULT_CLIENTE_NAME}`}>
                {/* N° TAG (prima degli applicativi) */}
                <div className="mb-5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">N° TAG</div>

                  {mode === "attivita" ? (
                    <input
                      type="text"
                      value={aForm.n_tag || ""}
                      onChange={(e) => setAForm((p) => ({ ...p, n_tag: e.target.value }))}
                      placeholder="es. 3"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-400"
                    />
                  ) : (
                    <input
                      type="text"
                      value={cForm.n_tag || ""}
                      onChange={(e) => setCForm((p) => ({ ...p, n_tag: e.target.value }))}
                      placeholder="es. 3"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-400"
                    />
                  )}
                </div>

                {/* Applicativi */}
                {mode === "attivita" ? (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-700">Seleziona l’applicativo dell’attività</div>

                    <div className="grid grid-cols-2 gap-2">
                      {APPLICATIVI_OPTIONS.map((app) => {
                        const active = aForm.applicativo === app;
                        return (
                          <button
                            key={app}
                            type="button"
                            onClick={() => setAForm((p) => ({ ...p, applicativo: p.applicativo === app ? "" : app }))}
                            className={cn(
                              "px-3 py-2 rounded-2xl text-[10px] font-black uppercase border transition text-left",
                              active ? "text-white border-transparent shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                            )}
                            style={active ? { background: BRAND } : {}}
                          >
                            {app}
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selezionato</div>
                      <div className="mt-1 text-xs font-bold text-slate-800">{aForm.applicativo || "—"}</div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-700">Seleziona uno o più applicativi per la change</div>

                    <div className="flex flex-wrap gap-2">
                      {APPLICATIVI_OPTIONS.map((app) => {
                        const active = cForm.applicativo.includes(app);
                        return (
                          <button
                            key={app}
                            type="button"
                            onClick={() => toggleChangeApp(app)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase border transition",
                              active ? "text-white" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                            )}
                            style={active ? { background: BRAND, borderColor: `${BRAND}55` } : {}}
                          >
                            {app}
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selezionati</div>
                      <div className="mt-1 text-xs font-bold text-slate-800">
                        {cForm.applicativo.length ? cForm.applicativo.join(", ") : "—"}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ) : null}

            {mode === "change" ? (
              <>
                <Card title="Rilasci" subtitle="Collaudo e Produzione">
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Rilascio in collaudo">
                      <input
                        type="date"
                        value={cForm.rilascio_in_collaudo || ""}
                        onChange={(e) => setCForm((p) => ({ ...p, rilascio_in_collaudo: e.target.value }))}
                        className="w-full px-4 py-3 rounded-2xl bg-amber-50 border border-amber-100 text-sm font-mono text-amber-800 outline-none"
                      />
                    </Field>

                    <Field label="Rilascio in produzione">
                      <input
                        type="date"
                        value={cForm.rilascio_in_produzione || ""}
                        onChange={(e) => setCForm((p) => ({ ...p, rilascio_in_produzione: e.target.value }))}
                        className="w-full px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-sm font-mono text-emerald-800 outline-none"
                      />
                    </Field>

                    <button
                      type="button"
                      onClick={() => setCForm((p) => ({ ...p, rilascio_in_collaudo: p.rilascio_in_collaudo || todayISO() }))}
                      className="px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-slate-200 bg-white hover:bg-slate-50 transition"
                    >
                      Metti oggi su collaudo
                    </button>
                  </div>
                </Card>

                <Card title="Checklist" subtitle="Flag documentali">
                  <div className="flex items-center gap-3">
                    <TicketSquare
                      label="A"
                      title="Ticket Analisi"
                      active={Boolean(cForm.ticket_analisi)}
                      color="green"
                      onClick={() => setCForm((p) => ({ ...p, ticket_analisi: !p.ticket_analisi }))}
                    />
                    <TicketSquare
                      label="T"
                      title="Ticket Test"
                      active={Boolean(cForm.ticket_test)}
                      color="blue"
                      onClick={() => setCForm((p) => ({ ...p, ticket_test: !p.ticket_test }))}
                    />
                    <TicketSquare
                      label="R"
                      title="Ticket Rilascio"
                      active={Boolean(cForm.ticket_rilascio)}
                      color="purple"
                      onClick={() => setCForm((p) => ({ ...p, ticket_rilascio: !p.ticket_rilascio }))}
                    />
                  </div>
                </Card>
              </>
            ) : (
              <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: `${BRAND}AA` }}>
                  Cliente
                </div>
                <div className="mt-2 text-sm text-slate-700 leading-relaxed">
                  In modalità <b>Attività</b> il cliente viene salvato come <b>FK</b> su tabella <b>clienti</b>.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-[11px] text-slate-400">
          Nota: se la tabella <b>changes</b> non ha <code className="px-1 py-0.5 bg-slate-100 rounded">cliente_id</code>, elimina quella riga dal payload change.
        </div>
      </div>
    </div>
  );
}