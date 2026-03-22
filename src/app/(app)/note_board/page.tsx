'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  CheckSquare,
  Cloud,
  Download,
  FileText,
  Plus,
  Save,
  Search,
  Square,
  Trash2,
} from 'lucide-react';

const supabase = createClient();

interface TicketRecord {
  n_tag: string;
  cliente: string;
  titolo: string;
  in_lavorazione_ora: boolean;
  numero_priorita?: number;
  rilascio_in_collaudo?: string | null;
  rilascio_in_produzione?: string | null;
  note?: string;
}

type NoteType = 'text' | 'todo';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

interface EditorNote {
  id: string;
  user_id: string;
  file_name: string;
  content: string;
  updated_at: string;
  note_type: NoteType;
  todo_items: TodoItem[];
}

export default function SublimeLikeEditorPage() {
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [allTickets, setAllTickets] = useState<TicketRecord[]>([]);
  const [notes, setNotes] = useState<EditorNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1 });
  const [showPreview, setShowPreview] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = useRef<Record<number, NodeJS.Timeout>>({});

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) || null,
    [notes, activeNoteId]
  );

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((note) => note.file_name.toLowerCase().includes(q));
  }, [notes, search]);

  const lineNumbers = useMemo(() => {
    if (!activeNote || activeNote.note_type !== 'text') return [1];
    const totalLines = activeNote.content.split('\n').length || 1;
    return Array.from({ length: totalLines }, (_, i) => i + 1);
  }, [activeNote]);

  const fetchTickets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ticket')
        .select(`n_tag, titolo, in_lavorazione_ora, numero_priorita, clienti ( nome )`)
        .order('n_tag', { ascending: false });

      if (error) {
        console.error('Errore caricamento ticket:', error);
        return;
      }

      if (data) {
        const formatted: TicketRecord[] = data.map((t: any) => ({
          n_tag: String(t.n_tag || '').trim(),
          titolo: String(t.titolo || '').trim(),
          in_lavorazione_ora: Boolean(t.in_lavorazione_ora),
          numero_priorita: t.numero_priorita,
          cliente: t.clienti ? String(t.clienti.nome || '').trim() : '',
        }));

        setAllTickets(formatted);
      }
    } catch (err) {
      console.error('Errore fetch ticket:', err);
    }
  }, []);

  const normalizeNote = (note: any): EditorNote => ({
    id: note.id,
    user_id: note.user_id,
    file_name: note.file_name,
    content: note.content || '',
    updated_at: note.updated_at,
    note_type: note.note_type === 'todo' ? 'todo' : 'text',
    todo_items: Array.isArray(note.todo_items) ? note.todo_items : [],
  });

  const createNote = useCallback(
    async (
      uid: string,
      fileName?: string,
      type: NoteType = 'text'
    ): Promise<EditorNote | null> => {
      const rawName =
        fileName?.trim() || `${type === 'todo' ? 'todo' : 'note'}-${Date.now()}.txt`;
      const finalName = rawName.endsWith('.txt') ? rawName : `${rawName}.txt`;

      try {
        setSaveStatus('saving');

        const { data, error } = await supabase
          .from('editor_notes')
          .insert({
            user_id: uid,
            file_name: finalName,
            content: '',
            note_type: type,
            todo_items: [],
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('Errore creazione nota:', error);
          setSaveStatus('error');
          return null;
        }

        setSaveStatus('saved');
        return normalizeNote(data);
      } catch (err) {
        console.error('Errore createNote:', err);
        setSaveStatus('error');
        return null;
      }
    },
    []
  );

  const loadNotes = useCallback(
    async (uid: string) => {
      try {
        const { data, error } = await supabase
          .from('editor_notes')
          .select('*')
          .eq('user_id', uid)
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('Errore caricamento note:', error);
          setNotes([]);
          return;
        }

        const loadedNotes = (data || []).map(normalizeNote);
        setNotes(loadedNotes);

        if (loadedNotes.length > 0) {
          setActiveNoteId(loadedNotes[0].id);
        } else {
          const created = await createNote(uid, 'untitled.txt', 'text');
          if (created) {
            setNotes([created]);
            setActiveNoteId(created.id);
          }
        }
      } catch (err) {
        console.error('Errore loadNotes:', err);
      }
    },
    [createNote]
  );

  const persistNote = useCallback(
    async (noteId: string, patch: Partial<EditorNote>) => {
      try {
        setSaveStatus('saving');

        const now = new Date().toISOString();

        const payload: any = {
          updated_at: now,
        };

        if (patch.content !== undefined) payload.content = patch.content;
        if (patch.file_name !== undefined) payload.file_name = patch.file_name;
        if (patch.note_type !== undefined) payload.note_type = patch.note_type;
        if (patch.todo_items !== undefined) payload.todo_items = patch.todo_items;

        const { error } = await supabase
          .from('editor_notes')
          .update(payload)
          .eq('id', noteId)
          .eq('user_id', userId);

        if (error) {
          console.error('Errore salvataggio nota:', error);
          setSaveStatus('error');
          return false;
        }

        setNotes((prev) =>
          [...prev]
            .map((note) =>
              note.id === noteId
                ? {
                    ...note,
                    ...patch,
                    updated_at: now,
                  }
                : note
            )
            .sort(
              (a, b) =>
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            )
        );

        setSaveStatus('saved');
        return true;
      } catch (err) {
        console.error('Errore persistNote:', err);
        setSaveStatus('error');
        return false;
      }
    },
    [userId]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      try {
        setSaveStatus('saving');

        const { error } = await supabase
          .from('editor_notes')
          .delete()
          .eq('id', noteId)
          .eq('user_id', userId);

        if (error) {
          console.error('Errore delete note:', error);
          setSaveStatus('error');
          return;
        }

        const remaining = notes.filter((n) => n.id !== noteId);

        if (remaining.length === 0) {
          const created = await createNote(userId, 'untitled.txt', 'text');
          if (created) {
            setNotes([created]);
            setActiveNoteId(created.id);
          } else {
            setNotes([]);
            setActiveNoteId('');
          }
        } else {
          setNotes(remaining);
          if (activeNoteId === noteId) {
            setActiveNoteId(remaining[0].id);
          }
        }

        setSaveStatus('saved');
      } catch (err) {
        console.error('Errore delete:', err);
        setSaveStatus('error');
      }
    },
    [activeNoteId, createNote, notes, userId]
  );

  const isValidDate = (dateStr: string) => {
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (!match) return false;

    const d = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const y = match[3]
      ? match[3].length === 2
        ? 2000 + parseInt(match[3], 10)
        : parseInt(match[3], 10)
      : new Date().getFullYear();

    const date = new Date(y, m, d);
    return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d;
  };

  const parseDateToISO = (dateStr: string) => {
    const parts = dateStr.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    let y = parts[2] || new Date().getFullYear().toString();
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  };

  const syncTicketData = useCallback(async (allLines: string[], startIndex: number) => {
    const firstLine = allLines[startIndex];
    const clientMatch = firstLine.match(/@([^\s]+)/);
    const tagMatch = firstLine.match(/#([\w\d]+)/);
    const titleMatch = firstLine.match(/"(.*?)"/);

    if (!clientMatch) return;

    const clientName = clientMatch[1].toLowerCase();
    const tag = tagMatch ? tagMatch[1].toUpperCase() : null;
    const title = titleMatch ? titleMatch[1] : null;

    const multiLineNote: string[] = [];
    const firstLineClean = firstLine
      .replace(/@([^\s]+)/g, '')
      .replace(/#([\w\d]+)/g, '')
      .replace(/"(.*?)"/g, '')
      .replace(/\(coll:.*?\)/g, '')
      .replace(/\(prod:.*?\)/g, '')
      .replace(/\[perc:.*?\]/g, '')
      .trim();

    if (firstLineClean) multiLineNote.push(firstLineClean);

    for (let i = startIndex + 1; i < allLines.length; i++) {
      if (allLines[i].includes('@')) break;
      const content = allLines[i].trim();
      if (content) multiLineNote.push(content);
    }

    const finalNote = multiLineNote.join('\n');
    let queryField = '';
    let queryValue = '';

    if (clientName === 'esselunga') {
      if (!tag) return;
      queryField = 'n_tag';
      queryValue = tag;
    } else {
      if (!title) return;
      queryField = 'titolo';
      queryValue = title;
    }

    const updates: any = { note: finalNote };

    const percMatch = firstLine.match(/\[perc:\s*([^\]]+)\]/);
    if (percMatch) {
      const val = percMatch[1].trim().toLowerCase();
      if (val === 'null') {
        updates.percentuale_avanzamento = null;
      } else {
        const num = parseInt(val.replace('%', ''), 10);
        if (!isNaN(num)) updates.percentuale_avanzamento = num;
      }
    }

    const collMatch = firstLine.match(/\(coll:\s*([^)]+)\)/);
    const prodMatch = firstLine.match(/\(prod:\s*([^)]+)\)/);

    if (collMatch && isValidDate(collMatch[1])) {
      updates.rilascio_in_collaudo = parseDateToISO(collMatch[1]);
    }

    if (prodMatch && isValidDate(prodMatch[1])) {
      updates.rilascio_in_produzione = parseDateToISO(prodMatch[1]);
    }

    try {
      const { error } = await supabase
        .from('ticket')
        .update(updates)
        .eq(queryField, queryValue);

      if (error) {
        console.error('Errore sync ticket:', error);
        return;
      }

      setAllTickets((prev) =>
        prev.map((t) => {
          const isMatch =
            queryField === 'n_tag' ? t.n_tag === queryValue : t.titolo === queryValue;
          return isMatch ? { ...t, ...updates } : t;
        })
      );
    } catch (err) {
      console.error('Errore sync ticket:', err);
    }
  }, []);

  const updateCursorPosition = useCallback(() => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const pos = textarea.selectionStart;
    const before = textarea.value.slice(0, pos);
    const lines = before.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;

    setCursorInfo({ line, col });
  }, []);

  const handleEditorChange = useCallback(
    (value: string) => {
      if (!activeNote || activeNote.note_type !== 'text') return;

      setNotes((prev) =>
        prev.map((note) =>
          note.id === activeNote.id
            ? {
                ...note,
                content: value,
                updated_at: new Date().toISOString(),
              }
            : note
        )
      );

      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }

      autosaveTimeoutRef.current = setTimeout(() => {
        persistNote(activeNote.id, { content: value });
      }, 700);

      const lines = value.split('\n');

      lines.forEach((line, idx) => {
        if (line.includes('@')) {
          if (syncTimeoutRef.current[idx]) {
            clearTimeout(syncTimeoutRef.current[idx]);
          }

          syncTimeoutRef.current[idx] = setTimeout(() => {
            syncTicketData(lines, idx);
          }, 600);
        }
      });
    },
    [activeNote, persistNote, syncTicketData]
  );

  const handleCreateNote = useCallback(
    async (type: NoteType) => {
      if (!userId) return;
      const created = await createNote(
        userId,
        `${type === 'todo' ? 'todo' : 'note'}-${notes.length + 1}.txt`,
        type
      );
      if (!created) return;

      setNotes((prev) =>
        [created, ...prev].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
      );
      setActiveNoteId(created.id);
    },
    [createNote, notes.length, userId]
  );

  const handleDeleteNote = useCallback(async () => {
    if (!activeNote) return;
    await deleteNote(activeNote.id);
  }, [activeNote, deleteNote]);

  const handleManualSave = useCallback(async () => {
    if (!activeNote) return;
    await persistNote(activeNote.id, {
      content: activeNote.content,
      note_type: activeNote.note_type,
      todo_items: activeNote.todo_items,
      file_name: activeNote.file_name,
    });
  }, [activeNote, persistNote]);

  const handleDownload = useCallback(() => {
    if (!activeNote) return;

    const textToDownload =
      activeNote.note_type === 'todo'
        ? activeNote.todo_items
            .map((item) => `${item.done ? '[x]' : '[ ]'} ${item.text}`)
            .join('\n')
        : activeNote.content;

    const blob = new Blob([textToDownload], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeNote.file_name;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeNote]);

  const updateActiveTodoItems = useCallback(
    async (updater: (items: TodoItem[]) => TodoItem[]) => {
      if (!activeNote || activeNote.note_type !== 'todo') return;

      const nextItems = updater(activeNote.todo_items || []);

      setNotes((prev) =>
        prev.map((note) =>
          note.id === activeNote.id
            ? {
                ...note,
                todo_items: nextItems,
                updated_at: new Date().toISOString(),
              }
            : note
        )
      );

      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }

      autosaveTimeoutRef.current = setTimeout(() => {
        persistNote(activeNote.id, { todo_items: nextItems });
      }, 500);
    },
    [activeNote, persistNote]
  );

  const addTodoItem = useCallback(() => {
    updateActiveTodoItems((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        text: '',
        done: false,
      },
    ]);
  }, [updateActiveTodoItems]);

  const toggleTodoItem = useCallback(
    (itemId: string) => {
      updateActiveTodoItems((items) =>
        items.map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item
        )
      );
    },
    [updateActiveTodoItems]
  );

  const changeTodoItemText = useCallback(
    (itemId: string, text: string) => {
      updateActiveTodoItems((items) =>
        items.map((item) => (item.id === itemId ? { ...item, text } : item))
      );
    },
    [updateActiveTodoItems]
  );

  const deleteTodoItem = useCallback(
    (itemId: string) => {
      updateActiveTodoItems((items) => items.filter((item) => item.id !== itemId));
    },
    [updateActiveTodoItems]
  );

  const changeNoteType = useCallback(
    async (nextType: NoteType) => {
      if (!activeNote || activeNote.note_type === nextType) return;

      const patch: Partial<EditorNote> =
        nextType === 'text'
          ? { note_type: 'text', todo_items: [] }
          : { note_type: 'todo', content: '' };

      setNotes((prev) =>
        prev.map((note) =>
          note.id === activeNote.id
            ? {
                ...note,
                ...patch,
                updated_at: new Date().toISOString(),
              }
            : note
        )
      );

      await persistNote(activeNote.id, patch);
    },
    [activeNote, persistNote]
  );

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        setLoading(true);
        setAuthError(null);

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Errore getSession:', error);
        }

        const session = data.session;

        if (!mounted) return;

        if (session?.user) {
          setUserId(session.user.id);
          setAuthReady(true);
        } else {
          setAuthReady(true);
          setAuthError('Utente non autenticato');
        }
      } catch (err) {
        console.error('Errore init auth:', err);
        if (mounted) {
          setAuthReady(true);
          setAuthError('Errore autenticazione');
        }
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setUserId(session.user.id);
        setAuthError(null);
        setAuthReady(true);
      } else {
        setUserId('');
        setNotes([]);
        setActiveNoteId('');
        setAuthError('Utente non autenticato');
        setAuthReady(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const initData = async () => {
      if (!authReady) return;

      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        await Promise.all([fetchTickets(), loadNotes(userId)]);
      } catch (err) {
        console.error('Errore initData:', err);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [authReady, userId, fetchTickets, loadNotes]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleManualSave]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#1e1e1e] text-white flex items-center justify-center font-mono">
        Caricamento...
      </div>
    );
  }

  if (authError && !userId) {
    return (
      <div className="h-screen w-full bg-[#1e1e1e] text-white flex items-center justify-center font-mono">
        {authError}
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono flex overflow-hidden">
      <aside className="w-[290px] bg-[#252526] border-r border-white/10 flex flex-col shrink-0">
        <div className="h-12 px-3 border-b border-white/10 flex items-center gap-2 text-sm font-bold tracking-wide text-white">
          <FileText size={16} />
          NOTES
        </div>

        <div className="p-2 border-b border-white/10">
          <div className="flex items-center gap-2 bg-[#1e1e1e] border border-white/10 rounded px-2 h-9">
            <Search size={14} className="text-white/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca note..."
              className="bg-transparent outline-none w-full text-sm text-white placeholder:text-white/40"
            />
          </div>
        </div>

        <div className="p-2 flex gap-2 border-b border-white/10">
          <button
            type="button"
            onClick={() => handleCreateNote('text')}
            className="flex-1 h-9 rounded bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            Testo
          </button>

          <button
            type="button"
            onClick={() => handleCreateNote('todo')}
            className="flex-1 h-9 rounded bg-[#5a3ea7] hover:bg-[#6d4fc4] text-white text-sm flex items-center justify-center gap-2"
          >
            <CheckSquare size={14} />
            To do
          </button>

          <button
            type="button"
            onClick={handleDeleteNote}
            disabled={!activeNote || notes.length <= 1}
            className="w-10 h-9 rounded bg-[#3c3c3c] hover:bg-[#4a4a4a] disabled:opacity-40 text-white flex items-center justify-center"
            title="Elimina nota"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredNotes.map((note) => {
            const isActive = note.id === activeNoteId;

            return (
              <button
                key={note.id}
                type="button"
                onClick={() => setActiveNoteId(note.id)}
                className={`w-full text-left px-3 py-2 border-l-2 transition ${
                  isActive
                    ? 'bg-[#1e1e1e] border-l-[#ffd700] text-white'
                    : 'bg-transparent border-l-transparent text-[#cccccc] hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  {note.note_type === 'todo' ? (
                    <CheckSquare size={13} className="text-violet-300" />
                  ) : (
                    <FileText size={13} className="text-sky-300" />
                  )}
                  <div className="text-sm truncate">{note.file_name}</div>
                </div>
                <div className="text-[10px] text-white/45 truncate mt-1">
                  {new Date(note.updated_at).toLocaleString()}
                </div>
              </button>
            );
          })}

          {filteredNotes.length === 0 && (
            <div className="px-3 py-4 text-xs text-white/40">Nessuna nota trovata</div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="h-12 px-4 bg-[#2d2d2d] border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <input
              value={activeNote?.file_name || ''}
              onChange={(e) => {
                if (!activeNote) return;
                const newName = e.target.value;

                setNotes((prev) =>
                  prev.map((note) =>
                    note.id === activeNote.id ? { ...note, file_name: newName } : note
                  )
                );
              }}
              onBlur={(e) => {
                if (!activeNote) return;
                const trimmed = e.target.value.trim() || 'untitled.txt';
                const finalName = trimmed.endsWith('.txt') ? trimmed : `${trimmed}.txt`;
                persistNote(activeNote.id, { file_name: finalName });
              }}
              className="bg-transparent outline-none text-sm text-white font-semibold min-w-0 max-w-[420px] border border-transparent focus:border-white/20 rounded px-2 py-1"
            />

            <select
              value={activeNote?.note_type || 'text'}
              onChange={(e) => changeNoteType(e.target.value as NoteType)}
              className="bg-[#1e1e1e] border border-white/10 rounded px-2 py-1 text-xs text-white outline-none"
            >
              <option value="text">Nota testuale</option>
              <option value="todo">To do note</option>
            </select>

            <span className="text-xs text-white/40 truncate">
              {activeNote?.updated_at
                ? `Ultima modifica: ${new Date(activeNote.updated_at).toLocaleString()}`
                : ''}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeNote?.note_type === 'text' && (
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="h-9 px-3 rounded bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white text-sm"
              >
                {showPreview ? 'Editor' : 'Preview'}
              </button>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="h-9 px-3 rounded bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white text-sm flex items-center gap-2"
            >
              <Download size={14} />
              Scarica
            </button>

            <button
              type="button"
              onClick={handleManualSave}
              className="h-9 px-3 rounded bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm flex items-center gap-2"
            >
              <Save size={14} />
              Salva
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex bg-[#1e1e1e]">
          {activeNote?.note_type === 'todo' ? (
            <div className="flex-1 min-w-0 overflow-auto p-5">
              <div className="mb-4">
                <button
                  type="button"
                  onClick={addTodoItem}
                  className="h-9 px-3 rounded bg-[#5a3ea7] hover:bg-[#6d4fc4] text-white text-sm flex items-center gap-2"
                >
                  <Plus size={14} />
                  Aggiungi attività
                </button>
              </div>

              <div className="space-y-2">
                {(activeNote.todo_items || []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-[#252526] border border-white/10 rounded px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => toggleTodoItem(item.id)}
                      className="text-white/80 hover:text-white shrink-0"
                    >
                      {item.done ? (
                        <CheckSquare size={18} className="text-green-400" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>

                    <input
                      value={item.text}
                      onChange={(e) => changeTodoItemText(item.id, e.target.value)}
                      placeholder="Scrivi attività..."
                      className={`flex-1 bg-transparent outline-none text-sm ${
                        item.done ? 'line-through text-white/40' : 'text-white'
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => deleteTodoItem(item.id)}
                      className="text-white/60 hover:text-red-400 shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}

                {(activeNote.todo_items || []).length === 0 && (
                  <div className="text-sm text-white/40">Nessuna attività presente</div>
                )}
              </div>
            </div>
          ) : !showPreview ? (
            <>
              <div className="w-[60px] bg-[#1e1e1e] border-r border-white/5 text-right text-[#858585] text-sm py-4 px-2 overflow-hidden select-none">
                {lineNumbers.map((n) => (
                  <div key={n} className="leading-7 h-7">
                    {n}
                  </div>
                ))}
              </div>

              <div className="flex-1 min-w-0 relative">
                <textarea
                  ref={editorRef}
                  value={activeNote?.content || ''}
                  onChange={(e) => handleEditorChange(e.target.value)}
                  onClick={updateCursorPosition}
                  onKeyUp={updateCursorPosition}
                  onSelect={updateCursorPosition}
                  spellCheck={false}
                  className="w-full h-full resize-none bg-[#1e1e1e] text-[#f8f8f2] outline-none border-none p-4 leading-7 text-sm caret-white"
                  placeholder="Scrivi qui le tue note..."
                  style={{ tabSize: 2 }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-auto p-6 whitespace-pre-wrap text-sm leading-7 text-[#f8f8f2]">
              {activeNote?.content || 'Nessun contenuto'}
            </div>
          )}
        </div>

        <div
          className={`h-8 px-4 flex items-center justify-between text-[11px] uppercase tracking-wide text-white ${
            saveStatus === 'saving'
              ? 'bg-amber-600'
              : saveStatus === 'error'
              ? 'bg-red-600'
              : 'bg-[#007acc]'
          }`}
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Cloud size={12} />
              {saveStatus === 'saving'
                ? 'Saving...'
                : saveStatus === 'error'
                ? 'Save Error'
                : 'Saved'}
            </span>
            <span>UTF-8</span>
            <span>{activeNote?.note_type === 'todo' ? 'TO DO NOTE' : 'PLAIN TEXT'}</span>
          </div>

          <div className="flex items-center gap-4">
            {activeNote?.note_type === 'text' ? (
              <span>
                Riga {cursorInfo.line}, Col {cursorInfo.col}
              </span>
            ) : (
              <span>{activeNote?.todo_items?.length || 0} attività</span>
            )}
            <span>{allTickets.length} ticket caricati</span>
          </div>
        </div>
      </main>
    </div>
  );
}