"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// --- TIPI E COSTANTI ---
type Mode = "attivita" | "change";
type Profile = { id: string; nome_completo: string | null };
type Cliente = { id: string; nome: string | null };

const BRAND = "#0150a0";
const BRAND_BG = "#eaf2fb";
const DEFAULT_CLIENTE_NAME = "Esselunga";

const APPLICATIVI_OPTIONS = ["APPECOM", "ECOM35", "EOL", "ESB", "IST35", "GCW", "Parafarmacia"] as const;
const TOOL_OPTIONS = ["GA4", "GTM", "BigQuery", "Databricks"] as const;
const TIPO_ATTIVITA_OPTIONS = [
  "Evolutiva GA4", "Evolutiva BQ", "Report", "Analisi degli Impatti",
  "Supporto funzionale Business", "Supporto Tecnico", "Formazione",
  "Incident Resolution", "Preanalisi"
] as const;
const TIPO_CHANGE_OPTIONS = ["Regressione", "Impattante", "Richiesta dal Business", "Non_impattante"] as const;
const STATO_CHANGE_OPTIONS = ["In Attesa", "In Collaudo", "In Produzione", "In Produzione + Regressione", "Annullata"] as const;
const SPRINT_OPTIONS = ["Sprint", "Opex"] as const;

// --- HELPER FUNCTIONS ---
const cn = (...xs: Array<string | false | undefined | null>) => xs.filter(Boolean).join(" ");

// --- COMPONENTI UI ---
function Card({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[28px] border border-slate-100 bg-white shadow-sm overflow-hidden", className)}>
      <div className="px-6 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-slate-900 uppercase tracking-tight">{title}</div>
            {subtitle ? <div className="mt-1 text-[11px] text-slate-400 font-medium">{subtitle}</div> : null}
          </div>
          <div className="h-10 w-10 rounded-2xl flex-shrink-0" style={{ background: BRAND_BG }} />
        </div>
      </div>
      <div className="px-6 pb-6 pt-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
        {hint ? <div className="text-[9px] font-bold text-slate-300 italic">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

function TicketSquare({ label, title, active, color, onClick }: { label: string; title: string; active: boolean; color: "green" | "blue" | "purple"; onClick: () => void }) {
  const palette = {
    green: "bg-green-500 border-green-200 text-green-700 hover:bg-green-50",
    blue: "bg-blue-500 border-blue-200 text-blue-700 hover:bg-blue-50",
    purple: "bg-purple-500 border-purple-200 text-purple-700 hover:bg-purple-50",
  }[color];

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "w-10 h-10 rounded-xl border-2 flex items-center justify-center font-black text-sm transition-all",
        active ? `${palette.split(' ')[0]} border-transparent text-white shadow-md scale-105` : `bg-white ${palette.split(' ')[1]} text-slate-300 ${palette.split(' ')[3]}`
      )}
    >
      {label}
    </button>
  );
}

