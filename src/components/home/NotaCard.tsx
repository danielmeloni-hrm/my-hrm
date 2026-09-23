"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckSquare,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Square,
  StickyNote,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { NotaCardConfig } from "@/lib/home-widgets";

/* ------------------------------------------------------------------ */
/* Tipi, allineati alla tabella editor_notes usata dal note board      */
/* ------------------------------------------------------------------ */

export type NoteType = "text" | "todo" | "taskmanager";

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
};

export type EditorNote = {
  id: string;
  user_id: string;
  file_name: string;
  content: string;
  note_type: NoteType;
  todo_items: TodoItem[] | null;
  updated_at: string;
};

export const CAMPI_NOTA =
  "id, user_id, file_name, content, note_type, todo_items, updated_at";

export const ICONA_TIPO_NOTA: Record<NoteType, typeof FileText> = {
  text: StickyNote,
  todo: CheckSquare,
  taskmanager: FileText,
};

export const ETICHETTA_TIPO_NOTA: Record<NoteType, string> = {
  text: "Testo",
  todo: "To do",
  taskmanager: "Task",
};

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

/**
 * Card legata a UNA nota del note board.
 *
 * A differenza della card "Note importanti", che elenca tutte le note, qui
 * si sceglie una nota e la card mostra sempre quella: serve per tenere
 * sotto gli occhi un promemoria o una lista di cose da fare senza doverla
 * ricercare ogni volta. Se ne possono mettere quante se ne vogliono.
 */
