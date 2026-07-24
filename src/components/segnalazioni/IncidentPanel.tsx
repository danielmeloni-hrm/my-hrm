"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppCard from "@/components/ui/AppCard";
import MultiSelectCreatable from "@/components/ui/MultiSelectCreatable";
import { createClient } from "@/lib/supabase";
import {
  APPLICATIVI_LIST,
  TICKET_FIELD_LABELS,
} from "@/components/parametri_ticket/attivita";
import { ExternalLink, Loader2, Pencil, Save, Trash2, X } from "lucide-react";

/**
 * I parametri intaccati corrispondono ai campi del ticket (tag): usiamo
 * le stesse etichette, così un incident punta sempre a un parametro reale.
 */
const PARAMETRI_TICKET = Object.values(TICKET_FIELD_LABELS).sort((a, b) =>
  String(a).localeCompare(String(b))
);

/* ------------------------------------------------------------------ */
/* Tipi (allineati alla tabella incident)                             */
/* ------------------------------------------------------------------ */

/** La colonna incident.stato è testo libero: usiamo questi valori. */
export type StatoIncident = "Aperto" | "In lavorazione" | "Risolto" | "Chiuso";

type Incident = {
  id: string;
  cliente_id: string | null;
  applicativo: string[] | null;
  eventi: string[] | null;
  parametri: string[] | null;
  titolo: string | null;
  descrizione: string | null;
  data_segnalazione: string | null;
  tread_email: string | null;
  verbalizzazione: string | null;
  stato: string | null;
  n_tag: string | null;
};

export const STATI_INCIDENT: { value: StatoIncident; label: string; chip: string }[] = [
  { value: "Aperto", label: "Aperto", chip: "bg-red-50 text-red-600 border border-red-100" },
  {
    value: "In lavorazione",
    label: "In lavorazione",
    chip: "bg-amber-50 text-amber-700 border border-amber-100",
  },
  {
    value: "Risolto",
    label: "Risolto",
    chip: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  },
  {
    value: "Chiuso",
    label: "Chiuso",
    chip: "bg-slate-100 text-slate-500 border border-slate-200",
  },
];

function chipStato(stato: string | null) {
  return (
    STATI_INCIDENT.find((s) => s.value === stato)?.chip ??
    "bg-slate-100 text-slate-500 border border-slate-200"
  );
}

type Bozza = {
  cliente_id: string;
  applicativo: string;
  eventi: string[];
  parametri: string[];
  descrizione: string;
  data_segnalazione: string;
  tread_email: string;
  verbalizzazione: string;
  stato: StatoIncident;
};

function bozzaVuota(cliente_id = "", applicativo = ""): Bozza {
  return {
    cliente_id,
    applicativo,
    eventi: [],
    parametri: [],
    descrizione: "",
    data_segnalazione: new Date().toISOString().slice(0, 10),
    tread_email: "",
    verbalizzazione: "",
    stato: "Aperto",
  };
}

function primoApplicativo(app: string[] | null): string {
  return Array.isArray(app) && app.length > 0 ? app[0] : "";
}

/** Dati derivati che il pannello riporta al genitore per popolare la barra filtri condivisa. */
export type IncidentDati = {
  opzioniEventi: string[];
  opzioniParametri: string[];
  conteggi: Record<string, number>;
};

/** Stessa sentinella usata nella pagina genitore per "Tutti i clienti". */
const ALL_CLIENTI = "__all__";

type Props = {
  clienteId: string;
  clienti: { id: string; nome: string }[];
  mostraApplicativo: boolean;
  filtroApplicativo: string;
  filtroStato: StatoIncident | "";
  filtroEvento: string;
  filtroParametro: string;
  ricerca: string;
  onDatiChange?: (dati: IncidentDati) => void;
};

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

