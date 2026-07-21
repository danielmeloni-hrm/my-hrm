"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, RotateCcw, Settings2, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import {
  CAMPI_DETTAGLIO,
  CONFIG_PREDEFINITA,
  SEZIONI,
  etichettaCampo,
  formattaValore,
  normalizeTicketModalConfig,
  type CampoDettaglio,
  type SezioneId,
  type TicketModalConfig,
} from "@/lib/ticket-modal-fields";
import type { Ticket } from "@/components/ticket/TicketCard";
import MailThread from "@/components/ticket/MailThread";
import ModalPortal from "@/components/ui/ModalPortal";

type TicketDetailModalProps = {
  selectedTicket: Ticket | null;
  setSelectedTicket: React.Dispatch<React.SetStateAction<Ticket | null>>;
  handleUpdateTicket: (id: string, patch: Partial<Ticket>) => void;
  formatDateShort: (date?: string | null) => string;
  ui: {
    label: string;
    card?: string;
    field?: string;
    textarea?: string;
  };
  cn: (...classes: Array<string | false | null | undefined>) => string;
  handleToggleInLavorazione: (ticket: Ticket) => void;
  addLogNoteToDb?: (ticketId: string, updatedLogs: string[]) => Promise<void> | void;
};

const MONTH_NAMES = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

function getTodayDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseLogEntry(entry: string) {
  const bracketMatch = entry.match(/^\[(\d{4})-(\d{2})-(\d{2})\]\s*(.*)$/);
  if (bracketMatch) {
    const [, year, month, day, text] = bracketMatch;
    return {
      raw: entry,
      year,
      month,
      day,
      key: `${year}-${month}`,
      display: `${day}/${month} ${text.trim()}`.trim(),
    };
  }

  const datetimeMatch = entry.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?\s*[—-]?\s*(.*)$/
  );

  if (datetimeMatch) {
    const [, year, month, day, hh, mi, text] = datetimeMatch;
    const timePart = hh && mi ? ` ${hh}:${mi}` : "";

    return {
      raw: entry,
      year,
      month,
      day,
      key: `${year}-${month}`,
      display: `${day}/${month}${timePart} ${text.trim()}`.trim(),
    };
  }

  return {
    raw: entry,
    year: "",
    month: "",
    day: "",
    key: "senza-data",
    display: entry,
  };
}

function groupLogsByMonth(logs: string[] = []) {
  return logs.reduce<Record<string, Array<{ raw: string; display: string }>>>(
    (acc, entry) => {
      const parsed = parseLogEntry(entry);

      if (!acc[parsed.key]) acc[parsed.key] = [];

      acc[parsed.key].push({
        raw: parsed.raw,
        display: parsed.display,
      });

      return acc;
    },
    {}
  );
}

