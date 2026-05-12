"use client";

import React, { useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import type { Ticket } from "@/components/ticket/TicketCard";
import MailThread from "@/components/ticket/MailThread";

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
    if (!newLogNote.trim()) return;

    const effectiveDate = logDate || getTodayDate();
    const formattedNote = `[${effectiveDate}] ${newLogNote.trim()}`;
    const updatedLogs = [...(selectedTicket.storia_ticket || []), formattedNote];

    handleUpdateTicket(selectedTicket.id, { storia_ticket: updatedLogs });
    setSelectedTicket((prev) =>
      prev ? { ...prev, storia_ticket: updatedLogs } : prev
    );
    setNewLogNote("");

    await addLogNoteToDb?.(selectedTicket.id, updatedLogs);
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

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-[#0150a0] text-[#0150a0] hover:bg-[#0150a0] hover:text-white transition-all"
                >
                  Apri ticket
                </a>

                <button
                  onClick={() => handleToggleInLavorazione(selectedTicket)}
                  className={cn(
                    "shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                    selectedTicket.in_lavorazione_ora
                      ? "bg-red-500 text-white border-red-500"
                      : "bg-white text-gray-600 border-gray-200"
                  )}
                >
                  {selectedTicket.in_lavorazione_ora
                    ? "In lavorazione"
                    : "Non in lavorazione"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 lg:p-8 overflow-y-auto bg-[#f8fafc]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            <div className="lg:col-span-8 space-y-6">
              <div className={`${cardClass} overflow-hidden flex flex-col h-[650px]`}>
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
                      placeholder="Aggiungi nota..."
                      className={`${textareaClass} py-2 text-sm min-h-[44px]`}
                      rows={1}
                    />

                    <button
                      onClick={addLogNote}
                      className="px-4 py-2 rounded-md bg-[#0150a0] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#013f82] transition-all shadow-sm"
                    >
                      Aggiungi
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-4">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}