// --- PAGINA PRINCIPALE ---
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
  const [success, setSuccess] = useState(false);
  const [aForm, setAForm] = useState({
    titolo: "",
    descrizione: "",
    applicativo: [] as string[],
    tool: "",
    tipo_di_attivita: "",
    sprint: "Sprint" as (typeof SPRINT_OPTIONS)[number],
    assignee: "",
    cliente_id: "",
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
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [{ data: pData }, { data: cData }] = await Promise.all([
          supabase.from("profili").select("id, nome_completo").order("nome_completo"),
          supabase.from("clienti").select("id, nome").order("nome"),
        ]);

        const cl = (cData as Cliente[]) || [];
        setProfiles((pData as Profile[]) || []);
        setClienti(cl);

        const ess = cl.find((x) => x.nome?.toLowerCase().includes(DEFAULT_CLIENTE_NAME.toLowerCase()));
        if (ess) {
          setDefaultClienteId(ess.id);
          setAForm((p) => ({ ...p, cliente_id: ess.id }));
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const isEsselungaSelected = useMemo(() => {
    if (mode === "change") return true;
    return aForm.cliente_id === defaultClienteId;
  }, [mode, aForm.cliente_id, defaultClienteId]);

  const save = async () => {
  setSaving(true);
  setError(null);
  setSuccess(false);

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Utente non autenticato");
    }

    if (mode === "attivita") {
      const payload = {
        titolo: aForm.titolo.trim(),
        descrizione: aForm.descrizione.trim() || null,
        applicativo: aForm.applicativo.length > 0 ? aForm.applicativo : null,
        tool: aForm.tool || null,
        tipo_di_attivita: aForm.tipo_di_attivita || null,
        sprint: aForm.sprint,
        assignee: aForm.assignee || null,
        cliente_id: aForm.cliente_id || null,
        numero_priorita: aForm.numero_priorita,
        in_lavorazione_ora: aForm.in_lavorazione_ora,
        n_tag: aForm.n_tag.trim() || null,
        stato: "Aperto",
        utente_id: user.id
      };

      const { error: err } = await supabase.from("ticket").insert([payload]);
      if (err) throw err;
    } else {
      const payload = {
        ...cForm,
        change_id: cForm.change_id.trim(),
        rilascio_in_collaudo: cForm.rilascio_in_collaudo || null,
        rilascio_in_produzione: cForm.rilascio_in_produzione || null,
        cliente_id: defaultClienteId || null,
      };

      const { error: err } = await supabase.from("changes").insert([payload]);
      if (err) throw err;
    }

    setSuccess(true);

  } catch (err: any) {
    setError(err.message);
  } finally {
    setSaving(false);
  }
};


  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-slate-300 animate-pulse">CARICAMENTO...</div>;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.4em] mb-1" style={{ color: BRAND }}>
              Management System
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              Nuova {mode === "attivita" ? "Attività" : "Change"}
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-[24px] shadow-sm border border-slate-100">
            <div className="flex bg-slate-100 rounded-2xl p-1">
              {(["attivita", "change"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-300",
                    mode === m ? "bg-white text-slate-900 shadow-sm scale-105" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              onClick={save}
              disabled={saving || (mode === "attivita" ? !aForm.titolo : !cForm.change_id)}
              className="px-8 py-2.5 rounded-xl text-[10px] font-black uppercase text-white transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:grayscale"
              style={{ background: BRAND }}
            >
              {saving ? "In corso..." : "Crea Entry"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-8 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold animate-in fade-in slide-in-from-top-4">
              ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="mb-8 p-4 rounded-2xl bg-green-50 border border-green-200 text-green-600 text-xs font-bold">
            ✅ Evento creato
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Form Column */}
          <div className="lg:col-span-8 space-y-8">
            {mode === "attivita" ? (
              <Card title="Dettagli Principali" subtitle="Informazioni base del ticket">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Titolo Attività" hint="Richiesto">
                    <input
                      value={aForm.titolo}
                      onChange={(e) => setAForm(p => ({ ...p, titolo: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 text-sm font-bold transition-all outline-none"
                      placeholder="Cosa bisogna fare?"
                    />
                  </Field>
                  <Field label="Cliente" hint="Tabella Clienti">
                    <select
                      value={aForm.cliente_id}
                      onChange={(e) => setAForm(p => ({ ...p, cliente_id: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 text-sm font-bold outline-none cursor-pointer"
                    >
                      <option value="">Seleziona cliente...</option>
                      {clienti.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Descrizione">
                      <textarea
                        rows={4}
                        value={aForm.descrizione}
                        onChange={(e) => setAForm(p => ({ ...p, descrizione: e.target.value }))}
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 text-sm outline-none resize-none transition-all"
                        placeholder="Dettagli dell'attività..."
                      />
                    </Field>
                  </div>
                  <Field label="Priorità">
                    <input
                      type="number"
                      value={aForm.numero_priorita}
                      onChange={(e) => setAForm(p => ({ ...p, numero_priorita: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent text-sm font-mono font-bold outline-none"
                    />
                  </Field>
                </div>
              </Card>
            ) : (
              <Card title="Dettagli Change" subtitle="Configurazione tecnica del rilascio">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Change ID" hint="es. CHG00123">
                    <input
                      value={cForm.change_id}
                      onChange={(e) => setCForm(p => ({ ...p, change_id: e.target.value.toUpperCase() }))}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent focus:border-slate-200 text-sm font-mono font-bold outline-none"
                    />
                  </Field>
                  <Field label="Tipologia">
                    <select
                      value={cForm.tipo_change}
                      onChange={(e) => setCForm(p => ({ ...p, tipo_change: e.target.value as any }))}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent text-sm font-bold outline-none"
                    >
                      <option value="">Scegli tipo...</option>
                      {TIPO_CHANGE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Descrizione Estesa">
                      <textarea
                        rows={3}
                        value={cForm.breve_descrizione}
                        onChange={(e) => setCForm(p => ({ ...p, breve_descrizione: e.target.value }))}
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 text-sm outline-none resize-none transition-all"
                      />
                    </Field>
                  </div>
                </div>
              </Card>
            )}

            {mode === "change" && (
              <Card title="Note Operative" subtitle="HRM e Sviluppo">
                <div className="space-y-6">
                  <Field label="Note HRM">
                    <textarea
                      value={cForm.note_hrm}
                      onChange={(e) => setCForm(p => ({ ...p, note_hrm: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent text-sm outline-none"
                    />
                  </Field>
                  <Field label="Note Sviluppo">
                    <textarea
                      value={cForm.note_sviluppatori}
                      onChange={(e) => setCForm(p => ({ ...p, note_sviluppatori: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent text-sm outline-none"
                    />
                  </Field>
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar Column */}
          <div className="lg:col-span-4 space-y-8">
            <div className={cn("transition-all duration-500", !isEsselungaSelected ? "opacity-30 grayscale pointer-events-none scale-95" : "opacity-100")}>
              <Card title="Tech Context" subtitle="Target: Esselunga" className="border-blue-100">
                <div className="space-y-6">
                  
                  {/* SEZIONE CONDIZIONALE: Solo per Attività */}
                  {mode === 'attivita' && isEsselungaSelected && (
                    <>
                      <Field label="Tipo di Attività">
                        <select
                          value={aForm.tipo_di_attivita}
                          onChange={(e) => setAForm(p => ({ ...p, tipo_di_attivita: e.target.value }))}
                          className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent text-xs font-bold outline-none cursor-pointer"
                        >
                          <option value="">Seleziona tipo...</option>
                          {TIPO_ATTIVITA_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </Field>

                      <Field label="Tool Principale">
                        <div className="grid grid-cols-2 gap-2">
                          {TOOL_OPTIONS.map((t) => {
                            const active = aForm.tool === t;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setAForm(p => ({ ...p, tool: p.tool === t ? "" : t }))}
                                className={cn(
                                  "py-2 rounded-xl text-[10px] font-bold border transition-all",
                                  active ? "bg-slate-900 text-white border-transparent shadow-sm" : "bg-white text-slate-400 border-slate-100"
                                )}
                              >
                                {t}
                              </button>
                            );
                          })}
                        </div>
                      </Field>

                      <Field label="N° Tag" hint="Riferimento numerico">
                        <input
                          type="text"
                          value={aForm.n_tag}
                          onChange={(e) => setAForm(p => ({ ...p, n_tag: e.target.value }))}
                          className="w-full px-4 py-2 rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold outline-none"
                        />
                      </Field>

                      <Field label="Pianificazione Sprint">
                        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 rounded-2xl">
                          {SPRINT_OPTIONS.map(s => (
                            <button
                              key={s}
                              onClick={() => setAForm(p => ({ ...p, sprint: s }))}
                              className={cn(
                                "py-2 rounded-xl text-[10px] font-black uppercase transition-all",
                                aForm.sprint === s ? "bg-white shadow-sm text-slate-900" : "text-slate-400"
                              )}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </Field>
                    </>
                  )}

                  {/* Applicativi: Sempre visibili (Esselunga) per entrambe le mode */}
                  <Field label="Applicativi">
                      <div className="grid grid-cols-2 gap-2">
                        {APPLICATIVI_OPTIONS.map((app) => {
                          const active = mode === "attivita" ? aForm.applicativo.includes(app) : cForm.applicativo.includes(app);
                          return (
                            <button
                              key={app}
                              type="button"
                              onClick={() => {
                                const setter = mode === "attivita" ? setAForm : setCForm;
                                setter((p: any) => ({
                                  ...p,
                                  applicativo: p.applicativo.includes(app)
                                    ? p.applicativo.filter((x: string) => x !== app)
                                    : [...p.applicativo, app],
                                }));
                              }}
                              className={cn(
                                "px-2 py-3 rounded-xl text-[9px] font-black uppercase border transition-all text-center",
                                active ? "text-white border-transparent shadow-md scale-[1.02]" : "bg-white text-slate-400 border-slate-100"
                              )}
                              style={active ? { background: BRAND } : {}}
                            >
                              {app}
                            </button>
                          );
                        })}
                      </div>
                  </Field>
                </div>
              </Card>
            </div>

            {mode === "change" && (
              <>
                <Card title="Timeline" subtitle="Date di rilascio">
                  <div className="space-y-4">
                    <Field label="Collaudo">
                      <input type="date" value={cForm.rilascio_in_collaudo} onChange={e => setCForm(p => ({ ...p, rilascio_in_collaudo: e.target.value }))} className="w-full p-3 rounded-xl bg-amber-50 text-xs font-mono border-none outline-none" />
                    </Field>
                    <Field label="Produzione">
                      <input type="date" value={cForm.rilascio_in_produzione} onChange={e => setCForm(p => ({ ...p, rilascio_in_produzione: e.target.value }))} className="w-full p-3 rounded-xl bg-emerald-50 text-xs font-mono border-none outline-none" />
                    </Field>
                  </div>
                </Card>

                <Card title="Checklist" subtitle="Documentazione">
                  <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                    <TicketSquare label="A" title="Analisi" active={cForm.ticket_analisi} color="green" onClick={() => setCForm(p => ({ ...p, ticket_analisi: !p.ticket_analisi }))} />
                    <TicketSquare label="T" title="Test" active={cForm.ticket_test} color="blue" onClick={() => setCForm(p => ({ ...p, ticket_test: !p.ticket_test }))} />
                    <TicketSquare label="R" title="Rilascio" active={cForm.ticket_rilascio} color="purple" onClick={() => setCForm(p => ({ ...p, ticket_rilascio: !p.ticket_rilascio }))} />
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}