export default function TicketDetailModal({
  selectedTicket,
  setSelectedTicket,
  handleUpdateTicket,
  formatDateShort,
  ui,
  cn,
  handleToggleInLavorazione,
  addLogNoteToDb,
}: TicketDetailModalProps) {
  const [newLogNote, setNewLogNote] = useState("");
  const [logDate, setLogDate] = useState(getTodayDate());
  const [salvataggioNota, setSalvataggioNota] = useState(false);
  const [erroreNota, setErroreNota] = useState<string | null>(null);

  /* ---------------- personalizzazione del popup ---------------- */

  const supabase = useMemo(() => createClient(), []);

  const [config, setConfig] = useState<TicketModalConfig>(CONFIG_PREDEFINITA);
  const [pannelloAperto, setPannelloAperto] = useState(false);

  useEffect(() => {
    let annullato = false;

    fetch("/api/settings/ticket-modal")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (annullato || !json?.ok) return;
        setConfig(normalizeTicketModalConfig(json.config));
      })
      .catch(() => {});

    return () => {
      annullato = true;
    };
  }, [supabase]);

  const salvaConfig = useCallback(async (prossima: TicketModalConfig) => {
    setConfig(prossima);

    try {
      await fetch("/api/settings/ticket-modal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prossima),
      });
    } catch (error) {
      console.error("Salvataggio preferenze popup fallito:", error);
    }
  }, []);

  const mostra = useCallback(
    (sezione: SezioneId) => config.sezioni.includes(sezione),
    [config.sezioni]
  );

  function toggleSezione(sezione: SezioneId) {
    salvaConfig({
      ...config,
      sezioni: config.sezioni.includes(sezione)
        ? config.sezioni.filter((item) => item !== sezione)
        : [...config.sezioni, sezione],
    });
  }

  function toggleCampo(campo: CampoDettaglio) {
    salvaConfig({
      ...config,
      campi: config.campi.includes(campo)
        ? config.campi.filter((item) => item !== campo)
        : [...config.campi, campo],
    });
  }

  const cardClass =
    ui.card || "bg-white rounded-2xl border border-gray-200 shadow-sm";

  const fieldClass =
    ui.field ||
    "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none";

  const textareaClass =
    ui.textarea ||
    "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none resize-none";

  const groupedLogs = useMemo(() => {
    return groupLogsByMonth(selectedTicket?.storia_ticket || []);
  }, [selectedTicket?.storia_ticket]);

  if (!selectedTicket) return null;

  const ticketUrl = `https://my-hrm-tau.vercel.app/ticket/${selectedTicket.id}`;

  const addLogNote = async () => {
    const testo = newLogNote.trim();
    if (!testo || salvataggioNota) return;

    setSalvataggioNota(true);
    setErroreNota(null);

    const effectiveDate = logDate || getTodayDate();
    const formattedNote = `[${effectiveDate}] ${testo}`;
    const updatedLogs = [...(selectedTicket.storia_ticket || []), formattedNote];

    // Aggiornamento immediato in interfaccia, poi scrittura a database.
    setSelectedTicket((prev) =>
      prev ? { ...prev, storia_ticket: updatedLogs } : prev
    );
    setNewLogNote("");

    try {
      await handleUpdateTicket(selectedTicket.id, {
        storia_ticket: updatedLogs,
      });

      await addLogNoteToDb?.(selectedTicket.id, updatedLogs);
    } catch (error) {
      console.error("Errore aggiunta nota storia:", error);

      setErroreNota(
        error instanceof Error ? error.message : "Salvataggio non riuscito"
      );

      // Ripristina lo stato precedente e recupera il testo digitato.
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              storia_ticket: selectedTicket.storia_ticket || [],
            }
          : prev
      );
      setNewLogNote(testo);
    } finally {
      setSalvataggioNota(false);
    }
  };

  const deleteLogNote = async (rawLogToDelete: string) => {
    const logs = selectedTicket.storia_ticket || [];
    const indexToDelete = logs.findIndex((log) => log === rawLogToDelete);

    if (indexToDelete === -1) return;

    const updatedLogs = logs.filter((_, index) => index !== indexToDelete);

    handleUpdateTicket(selectedTicket.id, { storia_ticket: updatedLogs });
    setSelectedTicket((prev) =>
      prev ? { ...prev, storia_ticket: updatedLogs } : prev
    );

    await addLogNoteToDb?.(selectedTicket.id, updatedLogs);
  };

  const sortedKeys = Object.keys(groupedLogs).sort();

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
        onClick={() => setSelectedTicket(null)}
      >
        <div
          className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="px-6 lg:px-8 py-5 border-b border-gray-200 bg-white flex items-start justify-between gap-4">
          <div className="space-y-3 min-w-0 w-full">
            <div className="flex items-center gap-2 flex-wrap">
              {mostra("badge_cliente") && (
                <span className="text-[10px] font-black uppercase tracking-widest text-[#0150a0] bg-[#e6eef8] px-2.5 py-1 rounded-lg">
                  {selectedTicket.clienti?.nome || "N/D"}
                </span>
              )}

              {mostra("badge_applicativo") && (
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                  {Array.isArray(selectedTicket.applicativo)
                    ? selectedTicket.applicativo.join(", ")
                    : selectedTicket.applicativo || "APP"}
                </span>
              )}

              {mostra("badge_tag") && !!selectedTicket.n_tag && (
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg">
                  {selectedTicket.n_tag}
                </span>
              )}

              {mostra("badge_sprint") && !!selectedTicket.sprint && (
                <span className="text-[10px] font-black uppercase tracking-widest text-violet-700 bg-violet-100 px-2.5 py-1 rounded-lg">
                  {selectedTicket.sprint}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-black tracking-tight text-gray-900 leading-tight">
                  {selectedTicket.titolo}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPannelloAperto((prev) => !prev)}
                  title="Personalizza cosa vedere"
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border transition-all",
                    pannelloAperto
                      ? "border-[#0150a0] bg-[#0150a0] text-[#ffffff]"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  )}
                >
                  <Settings2 size={16} />
                </button>

                {mostra("azione_apri_ticket") && (
                <a
                  href={ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-[#0150a0] text-[#0150a0] hover:bg-[#0150a0] hover:text-[#ffffff] transition-all"
                >
                  Apri ticket
                </a>
                )}

                {mostra("azione_in_lavorazione") && (
                <button
                  onClick={() => handleToggleInLavorazione(selectedTicket)}
                  className={cn(
                    "shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                    selectedTicket.in_lavorazione_ora
                      ? "bg-red-500 text-[#ffffff] border-red-500"
                      : "bg-white text-gray-600 border-gray-200"
                  )}
                >
                  {selectedTicket.in_lavorazione_ora
                    ? "In lavorazione"
                    : "Non in lavorazione"}
                </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {pannelloAperto && (
          <div className="border-b border-gray-200 bg-white px-6 py-5 lg:px-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-gray-900">
                  Personalizza il popup
                </h3>
                <p className="text-xs text-gray-500">
                  Le scelte valgono solo per te e restano salvate
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => salvaConfig(CONFIG_PREDEFINITA)}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-black text-gray-500 hover:bg-gray-50"
                >
                  <RotateCcw size={13} />
                  Ripristina
                </button>

                <button
                  type="button"
                  onClick={() => setPannelloAperto(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:bg-gray-100"
                  aria-label="Chiudi pannello"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Sezioni
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {SEZIONI.map((sezione) => {
                    const attivo = config.sezioni.includes(sezione.id);

                    return (
                      <button
                        key={sezione.id}
                        type="button"
                        onClick={() => toggleSezione(sezione.id)}
                        className={cn(
                          "rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition",
                          attivo
                            ? "bg-[#0150a0] text-[#ffffff]"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        )}
                      >
                        {sezione.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Campi della scheda dettagli
                </p>

                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1">
                  {CAMPI_DETTAGLIO.map((campo) => {
                    const attivo = config.campi.includes(campo);

                    return (
                      <button
                        key={campo}
                        type="button"
                        onClick={() => toggleCampo(campo)}
                        className={cn(
                          "rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition",
                          attivo
                            ? "bg-emerald-600 text-[#ffffff]"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        )}
                      >
                        {etichettaCampo(campo)}
                      </button>
                    );
                  })}
                </div>

                {!config.sezioni.includes("dettagli") && (
                  <p className="mt-2 text-[11px] font-semibold text-amber-600">
                    Attiva la sezione “Scheda dettagli” per vederli nel popup.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="p-6 lg:p-8 overflow-y-auto bg-[#f8fafc]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            <div className="lg:col-span-8 space-y-6">
              {mostra("storia") && (
              <div
                className={`${cardClass} flex h-[clamp(320px,55vh,650px)] flex-col overflow-hidden`}
              >
                <div className="px-8 py-4 border-b border-gray-100 flex items-center gap-2 bg-[#f8fbff]">
                  <MessageSquare size={16} className="text-[#0150a0]" />
                  <span className="text-[10px] font-black uppercase text-[#0150a0] tracking-widest">
                    Storia dell'attività
                  </span>
                </div>

                <div className="flex flex-col flex-1 border-b border-gray-100">
                  <div className="flex-1 overflow-y-auto p-8 text-[14px] leading-relaxed text-gray-700 space-y-5 bg-gray-50">
                    {sortedKeys.length === 0 ? (
                      <div className="text-sm text-gray-400">
                        Nessuna nota presente.
                      </div>
                    ) : (
                      sortedKeys.map((key) => {
                        if (key === "senza-data") {
                          return (
                            <div key={key} className="space-y-3">
                              <div className="text-[10px] font-black uppercase tracking-widest text-[#0150a0]">
                                Senza data
                              </div>

                              <ul className="space-y-2">
                                {groupedLogs[key].map((note, i) => (
                                  <li
                                    key={`${key}-${i}`}
                                    className="flex items-start justify-between gap-4 rounded-lg px-4 py-3"
                                  >
                                    <span className="text-sm text-gray-700">
                                      {note.display}
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() => deleteLogNote(note.raw)}
                                      className="shrink-0 text-red-500 text-xs font-black hover:text-red-600"
                                    >
                                      ✕
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        }

                        const [year, month] = key.split("-");

                        return (
                          <div key={key} className="space-y-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-[#0150a0]">
                              {MONTH_NAMES[parseInt(month, 10) - 1]} {year}
                            </div>

                            <ul className="space-y-2">
                              {groupedLogs[key].map((note, i) => (
                                <li
                                  key={`${key}-${i}`}
                                  className="flex items-start justify-between gap-4 rounded-lg px-4 py-3"
                                >
                                  <span className="text-sm text-gray-700">
                                    {note.display}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => deleteLogNote(note.raw)}
                                    className="shrink-0 text-red-500 text-xs font-black hover:text-red-600"
                                  >
                                    ✕
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-3 px-6 py-3 bg-white border-t border-gray-100 items-center">
                    <input
                      type="date"
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                      className={`${fieldClass} py-2 text-xs`}
                    />

                    <textarea
                      value={newLogNote}
                      onChange={(e) => setNewLogNote(e.target.value)}
                      onKeyDown={(e) => {
                        // Invio aggiunge la nota, Shift+Invio va a capo.
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void addLogNote();
                        }
                      }}
                      placeholder="Aggiungi nota..."
                      className={`${textareaClass} py-2 text-sm min-h-[44px]`}
                      rows={1}
                    />

                    <button
                      onClick={() => void addLogNote()}
                      disabled={!newLogNote.trim() || salvataggioNota}
                      className="rounded-md bg-[#0150a0] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#ffffff] shadow-sm transition-all hover:bg-[#013f82] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {salvataggioNota ? "Salvo…" : "Aggiungi"}
                    </button>

                    {erroreNota && (
                      <p className="md:col-span-3 text-xs font-bold text-red-600">
                        {erroreNota}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              )}
            </div>

            <div className="lg:col-span-4 space-y-4">
              {mostra("dettagli") && config.campi.length > 0 && (
                <div className={cardClass}>
                  <div className="p-4">
                    <p className={ui.label}>Dettagli</p>

                    <dl className="mt-3 space-y-2">
                      {config.campi.map((campo) => (
                        <div
                          key={campo}
                          className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                        >
                          <dt className="text-[11px] font-black uppercase tracking-tight text-gray-400">
                            {etichettaCampo(campo)}
                          </dt>
                          <dd className="text-right text-xs font-bold text-gray-700">
                            {formattaValore(
                              campo,
                              (selectedTicket as Record<string, unknown>)[campo]
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              )}

              {mostra("avanzamento") && (
              <div className={cardClass}>
                <div className="p-4">
                  <p className={ui.label}>Avanzamento</p>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-gray-700">Progresso</span>

                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={selectedTicket.percentuale_avanzamento || 0}
                        onChange={(e) =>
                          setSelectedTicket({
                            ...selectedTicket,
                            percentuale_avanzamento: Math.min(
                              100,
                              Math.max(0, parseInt(e.target.value) || 0)
                            ),
                          })
                        }
                        onBlur={(e) =>
                          handleUpdateTicket(selectedTicket.id, {
                            percentuale_avanzamento: Math.min(
                              100,
                              Math.max(0, parseInt(e.target.value) || 0)
                            ),
                          })
                        }
                        className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-black text-gray-800 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{
                        width: `${selectedTicket.percentuale_avanzamento || 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              )}

              {mostra("mail_thread") && (
              <MailThread
                ticketData={selectedTicket}
                saving={false}
                onUpdate={async (field, value) => {
                  handleUpdateTicket(selectedTicket.id, { [field]: value });

                  setSelectedTicket((prev) =>
                    prev ? { ...prev, [field]: value } : prev
                  );

                  if (field === "storia_ticket" && Array.isArray(value)) {
                    await addLogNoteToDb?.(selectedTicket.id, value);
                  }
                }}
              />
              )}

              {mostra("note_bloccanti") && (
              <div className={`${cardClass} flex flex-col`}>
                <div className="p-4">
                  <p className={ui.label}>Note bloccanti</p>
                  <textarea
                    rows={10}
                    value={selectedTicket.note_importanti || ""}
                    onChange={(e) =>
                      setSelectedTicket({
                        ...selectedTicket,
                        note_importanti: e.target.value,
                      })
                    }
                    onBlur={(e) =>
                      handleUpdateTicket(selectedTicket.id, {
                        note_importanti: e.target.value,
                      })
                    }
                    className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 outline-none resize-none min-h-[220px]"
                  />
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </ModalPortal>
  );
}
