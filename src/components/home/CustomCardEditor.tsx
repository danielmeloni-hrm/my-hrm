"use client";

import { useMemo, useState } from "react";
import ModalPortal from "@/components/ui/ModalPortal";
import { Filter, Plus, Save, Trash2, X } from "lucide-react";
import {
  CAMPI_TICKET_CARD,
  MODI_VISUALIZZAZIONE,
  ORDINAMENTI_CARD,
  etichettaCampoCard,
  type CustomCardConfig,
  type ModoVisualizzazione,
  type OrdinamentoCard,
} from "@/lib/home-widgets";
import {
  CAMPI_FILTRO,
  CAMPO_FILTRO_BY_ID,
  ETICHETTE_OPERATORE,
  OPERATORI_A_ELENCO,
  OPERATORI_PER_TIPO,
  OPERATORI_SENZA_VALORE,
  descriviFiltro,
  nuovaCondizione,
  nuovoGruppo,
  type CampoFiltro,
  type CondizioneFiltro,
  type GruppoFiltri,
  type LogicaFiltro,
  type OperatoreFiltro,
} from "@/lib/home-filters";

type Props = {
  config: CustomCardConfig;
  clienti?: string[];
  assegnatari?: string[];
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
  assegnatari = [],
  onSave,
  onClose,
}: Props) {
  const [bozza, setBozza] = useState<CustomCardConfig>(config);

  function patch(p: Partial<CustomCardConfig>) {
    setBozza((prev) => ({ ...prev, ...p }));
  }

  /** Opzioni dei campi che dipendono dai ticket caricati. */
  const opzioniDinamiche = useMemo(
    () => ({ clienti, assegnatari }),
    [clienti, assegnatari]
  );

  function opzioniDelCampo(definizione: CampoFiltro): readonly string[] {
    if (definizione.dinamico === "clienti") return opzioniDinamiche.clienti;
    if (definizione.dinamico === "assegnatari")
      return opzioniDinamiche.assegnatari;
    return definizione.opzioni ?? [];
  }

  /* -------------------------------------------------------------- */
  /* Modifica dei filtri                                             */
  /* -------------------------------------------------------------- */

  function aggiornaGruppi(gruppi: GruppoFiltri[]) {
    patch({ filtri: { ...bozza.filtri, gruppi } });
  }

  function modificaGruppo(idGruppo: string, modifica: Partial<GruppoFiltri>) {
    aggiornaGruppi(
      bozza.filtri.gruppi.map((gruppo) =>
        gruppo.id === idGruppo ? { ...gruppo, ...modifica } : gruppo
      )
    );
  }

  function modificaCondizione(
    idGruppo: string,
    idCondizione: string,
    modifica: Partial<CondizioneFiltro>
  ) {
    aggiornaGruppi(
      bozza.filtri.gruppi.map((gruppo) =>
        gruppo.id !== idGruppo
          ? gruppo
          : {
              ...gruppo,
              condizioni: gruppo.condizioni.map((condizione) =>
                condizione.id === idCondizione
                  ? { ...condizione, ...modifica }
                  : condizione
              ),
            }
      )
    );
  }

  /**
   * Cambiando campo cambiano gli operatori ammessi: si riparte dal primo
   * valido e si azzerano i valori, che appartenevano al campo precedente.
   */
  function cambiaCampo(idGruppo: string, idCondizione: string, campo: string) {
    const definizione = CAMPO_FILTRO_BY_ID.get(campo);
    if (!definizione) return;

    modificaCondizione(idGruppo, idCondizione, {
      campo,
      operatore: OPERATORI_PER_TIPO[definizione.tipo][0],
      valori: [],
      valore: "",
    });
  }

  function rimuoviCondizione(idGruppo: string, idCondizione: string) {
    const gruppo = bozza.filtri.gruppi.find((g) => g.id === idGruppo);
    if (!gruppo) return;

    const condizioni = gruppo.condizioni.filter((c) => c.id !== idCondizione);

    // Un gruppo rimasto senza condizioni non serve a nulla: si elimina,
    // altrimenti con logica OR farebbe passare tutti i ticket.
    if (condizioni.length === 0) {
      aggiornaGruppi(bozza.filtri.gruppi.filter((g) => g.id !== idGruppo));
      return;
    }

    modificaGruppo(idGruppo, { condizioni });
  }

  const totaleCondizioni = bozza.filtri.gruppi.reduce(
    (totale, gruppo) => totale + gruppo.condizioni.length,
    0
  );

  const riassunto = descriviFiltro(bozza.filtri);

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[120] overflow-y-auto bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-auto my-4 flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
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

            {/* Costruttore di filtri */}
            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400">
                  <Filter className="h-3.5 w-3.5" />
                  Filtri
                  {totaleCondizioni === 0 && (
                    <span className="font-semibold normal-case tracking-normal text-gray-300">
                      nessuno: la card mostra tutti i ticket
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    aggiornaGruppi([...bozza.filtri.gruppi, nuovoGruppo()])
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-[11px] font-bold text-gray-600 transition hover:bg-gray-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Aggiungi gruppo
                </button>
              </div>

              {bozza.filtri.gruppi.length === 0 ? (
                <p className="text-xs font-medium text-gray-400">
                  Aggiungi un gruppo per iniziare a filtrare. Dentro un gruppo
                  le condizioni si combinano fra loro, e i gruppi fra loro.
                </p>
              ) : (
                <div className="space-y-3">
                  {bozza.filtri.gruppi.map((gruppo, indiceGruppo) => (
                    <div key={gruppo.id}>
                      {indiceGruppo > 0 && (
                        <div className="mb-3 flex justify-center">
                          <SelettoreLogica
                            valore={bozza.filtri.logica}
                            onChange={(logica) =>
                              patch({ filtri: { ...bozza.filtri, logica } })
                            }
                            etichette={["E anche", "OPPURE"]}
                          />
                        </div>
                      )}

                      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Gruppo {indiceGruppo + 1}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              aggiornaGruppi(
                                bozza.filtri.gruppi.filter(
                                  (g) => g.id !== gruppo.id
                                )
                              )
                            }
                            className="rounded-lg p-1 text-gray-300 transition hover:bg-red-50 hover:text-red-500"
                            aria-label="Elimina gruppo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          {gruppo.condizioni.map((condizione, indice) => {
                            const definizione =
                              CAMPO_FILTRO_BY_ID.get(condizione.campo) ??
                              CAMPI_FILTRO[0];
                            const operatoriAmmessi =
                              OPERATORI_PER_TIPO[definizione.tipo];
                            const opzioni = opzioniDelCampo(definizione);

                            return (
                              <div key={condizione.id}>
                                {indice > 0 && (
                                  <div className="mb-2 flex justify-start pl-1">
                                    <SelettoreLogica
                                      valore={gruppo.logica}
                                      onChange={(logica) =>
                                        modificaGruppo(gruppo.id, { logica })
                                      }
                                      etichette={["E", "OPPURE"]}
                                      compatto
                                    />
                                  </div>
                                )}

                                <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <select
                                      value={condizione.campo}
                                      onChange={(e) =>
                                        cambiaCampo(
                                          gruppo.id,
                                          condizione.id,
                                          e.target.value
                                        )
                                      }
                                      className={selectPiccolo}
                                    >
                                      {CAMPI_FILTRO.map((campo) => (
                                        <option
                                          key={campo.campo}
                                          value={campo.campo}
                                        >
                                          {campo.label}
                                        </option>
                                      ))}
                                    </select>

                                    <select
                                      value={condizione.operatore}
                                      onChange={(e) =>
                                        modificaCondizione(
                                          gruppo.id,
                                          condizione.id,
                                          {
                                            operatore: e.target
                                              .value as OperatoreFiltro,
                                            valori: [],
                                            valore: "",
                                          }
                                        )
                                      }
                                      className={selectPiccolo}
                                    >
                                      {operatoriAmmessi.map((operatore) => (
                                        <option key={operatore} value={operatore}>
                                          {ETICHETTE_OPERATORE[operatore]}
                                        </option>
                                      ))}
                                    </select>

                                    <ValoreCondizione
                                      definizione={definizione}
                                      condizione={condizione}
                                      opzioni={opzioni}
                                      onChange={(modifica) =>
                                        modificaCondizione(
                                          gruppo.id,
                                          condizione.id,
                                          modifica
                                        )
                                      }
                                    />

                                    <button
                                      type="button"
                                      onClick={() =>
                                        rimuoviCondizione(
                                          gruppo.id,
                                          condizione.id
                                        )
                                      }
                                      className="ml-auto rounded-lg p-1.5 text-gray-300 transition hover:bg-red-50 hover:text-red-500"
                                      aria-label="Elimina condizione"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            modificaGruppo(gruppo.id, {
                              condizioni: [
                                ...gruppo.condizioni,
                                nuovaCondizione(),
                              ],
                            })
                          }
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-500 transition hover:bg-gray-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Aggiungi condizione
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {riassunto && (
                <p className="mt-3 rounded-lg bg-blue-50/70 px-3 py-2 text-[11px] font-medium leading-relaxed text-[#0150a0]">
                  Mostra i ticket dove {riassunto}
                </p>
              )}
            </div>

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
/* Valore di una condizione                                            */
/* ------------------------------------------------------------------ */

function ValoreCondizione({
  definizione,
  condizione,
  opzioni,
  onChange,
}: {
  definizione: CampoFiltro;
  condizione: CondizioneFiltro;
  opzioni: readonly string[];
  onChange: (modifica: Partial<CondizioneFiltro>) => void;
}) {
  if (OPERATORI_SENZA_VALORE.includes(condizione.operatore)) {
    return null;
  }

  if (OPERATORI_A_ELENCO.includes(condizione.operatore) && opzioni.length > 0) {
    return (
      <div className="flex flex-wrap gap-1">
        {opzioni.map((opzione) => {
          const attivo = condizione.valori.includes(opzione);

          return (
            <button
              key={opzione}
              type="button"
              onClick={() =>
                onChange({ valori: toggle(condizione.valori, opzione) })
              }
              className={`rounded-md px-2 py-1 text-[10px] font-bold transition ${
                attivo
                  ? "bg-slate-900 text-[#ffffff]"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {opzione}
            </button>
          );
        })}

        {opzioni.length === 0 && (
          <span className="text-[11px] text-gray-400">
            Nessun valore disponibile
          </span>
        )}
      </div>
    );
  }

  // "è uno di" su un campo libero: si scrivono i valori separati da virgola.
  if (OPERATORI_A_ELENCO.includes(condizione.operatore)) {
    return (
      <input
        value={condizione.valori.join(", ")}
        onChange={(e) =>
          onChange({
            valori: e.target.value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          })
        }
        placeholder="valori separati da virgola"
        className={inputPiccolo}
      />
    );
  }

  if (
    condizione.operatore === "ultimi_giorni" ||
    condizione.operatore === "oltre_giorni"
  ) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          value={condizione.valore}
          onChange={(e) => onChange({ valore: e.target.value })}
          placeholder="15"
          className={`${inputPiccolo} w-20`}
        />
        <span className="text-[11px] font-bold text-gray-400">giorni</span>
      </div>
    );
  }

  if (definizione.tipo === "data") {
    return (
      <input
        type="date"
        value={condizione.valore}
        onChange={(e) => onChange({ valore: e.target.value })}
        className={inputPiccolo}
      />
    );
  }

  if (definizione.tipo === "numero") {
    return (
      <input
        type="number"
        value={condizione.valore}
        onChange={(e) => onChange({ valore: e.target.value })}
        className={`${inputPiccolo} w-24`}
      />
    );
  }

  return (
    <input
      value={condizione.valore}
      onChange={(e) => onChange({ valore: e.target.value })}
      placeholder="testo da cercare"
      className={inputPiccolo}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Helper                                                             */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0150a0]";

const inputPiccolo =
  "rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-[#0150a0]";

const selectPiccolo =
  "rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-700 outline-none focus:border-[#0150a0]";

function SelettoreLogica({
  valore,
  onChange,
  etichette,
  compatto = false,
}: {
  valore: LogicaFiltro;
  onChange: (logica: LogicaFiltro) => void;
  etichette: [string, string];
  compatto?: boolean;
}) {
  return (
    <div
      className={`inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white ${
        compatto ? "text-[9px]" : "text-[10px]"
      }`}
    >
      {(["and", "or"] as LogicaFiltro[]).map((logica, indice) => (
        <button
          key={logica}
          type="button"
          onClick={() => onChange(logica)}
          className={`px-2 py-0.5 font-black uppercase tracking-widest transition ${
            valore === logica
              ? "bg-slate-900 text-[#ffffff]"
              : "text-gray-400 hover:bg-gray-50"
          }`}
        >
          {etichette[indice]}
        </button>
      ))}
    </div>
  );
}

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
