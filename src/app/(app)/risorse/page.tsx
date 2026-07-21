"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppPage from "@/components/ui/AppPage";
import AppCard from "@/components/ui/AppCard";
import { createClient } from "@/lib/supabase";
import {
  CheckCircle2,
  CircleDashed,
  Clock,
  Loader2,
  MinusCircle,
  Search,
  Users,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Tipi                                                                */
/* ------------------------------------------------------------------ */

type Profilo = {
  id: string;
  nome: string | null;
  nome_completo: string | null;
  email: string | null;
  ruolo: string | null;
};

type Cliente = {
  id: string;
  nome: string;
};

type Step = {
  id: string;
  cliente_id: string;
  nome_step: string;
  ordine: number;
};

type StatoAbilitazione =
  | "da_fare"
  | "in_corso"
  | "completato"
  | "non_applicabile";

type RigaStato = {
  profilo_id: string;
  step_id: string;
  cliente_id: string;
  stato: StatoAbilitazione;
};

const STATI: {
  value: StatoAbilitazione;
  label: string;
  icon: typeof CheckCircle2;
  cella: string;
  chip: string;
}[] = [
  {
    value: "da_fare",
    label: "Da fare",
    icon: CircleDashed,
    cella: "bg-slate-50 text-slate-400 hover:bg-slate-100",
    chip: "bg-slate-100 text-slate-500",
  },
  {
    value: "in_corso",
    label: "In corso",
    icon: Clock,
    cella: "bg-amber-50 text-amber-600 hover:bg-amber-100",
    chip: "bg-amber-50 text-amber-700",
  },
  {
    value: "completato",
    label: "Completato",
    icon: CheckCircle2,
    cella: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",
    chip: "bg-emerald-50 text-emerald-700",
  },
  {
    value: "non_applicabile",
    label: "Non applicabile",
    icon: MinusCircle,
    cella: "bg-slate-100 text-slate-300 hover:bg-slate-200",
    chip: "bg-slate-100 text-slate-400",
  },
];

const STATO_BY_VALUE = new Map(STATI.map((stato) => [stato.value, stato]));

/** Ordine di rotazione al clic sulla cella. */
const CICLO: StatoAbilitazione[] = [
  "da_fare",
  "in_corso",
  "completato",
  "non_applicabile",
];

function nomeVisualizzato(profilo: Profilo) {
  return (
    profilo.nome_completo || profilo.nome || profilo.email || "Senza nome"
  );
}

function chiave(profiloId: string, stepId: string) {
  return `${profiloId}::${stepId}`;
}

/* ------------------------------------------------------------------ */
/* Pagina                                                              */
/* ------------------------------------------------------------------ */

export default function RisorsePage() {
  const supabase = useMemo(() => createClient(), []);

  const [profili, setProfili] = useState<Profilo[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stati, setStati] = useState<Map<string, StatoAbilitazione>>(new Map());

  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [inSalvataggio, setInSalvataggio] = useState<string | null>(null);

  const [filtroCliente, setFiltroCliente] = useState("");
  const [ricerca, setRicerca] = useState("");

  /* ---------------------------- caricamento --------------------------- */

  const carica = useCallback(async () => {
    setLoading(true);

    const [profiliRes, clientiRes, stepsRes, statiRes] = await Promise.all([
      supabase
        .from("profili")
        .select("id, nome, nome_completo, email, ruolo")
        .order("nome_completo", { ascending: true }),
      supabase.from("clienti").select("id, nome").order("nome"),
      supabase
        .from("clienti_abilitazione_step")
        .select("id, cliente_id, nome_step, ordine")
        .order("ordine", { ascending: true }),
      supabase
        .from("clienti_abilitazione_utente")
        .select("profilo_id, step_id, cliente_id, stato"),
    ]);

    const primoErrore =
      profiliRes.error || clientiRes.error || stepsRes.error || statiRes.error;

    if (primoErrore) {
      console.error("Errore caricamento risorse:", primoErrore);
      setErrore(primoErrore.message);
      setLoading(false);
      return;
    }

    setErrore(null);
    setProfili(profiliRes.data ?? []);
    setClienti(clientiRes.data ?? []);
    setSteps(stepsRes.data ?? []);

    const mappa = new Map<string, StatoAbilitazione>();

    for (const riga of (statiRes.data ?? []) as RigaStato[]) {
      mappa.set(chiave(riga.profilo_id, riga.step_id), riga.stato);
    }

    setStati(mappa);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    carica();
  }, [carica]);

  /* ------------------------------- derivati --------------------------- */

  const stepsPerCliente = useMemo(() => {
    const mappa = new Map<string, Step[]>();

    for (const step of steps) {
      const lista = mappa.get(step.cliente_id) ?? [];
      lista.push(step);
      mappa.set(step.cliente_id, lista);
    }

    return mappa;
  }, [steps]);

  const profiliFiltrati = useMemo(() => {
    const termine = ricerca.trim().toLowerCase();

    if (!termine) return profili;

    return profili.filter((profilo) =>
      [profilo.nome, profilo.nome_completo, profilo.email, profilo.ruolo]
        .filter(Boolean)
        .some((valore) => String(valore).toLowerCase().includes(termine))
    );
  }, [profili, ricerca]);

  const stepsAttivi = filtroCliente
    ? stepsPerCliente.get(filtroCliente) ?? []
    : [];

  function getStato(profiloId: string, stepId: string): StatoAbilitazione {
    return stati.get(chiave(profiloId, stepId)) ?? "da_fare";
  }

  /** Quanti step risultano completati su quelli applicabili. */
  function avanzamento(profiloId: string, clienteId: string) {
    const lista = stepsPerCliente.get(clienteId) ?? [];

    const applicabili = lista.filter(
      (step) => getStato(profiloId, step.id) !== "non_applicabile"
    );

    const completati = applicabili.filter(
      (step) => getStato(profiloId, step.id) === "completato"
    );

    return {
      completati: completati.length,
      totale: applicabili.length,
      percentuale: applicabili.length
        ? Math.round((completati.length / applicabili.length) * 100)
        : 0,
    };
  }

  /* -------------------------- cambio di stato ------------------------- */

  async function cicla(profiloId: string, step: Step) {
    const attuale = getStato(profiloId, step.id);
    const prossimo = CICLO[(CICLO.indexOf(attuale) + 1) % CICLO.length];
    const key = chiave(profiloId, step.id);

    // Aggiornamento ottimistico: la matrice resta reattiva.
    setStati((prev) => new Map(prev).set(key, prossimo));
    setInSalvataggio(key);

    const { error } = await supabase.from("clienti_abilitazione_utente").upsert(
      {
        profilo_id: profiloId,
        step_id: step.id,
        cliente_id: step.cliente_id,
        stato: prossimo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profilo_id,step_id" }
    );

    setInSalvataggio(null);

    if (error) {
      console.error("Errore salvataggio stato:", error);
      setErrore(error.message);

      // Ripristina il valore precedente.
      setStati((prev) => new Map(prev).set(key, attuale));
    }
  }

  /* -------------------------------- render ---------------------------- */

  const clienteSelezionato = clienti.find(
    (cliente) => cliente.id === filtroCliente
  );

  return (
    <AppPage
      title="Risorse"
      subtitle="Utenti registrati e stato delle abilitazioni per cliente"
      icon={<Users size={22} />}
      maxWidth="full"
    >
      <div className="space-y-6 pb-16">
        <AppCard padded={false} className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />

              <input
                type="text"
                placeholder="Cerca persona..."
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                className="w-full rounded-xl border border-transparent bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-slate-300 focus:bg-white"
              />
            </div>

            <select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-[#0150a0] sm:w-64"
            >
              <option value="">Tutti i clienti (riepilogo)</option>
              {clienti.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {STATI.map((stato) => {
                const Icon = stato.icon;

                return (
                  <span
                    key={stato.value}
                    className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold ${stato.chip}`}
                  >
                    <Icon className="h-3 w-3" />
                    {stato.label}
                  </span>
                );
              })}
            </div>
          </div>
        </AppCard>

        {errore && (
          <AppCard className="border-red-200 bg-red-50">
            <p className="text-sm font-semibold text-red-700">{errore}</p>
          </AppCard>
        )}

        {loading ? (
          <AppCard className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Caricamento…
          </AppCard>
        ) : filtroCliente ? (
          /* ---------------- matrice persone x step del cliente --------- */
          <AppCard padded={false} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="font-semibold text-gray-900">
                  {clienteSelezionato?.nome}
                </h2>
                <p className="text-xs text-gray-500">
                  {stepsAttivi.length} step · {profiliFiltrati.length} persone ·
                  clicca una cella per cambiare stato
                </p>
              </div>
            </div>

            {stepsAttivi.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-semibold text-gray-500">
                  Nessuno step configurato per questo cliente
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Aggiungili da Clienti → Abilitazione Utenti.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-slate-50">
                      <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-gray-400">
                        Persona
                      </th>

                      {stepsAttivi.map((step) => (
                        <th
                          key={step.id}
                          className="px-2 py-3 text-center text-[10px] font-bold text-gray-500"
                        >
                          <span className="mx-auto block max-w-[110px] leading-tight">
                            {step.nome_step}
                          </span>
                        </th>
                      ))}

                      <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-widest text-gray-400">
                        Avanzamento
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {profiliFiltrati.map((profilo) => {
                      const progresso = avanzamento(profilo.id, filtroCliente);

                      return (
                        <tr
                          key={profilo.id}
                          className="border-b border-gray-100 last:border-0 hover:bg-slate-50/60"
                        >
                          <td className="sticky left-0 z-10 bg-white px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900">
                              {nomeVisualizzato(profilo)}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {profilo.ruolo || profilo.email}
                            </p>
                          </td>

                          {stepsAttivi.map((step) => {
                            const stato = getStato(profilo.id, step.id);
                            const config = STATO_BY_VALUE.get(stato)!;
                            const Icon = config.icon;
                            const key = chiave(profilo.id, step.id);

                            return (
                              <td key={step.id} className="px-2 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => cicla(profilo.id, step)}
                                  title={`${step.nome_step}: ${config.label}`}
                                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl transition ${config.cella}`}
                                >
                                  {inSalvataggio === key ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Icon className="h-4 w-4" />
                                  )}
                                </button>
                              </td>
                            );
                          })}

                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{ width: `${progresso.percentuale}%` }}
                                />
                              </div>

                              <span className="w-16 text-right text-xs font-bold text-gray-600">
                                {progresso.completati}/{progresso.totale}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </AppCard>
        ) : (
          /* ---------------- riepilogo per persona su tutti i clienti ---- */
          <AppCard padded={false} className="overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="font-semibold text-gray-900">
                {profiliFiltrati.length} utenti registrati
              </h2>
              <p className="text-xs text-gray-500">
                Seleziona un cliente per gestire i singoli step
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {profiliFiltrati.map((profilo) => (
                <div key={profilo.id} className="px-6 py-4">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {nomeVisualizzato(profilo)}
                      </p>
                      <p className="text-xs text-gray-400">{profilo.email}</p>
                    </div>

                    {profilo.ruolo && (
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-tight text-slate-500">
                        {profilo.ruolo}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {clienti.filter(
                      (cliente) => (stepsPerCliente.get(cliente.id) ?? []).length > 0
                    ).length === 0 && (
                      <span className="text-xs text-gray-400">
                        Nessun cliente ha step di abilitazione configurati.
                      </span>
                    )}

                    {clienti.map((cliente) => {
                      const lista = stepsPerCliente.get(cliente.id) ?? [];
                      if (lista.length === 0) return null;

                      const progresso = avanzamento(profilo.id, cliente.id);
                      const completo =
                        progresso.totale > 0 &&
                        progresso.completati === progresso.totale;

                      return (
                        <button
                          key={cliente.id}
                          type="button"
                          onClick={() => setFiltroCliente(cliente.id)}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                            completo
                              ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                              : progresso.completati > 0
                                ? "border-amber-100 bg-amber-50 text-amber-700"
                                : "border-gray-100 bg-slate-50 text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {cliente.nome}
                          <span className="opacity-70">
                            {progresso.completati}/{progresso.totale}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {profiliFiltrati.length === 0 && (
                <div className="p-10 text-center text-sm text-gray-500">
                  Nessun utente trovato
                </div>
              )}
            </div>
          </AppCard>
        )}
      </div>
    </AppPage>
  );
}
