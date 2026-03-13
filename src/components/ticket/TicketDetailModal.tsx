"use client";

import React, { useState } from "react";
import { MessageSquare } from "lucide-react";
import type { Ticket } from "@/components/ticket/TicketCard";

type TicketDetailModalProps = {
  selectedTicket: Ticket | null;
  setSelectedTicket: React.Dispatch<React.SetStateAction<Ticket | null>>;
  handleUpdateTicket: (id: string, patch: Partial<Ticket>) => void;
  formatDateShort: (date?: string | null) => string;
  ui: {
    label: string;
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

function groupLogsByMonth(logs: string[] = []) {
  return logs.reduce<Record<string, string[]>>((acc, note) => {
    const match = note.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const key = match ? `${match[1]}-${match[2]}` : "senza-data";

    if (!acc[key]) acc[key] = [];
    acc[key].push(note);

    return acc;
  }, {});
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

  if (!selectedTicket) return null;

  const addLogNote = async () => {
    if (!selectedTicket || !newLogNote.trim()) return;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");

    const formattedNote = `${yyyy}-${mm}-${dd} ${hh}:${mi} — ${newLogNote.trim()}`;
    const updatedLogs = [...(selectedTicket.storia_ticket || []), formattedNote];

    handleUpdateTicket(selectedTicket.id, { storia_ticket: updatedLogs });
    setSelectedTicket((prev) =>
      prev ? { ...prev, storia_ticket: updatedLogs } : prev
    );
    setNewLogNote("");

    await addLogNoteToDb?.(selectedTicket.id, updatedLogs);
  };

  const deleteLogNote = async (indexToDelete: number) => {
    if (!selectedTicket) return;

    const updatedLogs = (selectedTicket.storia_ticket || []).filter(
      (_, index) => index !== indexToDelete
    );

    handleUpdateTicket(selectedTicket.id, { storia_ticket: updatedLogs });
    setSelectedTicket((prev) =>
      prev ? { ...prev, storia_ticket: updatedLogs } : prev
    );

    await addLogNoteToDb?.(selectedTicket.id, updatedLogs);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] p-4 flex items-center justify-center"
      onClick={() => setSelectedTicket(null)}
    >
      <div
        className="w-full max-w-6xl bg-white rounded-[28px] shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 lg:px-8 py-5 border-b border-gray-200 bg-white flex items-start justify-between gap-4">
          <div className="space-y-3 min-w-0 w-full">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#0150a0] bg-[#e6eef8] px-2.5 py-1 rounded-lg">
                {selectedTicket.clienti?.nome || "N/D"}
              </span>

              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                {Array.isArray(selectedTicket.applicativo)
                  ? selectedTicket.applicativo.join(", ")
                  : selectedTicket.applicativo || "APP"}
              </span>

              {!!selectedTicket.n_tag && (
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg">
                  {selectedTicket.n_tag}
                </span>
              )}

              {!!selectedTicket.sprint && (
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

              <button
                onClick={() => handleToggleInLavorazione(selectedTicket)}
                className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                  selectedTicket.in_lavorazione_ora
                    ? "bg-red-500 text-white border-red-500"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {selectedTicket.in_lavorazione_ora
                  ? "In lavorazione"
                  : "Non in lavorazione"}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 lg:p-8 overflow-y-auto space-y-6 bg-[#f8fafc]">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-200 p-5">
              <p className={ui.label}>Descrizione</p>
              <textarea
                rows={16}
                value={selectedTicket.descrizione || ""}
                onChange={(e) =>
                  setSelectedTicket({
                    ...selectedTicket,
                    descrizione: e.target.value,
                  })
                }
                onBlur={(e) =>
                  handleUpdateTicket(selectedTicket.id, {
                    descrizione: e.target.value,
                  })
                }
                className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none resize-none min-h-[420px]"
              />
            </div>

            <div className="xl:col-span-1 flex flex-col gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
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

              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className={ui.label}>Ultimo ping</p>
                <p className="mt-2 text-sm font-bold text-gray-900">
                  {formatDateShort(selectedTicket.ultimo_ping)}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-4 flex-1">
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
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-8 py-4 border-b border-gray-100 flex items-center gap-2 bg-[#f8fbff]">
              <MessageSquare size={16} className="text-[#0150a0]" />
              <span className="text-[10px] font-black uppercase text-[#0150a0] tracking-widest">
                Storia dell'attività
              </span>
            </div>

            <div className="flex flex-col border-b border-gray-100">
              <div className="overflow-y-auto p-8 text-[14px] leading-relaxed text-gray-700 space-y-5 bg-gray-50 max-h-[320px]">
                {(() => {
                  const grouped = groupLogsByMonth(selectedTicket.storia_ticket || []);
                  const sortedKeys = Object.keys(grouped).sort();

                  if (sortedKeys.length === 0) {
                    return (
                      <div className="text-sm text-gray-400">
                        Nessuna nota presente.
                      </div>
                    );
                  }

                  let globalIndex = -1;

                  return sortedKeys.map((key) => {
                    if (key === "senza-data") {
                      return (
                        <div key={key} className="space-y-3">
                          <div className="text-[10px] font-black uppercase tracking-widest text-[#0150a0]">
                            Senza data
                          </div>

                          <ul className="space-y-2">
                            {grouped[key].map((note, i) => {
                              globalIndex += 1;
                              return (
                                <li
                                  key={i}
                                  className="flex items-start justify-between gap-4 rounded-lg px-4 py-3 bg-white border border-gray-200"
                                >
                                  <span className="text-sm text-gray-700">
                                    {note}
                                  </span>

                                  <button
                                    onClick={() => deleteLogNote(globalIndex)}
                                    className="shrink-0 text-red-500 text-xs font-black hover:text-red-600"
                                  >
                                    ✕
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    }

                    const [year, month] = key.split("-");

                    return (
                      <div key={key} className="space-y-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#0150a0]">
                          {MONTH_NAMES[parseInt(month) - 1]} {year}
                        </div>

                        <ul className="space-y-2">
                          {grouped[key].map((note, i) => {
                            globalIndex += 1;
                            return (
                              <li
                                key={i}
                                className="flex items-start justify-between gap-4 rounded-lg px-4 py-3 bg-white border border-gray-200"
                              >
                                <span className="text-sm text-gray-700">
                                  {note}
                                </span>

                                <button
                                  onClick={() => deleteLogNote(globalIndex)}
                                  className="shrink-0 text-red-500 text-xs font-black hover:text-red-600"
                                >
                                  ✕
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="p-6 bg-white border-t border-gray-100 flex flex-col gap-3">
                <textarea
                  rows={3}
                  value={newLogNote}
                  onChange={(e) => setNewLogNote(e.target.value)}
                  placeholder="Aggiungi una nota alla storia dell'attività..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none resize-none"
                />

                <div className="flex justify-end">
                  <button
                    onClick={addLogNote}
                    className="px-4 py-2 rounded-xl bg-[#0150a0] text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                  >
                    Aggiungi nota
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
