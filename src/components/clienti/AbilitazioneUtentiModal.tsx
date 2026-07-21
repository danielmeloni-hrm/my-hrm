"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/* Tipi                                                                */
/* ------------------------------------------------------------------ */

export type LinkUtile = {
  etichetta: string;
  url: string;
};

export type StepAbilitazione = {
  id: string;
  cliente_id: string;
  nome_step: string;
  dettagli: string | null;
  descrizione: string | null;
  link_utili: LinkUtile[] | null;
  ordine: number;
  created_at?: string;
  updated_at?: string;
};

type Props = {
  clienteId: string;
  clienteNome: string;
  onClose: () => void;
};

type Bozza = {
  nome_step: string;
  dettagli: string;
  descrizione: string;
  link_utili: LinkUtile[];
};

const BOZZA_VUOTA: Bozza = {
  nome_step: "",
  dettagli: "",
  descrizione: "",
  link_utili: [],
};

function normalizzaLink(value: unknown): LinkUtile[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object")
    )
    .map((item) => ({
      etichetta: String(item.etichetta ?? item.label ?? "").trim(),
      url: String(item.url ?? "").trim(),
    }))
    .filter((item) => item.url.length > 0);
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

export default function AbilitazioneUtentiModal({
  clienteId,
  clienteNome,
  onClose,
}: Props) {
  const supabase = createClient();

  const [steps, setSteps] = useState<StepAbilitazione[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  /** null = nessun form aperto, "nuovo" = creazione, altrimenti id in modifica. */
  const [inModifica, setInModifica] = useState<string | null>(null);
  const [bozza, setBozza] = useState<Bozza>(BOZZA_VUOTA);

  // Il portal si può creare solo dopo il montaggio lato client.
  const [montato, setMontato] = useState(false);

  useEffect(() => {
    setMontato(true);
  }, []);

  // Blocca lo scorrimento della pagina sotto al pannello.
  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const caricaSteps = useCallback(async () => {
    const { data, error } = await supabase
      .from("clienti_abilitazione_step")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("ordine", { ascending: true });

    if (error) {
      console.error("Errore caricamento step abilitazione:", error);
      setErrore(error.message);
      setLoading(false);
      return;
    }

    setErrore(null);
    setSteps(
      (data ?? []).map((row: any) => ({
        ...row,
        link_utili: normalizzaLink(row.link_utili),
      }))
    );
    setLoading(false);
  }, [supabase, clienteId]);

  useEffect(() => {
    caricaSteps();
  }, [caricaSteps]);

  /* ----------------------------- azioni ----------------------------- */

  function apriNuovo() {
    setBozza(BOZZA_VUOTA);
    setInModifica("nuovo");
  }

  function apriModifica(step: StepAbilitazione) {
    setBozza({
      nome_step: step.nome_step,
      dettagli: step.dettagli ?? "",
      descrizione: step.descrizione ?? "",
      link_utili: step.link_utili ?? [],
    });
    setInModifica(step.id);
  }

  function chiudiForm() {
    setInModifica(null);
    setBozza(BOZZA_VUOTA);
  }

  function aggiornaLink(index: number, patch: Partial<LinkUtile>) {
    setBozza((prev) => ({
      ...prev,
      link_utili: prev.link_utili.map((link, i) =>
        i === index ? { ...link, ...patch } : link
      ),
    }));
  }

  function aggiungiLink() {
    setBozza((prev) => ({
      ...prev,
      link_utili: [...prev.link_utili, { etichetta: "", url: "" }],
    }));
  }

  function rimuoviLink(index: number) {
    setBozza((prev) => ({
      ...prev,
      link_utili: prev.link_utili.filter((_, i) => i !== index),
    }));
  }

  async function salva() {
    const nome = bozza.nome_step.trim();

    if (!nome) {
      setErrore("Il nome dello step è obbligatorio.");
      return;
    }

    setSalvataggio(true);
    setErrore(null);

    const payload = {
      cliente_id: clienteId,
      nome_step: nome,
      dettagli: bozza.dettagli.trim() || null,
      descrizione: bozza.descrizione.trim() || null,
      link_utili: bozza.link_utili
        .map((link) => ({
          etichetta: link.etichetta.trim(),
          url: link.url.trim(),
        }))
        .filter((link) => link.url.length > 0),
      updated_at: new Date().toISOString(),
    };

    const risultato =
      inModifica && inModifica !== "nuovo"
        ? await supabase
            .from("clienti_abilitazione_step")
            .update(payload)
            .eq("id", inModifica)
        : await supabase.from("clienti_abilitazione_step").insert({
            ...payload,
            ordine: steps.length,
          });

    setSalvataggio(false);

    if (risultato.error) {
      console.error("Errore salvataggio step:", risultato.error);
      setErrore(risultato.error.message);
      return;
    }

    chiudiForm();
    await caricaSteps();
  }

  async function elimina(step: StepAbilitazione) {
    if (!confirm(`Eliminare lo step "${step.nome_step}"?`)) return;

    const { error } = await supabase
      .from("clienti_abilitazione_step")
      .delete()
      .eq("id", step.id);

    if (error) {
      console.error("Errore eliminazione step:", error);
      setErrore(error.message);
      return;
    }

    await caricaSteps();
  }

  /** Sposta lo step e riscrive l'ordine di tutta la lista. */
  async function sposta(index: number, direzione: -1 | 1) {
    const destinazione = index + direzione;
    if (destinazione < 0 || destinazione >= steps.length) return;

    const riordinati = [...steps];
    const [spostato] = riordinati.splice(index, 1);
    riordinati.splice(destinazione, 0, spostato);

    setSteps(riordinati);

    for (const [posizione, step] of riordinati.entries()) {
      const { error } = await supabase
        .from("clienti_abilitazione_step")
        .update({ ordine: posizione })
        .eq("id", step.id);

      if (error) {
        console.error("Errore riordino step:", error);
        setErrore(error.message);
        return;
      }
    }
  }

  /* ----------------------------- render ----------------------------- */

  if (!montato) return null;

  // Montato su document.body: così resta ancorato allo schermo anche se un
  // contenitore della pagina applica transform o filtri.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#0150a0]">
              <UserPlus className="h-5 w-5" />
            </span>

            <div>
              <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                Abilitazione utenti
              </h2>
              <p className="text-sm text-gray-500">{clienteNome}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Gli step da seguire per abilitare un nuovo collega su questo cliente.
            </p>

            <button
              onClick={apriNuovo}
              disabled={inModifica === "nuovo"}
              className="flex items-center gap-2 rounded-xl bg-[#0150a0] px-3 py-2 text-sm font-semibold text-[#ffffff] transition hover:bg-[#014080] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Nuovo step
            </button>
          </div>

          {errore && (
            <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errore}
            </p>
          )}

          {inModifica && (
            <div className="mb-5 rounded-2xl border border-[#0150a0]/30 bg-blue-50/50 p-4">
              <h3 className="mb-3 text-sm font-bold text-gray-900">
                {inModifica === "nuovo" ? "Nuovo step" : "Modifica step"}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-400">
                    Nome step
                  </label>
                  <input
                    value={bozza.nome_step}
                    onChange={(e) =>
                      setBozza((prev) => ({ ...prev, nome_step: e.target.value }))
                    }
                    placeholder="Es. Richiesta accesso VPN"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0150a0]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-400">
                    Dettagli
                  </label>
                  <input
                    value={bozza.dettagli}
                    onChange={(e) =>
                      setBozza((prev) => ({ ...prev, dettagli: e.target.value }))
                    }
                    placeholder="Es. Referente IT, tempi di attivazione"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0150a0]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-400">
                    Descrizione
                  </label>
                  <textarea
                    value={bozza.descrizione}
                    onChange={(e) =>
                      setBozza((prev) => ({
                        ...prev,
                        descrizione: e.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="Cosa fare, in che ordine, cosa serve..."
                    className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0150a0]"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                      Link utili
                    </label>

                    <button
                      onClick={aggiungiLink}
                      className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-[#0150a0] hover:bg-blue-50"
                    >
                      <Plus className="h-3 w-3" />
                      Aggiungi link
                    </button>
                  </div>

                  <div className="space-y-2">
                    {bozza.link_utili.length === 0 && (
                      <p className="text-xs text-gray-400">Nessun link.</p>
                    )}

                    {bozza.link_utili.map((link, index) => (
                      <div key={index} className="flex flex-col gap-2 sm:flex-row">
                        <input
                          value={link.etichetta}
                          onChange={(e) =>
                            aggiornaLink(index, { etichetta: e.target.value })
                          }
                          placeholder="Etichetta"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0150a0] sm:w-44"
                        />

                        <input
                          value={link.url}
                          onChange={(e) =>
                            aggiornaLink(index, { url: e.target.value })
                          }
                          placeholder="https://..."
                          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0150a0]"
                        />

                        <button
                          onClick={() => rimuoviLink(index)}
                          className="self-start rounded-xl p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Rimuovi link"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
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
                  Salva step
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Caricamento…
            </div>
          ) : steps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 py-10 text-center">
              <p className="text-sm font-semibold text-gray-500">
                Nessuno step configurato
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Aggiungi il primo passaggio per abilitare un collega.
              </p>
            </div>
          ) : (
            <ol className="space-y-3">
              {steps.map((step, index) => (
                <li
                  key={step.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-black text-[#0150a0]">
                        {index + 1}
                      </span>

                      <div className="min-w-0">
                        <h4 className="font-semibold text-gray-900">
                          {step.nome_step}
                        </h4>

                        {step.dettagli && (
                          <p className="mt-0.5 text-xs font-bold uppercase tracking-tight text-gray-400">
                            {step.dettagli}
                          </p>
                        )}

                        {step.descrizione && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                            {step.descrizione}
                          </p>
                        )}

                        {step.link_utili && step.link_utili.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {step.link_utili.map((link, i) => (
                              <a
                                key={i}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-[#0150a0] hover:bg-blue-50"
                              >
                                <Link2 className="h-3 w-3" />
                                {link.etichetta || link.url}
                                <ExternalLink className="h-3 w-3 opacity-50" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => sposta(index, -1)}
                        disabled={index === 0}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                        aria-label="Sposta su"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => sposta(index, 1)}
                        disabled={index === steps.length - 1}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                        aria-label="Sposta giù"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => apriModifica(step)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#0150a0]"
                        aria-label="Modifica"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => elimina(step)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Elimina"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
