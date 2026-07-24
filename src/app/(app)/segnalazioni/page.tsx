"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppPage from "@/components/ui/AppPage";
import AppCard from "@/components/ui/AppCard";
import { createClient } from "@/lib/supabase";
import { APPLICATIVI_LIST } from "@/components/parametri_ticket/attivita";
import {
  AlertTriangle,
  ClipboardList,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import IncidentPanel, {
  IncidentDati,
  STATI_INCIDENT,
  StatoIncident,
} from "@/components/segnalazioni/IncidentPanel";
import MultiSelectCreatable from "@/components/ui/MultiSelectCreatable";

/** Valore sentinella per il selettore cliente: mostra tutti i clienti insieme. */
const ALL_CLIENTI = "__all__";

type TipoVista = "attivita" | "incident";

/* ------------------------------------------------------------------ */
/* Tipi                                                                */
/* ------------------------------------------------------------------ */

type Cliente = { id: string; nome: string };

type StatoSegnalazione =
  | "aperto"
  | "in_lavorazione"
  | "risolto"
  | "non_risolvibile";

type Segnalazione = {
  id: string;
  cliente_id: string;
  applicativo: string[] | null;
  titolo: string | null;
  nome_evento: string | null;
  nome_parametro: string | null;
  nota: string | null;
  data_segnalazione: string;
  thread_email: string | null;
  verbalizzazione: string | null;
  stato: StatoSegnalazione;
};

const STATI: {
  value: StatoSegnalazione;
  label: string;
  chip: string;
}[] = [
  { value: "aperto", label: "Aperto", chip: "bg-red-50 text-red-600 border border-red-100" },
  {
    value: "in_lavorazione",
    label: "In lavorazione",
    chip: "bg-amber-50 text-amber-700 border border-amber-100",
  },
  {
    value: "risolto",
    label: "Risolto",
    chip: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  },
  {
    value: "non_risolvibile",
    label: "Non risolvibile",
    chip: "bg-slate-100 text-slate-500 border border-slate-200",
  },
];

const STATO_BY_VALUE = new Map(STATI.map((s) => [s.value, s]));

/** Il campo applicativo ha senso solo su questo cliente. */
const CLIENTE_CON_APPLICATIVO = /esselunga/i;

type Bozza = {
  cliente_id: string;
  applicativo: string[];
  titolo: string;
  nome_evento: string;
  nome_parametro: string;
  nota: string;
  data_segnalazione: string;
  thread_email: string;
  verbalizzazione: string;
  stato: StatoSegnalazione;
};

function bozzaVuota(): Bozza {
  return {
    cliente_id: "",
    applicativo: [],
    titolo: "",
    nome_evento: "",
    nome_parametro: "",
    nota: "",
    data_segnalazione: new Date().toISOString().slice(0, 10),
    thread_email: "",
    verbalizzazione: "",
    stato: "aperto",
  };
}

/* ------------------------------------------------------------------ */
/* Pagina                                                              */
/* ------------------------------------------------------------------ */

export default function SegnalazioniPage() {
  const supabase = useMemo(() => createClient(), []);

  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [segnalazioni, setSegnalazioni] = useState<Segnalazione[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  const [clienteId, setClienteId] = useState("");
  const [tipoVista, setTipoVista] = useState<TipoVista>("attivita");
  const [filtroApplicativo, setFiltroApplicativo] = useState("");
  const [filtroStato, setFiltroStato] = useState<StatoSegnalazione | "">("");
  const [filtroEvento, setFiltroEvento] = useState<string[]>([]);
  const [filtroParametro, setFiltroParametro] = useState<string[]>([]);
  const [ricerca, setRicerca] = useState("");

  // Filtri della vista Incident (delegati a IncidentPanel, ma resi qui
  // nella barra filtri condivisa in cima alla pagina).
  const [filtroStatoIncident, setFiltroStatoIncident] = useState<
    StatoIncident | ""
  >("");
  const [filtroEventoIncident, setFiltroEventoIncident] = useState("");
  const [filtroParametroIncident, setFiltroParametroIncident] = useState("");
  const [ricercaIncident, setRicercaIncident] = useState("");
  const [datiIncident, setDatiIncident] = useState<IncidentDati>({
    opzioniEventi: [],
    opzioniParametri: [],
    conteggi: {},
  });

  const handleDatiIncidentChange = useCallback((dati: IncidentDati) => {
    setDatiIncident(dati);
  }, []);

  const [formAperto, setFormAperto] = useState(false);
  const [inModifica, setInModifica] = useState<string | null>(null);
  const [bozza, setBozza] = useState<Bozza>(bozzaVuota());
  const [salvataggio, setSalvataggio] = useState(false);

  /* ---------------------------- caricamento --------------------------- */

  const caricaClienti = useCallback(async () => {
    const { data, error } = await supabase
      .from("clienti")
      .select("id, nome")
      .order("nome");

    if (error) {
      setErrore(error.message);
      return;
    }

    setClienti(data ?? []);

    // Di default mostra tutti i clienti insieme.
    if (!clienteId && data && data.length > 0) {
      setClienteId(ALL_CLIENTI);
    }
  }, [supabase, clienteId]);

  const caricaSegnalazioni = useCallback(
    async (cliente: string) => {
      if (!cliente) {
        setSegnalazioni([]);
        return;
      }

      setLoading(true);

      let query = supabase
        .from("segnalazioni_problemi")
        .select("*")
        .order("data_segnalazione", { ascending: false });

      if (cliente !== ALL_CLIENTI) {
        query = query.eq("cliente_id", cliente);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Errore caricamento segnalazioni:", error);
        setErrore(error.message);
        setLoading(false);
        return;
      }

      setErrore(null);
      setSegnalazioni((data ?? []) as Segnalazione[]);
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    caricaClienti().finally(() => setLoading(false));
  }, [caricaClienti]);

  useEffect(() => {
    if (clienteId) caricaSegnalazioni(clienteId);
  }, [clienteId, caricaSegnalazioni]);

  /* ------------------------------- derivati --------------------------- */

  const vistaTuttiClienti = clienteId === ALL_CLIENTI;

  const clientiById = useMemo(
    () => new Map(clienti.map((c) => [c.id, c.nome])),
    [clienti]
  );

  const isEsselungaId = useCallback(
    (id: string) => CLIENTE_CON_APPLICATIVO.test(clientiById.get(id) ?? ""),
    [clientiById]
  );

  const clienteCorrente = clienti.find((c) => c.id === clienteId);
  const mostraApplicativo =
    vistaTuttiClienti || CLIENTE_CON_APPLICATIVO.test(clienteCorrente?.nome ?? "");

  // Il filtro applicativo ha senso solo quando è selezionato un cliente
  // specifico con suddivisione per applicativo (es. Esselunga), non in
  // vista "Tutti i clienti".
  const mostraFiltroApplicativo =
    !vistaTuttiClienti && CLIENTE_CON_APPLICATIVO.test(clienteCorrente?.nome ?? "");

  const opzioniEvento = useMemo(() => {
    const set = new Set<string>();
    segnalazioni.forEach((s) => {
      (s.nome_evento || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .forEach((v) => set.add(v));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "it"));
  }, [segnalazioni]);

  const opzioniParametro = useMemo(() => {
    const set = new Set<string>();
    segnalazioni.forEach((s) => {
      (s.nome_parametro || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .forEach((v) => set.add(v));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "it"));
  }, [segnalazioni]);

  const listaFiltrata = useMemo(() => {
    const termine = ricerca.trim().toLowerCase();

    return segnalazioni.filter((s) => {
      const okApp =
        !filtroApplicativo || (s.applicativo ?? []).includes(filtroApplicativo);
      const okStato = !filtroStato || s.stato === filtroStato;

      const okEvento =
        filtroEvento.length === 0 ||
        (s.nome_evento || "")
          .split(",")
          .map((v) => v.trim())
          .some((v) => filtroEvento.includes(v));

      const okParametro =
        filtroParametro.length === 0 ||
        (s.nome_parametro || "")
          .split(",")
          .map((v) => v.trim())
          .some((v) => filtroParametro.includes(v));

      const okRicerca =
        !termine ||
        [s.nome_evento, s.nome_parametro, s.nota, s.verbalizzazione]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(termine));

      return okApp && okStato && okEvento && okParametro && okRicerca;
    });
  }, [
    segnalazioni,
    filtroApplicativo,
    filtroStato,
    filtroEvento,
    filtroParametro,
    ricerca,
  ]);

  /* ------------------------------- azioni ----------------------------- */

  function apriNuova() {
    const clienteDefault = vistaTuttiClienti ? "" : clienteId;

    setBozza({
      ...bozzaVuota(),
      cliente_id: clienteDefault,
      applicativo:
        isEsselungaId(clienteDefault) && filtroApplicativo
          ? [filtroApplicativo]
          : [],
    });
    setInModifica(null);
    setFormAperto(true);
  }

  function apriModifica(s: Segnalazione) {
    setBozza({
      cliente_id: s.cliente_id,
      applicativo: s.applicativo ?? [],
      titolo: s.titolo ?? "",
      nome_evento: s.nome_evento ?? "",
      nome_parametro: s.nome_parametro ?? "",
      nota: s.nota ?? "",
      data_segnalazione: s.data_segnalazione?.slice(0, 10) ?? "",
      thread_email: s.thread_email ?? "",
      verbalizzazione: s.verbalizzazione ?? "",
      stato: s.stato,
    });
    setInModifica(s.id);
    setFormAperto(true);
  }

  function chiudiForm() {
    setFormAperto(false);
    setInModifica(null);
    setBozza(bozzaVuota());
  }

  async function salva() {
    // Nome evento e parametro accettano più valori separati da virgola.
    const eventi = bozza.nome_evento
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const parametro = bozza.nome_parametro
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .join(", ");

    if (!bozza.cliente_id) {
      setErrore("Seleziona un cliente.");
      return;
    }

    setSalvataggio(true);
    setErrore(null);

    const base = {
      cliente_id: bozza.cliente_id,
      applicativo:
        isEsselungaId(bozza.cliente_id) && bozza.applicativo.length > 0
          ? bozza.applicativo
          : null,
      titolo: bozza.titolo.trim() || null,
      nome_parametro: parametro || null,
      nota: bozza.nota.trim() || null,
      data_segnalazione:
        bozza.data_segnalazione || new Date().toISOString().slice(0, 10),
      thread_email: bozza.thread_email.trim() || null,
      verbalizzazione: bozza.verbalizzazione.trim() || null,
      stato: bozza.stato,
      updated_at: new Date().toISOString(),
    };

    let risultato;

    if (inModifica) {
      // In modifica resta una sola riga: uniamo gli eventi in un unico valore.
      risultato = await supabase
        .from("segnalazioni_problemi")
        .update({
          ...base,
          nome_evento: eventi.length > 0 ? eventi.join(", ") : null,
        })
        .eq("id", inModifica);
    } else if (eventi.length === 0) {
      // Nessun evento indicato: creiamo comunque un'unica segnalazione.
      risultato = await supabase
        .from("segnalazioni_problemi")
        .insert({ ...base, nome_evento: null });
    } else {
      // In creazione: una segnalazione per ciascun evento indicato.
      const righe = eventi.map((nome_evento) => ({ ...base, nome_evento }));
      risultato = await supabase.from("segnalazioni_problemi").insert(righe);
    }

    setSalvataggio(false);

    if (risultato.error) {
      console.error("Errore salvataggio segnalazione:", risultato.error);
      setErrore(risultato.error.message);
      return;
    }

    chiudiForm();
    await caricaSegnalazioni(clienteId);
  }

  async function elimina(s: Segnalazione) {
    const etichetta = s.nome_evento || s.titolo || "senza nome";
    if (!confirm(`Eliminare la segnalazione "${etichetta}"?`)) return;

    const { error } = await supabase
      .from("segnalazioni_problemi")
      .delete()
      .eq("id", s.id);

    if (error) {
      setErrore(error.message);
      return;
    }

    await caricaSegnalazioni(clienteId);
  }

  const conteggi = useMemo(() => {
    const base: Record<string, number> = {};
    for (const s of segnalazioni) base[s.stato] = (base[s.stato] ?? 0) + 1;
    return base;
  }, [segnalazioni]);

  /* -------------------------------- render ---------------------------- */

  return (
    <AppPage
      title="Segnalazioni e Problemi noti"
      subtitle="Problemi tecnologici o da sistemare, per cliente e applicativo"
      icon={<AlertTriangle size={22} />}
      maxWidth="full"
      actions={
        tipoVista === "attivita" && (
          <button
            onClick={apriNuova}
            disabled={!clienteId}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0150a0] px-4 py-2.5 text-sm font-semibold text-[#ffffff] transition hover:bg-[#014080] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Nuova segnalazione
          </button>
        )
      }
    >
      <div className="space-y-6 pb-16">
        {/* Tutti i filtri insieme: cliente, applicativo, vista, stato, evento, parametro, ricerca */}
        <AppCard padded={false} className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={clienteId}
              onChange={(e) => {
                setClienteId(e.target.value);
                setFiltroApplicativo("");
                setFiltroEvento([]);
                setFiltroParametro([]);
                setFiltroStatoIncident("");
                setFiltroEventoIncident("");
                setFiltroParametroIncident("");
                setRicercaIncident("");
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-[#0150a0] sm:w-56"
            >
              {clienti.length === 0 && <option value="">Nessun cliente</option>}
              {clienti.length > 0 && (
                <option value={ALL_CLIENTI}>Tutti i clienti</option>
              )}
              {clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>

            {mostraFiltroApplicativo && (
              <select
                value={filtroApplicativo}
                onChange={(e) => setFiltroApplicativo(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-[#0150a0] sm:w-48"
              >
                <option value="">Tutti gli applicativi</option>
                {APPLICATIVI_LIST.map((app) => (
                  <option key={app} value={app}>
                    {app}
                  </option>
                ))}
              </select>
            )}

            {tipoVista === "attivita" && (
              <select
                value={filtroStato}
                onChange={(e) =>
                  setFiltroStato(e.target.value as StatoSegnalazione | "")
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-[#0150a0] sm:w-44"
              >
                <option value="">Tutti gli stati</option>
                {STATI.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}

            {tipoVista === "attivita" && (
              <div className="w-full sm:w-56">
                <MultiSelectCreatable
                  value={filtroEvento}
                  onChange={setFiltroEvento}
                  options={opzioniEvento}
                  placeholder="Filtra per evento"
                />
              </div>
            )}

            {tipoVista === "attivita" && (
              <div className="w-full sm:w-56">
                <MultiSelectCreatable
                  value={filtroParametro}
                  onChange={setFiltroParametro}
                  options={opzioniParametro}
                  placeholder="Filtra per parametro"
                />
              </div>
            )}

            {tipoVista === "attivita" && (
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca..."
                  value={ricerca}
                  onChange={(e) => setRicerca(e.target.value)}
                  className="w-full rounded-xl border border-transparent bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-300 focus:bg-white"
                />
              </div>
            )}

            {tipoVista === "incident" && (
              <select
                value={filtroStatoIncident}
                onChange={(e) =>
                  setFiltroStatoIncident(e.target.value as StatoIncident | "")
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-[#0150a0] sm:w-44"
              >
                <option value="">Tutti gli stati</option>
                {STATI_INCIDENT.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}

            {tipoVista === "incident" && (
              <select
                value={filtroEventoIncident}
                onChange={(e) => setFiltroEventoIncident(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-[#0150a0] sm:w-48"
              >
                <option value="">Tutti gli eventi</option>
                {datiIncident.opzioniEventi.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            )}

            {tipoVista === "incident" && (
              <select
                value={filtroParametroIncident}
                onChange={(e) => setFiltroParametroIncident(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-[#0150a0] sm:w-48"
              >
                <option value="">Tutti i parametri</option>
                {datiIncident.opzioniParametri.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}

            {tipoVista === "incident" && (
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca..."
                  value={ricercaIncident}
                  onChange={(e) => setRicercaIncident(e.target.value)}
                  className="w-full rounded-xl border border-transparent bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-300 focus:bg-white"
                />
              </div>
            )}

            {/* Interruttore Attività / Incident */}
            <div className="flex overflow-hidden rounded-xl border border-slate-200 sm:ml-auto">
              <button
                type="button"
                onClick={() => setTipoVista("attivita")}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black transition ${
                  tipoVista === "attivita"
                    ? "bg-slate-900 text-[#ffffff]"
                    : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                <ClipboardList size={14} />
                Attività
              </button>

              <button
                type="button"
                onClick={() => setTipoVista("incident")}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black transition ${
                  tipoVista === "incident"
                    ? "bg-red-600 text-[#ffffff]"
                    : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Zap size={14} />
                Incident
              </button>
            </div>
          </div>

          {tipoVista === "attivita" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {STATI.map((s) => (
                <span
                  key={s.value}
                  className={`rounded-lg px-2 py-1 text-[11px] font-bold ${s.chip}`}
                >
                  {s.label}: {conteggi[s.value] ?? 0}
                </span>
              ))}
            </div>
          )}

          {tipoVista === "incident" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {STATI_INCIDENT.map((s) => (
                <span
                  key={s.value}
                  className={`rounded-lg px-2 py-1 text-[11px] font-bold ${s.chip}`}
                >
                  {s.label}: {datiIncident.conteggi[s.value] ?? 0}
                </span>
              ))}
            </div>
          )}
        </AppCard>

        {tipoVista === "incident" ? (
          <IncidentPanel
            clienteId={clienteId}
            clienti={clienti}
            mostraApplicativo={mostraApplicativo}
            filtroApplicativo={filtroApplicativo}
            filtroStato={filtroStatoIncident}
            filtroEvento={filtroEventoIncident}
            filtroParametro={filtroParametroIncident}
            ricerca={ricercaIncident}
            onDatiChange={handleDatiIncidentChange}
          />
        ) : (
        <>
        {errore && (
          <AppCard className="border-red-200 bg-red-50">
            <p className="text-sm font-semibold text-red-700">{errore}</p>
          </AppCard>
        )}

        {formAperto && (
          <AppCard className="border-[#0150a0]/30 bg-blue-50/40">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900">
                {inModifica ? "Modifica segnalazione" : "Nuova segnalazione"}
                {clientiById.get(bozza.cliente_id) && (
                  <span className="ml-2 font-bold text-gray-400">
                    · {clientiById.get(bozza.cliente_id)}
                  </span>
                )}
              </h3>

              <button
                onClick={chiudiForm}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-gray-400 hover:bg-gray-100"
                aria-label="Chiudi"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Campo label="Cliente *">
                <select
                  value={bozza.cliente_id}
                  onChange={(e) =>
                    setBozza((b) => ({
                      ...b,
                      cliente_id: e.target.value,
                      applicativo: isEsselungaId(e.target.value)
                        ? b.applicativo
                        : [],
                    }))
                  }
                  disabled={!vistaTuttiClienti}
                  className={`${inputClass} ${
                    !vistaTuttiClienti ? "cursor-not-allowed opacity-70" : ""
                  }`}
                >
                  <option value="">Seleziona cliente</option>
                  {clienti.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </Campo>

              {isEsselungaId(bozza.cliente_id) && (
                <Campo label="Applicativi">
                  <MultiSelectCreatable
                    value={bozza.applicativo}
                    onChange={(next) =>
                      setBozza((b) => ({ ...b, applicativo: next }))
                    }
                    options={[...APPLICATIVI_LIST]}
                    placeholder="Seleziona uno o più applicativi..."
                  />
                </Campo>
              )}

              <Campo label="Stato">
                <select
                  value={bozza.stato}
                  onChange={(e) =>
                    setBozza((b) => ({
                      ...b,
                      stato: e.target.value as StatoSegnalazione,
                    }))
                  }
                  className={inputClass}
                >
                  {STATI.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Titolo" full>
                <input
                  value={bozza.titolo}
                  onChange={(e) =>
                    setBozza((b) => ({ ...b, titolo: e.target.value }))
                  }
                  placeholder="Titolo della segnalazione"
                  className={inputClass}
                />
              </Campo>

              {/* Evento e parametro sempre affiancati */}
              <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
                <Campo label="Nome evento">
                  <input
                    value={bozza.nome_evento}
                    onChange={(e) =>
                      setBozza((b) => ({ ...b, nome_evento: e.target.value }))
                    }
                    placeholder="Opzionale. Più eventi separati da virgola"
                    className={inputClass}
                  />
                  <p className="mt-1 text-[10px] font-semibold text-gray-400">
                    Campo facoltativo. Separa con la virgola per creare una segnalazione per ogni evento.
                  </p>
                </Campo>

                <Campo label="Nome parametro">
                  <input
                    value={bozza.nome_parametro}
                    onChange={(e) =>
                      setBozza((b) => ({ ...b, nome_parametro: e.target.value }))
                    }
                    placeholder="Uno o più parametri, separati da virgola"
                    className={inputClass}
                  />
                </Campo>
              </div>

              <Campo label="Data segnalazione">
                <input
                  type="date"
                  value={bozza.data_segnalazione}
                  onChange={(e) =>
                    setBozza((b) => ({
                      ...b,
                      data_segnalazione: e.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </Campo>

              <Campo label="Thread email">
                <input
                  value={bozza.thread_email}
                  onChange={(e) =>
                    setBozza((b) => ({ ...b, thread_email: e.target.value }))
                  }
                  placeholder="Link o riferimento al thread"
                  className={inputClass}
                />
              </Campo>

              <Campo label="Nota" full>
                <textarea
                  rows={2}
                  value={bozza.nota}
                  onChange={(e) =>
                    setBozza((b) => ({ ...b, nota: e.target.value }))
                  }
                  placeholder="Descrizione del problema..."
                  className={`${inputClass} resize-y`}
                />
              </Campo>

              <Campo label="Verbalizzazione" full>
                <textarea
                  rows={2}
                  value={bozza.verbalizzazione}
                  onChange={(e) =>
                    setBozza((b) => ({ ...b, verbalizzazione: e.target.value }))
                  }
                  placeholder="Esito discusso, decisioni prese..."
                  className={`${inputClass} resize-y`}
                />
              </Campo>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={chiudiForm}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Annulla
              </button>

              <button
                onClick={salva}
                disabled={salvataggio}
                className="flex items-center gap-2 rounded-xl bg-[#0150a0] px-4 py-2 text-sm font-semibold text-[#ffffff] hover:bg-[#014080] disabled:opacity-60"
              >
                {salvataggio ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salva
              </button>
            </div>
          </AppCard>
        )}

        <AppCard padded={false} className="overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">
              {listaFiltrata.length} segnalazioni
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Caricamento…
            </div>
          ) : listaFiltrata.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-gray-500">
                Nessuna segnalazione
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Aggiungi la prima con il pulsante “Nuova segnalazione”.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-slate-50 text-left">
                    <th className={thClass}>Data</th>
                    {vistaTuttiClienti && (
                      <th className={thClass}>Cliente</th>
                    )}
                    {mostraApplicativo && <th className={thClass}>App</th>}
                    <th className={thClass}>Titolo</th>
                    <th className={thClass}>Evento</th>
                    <th className={thClass}>Parametro</th>
                    <th className={thClass}>Nota</th>
                    <th className={thClass}>Stato</th>
                    <th className={thClass}>Rif.</th>
                    <th className={`${thClass} text-right`}>Azioni</th>
                  </tr>
                </thead>

                <tbody>
                  {listaFiltrata.map((s) => {
                    const stato = STATO_BY_VALUE.get(s.stato);

                    return (
                      <tr
                        key={s.id}
                        className="border-b border-gray-100 align-top last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-gray-500">
                          {s.data_segnalazione
                            ? new Date(s.data_segnalazione).toLocaleDateString(
                                "it-IT"
                              )
                            : "—"}
                        </td>

                        {vistaTuttiClienti && (
                          <td className="px-4 py-3 font-semibold text-gray-700">
                            {clientiById.get(s.cliente_id) || "—"}
                          </td>
                        )}

                        {mostraApplicativo && (
                          <td className="px-4 py-3">
                            {(s.applicativo ?? []).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {(s.applicativo ?? []).map((app) => (
                                  <span
                                    key={app}
                                    className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-tight text-slate-600"
                                  >
                                    {app}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        )}

                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {s.titolo || "—"}
                        </td>

                        <td className="px-4 py-3 text-gray-700">
                          {s.nome_evento || "—"}
                        </td>

                        <td className="px-4 py-3 text-gray-600">
                          {s.nome_parametro || "—"}
                        </td>

                        <td className="max-w-[280px] px-4 py-3 text-gray-600">
                          <p className="line-clamp-3 whitespace-pre-wrap">
                            {s.nota || "—"}
                          </p>
                          {s.verbalizzazione && (
                            <p className="mt-1 line-clamp-2 text-[11px] text-gray-400">
                              <span className="font-black uppercase tracking-tight">
                                Verb.:{" "}
                              </span>
                              {s.verbalizzazione}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-lg px-2 py-1 text-[10px] font-black ${stato?.chip}`}
                          >
                            {stato?.label}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {s.thread_email ? (
                            /^https?:\/\//i.test(s.thread_email) ? (
                              <a
                                href={s.thread_email}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#0150a0] hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Email
                              </a>
                            ) : (
                              <span
                                title={s.thread_email}
                                className="text-xs text-gray-500"
                              >
                                {s.thread_email}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => apriModifica(s)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0150a0]"
                              aria-label="Modifica"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() => elimina(s)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              aria-label="Elimina"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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
        </>
        )}
      </div>
    </AppPage>
  );
}

/* ------------------------------------------------------------------ */
/* Piccoli helper di layout                                            */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0150a0]";

const thClass =
  "px-4 py-3 text-[11px] font-black uppercase tracking-widest text-gray-400";

function Campo({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-400">
        {label}
      </label>
      {children}
    </div>
  );
}
