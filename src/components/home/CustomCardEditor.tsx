"use client";

import { useState } from "react";
import ModalPortal from "@/components/ui/ModalPortal";
import { Save, X } from "lucide-react";
import {
  CAMPI_TICKET_CARD,
  MODI_VISUALIZZAZIONE,
  OPZIONI_APPLICATIVO,
  OPZIONI_PRIORITA,
  OPZIONI_STATO,
  OPZIONI_TIPOLOGIA,
  ORDINAMENTI_CARD,
  etichettaCampoCard,
  type CustomCardConfig,
  type ModoVisualizzazione,
  type OrdinamentoCard,
} from "@/lib/home-widgets";

type Props = {
  config: CustomCardConfig;
  clienti?: string[];
  onSave: (config: CustomCardConfig) => void;
  onClose: () => void;
};

/** Aggiunge o rimuove un valore da un array (toggle). */
function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export default function CustomCardEditor({
  config,
  clienti = [],
  onSave,
  onClose,
}: Props) {
  const [bozza, setBozza] = useState<CustomCardConfig>(config);

  function patch(p: Partial<CustomCardConfig>) {
    setBozza((prev) => ({ ...prev, ...p }));
  }

  // L'applicativo ha senso solo per Esselunga: compare se è tra i clienti scelti.
  const esselungaSelezionata = bozza.clienti.some((c) =>
    /esselunga/i.test(c)
  );

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[120] overflow-y-auto bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-auto my-4 flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-bold text-gray-900">
              Configura la card
            </h2>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Chiudi"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            {/* Titolo */}
            <Campo label="Titolo della card">
              <input
                value={bozza.titolo}
                onChange={(e) => patch({ titolo: e.target.value })}
                placeholder="Es. I miei incident urgenti"
                className={inputClass}
              />
            </Campo>

            {/* Filtro per titolo del ticket */}
            <Campo label="Filtra per titolo del ticket">
              <input
                value={bozza.filtroTitolo}
                onChange={(e) => patch({ filtroTitolo: e.target.value })}
                placeholder="Mostra solo i ticket che contengono..."
                className={inputClass}
              />
            </Campo>

            {/* Ambito */}
            <div className="flex flex-wrap gap-2">
              <Toggle
                attivo={bozza.soloMiei}
                onClick={() => patch({ soloMiei: !bozza.soloMiei })}
              >
                Solo i miei ticket
              </Toggle>
              <Toggle
                attivo={bozza.soloAperti}
                onClick={() => patch({ soloAperti: !bozza.soloAperti })}
              >
                Solo ticket aperti
              </Toggle>
            </div>

            {/* Filtri a chip */}
            <FiltroChip
              label="Stato"
              opzioni={OPZIONI_STATO}
              selezionati={bozza.stati}
              onToggle={(v) => patch({ stati: toggle(bozza.stati, v) })}
            />

            <FiltroChip
              label="Priorità"
              opzioni={OPZIONI_PRIORITA}
              selezionati={bozza.priorita}
              onToggle={(v) => patch({ priorita: toggle(bozza.priorita, v) })}
            />

            <FiltroChip
              label="Tipologia"
              opzioni={OPZIONI_TIPOLOGIA}
              selezionati={bozza.tipologie}
              onToggle={(v) => patch({ tipologie: toggle(bozza.tipologie, v) })}
            />

            {clienti.length > 0 && (
              <FiltroChip
                label="Cliente"
                opzioni={clienti}
                selezionati={bozza.clienti}
                onToggle={(v) => {
                  const prossimi = toggle(bozza.clienti, v);
                  // Se Esselunga non è più selezionata, azzeriamo gli applicativi.
                  const ancoraEsselunga = prossimi.some((c) =>
                    /esselunga/i.test(c)
                  );
                  patch({
                    clienti: prossimi,
                    applicativi: ancoraEsselunga ? bozza.applicativi : [],
                  });
                }}
              />
            )}

            {/* Applicativo: solo se è selezionata Esselunga */}
            {esselungaSelezionata && (
              <FiltroChip
                label="Applicativo"
                opzioni={OPZIONI_APPLICATIVO}
                selezionati={bozza.applicativi}
                onToggle={(v) =>
                  patch({ applicativi: toggle(bozza.applicativi, v) })
                }
              />
            )}

            {/* Visualizzazione */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo label="Come vederli">
                <select
                  value={bozza.modo}
                  onChange={(e) =>
                    patch({ modo: e.target.value as ModoVisualizzazione })
                  }
                  className={inputClass}
                >
                  {MODI_VISUALIZZAZIONE.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Ordina per">
                <select
                  value={bozza.ordina}
                  onChange={(e) =>
                    patch({ ordina: e.target.value as OrdinamentoCard })
                  }
                  className={inputClass}
                >
                  {ORDINAMENTI_CARD.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo label="Max ticket">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={bozza.limite}
                  onChange={(e) =>
                    patch({
                      limite: Math.min(
                        100,
                        Math.max(1, parseInt(e.target.value) || 15)
                      ),
                    })
                  }
                  className={inputClass}
                />
              </Campo>
            </div>

            {/* Campi da mostrare */}
            {bozza.modo !== "conteggio" && (
              <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-gray-400">
                  Parametri da mostrare
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {CAMPI_TICKET_CARD.map((campo) => {
                    const attivo = bozza.campi.includes(campo);
                    return (
                      <button
                        key={campo}
                        type="button"
                        onClick={() =>
                          patch({ campi: toggle(bozza.campi, campo) })
                        }
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                          attivo
                            ? "bg-[#0150a0] text-[#ffffff]"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {etichettaCampoCard(campo)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Annulla
            </button>
            <button
              onClick={() => onSave(bozza)}
              className="flex items-center gap-2 rounded-xl bg-[#0150a0] px-4 py-2 text-sm font-semibold text-[#ffffff] hover:bg-[#014080]"
            >
              <Save className="h-4 w-4" />
              Salva card
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

/* ------------------------------------------------------------------ */
/* Helper                                                             */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0150a0]";

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  attivo,
  onClick,
  children,
}: {
  attivo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-xs font-black transition ${
        attivo
          ? "bg-[#0150a0] text-[#ffffff]"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function FiltroChip({
  label,
  opzioni,
  selezionati,
  onToggle,
}: {
  label: string;
  opzioni: readonly string[];
  selezionati: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-gray-400">
        {label}
        {selezionati.length === 0 && (
          <span className="ml-2 font-semibold text-gray-300">tutti</span>
        )}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {opzioni.map((opt) => {
          const attivo = selezionati.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                attivo
                  ? "bg-slate-900 text-[#ffffff]"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