export default function IncidentPanel({
  clienteId,
  clienti,
  mostraApplicativo,
  filtroApplicativo,
  filtroStato,
  filtroEvento,
  filtroParametro,
  ricerca,
  onDatiChange,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [eventiCatalogo, setEventiCatalogo] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  const [formAperto, setFormAperto] = useState(false);
  const [inModifica, setInModifica] = useState<string | null>(null);
  const [bozza, setBozza] = useState<Bozza>(bozzaVuota());
  const [salvataggio, setSalvataggio] = useState(false);

  const clientiById = useMemo(
    () => new Map(clienti.map((c) => [c.id, c.nome])),
    [clienti]
  );

  /* ---------------------------- caricamento --------------------------- */

  const carica = useCallback(async () => {
    if (!clienteId) {
      setIncidents([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const tuttiIClienti = clienteId === ALL_CLIENTI;

    let incidentQuery = supabase
      .from("incident")
      .select(
        "id, cliente_id, applicativo, eventi, parametri, titolo, descrizione, data_segnalazione, tread_email, verbalizzazione, stato, n_tag"
      )
      .order("data_segnalazione", { ascending: false });

    if (!tuttiIClienti) {
      incidentQuery = incidentQuery.eq("cliente_id", clienteId);
    }

    let catalogoQuery = supabase
      .from("incident_eventi_catalogo")
      .select("nome, cliente_id")
      .order("nome");

    if (!tuttiIClienti) {
      catalogoQuery = catalogoQuery.or(
        `cliente_id.eq.${clienteId},cliente_id.is.null`
      );
    }

    const [incidentRes, catalogoRes] = await Promise.all([
      incidentQuery,
      catalogoQuery,
    ]);

    if (incidentRes.error) {
      console.error("Errore caricamento incident:", incidentRes.error);
      setErrore(incidentRes.error.message);
      setLoading(false);
      return;
    }

    setErrore(null);
    setIncidents((incidentRes.data ?? []) as Incident[]);
    setEventiCatalogo(
      Array.from(
        new Set((catalogoRes.data ?? []).map((r: any) => r.nome as string))
      )
    );
    setLoading(false);
  }, [supabase, clienteId]);

  useEffect(() => {
    carica();
  }, [carica]);

  /* ------------------------------- derivati --------------------------- */

  const opzioniEventi = useMemo(() => {
    const set = new Set<string>(eventiCatalogo);
    incidents.forEach((i) => i.eventi?.forEach((e) => set.add(e)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [eventiCatalogo, incidents]);

  const opzioniParametri = useMemo(() => {
    const set = new Set<string>(PARAMETRI_TICKET);
    incidents.forEach((i) => i.parametri?.forEach((p) => set.add(p)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [incidents]);

  const listaFiltrata = useMemo(() => {
    const termine = ricerca.trim().toLowerCase();

    return incidents.filter((i) => {
      const okApp =
        !filtroApplicativo || (i.applicativo ?? []).includes(filtroApplicativo);
      const okStato = !filtroStato || i.stato === filtroStato;
      const okEvento = !filtroEvento || (i.eventi ?? []).includes(filtroEvento);
      const okParametro =
        !filtroParametro || (i.parametri ?? []).includes(filtroParametro);
      const okRicerca =
        !termine ||
        [
          ...(i.eventi ?? []),
          ...(i.parametri ?? []),
          i.titolo,
          i.descrizione,
          i.verbalizzazione,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(termine));

      return okApp && okStato && okEvento && okParametro && okRicerca;
    });
  }, [incidents, filtroApplicativo, filtroStato, filtroEvento, filtroParametro, ricerca]);

  const conteggi = useMemo(() => {
    const base: Record<string, number> = {};
    for (const i of incidents) {
      const stato = i.stato ?? "Aperto";
      base[stato] = (base[stato] ?? 0) + 1;
    }
    return base;
  }, [incidents]);

  // Riporta al genitore le opzioni e i conteggi, così può popolare la
  // barra filtri condivisa in cima alla pagina.
  useEffect(() => {
    onDatiChange?.({ opzioniEventi, opzioniParametri, conteggi });
  }, [opzioniEventi, opzioniParametri, conteggi, onDatiChange]);

  /* ------------------------------- azioni ----------------------------- */

  function apriModifica(i: Incident) {
    setBozza({
      cliente_id: i.cliente_id ?? "",
      applicativo: primoApplicativo(i.applicativo),
      eventi: i.eventi ?? [],
      parametri: i.parametri ?? [],
      descrizione: i.descrizione ?? "",
      data_segnalazione: i.data_segnalazione?.slice(0, 10) ?? "",
      tread_email: i.tread_email ?? "",
      verbalizzazione: i.verbalizzazione ?? "",
      stato: (STATI_INCIDENT.find((s) => s.value === i.stato)?.value ?? "Aperto"),
    });
    setInModifica(i.id);
    setFormAperto(true);
  }

  function chiudiForm() {
    setFormAperto(false);
    setInModifica(null);
    setBozza(bozzaVuota());
  }

  /** Registra un evento creato al volo, così resta riutilizzabile. */
  async function registraEvento(nome: string) {
    if (eventiCatalogo.some((e) => e.toLowerCase() === nome.toLowerCase())) {
      return;
    }

    const { error } = await supabase.from("incident_eventi_catalogo").insert({
      nome,
      cliente_id: bozza.cliente_id || null,
      applicativo: mostraApplicativo ? bozza.applicativo || null : null,
    });

    if (!error) setEventiCatalogo((prev) => [...prev, nome]);
  }

  async function salva() {
    if (bozza.eventi.length === 0) {
      setErrore("Seleziona almeno un evento.");
      return;
    }

    if (!bozza.cliente_id) {
      setErrore("Cliente non valido per questo incident.");
      return;
    }

    setSalvataggio(true);
    setErrore(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrore("Utente non autenticato.");
      setSalvataggio(false);
      return;
    }

    // titolo non può essere nullo: se manca lo componiamo dagli eventi.
    const titolo =
      bozza.descrizione.trim().slice(0, 80) ||
      bozza.eventi.join(", ").slice(0, 80) ||
      "Incident";

    const payload: Record<string, any> = {
      cliente_id: bozza.cliente_id,
      applicativo:
        mostraApplicativo && bozza.applicativo ? [bozza.applicativo] : null,
      eventi: bozza.eventi,
      parametri: bozza.parametri,
      descrizione: bozza.descrizione.trim() || null,
      data_segnalazione:
        bozza.data_segnalazione || new Date().toISOString().slice(0, 10),
      tread_email: bozza.tread_email.trim() || null,
      verbalizzazione: bozza.verbalizzazione.trim() || null,
      stato: bozza.stato,
      titolo,
      tipologia_ticket: "Incident",
    };

    let risultato;

    if (inModifica) {
      risultato = await supabase
        .from("incident")
        .update(payload)
        .eq("id", inModifica);
    } else {
      // In creazione servono i campi obbligatori della tabella.
      risultato = await supabase
        .from("incident")
        .insert({ ...payload, utente_id: user.id });
    }

    setSalvataggio(false);

    if (risultato.error) {
      console.error("Errore salvataggio incident:", risultato.error);
      setErrore(risultato.error.message);
      return;
    }

    chiudiForm();
    await carica();
  }

  async function elimina(i: Incident) {
    if (!confirm("Eliminare questo incident?")) return;

    const { error } = await supabase.from("incident").delete().eq("id", i.id);

    if (error) {
      setErrore(error.message);
      return;
    }

    await carica();
  }

  /* -------------------------------- render ---------------------------- */

  return (
    <div className="space-y-6">
      {errore && (
        <AppCard className="border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-700">{errore}</p>
        </AppCard>
      )}

      {formAperto && (
        <AppCard className="border-[#0150a0]/30 bg-blue-50/40">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-black text-gray-900">
              {inModifica ? "Modifica incident" : "Nuovo incident"}
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
            {mostraApplicativo && (
              <Campo label="Applicativo">
                <select
                  value={bozza.applicativo}
                  onChange={(e) =>
                    setBozza((b) => ({ ...b, applicativo: e.target.value }))
                  }
                  className={inputClass}
                >
                  <option value="">— nessuno —</option>
                  {APPLICATIVI_LIST.map((app) => (
                    <option key={app} value={app}>
                      {app}
                    </option>
                  ))}
                </select>
              </Campo>
            )}

            <Campo label="Stato">
              <select
                value={bozza.stato}
                onChange={(e) =>
                  setBozza((b) => ({
                    ...b,
                    stato: e.target.value as StatoIncident,
                  }))
                }
                className={inputClass}
              >
                {STATI_INCIDENT.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Evento/i *" full>
              <MultiSelectCreatable
                value={bozza.eventi}
                onChange={(eventi) => setBozza((b) => ({ ...b, eventi }))}
                options={opzioniEventi}
                onCreate={(nome) => registraEvento(nome)}
                placeholder="Seleziona o crea un evento..."
              />
              <p className="mt-1 text-[10px] font-semibold text-gray-400">
                Puoi selezionare più eventi o digitarne uno nuovo e premere
                &ldquo;Crea&rdquo;.
              </p>
            </Campo>

            <Campo label="Parametro/i intaccato/i" full>
              <MultiSelectCreatable
                value={bozza.parametri}
                onChange={(parametri) => setBozza((b) => ({ ...b, parametri }))}
                options={opzioniParametri}
                placeholder="Seleziona un parametro del ticket..."
              />
              <p className="mt-1 text-[10px] font-semibold text-gray-400">
                Puoi selezionare più parametri tra i campi del ticket.
              </p>
            </Campo>

            <Campo label="Data segnalazione">
              <input
                type="date"
                value={bozza.data_segnalazione}
                onChange={(e) =>
                  setBozza((b) => ({ ...b, data_segnalazione: e.target.value }))
                }
                className={inputClass}
              />
            </Campo>

            <Campo label="Thread email">
              <input
                value={bozza.tread_email}
                onChange={(e) =>
                  setBozza((b) => ({ ...b, tread_email: e.target.value }))
                }
                placeholder="Link o riferimento al thread"
                className={inputClass}
              />
            </Campo>

            <Campo label="Descrizione / Nota" full>
              <textarea
                rows={2}
                value={bozza.descrizione}
                onChange={(e) =>
                  setBozza((b) => ({ ...b, descrizione: e.target.value }))
                }
                placeholder="Descrizione dell'incident..."
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
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            {listaFiltrata.length} incident
          </h2>

          <Link
            href="/tutti-gli-incident"
            className="text-xs font-bold text-[#0150a0] hover:underline"
          >
            Database completo →
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Caricamento…
          </div>
        ) : listaFiltrata.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-gray-500">
              Nessun incident con questi filtri
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Gli incident si creano dalla pagina di apertura ticket.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-slate-50 text-left">
                  <th className={thClass}>Data</th>
                  {clienteId === ALL_CLIENTI && (
                    <th className={thClass}>Cliente</th>
                  )}
                  <th className={thClass}>Tag</th>
                  {mostraApplicativo && <th className={thClass}>App</th>}
                  <th className={thClass}>Eventi</th>
                  <th className={thClass}>Parametri</th>
                  <th className={thClass}>Descrizione</th>
                  <th className={thClass}>Stato</th>
                  <th className={thClass}>Rif.</th>
                  <th className={`${thClass} text-right`}>Azioni</th>
                </tr>
              </thead>

              <tbody>
                {listaFiltrata.map((i) => (
                  <tr
                    key={i.id}
                    className="border-b border-gray-100 align-top last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-gray-500">
                      {i.data_segnalazione
                        ? new Date(i.data_segnalazione).toLocaleDateString(
                            "it-IT"
                          )
                        : "—"}
                    </td>

                    {clienteId === ALL_CLIENTI && (
                      <td className="px-4 py-3 font-semibold text-gray-700">
                        {(i.cliente_id && clientiById.get(i.cliente_id)) ||
                          "—"}
                      </td>
                    )}

                    <td className="px-4 py-3">
                      {i.n_tag ? (
                        <Link
                          href={`/ticket/${i.id}`}
                          className="text-[11px] font-black uppercase tracking-tight text-[#0150a0] hover:underline"
                        >
                          {i.n_tag}
                        </Link>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {mostraApplicativo && (
                      <td className="px-4 py-3">
                        {(i.applicativo ?? []).length > 0 ? (
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-tight text-slate-600">
                            {(i.applicativo ?? []).join(", ")}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )}

                    <td className="px-4 py-3">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {(i.eventi ?? []).map((e) => (
                          <span
                            key={e}
                            className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-bold text-red-700"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {(i.parametri ?? []).length === 0 ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          (i.parametri ?? []).map((p) => (
                            <span
                              key={p}
                              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600"
                            >
                              {p}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="max-w-[260px] px-4 py-3 text-gray-600">
                      <p className="line-clamp-3 whitespace-pre-wrap">
                        {i.descrizione || i.titolo || "—"}
                      </p>
                      {i.verbalizzazione && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-gray-400">
                          <span className="font-black uppercase tracking-tight">
                            Verb.:{" "}
                          </span>
                          {i.verbalizzazione}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-lg px-2 py-1 text-[10px] font-black ${chipStato(
                          i.stato
                        )}`}
                      >
                        {i.stato ?? "Aperto"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {i.tread_email ? (
                        /^https?:\/\//i.test(i.tread_email) ? (
                          <a
                            href={i.tread_email}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#0150a0] hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Email
                          </a>
                        ) : (
                          <span
                            title={i.tread_email}
                            className="text-xs text-gray-500"
                          >
                            {i.tread_email}
                          </span>
                        )
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => apriModifica(i)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0150a0]"
                          aria-label="Modifica"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => elimina(i)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Elimina"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helper                                                              */
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
