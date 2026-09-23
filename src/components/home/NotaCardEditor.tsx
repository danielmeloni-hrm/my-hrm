"use client";

import { useEffect, useMemo, useState } from "react";
import ModalPortal from "@/components/ui/ModalPortal";
import { Loader2, Save, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { NotaCardConfig } from "@/lib/home-widgets";
import {
  CAMPI_NOTA,
  ETICHETTA_TIPO_NOTA,
  ICONA_TIPO_NOTA,
  type EditorNote,
} from "./NotaCard";

type Props = {
  config: NotaCardConfig;
  onSave: (config: NotaCardConfig) => void;
  onClose: () => void;
};

export default function NotaCardEditor({ config, onSave, onClose }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [bozza, setBozza] = useState<NotaCardConfig>(config);
  const [note, setNote] = useState<EditorNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState("");

  useEffect(() => {
    let annullato = false;

    async function carica() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (annullato) return;

      if (!user) {
        setErrore("Sessione non valida: rientra nell'applicazione.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("editor_notes")
        .select(CAMPI_NOTA)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (annullato) return;

      if (error) {
        console.error("Errore caricamento note:", error);
        setErrore(error.message);
      } else {
        setErrore(null);
        setNote((data ?? []) as EditorNote[]);
      }

      setLoading(false);
    }

    carica();

    return () => {
      annullato = true;
    };
  }, [supabase]);

  const noteFiltrate = useMemo(() => {
    const query = ricerca.trim().toLowerCase();
    if (!query) return note;

    return note.filter(
      (nota) =>
        nota.file_name.toLowerCase().includes(query) ||
        (nota.content ?? "").toLowerCase().includes(query)
    );
  }, [note, ricerca]);

  const notaScelta = note.find((nota) => nota.id === bozza.noteId) ?? null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[120] overflow-y-auto bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          className="mx-auto my-4 flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-bold text-gray-900">
              Scegli la nota da mostrare
            </h2>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Chiudi"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-400">
                Titolo della card
              </label>
              <input
                value={bozza.titolo}
                onChange={(event) =>
                  setBozza((prev) => ({ ...prev, titolo: event.target.value }))
                }
                placeholder={
                  notaScelta?.file_name || "Vuoto: si usa il nome della nota"
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0150a0]"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setBozza((prev) => ({
                  ...prev,
                  soloLettura: !prev.soloLettura,
                }))
              }
              className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                bozza.soloLettura
                  ? "bg-[#0150a0] text-[#ffffff]"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              Sola lettura
            </button>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                  Nota collegata
                </span>

                <div className="relative">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300"
                  />
                  <input
                    value={ricerca}
                    onChange={(event) => setRicerca(event.target.value)}
                    placeholder="Cerca…"
                    className="w-44 rounded-lg border border-gray-200 py-1.5 pl-7 pr-2 text-[11px] outline-none focus:border-[#0150a0]"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs font-bold text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                  Carico le note…
                </div>
              ) : errore ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                  {errore}
                </p>
              ) : noteFiltrate.length === 0 ? (
                <p className="py-8 text-center text-xs font-bold text-gray-400">
                  {note.length === 0
                    ? "Non hai ancora nessuna nota: creane una dal note board."
                    : "Nessuna nota corrisponde alla ricerca."}
                </p>
              ) : (
                <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {noteFiltrate.map((nota) => {
                    const Icona = ICONA_TIPO_NOTA[nota.note_type] ?? Search;
                    const scelta = bozza.noteId === nota.id;
                    const voci = nota.todo_items?.length ?? 0;

                    return (
                      <button
                        key={nota.id}
                        type="button"
                        onClick={() =>
                          setBozza((prev) => ({ ...prev, noteId: nota.id }))
                        }
                        className={`flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                          scelta
                            ? "border-[#0150a0] bg-blue-50/60"
                            : "border-gray-100 bg-gray-50/60 hover:border-gray-200 hover:bg-gray-100/60"
                        }`}
                      >
                        <Icona
                          size={14}
                          className={`mt-0.5 shrink-0 ${
                            scelta ? "text-[#0150a0]" : "text-gray-400"
                          }`}
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-bold text-gray-800">
                            {nota.file_name}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-gray-500">
                            {ETICHETTA_TIPO_NOTA[nota.note_type] ??
                              nota.note_type}
                            {voci > 0 && ` · ${voci} voci`}
                            {" · "}
                            {new Date(nota.updated_at).toLocaleDateString(
                              "it-IT"
                            )}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
              disabled={!bozza.noteId}
              className="flex items-center gap-2 rounded-xl bg-[#0150a0] px-4 py-2 text-sm font-semibold text-[#ffffff] transition hover:bg-[#014080] disabled:opacity-40"
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
