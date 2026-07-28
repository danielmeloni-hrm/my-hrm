"use client";

import { useMemo, useState } from "react";
import ModalPortal from "@/components/ui/ModalPortal";
import { Download, X } from "lucide-react";
import { esportaTicketExcel } from "@/lib/export-excel";

export type ExportColumn = { id: string; label: string };

type Props = {
  /** Tutte le colonne selezionabili, nell'ordine mostrato in tabella. */
  columns: ExportColumn[];
  /** Ticket già filtrati da esportare. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tickets: any[];
  /** Nome file (senza estensione, la data viene aggiunta in automatico). */
  filenameBase: string;
  /** Nome del foglio Excel. */
  sheetName?: string;
  /** Id delle colonne pre-selezionate (default: tutte). */
  defaultSelected?: string[];
  onClose: () => void;
};

export default function ExcelExportDialog({
  columns,
  tickets,
  filenameBase,
  sheetName = "Ticket",
  defaultSelected,
  onClose,
}: Props) {
  const [selezionate, setSelezionate] = useState<string[]>(
    defaultSelected ?? columns.map((c) => c.id)
  );
  const [scaricando, setScaricando] = useState(false);

  const tutteSelezionate = selezionate.length === columns.length;

  const colonneOrdinate = useMemo(
    () => columns.filter((c) => selezionate.includes(c.id)),
    [columns, selezionate]
  );

  function toggle(id: string) {
    setSelezionate((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleTutte() {
    setSelezionate(tutteSelezionate ? [] : columns.map((c) => c.id));
  }

  async function scarica() {
    if (colonneOrdinate.length === 0) return;
    setScaricando(true);
    try {
      await esportaTicketExcel(
        filenameBase,
        colonneOrdinate,
        tickets,
        sheetName
      );
      onClose();
    } finally {
      setScaricando(false);
    }
  }

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[120] overflow-y-auto bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-auto my-4 flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Scarica in Excel
              </h2>
              <p className="text-[11px] font-semibold text-slate-400">
                {tickets.length} righe · scegli le colonne da esportare
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Chiudi"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <button
              type="button"
              onClick={toggleTutte}
              className="mb-3 text-[11px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800"
            >
              {tutteSelezionate ? "Deseleziona tutte" : "Seleziona tutte"}
            </button>

            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {columns.map((col) => {
                const attiva = selezionate.includes(col.id);
                return (
                  <label
                    key={col.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      attiva
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={attiva}
                      onChange={() => toggle(col.id)}
                      className="h-4 w-4 accent-blue-600"
                    />
                    {col.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-slate-200 px-6 py-4">
            <span className="text-[11px] font-bold text-slate-400">
              {selezionate.length} colonne selezionate
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Annulla
              </button>
              <button
                onClick={scarica}
                disabled={colonneOrdinate.length === 0 || scaricando}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-[#ffffff] hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {scaricando ? "Preparazione..." : "Scarica Excel"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
