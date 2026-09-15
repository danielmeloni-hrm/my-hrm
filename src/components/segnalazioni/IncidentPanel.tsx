"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppCard from "@/components/ui/AppCard";
import MultiSelectCreatable from "@/components/ui/MultiSelectCreatable";
import { createClient } from "@/lib/supabase";
import {
  STATO_TICKET_LIST,
  TICKET_FIELD_LABELS,
} from "@/components/parametri_ticket/attivita";
import { ExternalLink, Loader2 } from "lucide-react";

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

/** Lo stato dell'incident è quello reale del ticket (STATO_TICKET_LIST). */
export type StatoIncident = string;

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

/** Colore del chip in base allo stato reale letto dal DB. */
function chipStato(stato: string | null) {
  const s = (stato ?? "").toLowerCase();
  if (!s) return "bg-slate-100 text-slate-500 border border-slate-200";
  if (s.startsWith("completato"))
    return "bg-emerald-50 text-emerald-700 border border-emerald-100";
  if (s.includes("cancellato"))
    return "bg-slate-100 text-slate-500 border border-slate-200";
  if (s.includes("attenzione"))
    return "bg-amber-50 text-amber-700 border border-amber-100";
  if (s.includes("lavorazione"))
    return "bg-blue-50 text-blue-700 border border-blue-100";
  if (s.includes("attesa") || s.includes("stand") || s.includes("sospesa"))
    return "bg-amber-50 text-amber-700 border border-amber-100";
  return "bg-red-50 text-red-600 border border-red-100";
}

/** Stati disponibili, letti dalla lista condivisa dei ticket (DB-aligned). */
export const STATI_INCIDENT: { value: StatoIncident; label: string; chip: string }[] =
  STATO_TICKET_LIST.map((s) => ({ value: s, label: s, chip: chipStato(s) }));

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

  /* -------------------------------- render ---------------------------- */
  /* La vista è di sola lettura: gli incident si creano e si modificano   */
  /* dalla pagina di apertura ticket / dal database incident.             */

  return (
    <div className="space-y-6">
      {errore && (
        <AppCard className="border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-700">{errore}</p>
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

const thClass =
  "px-4 py-3 text-[11px] font-black uppercase tracking-widest text-gray-400";
