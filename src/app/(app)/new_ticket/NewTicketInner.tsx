"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

import { useSearchParams } from 'next/navigation';
import {
  APPLICATIVI_LIST,
  TOOL_LIST,
  ATTIVITA_LIST,
  SPRINT_LIST,
  STATO_TICKET_LIST,
  TIPOLOGIA_TICKET,
  PRIORITA_LIST,
} from "@/components/parametri_ticket/attivita";
import {
  TIPO_CHANGE_LIST,
  STATO_CHANGE_LIST,
} from "@/components/parametri_ticket/change";

// --- TIPI E COSTANTI ---
type Mode = "attività" |"incident" | "change";
type Profile = { id: string; nome_completo: string | null };
type Cliente = { id: string; nome: string | null };
type StatoTicket = (typeof STATO_TICKET_LIST)[number];
type PrioritaTicket = (typeof PRIORITA_LIST)[number];
const BRAND = "#0150a0";
const BRAND_BG = "#eaf2fb";

type Applicativo = (typeof APPLICATIVI_LIST)[number];
type Tool = (typeof TOOL_LIST)[number];
type TipoAttivita = (typeof ATTIVITA_LIST)[number];
type TipoChange = (typeof TIPO_CHANGE_LIST)[number];
type StatoChange = (typeof STATO_CHANGE_LIST)[number];
type Sprint = (typeof SPRINT_LIST)[number];

// --- HELPERS ---
const cn = (...xs: Array<string | false | undefined | null>) => xs.filter(Boolean).join(" ");

function normalizeString(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}



// --- COMPONENTI UI ---
function Card({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
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
        active
          ? `${palette.split(" ")[0]} border-transparent text-white shadow-md scale-105`
          : `bg-white ${palette.split(" ")[1]} text-slate-300 ${palette.split(" ")[3]}`
      )}
    >
      {label}
    </button>
  );
}