export default function NotaCard({ config }: { config: NotaCardConfig }) {
  const supabase = useMemo(() => createClient(), []);

  const [nota, setNota] = useState<EditorNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [bozza, setBozza] = useState("");
  const [nuovoTodo, setNuovoTodo] = useState("");
  const [salvataggio, setSalvataggio] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  const timerSalvataggio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteId = config.noteId;

  useEffect(() => {
    let annullato = false;

    async function carica() {
      if (!noteId) {
        setNota(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("editor_notes")
        .select(CAMPI_NOTA)
        .eq("id", noteId)
        .maybeSingle();

      if (annullato) return;

      if (error) {
        console.error("Errore caricamento nota:", error);
        setErrore(error.message);
        setNota(null);
      } else {
        setErrore(null);
        setNota((data as EditorNote | null) ?? null);
        setBozza((data as EditorNote | null)?.content ?? "");
      }

      setLoading(false);
    }

    carica();

    return () => {
      annullato = true;
      if (timerSalvataggio.current) clearTimeout(timerSalvataggio.current);
    };
  }, [supabase, noteId]);

  const persistNote = useCallback(
    async (patch: Partial<EditorNote>) => {
      if (!nota) return;

      setSalvataggio("saving");

      const aggiornato = new Date().toISOString();

      const { error } = await supabase
        .from("editor_notes")
        .update({ ...patch, updated_at: aggiornato })
        .eq("id", nota.id);

      if (error) {
        console.error("Errore salvataggio nota:", error);
        setErrore(error.message);
        setSalvataggio("idle");
        return;
      }

      setErrore(null);
      setNota((prev) =>
        prev ? { ...prev, ...patch, updated_at: aggiornato } : prev
      );

      setSalvataggio("saved");
      setTimeout(() => setSalvataggio("idle"), 1500);
    },
    [supabase, nota]
  );

  function cambiaContenuto(valore: string) {
    setBozza(valore);
    if (!nota || config.soloLettura) return;

    if (timerSalvataggio.current) clearTimeout(timerSalvataggio.current);

    // Salvataggio automatico dopo una breve pausa nella digitazione.
    timerSalvataggio.current = setTimeout(() => {
      void persistNote({ content: valore });
    }, 800);
  }

  async function spuntaTodo(itemId: string) {
    if (!nota || config.soloLettura) return;

    const items = (nota.todo_items ?? []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );

    await persistNote({ todo_items: items });
  }

  async function aggiungiTodo() {
    const testo = nuovoTodo.trim();
    if (!nota || !testo || config.soloLettura) return;

    const items = [
      ...(nota.todo_items ?? []),
      {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`,
        text: testo,
        done: false,
      },
    ];

    setNuovoTodo("");
    await persistNote({ todo_items: items });
  }

  async function rimuoviTodo(itemId: string) {
    if (!nota || config.soloLettura) return;

    const items = (nota.todo_items ?? []).filter((item) => item.id !== itemId);
    await persistNote({ todo_items: items });
  }

  /* ------------------------------ render ---------------------------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-xs font-bold text-slate-400">
        <Loader2 size={14} className="animate-spin" />
        Carico la nota…
      </div>
    );
  }

  if (!noteId) {
    return (
      <p className="py-6 text-center text-[11px] font-bold text-slate-400">
        Nessuna nota scelta. Entra in modifica e usa la matita sulla card per
        sceglierne una.
      </p>
    );
  }

  if (!nota) {
    return (
      <p className="py-6 text-center text-[11px] font-bold text-slate-400">
        {errore
          ? `Nota non caricata: ${errore}`
          : "La nota collegata non esiste più. Scegline un'altra dalla matita."}
      </p>
    );
  }

  const todoItems = nota.todo_items ?? [];
  const fatti = todoItems.filter((item) => item.done).length;
  const modificabile = !config.soloLettura;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="truncate text-[10px] font-bold text-slate-400">
          {new Date(nota.updated_at).toLocaleString("it-IT", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {todoItems.length > 0 && (
            <>
              {" · "}
              {fatti}/{todoItems.length} fatte
            </>
          )}
          {salvataggio === "saving" && " · salvataggio…"}
          {salvataggio === "saved" && " · salvato"}
        </span>

        <Link
          href="/note_board"
          className="inline-flex shrink-0 items-center gap-1 text-[10px] font-black uppercase tracking-tight text-slate-400 transition hover:text-[#0150a0]"
          title="Apri il note board"
        >
          Note board
          <ExternalLink size={11} />
        </Link>
      </div>

      {errore && (
        <p className="shrink-0 rounded-lg bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">
          {errore}
        </p>
      )}

      {nota.note_type === "text" ? (
        modificabile ? (
          <textarea
            value={bozza}
            onChange={(event) => cambiaContenuto(event.target.value)}
            placeholder="Scrivi qui…"
            className="min-h-0 flex-1 resize-none rounded-xl border border-slate-200 bg-white/80 p-3 text-[12px] leading-relaxed text-slate-700 outline-none focus:border-[#0150a0]"
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white/80 p-3 text-[12px] leading-relaxed text-slate-700">
            {nota.content || "—"}
          </div>
        )
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {todoItems.length === 0 ? (
              <p className="py-4 text-center text-[11px] font-bold text-slate-300">
                Nessuna voce.
              </p>
            ) : (
              todoItems.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-start gap-2 rounded-lg px-1 py-1 transition hover:bg-white/70"
                >
                  <button
                    type="button"
                    onClick={() => spuntaTodo(item.id)}
                    disabled={!modificabile}
                    className={`mt-0.5 shrink-0 transition ${
                      item.done ? "text-emerald-600" : "text-slate-300"
                    } ${modificabile ? "hover:text-emerald-600" : "cursor-default"}`}
                    aria-label={item.done ? "Da fare" : "Fatto"}
                  >
                    {item.done ? (
                      <CheckSquare size={14} />
                    ) : (
                      <Square size={14} />
                    )}
                  </button>

                  <span
                    className={`min-w-0 flex-1 break-words text-[12px] ${
                      item.done
                        ? "text-slate-400 line-through"
                        : "text-slate-700"
                    }`}
                  >
                    {item.text}
                  </span>

                  {modificabile && (
                    <button
                      type="button"
                      onClick={() => rimuoviTodo(item.id)}
                      className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                      aria-label="Elimina voce"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {modificabile && (
            <div className="flex shrink-0 items-center gap-1.5">
              <input
                value={nuovoTodo}
                onChange={(event) => setNuovoTodo(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void aggiungiTodo();
                  }
                }}
                placeholder="Aggiungi una voce…"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] outline-none focus:border-[#0150a0]"
              />

              <button
                type="button"
                onClick={() => void aggiungiTodo()}
                disabled={!nuovoTodo.trim()}
                className="shrink-0 rounded-lg bg-[#0150a0] p-1.5 text-[#ffffff] transition disabled:opacity-40"
                aria-label="Aggiungi voce"
              >
                <Plus size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
