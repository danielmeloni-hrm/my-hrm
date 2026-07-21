"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckSquare,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/* Tipi (allineati alla tabella editor_notes usata da note_board)      */
/* ------------------------------------------------------------------ */

type NoteType = "text" | "todo" | "taskmanager";

type TodoItem = {
  id: string;
  text: string;
  done: boolean;
};

type EditorNote = {
  id: string;
  user_id: string;
  file_name: string;
  content: string;
  note_type: NoteType;
  todo_items: TodoItem[] | null;
  updated_at: string;
};

const NOTE_TYPES: {
  type: NoteType;
  label: string;
  icon: typeof FileText;
  activeClass: string;
}[] = [
  {
    type: "text",
    label: "Testo",
    icon: StickyNote,
    activeClass: "bg-[#0e639c] text-[#ffffff]",
  },
  {
    type: "todo",
    label: "To do",
    icon: CheckSquare,
    activeClass: "bg-[#5a3ea7] text-[#ffffff]",
  },
  {
    type: "taskmanager",
    label: "Task",
    icon: FileText,
    activeClass: "bg-[#7a5c00] text-[#ffffff]",
  },
];

/* ------------------------------------------------------------------ */
/* Widget                                                              */
/* ------------------------------------------------------------------ */

export default function NoteWidget() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState<EditorNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  const [filtroTipo, setFiltroTipo] = useState<NoteType | null>(null);
  const [noteAttivaId, setNoteAttivaId] = useState<string | null>(null);

  const [bozza, setBozza] = useState("");
  const [nuovoTodo, setNuovoTodo] = useState("");
  const [salvataggio, setSalvataggio] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  const timerSalvataggio = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------------------------- caricamento --------------------------- */

  const loadNotes = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase
        .from("editor_notes")
        .select("id, user_id, file_name, content, note_type, todo_items, updated_at")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Errore caricamento note:", error);
        setErrore(error.message);
        return;
      }

      setErrore(null);
      setNotes((data ?? []) as EditorNote[]);
    },
    [supabase]
  );

  useEffect(() => {
    let annullato = false;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (annullato) return;

      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);
      await loadNotes(user.id);

      if (!annullato) setLoading(false);
    }

    init();

    return () => {
      annullato = true;
      if (timerSalvataggio.current) clearTimeout(timerSalvataggio.current);
    };
  }, [supabase, loadNotes]);

  /* ------------------------------ selezione --------------------------- */

  const noteFiltrate = useMemo(
    () =>
      filtroTipo ? notes.filter((note) => note.note_type === filtroTipo) : notes,
    [notes, filtroTipo]
  );

  const noteAttiva = useMemo(
    () => noteFiltrate.find((note) => note.id === noteAttivaId) ?? null,
    [noteFiltrate, noteAttivaId]
  );

  // Se il filtro esclude la nota aperta, passiamo alla prima disponibile.
  useEffect(() => {
    if (noteFiltrate.length === 0) {
      setNoteAttivaId(null);
      return;
    }

    if (!noteFiltrate.some((note) => note.id === noteAttivaId)) {
      setNoteAttivaId(noteFiltrate[0].id);
    }
  }, [noteFiltrate, noteAttivaId]);

  useEffect(() => {
    setBozza(noteAttiva?.content ?? "");
  }, [noteAttiva?.id, noteAttiva?.content]);

  /* ----------------------------- salvataggio -------------------------- */

  const persistNote = useCallback(
    async (noteId: string, patch: Partial<EditorNote>) => {
      setSalvataggio("saving");

      const { error } = await supabase
        .from("editor_notes")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", noteId);

      if (error) {
        console.error("Errore salvataggio nota:", error);
        setErrore(error.message);
        setSalvataggio("idle");
        return false;
      }

      setErrore(null);
      setNotes((prev) =>
        prev.map((note) =>
          note.id === noteId
            ? { ...note, ...patch, updated_at: new Date().toISOString() }
            : note
        )
      );

      setSalvataggio("saved");
      setTimeout(() => setSalvataggio("idle"), 1500);
      return true;
    },
    [supabase]
  );

  function handleContentChange(value: string) {
    setBozza(value);

    if (!noteAttiva) return;

    if (timerSalvataggio.current) clearTimeout(timerSalvataggio.current);

    // Salvataggio automatico dopo una breve pausa nella digitazione.
    timerSalvataggio.current = setTimeout(() => {
      persistNote(noteAttiva.id, { content: value });
    }, 800);
  }

  async function toggleTodo(itemId: string) {
    if (!noteAttiva) return;

    const items = (noteAttiva.todo_items ?? []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );

    await persistNote(noteAttiva.id, { todo_items: items });
  }

  async function addTodo() {
    const testo = nuovoTodo.trim();
    if (!noteAttiva || !testo) return;

    const items = [
      ...(noteAttiva.todo_items ?? []),
      { id: crypto.randomUUID(), text: testo, done: false },
    ];

    setNuovoTodo("");
    await persistNote(noteAttiva.id, { todo_items: items });
  }

  async function removeTodo(itemId: string) {
    if (!noteAttiva) return;

    const items = (noteAttiva.todo_items ?? []).filter(
      (item) => item.id !== itemId
    );

    await persistNote(noteAttiva.id, { todo_items: items });
  }

  async function createNote(type: NoteType) {
    if (!userId) return;

    setSalvataggio("saving");

    const { data, error } = await supabase
      .from("editor_notes")
      .insert({
        user_id: userId,
        file_name: `${
          type === "todo" ? "todo" : type === "taskmanager" ? "task" : "nota"
        }-${new Date().toLocaleDateString("it-IT")}`,
        content: "",
        note_type: type,
        todo_items: [],
        share_mode: "private",
        updated_at: new Date().toISOString(),
      })
      .select("id, user_id, file_name, content, note_type, todo_items, updated_at")
      .single();

    if (error) {
      console.error("Errore creazione nota:", error);
      setErrore(error.message);
      setSalvataggio("idle");
      return;
    }

    setErrore(null);
    setNotes((prev) => [data as EditorNote, ...prev]);
    setFiltroTipo(type);
    setNoteAttivaId(data.id);
    setSalvataggio("idle");
  }

  /* ------------------------------- render ----------------------------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-xs font-bold text-slate-400">
        <Loader2 size={14} className="animate-spin" />
        Carico le note…
      </div>
    );
  }

  if (!userId) {
    return (
      <p className="py-8 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400">
        Accedi per vedere le tue note
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filtri per tipo + creazione */}
      <div className="flex flex-wrap items-center gap-1.5">
        {NOTE_TYPES.map(({ type, label, icon: Icon, activeClass }) => {
          const attivo = filtroTipo === type;
          const totale = notes.filter((note) => note.note_type === type).length;

          return (
            <button
              key={type}
              type="button"
              onClick={() => setFiltroTipo(attivo ? null : type)}
              title={`Filtra: ${label}`}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-black transition ${
                attivo
                  ? activeClass
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}
            >
              <Icon size={13} />
              {label}
              <span className={attivo ? "opacity-70" : "text-slate-400"}>
                {totale}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => createNote(filtroTipo ?? "text")}
          title="Crea una nuova nota"
          className="ml-auto flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-black text-[#ffffff] transition hover:bg-slate-800"
        >
          <Plus size={13} />
          Nuova
        </button>
      </div>

      {/* Selettore nota */}
      <div className="flex items-center gap-2">
        <select
          value={noteAttivaId ?? ""}
          onChange={(event) => setNoteAttivaId(event.target.value || null)}
          disabled={noteFiltrate.length === 0}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-[#0150a0] disabled:opacity-50"
        >
          {noteFiltrate.length === 0 && <option value="">Nessuna nota</option>}

          {noteFiltrate.map((note) => (
            <option key={note.id} value={note.id}>
              {note.file_name}
            </option>
          ))}
        </select>

        <Link
          href="/note_board"
          title="Apri la board delle note"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <ExternalLink size={14} />
        </Link>
      </div>

      {errore && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600">
          {errore}
        </p>
      )}

      {/* Contenuto */}
      {!noteAttiva ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Nessuna nota di questo tipo
          </p>
        </div>
      ) : noteAttiva.note_type === "todo" ? (
        <div className="space-y-2">
          <div className="max-h-[200px] space-y-1.5 overflow-y-auto pr-1">
            {(noteAttiva.todo_items ?? []).length === 0 && (
              <p className="py-4 text-center text-[11px] font-bold text-slate-400">
                Lista vuota
              </p>
            )}

            {(noteAttiva.todo_items ?? []).map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5"
              >
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggleTodo(item.id)}
                  className="h-3.5 w-3.5 shrink-0 accent-[#0150a0]"
                />

                <span
                  className={`min-w-0 flex-1 truncate text-xs font-semibold ${
                    item.done ? "text-slate-300 line-through" : "text-slate-700"
                  }`}
                >
                  {item.text}
                </span>

                <button
                  type="button"
                  onClick={() => removeTodo(item.id)}
                  className="shrink-0 text-slate-200 transition hover:text-red-500 group-hover:text-slate-400"
                  aria-label="Elimina voce"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={nuovoTodo}
              onChange={(event) => setNuovoTodo(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTodo();
                }
              }}
              placeholder="Aggiungi una voce…"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none transition focus:border-[#0150a0]"
            />

            <button
              type="button"
              onClick={addTodo}
              disabled={!nuovoTodo.trim()}
              className="rounded-xl bg-slate-900 px-3 text-xs font-black text-[#ffffff] transition hover:bg-slate-800 disabled:opacity-40"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      ) : (
        <textarea
          value={bozza}
          onChange={(event) => handleContentChange(event.target.value)}
          placeholder="Scrivi qui le note importanti…"
          className="min-h-[180px] w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium leading-relaxed text-slate-800 outline-none transition focus:border-[#0150a0]"
        />
      )}

      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight text-slate-300">
        <span>
          {noteAttiva
            ? `Aggiornata il ${new Date(noteAttiva.updated_at).toLocaleDateString(
                "it-IT",
                { day: "2-digit", month: "2-digit", year: "2-digit" }
              )}`
            : ""}
        </span>

        {salvataggio === "saving" && <span>Salvataggio…</span>}
        {salvataggio === "saved" && (
          <span className="text-emerald-500">Salvato</span>
        )}
      </div>
    </div>
  );
}