// --- PAGINA PRINCIPALE ---
export default function CreateAttivitaOrChangePage() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("attività");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTaskMode = mode === "attività" || mode === "incident";
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  
  const [success, setSuccess] = useState(false);
  const [showNewCliente, setShowNewCliente] = useState(false);
  const [newClienteName, setNewClienteName] = useState("");
  const [creatingCliente, setCreatingCliente] = useState(false);
  const [aForm, setAForm] = useState({
    titolo: "",
    descrizione: "",
    applicativo: [] as Applicativo[],
    tool: "" as "" | Tool,
    tipo_di_attivita: "" as "" | TipoAttivita,
    sprint: "Sprint" as Sprint,
    assignee: "",
    cliente_id: "",
    numero_priorita: 100,
    in_lavorazione_ora: true,
    n_tag: "",
    link_tag: "",
    stato: "Aperto" as StatoTicket,
    priorita: PRIORITA_LIST[0] as PrioritaTicket,
  });

  const [cForm, setCForm] = useState({
    change_id: "",
    tipo_change: "" as "" | TipoChange,
    applicativo: [] as Applicativo[],
    breve_descrizione: "",
    stato: "In Attesa" as StatoChange,
    rilascio_in_collaudo: "",
    rilascio_in_produzione: "",
    ticket_analisi: false,
    ticket_test: false,
    ticket_rilascio: false,
    note_hrm: "",
    note_sviluppatori: "",
  });
  const esselungaId = useMemo(() => {
  const cliente = clienti.find(
    (c) => normalizeString(c.nome) === "esselunga"
  );
    return cliente?.id ?? null;
  }, [clienti]);

  const isEsselungaSelected = aForm.cliente_id === esselungaId;
  const sprintOptions = useMemo(() => {
  if (mode === "attività") return ["Sprint", "Backlog"] as Sprint[];
  if (mode === "incident") return ["Opex", "Backlog"] as Sprint[];
  return [];
}, [mode]);
  useEffect(() => {
  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const queryCliente = searchParams.get("cliente");
      const queryTitolo = searchParams.get("titolo");
      const queryAssignee = searchParams.get("assignee");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      const [{ data: pData, error: pError }, { data: cData, error: cError }] =
        await Promise.all([
          supabase.from("profili").select("id, nome_completo").order("nome_completo"),
          supabase.from("clienti").select("id, nome").order("nome"),
        ]);

      if (pError) throw pError;
      if (cError) throw cError;

      const profiliList = (pData as Profile[]) ?? [];
      const clientiList = (cData as Cliente[]) ?? [];

      setProfiles(profiliList);
      setClienti(clientiList);

      const matchedCliente = queryCliente
        ? clientiList.find(
            (c) => normalizeString(c.nome) === normalizeString(queryCliente)
          )
        : null;

      setAForm((prev) => ({
        ...prev,
        titolo: queryTitolo?.trim() || prev.titolo,
        assignee: queryAssignee || user?.id || prev.assignee,
        cliente_id: matchedCliente?.id || prev.cliente_id,
      }));
    } catch (err: any) {
      setError(err.message ?? "Errore durante il caricamento dati");
    } finally {
      setLoading(false);
    }
  }

  loadData();
}, [supabase, searchParams]);

  

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

      if (mode === "attività" ||mode==="incident") {
        if (!aForm.cliente_id) {
          throw new Error("Seleziona un cliente valido");
        }

        const payload = {
          titolo: aForm.titolo.trim(),
          descrizione: aForm.descrizione.trim() || null,
          applicativo: aForm.applicativo.length > 0 ? aForm.applicativo : null,
          tool: aForm.tool || null,
          tipo_di_attivita: aForm.tipo_di_attivita || null,
          sprint: aForm.sprint || "Sprint",
          assignee: aForm.assignee || user.id,
          cliente_id: aForm.cliente_id,
          numero_priorita: aForm.numero_priorita || 100,
          in_lavorazione_ora: aForm.in_lavorazione_ora,
          n_tag: aForm.n_tag.trim() || null,
          priorita: aForm.priorita,
          utente_id: user.id,
          link_tag: aForm.link_tag.trim() || null,
          stato: aForm.stato || "Non Iniziato",
        };

        const { error: err } = await supabase.from("ticket").insert([payload]);
        if (err) throw err;
      } else {
        const payload = {
          ...cForm,
          change_id: cForm.change_id.trim(),
          rilascio_in_collaudo: cForm.rilascio_in_collaudo || null,
          rilascio_in_produzione: cForm.rilascio_in_produzione || null,
        };

        const { error: err } = await supabase.from("changes").insert([payload]);
        if (err) throw err;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const createNewCliente = async () => {
    const nomePulito = newClienteName.trim();

    if (!nomePulito) {
      setError("Inserisci il nome del nuovo cliente");
      return;
    }

    const alreadyExists = clienti.some(
      (c) => normalizeString(c.nome) === normalizeString(nomePulito)
    );

    if (alreadyExists) {
      setError("Questo cliente esiste già");
      return;
    }

    try {
      setCreatingCliente(true);
      setError(null);

      const { data, error } = await supabase
        .from("clienti")
        .insert([{ nome: nomePulito }])
        .select("id, nome")
        .single();

      if (error) throw error;

      setClienti((prev) =>
        [...prev, data as Cliente].sort((a, b) =>
          (a.nome || "").localeCompare(b.nome || "", "it")
        )
      );

      setAForm((prev) => ({
        ...prev,
        cliente_id: data.id,
      }));

      setNewClienteName("");
      setShowNewCliente(false);
    } catch (err: any) {
      setError(err.message ?? "Errore durante la creazione del cliente");
    } finally {
      setCreatingCliente(false);
    }
  };
  useEffect(() => {
  if (mode === "incident") {
    setAForm((p) => ({
      ...p,
      tipo_di_attivita: "Incident Resolution",
    }));
  }
}, [mode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-slate-300 animate-pulse">
        CARICAMENTO...
      </div>
    );
  }
  const allSelected =
  mode === "attività"
    ? aForm.applicativo.length === APPLICATIVI_LIST.length - 1
    : cForm.applicativo.length === APPLICATIVI_LIST.length - 1;
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div
              className="text-[10px] font-black uppercase tracking-[0.4em] mb-1"
              style={{ color: BRAND }}
            >
              Management System
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            Nuov{mode === "change" ? "a Change" : mode === "incident" ? "o Incident" : "a Attività"}
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-[24px] shadow-sm border border-slate-100">
            <div className="flex bg-slate-100 rounded-2xl p-1">
              {TIPOLOGIA_TICKET.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m.toLowerCase() as Mode)}
                  className={cn(
                    "px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-300",
                    mode === m.toLowerCase()
                      ? "bg-white text-slate-900 shadow-sm scale-105"
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              onClick={save}
              disabled={saving || (mode === "attività"||mode==="incident" ? !aForm.titolo : !cForm.change_id)}
              className="px-8 py-2.5 rounded-xl text-[10px] font-black uppercase text-white transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:grayscale"
              style={{ background: BRAND }}
            >
              {saving ? "In corso..." : "Crea Entry"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-8 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="mb-8 p-4 rounded-2xl bg-green-50 border border-green-200 text-green-600 text-xs font-bold">
            ✅ Evento creato
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            {mode === "attività"||mode === "incident" ? (
              <Card title="Dettagli Principali" subtitle="Informazioni base del ticket">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Titolo Attività" hint="Richiesto">
                    <input
                      value={aForm.titolo}
                      onChange={(e) => setAForm((p) => ({ ...p, titolo: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 text-sm font-bold transition-all outline-none"
                      placeholder="Cosa bisogna fare?"
                    />
                  </Field>

                 <Field label="Cliente" hint="Tabella Clienti">
  <div className="space-y-3">
    <select
      value={showNewCliente ? "__new__" : aForm.cliente_id}
      onChange={(e) => {
        const value = e.target.value;

        if (value === "__new__") {
          setShowNewCliente(true);
          setAForm((p) => ({ ...p, cliente_id: "" }));
          return;
        }

        setShowNewCliente(false);
        setAForm((p) => ({ ...p, cliente_id: value }));
      }}
      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 text-sm font-bold outline-none cursor-pointer"
    >
      <option value="">Seleziona cliente...</option>

      {clienti.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nome}
        </option>
      ))}

      <option value="__new__">+ Aggiungi nuovo cliente</option>
    </select>

    {showNewCliente && (
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={newClienteName}
          onChange={(e) => setNewClienteName(e.target.value)}
          placeholder="Nome nuovo cliente"
          className="flex-1 px-4 py-3 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 text-sm font-bold outline-none"
        />

        <button
          type="button"
          onClick={createNewCliente}
          disabled={creatingCliente || !newClienteName.trim()}
          className="px-4 py-3 rounded-2xl text-white text-xs font-black uppercase disabled:opacity-50"
          style={{ background: BRAND }}
        >
          {creatingCliente ? "Salvataggio..." : "Aggiungi"}
        </button>
      </div>
    )}
  </div>
</Field>
                    
                  

                  <Field label={`N° ${
                          mode === "incident"
                            ? "Incident"
                            : "TAG"
                        }`} hint="ID Ticket">
                    <input
                      type="text"
                      value={aForm.n_tag}
                      onChange={(e) => setAForm((p) => ({ ...p, n_tag: e.target.value }))}
                      className="w-full px-4 py-2 rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold outline-none"
                    />
                  </Field>
                  <Field
                        label={`Link ${
                          mode === "incident"
                            ? "Incident SN"
                            : "TAG SN"
                        }`}
                        hint="URL Ticket"
                      >
                    <input
                      type="text"
                      value={aForm.link_tag}
                      onChange={(e) => setAForm((p) => ({ ...p, link_tag: e.target.value }))}
                      className="w-full px-4 py-2 rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold outline-none"
                      placeholder="https://..."
                    />
                  </Field>
                  
                  
                  <Field label="Stato Ticket">
                  <select
                    value={aForm.stato}
                    onChange={(e) =>
                      setAForm((p) => ({
                        ...p,
                        stato: e.target.value as StatoTicket,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold outline-none cursor-pointer"
                  >
                    {STATO_TICKET_LIST.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                  
                    
                    <Field label="Priorità">
                        <div className="inline-flex rounded-2xl bg-slate-50 p-1 border border-slate-100">
                          {PRIORITA_LIST.map((p) => {
                            const active = aForm.priorita === p;

                            const activeStyle =
                              p === "Bassa"
                                ? "bg-white text-green-700 shadow-sm"
                                : p === "Media"
                                ? "bg-white text-amber-700 shadow-sm"
                                : "bg-white text-red-700 shadow-sm";

                            const dot =
                              p === "Bassa"
                                ? "bg-green-500"
                                : p === "Media"
                                ? "bg-amber-500"
                                : "bg-red-500";

                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() =>
                                  setAForm((prev) => ({
                                    ...prev,
                                    priorita: p as PrioritaTicket,
                                  }))
                                }
                                className={cn(
                                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-black transition-all",
                                  active ? activeStyle : "text-slate-400 hover:text-slate-700"
                                )}
                              >
                                <span className={cn("h-2.5 w-2.5 rounded-full", dot)} />
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </Field>
                      <Field label="Assegnato a" hint="Chi si occupa del ticket?">
                    <select
                      value={aForm.assignee}
                      onChange={(e) => setAForm((p) => ({ ...p, assignee: e.target.value }))}
                      className="w-full px-4 py-2 rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="">Nessun assegnatario</option>
                      {profiles.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.nome_completo || "Utente senza nome"}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Descrizione">
                      <textarea
                        rows={4}
                        value={aForm.descrizione}
                        onChange={(e) => setAForm((p) => ({ ...p, descrizione: e.target.value }))}
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 text-sm outline-none resize-none transition-all"
                        placeholder="Dettagli dell'attività..."
                      />
                    </Field>
                  </div>


                </div>
              </Card>
            ) : (
              <Card title="Dettagli Change" subtitle="Configurazione tecnica del rilascio">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Change ID" hint="es. CHG00123">
                    <input
                      value={cForm.change_id}
                      onChange={(e) =>
                        setCForm((p) => ({ ...p, change_id: e.target.value.toUpperCase() }))
                      }
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent focus:border-slate-200 text-sm font-mono font-bold outline-none"
                    />
                  </Field>

                  <Field label="Tipologia">
                    <select
                      value={cForm.tipo_change}
                      onChange={(e) =>
                        setCForm((p) => ({ ...p, tipo_change: e.target.value as TipoChange | "" }))
                      }
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent text-sm font-bold outline-none"
                    >
                      <option value="">Scegli tipo...</option>
                      {TIPO_CHANGE_LIST.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Descrizione Estesa">
                      <textarea
                        rows={3}
                        value={cForm.breve_descrizione}
                        onChange={(e) =>
                          setCForm((p) => ({ ...p, breve_descrizione: e.target.value }))
                        }
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
                      onChange={(e) => setCForm((p) => ({ ...p, note_hrm: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent text-sm outline-none"
                    />
                  </Field>

                  <Field label="Note Sviluppo">
                    <textarea
                      value={cForm.note_sviluppatori}
                      onChange={(e) =>
                        setCForm((p) => ({ ...p, note_sviluppatori: e.target.value }))
                      }
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent text-sm outline-none"
                    />
                  </Field>
                </div>
              </Card>
            )}
          </div>

          {isEsselungaSelected  && (
            <div className="lg:col-span-4 space-y-8">
              <Card
                title="Tech Context"
                subtitle="Target: Esselunga"
                className="border-blue-100"
              >
                <div className="space-y-6">
                  {isTaskMode    && (
                    <>
                     <Field label="Tipo di Attività">
                        {mode === "incident" ? (
                          <input
                            value="Incident Resolution"
                            readOnly
                            className="w-full px-4 py-3 rounded-2xl bg-slate-100 border border-transparent text-xs font-bold outline-none cursor-not-allowed"
                          />
                        ) : (
                          <select
                            value={aForm.tipo_di_attivita}
                            onChange={(e) =>
                              setAForm((p) => ({
                                ...p,
                                tipo_di_attivita: e.target.value as TipoAttivita | "",
                              }))
                            }
                            className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-transparent text-xs font-bold outline-none cursor-pointer"
                          >
                            <option value="">Seleziona tipo...</option>

                            {ATTIVITA_LIST
                              .filter((t) => t !== "Incident Resolution")
                              .map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                          </select>
                        )}
                      </Field>

                      <Field label="Tool Principale">
                        <div className="grid grid-cols-2 gap-2">
                          {TOOL_LIST.map((t) => {
                            const active = aForm.tool === t;

                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() =>
                                  setAForm((p) => ({
                                    ...p,
                                    tool: p.tool === t ? "" : t,
                                  }))
                                }
                                className={cn(
                                  "py-2 rounded-xl text-[10px] font-bold border transition-all",
                                  active
                                    ? "bg-slate-900 text-white border-transparent shadow-sm"
                                    : "bg-white text-slate-400 border-slate-100"
                                )}
                              >
                                {t}
                              </button>
                            );
                          })}
                        </div>
                      </Field>

                      <Field label="Pianificazione Sprint">
                        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 rounded-2xl">
                          {sprintOptions.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setAForm((p) => ({ ...p, sprint: s }))}
                              className={cn(
                                "py-2 rounded-xl text-[10px] font-black uppercase transition-all",
                                aForm.sprint === s
                                  ? "bg-white shadow-sm text-slate-900"
                                  : "text-slate-400"
                              )}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </Field>
                    </>
                  )}

                  <Field label="Applicativi">
                    <div className="grid grid-cols-2 gap-2">
                      {APPLICATIVI_LIST.map((app) => {
                        const active =
                          app === "ALL"
                            ? allSelected
                            : mode === "attività"
                            ? aForm.applicativo.includes(app)
                            : cForm.applicativo.includes(app);

                        return (
                          <button
                            key={app}
                            type="button"
                            onClick={() => {
                              if (app === "ALL") {
                                const allApps = APPLICATIVI_LIST.filter((a) => a !== "ALL");

                                if (mode === "attività") {
                                  setAForm((p) => ({
                                    ...p,
                                    applicativo: allSelected ? [] : allApps,
                                  }));
                                } else {
                                  setCForm((p) => ({
                                    ...p,
                                    applicativo: allSelected ? [] : allApps,
                                  }));
                                }

                                return;
                              }

                              if (mode === "attività") {
                                setAForm((p) => ({
                                  ...p,
                                  applicativo: p.applicativo.includes(app)
                                    ? p.applicativo.filter((x) => x !== app)
                                    : [...p.applicativo, app],
                                }));
                              } else {
                                setCForm((p) => ({
                                  ...p,
                                  applicativo: p.applicativo.includes(app)
                                    ? p.applicativo.filter((x) => x !== app)
                                    : [...p.applicativo, app],
                                }));
                              }
                            }}
                            className={cn(
                              "px-2 py-3 rounded-xl text-[9px] font-black uppercase border transition-all text-center",
                              active
                                ? "text-white border-transparent shadow-md scale-[1.02]"
                                : "bg-white text-slate-400 border-slate-100"
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

              {mode === "change" && (
                <>
                  <Card title="Timeline" subtitle="Date di rilascio">
                    <div className="space-y-4">
                      <Field label="Collaudo">
                        <input
                          type="date"
                          value={cForm.rilascio_in_collaudo}
                          onChange={(e) =>
                            setCForm((p) => ({ ...p, rilascio_in_collaudo: e.target.value }))
                          }
                          className="w-full p-3 rounded-xl bg-amber-50 text-xs font-mono border-none outline-none"
                        />
                      </Field>

                      <Field label="Produzione">
                        <input
                          type="date"
                          value={cForm.rilascio_in_produzione}
                          onChange={(e) =>
                            setCForm((p) => ({ ...p, rilascio_in_produzione: e.target.value }))
                          }
                          className="w-full p-3 rounded-xl bg-emerald-50 text-xs font-mono border-none outline-none"
                        />
                      </Field>
                    </div>
                  </Card>

                  <Card title="Checklist" subtitle="Documentazione">
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                      <TicketSquare
                        label="A"
                        title="Analisi"
                        active={cForm.ticket_analisi}
                        color="green"
                        onClick={() =>
                          setCForm((p) => ({ ...p, ticket_analisi: !p.ticket_analisi }))
                        }
                      />
                      <TicketSquare
                        label="T"
                        title="Test"
                        active={cForm.ticket_test}
                        color="blue"
                        onClick={() =>
                          setCForm((p) => ({ ...p, ticket_test: !p.ticket_test }))
                        }
                      />
                      <TicketSquare
                        label="R"
                        title="Rilascio"
                        active={cForm.ticket_rilascio}
                        color="purple"
                        onClick={() =>
                          setCForm((p) => ({ ...p, ticket_rilascio: !p.ticket_rilascio }))
                        }
                      />
                    </div>
                  </Card>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}