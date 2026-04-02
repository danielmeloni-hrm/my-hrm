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
  Users,
} from 'lucide-react';

const supabase = createClient();

interface TicketRecord {
  id: string;
  cliente_id?: string | null;
  n_tag: string;
  cliente: string;
  titolo: string;
  in_lavorazione_ora: boolean;
  numero_priorita?: number | null;
  rilascio_in_collaudo?: string | null;
  rilascio_in_produzione?: string | null;
  note?: string | null;
  percentuale_avanzamento?: number | null;
  stato?: string | null;
  priorita?: string | null;
  sprint?: string | null;
  tool?: string | null;
  tipo_di_attivita?: string | null;
  assignee?: string | null;
  link_tag?: string | null;
}
interface ClienteRecord {
  id: string;
  nome: string;
}
type NoteType = 'text' | 'todo' | 'taskmanager';

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
  is_shared: boolean;
  shared_by_user_id?: string | null;
  shared_at?: string | null;
}

interface TaskManagerMatch {
  lineIndex: number;
  rawLine: string;
  clientName: string | null;
  tag: string | null;
  title: string | null;
  note: string;
  percentuale_avanzamento?: number | null;
  rilascio_in_collaudo?: string | null;
  rilascio_in_produzione?: string | null;
  matchedTicket?: TicketRecord | null;
  queryField?: 'n_tag' | 'titolo' | null;
  queryValue?: string | null;
  valid: boolean;
  reason?: string;
  warning?: boolean;
}

function normalizeString(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export default function SublimeLikeEditorPage() {
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [clienti, setClienti] = useState<ClienteRecord[]>([]);
  const [fixingClienteKey, setFixingClienteKey] = useState<string | null>(null);
  const [allTickets, setAllTickets] = useState<TicketRecord[]>([]);
  const [notes, setNotes] = useState<EditorNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1 });
  const [showPreview, setShowPreview] = useState(false);

  const [taskMatches, setTaskMatches] = useState<TaskManagerMatch[]>([]);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'updating' | 'done' | 'error'>('idle');

  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = useRef<Record<number, NodeJS.Timeout>>({});
  const getCreateTicketTooltip = useCallback((match: TaskManagerMatch) => {
  const hasCliente = Boolean(match.clientName?.trim());
  const hasTitolo = Boolean(match.title?.trim());

  if (hasCliente && hasTitolo) return 'Crea ticket';
  if (!hasCliente && hasTitolo) return 'Inserisci cliente nella nota';
  if (hasCliente && !hasTitolo) return 'Inserisci titolo nella nota';
  return 'Inserisci cliente e titolo nella nota';
}, []);

const canCreateTicketFromMatch = useCallback((match: TaskManagerMatch) => {
  return Boolean(match.clientName?.trim() && match.title?.trim() && !match.matchedTicket);
}, []);

const handleCreateTicketFromMatch = useCallback((match: TaskManagerMatch) => {
  if (!canCreateTicketFromMatch(match)) return;

  const params = new URLSearchParams({
    cliente: match.clientName!.trim(),
    titolo: match.title!.trim(),
    assignee: userId,
  });

  window.open(`/new_ticket?${params.toString()}`, '_blank', 'noopener,noreferrer');
}, [canCreateTicketFromMatch, userId]);
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
    if (!activeNote || (activeNote.note_type !== 'text' && activeNote.note_type !== 'taskmanager')) {
      return [1];
    }
    const totalLines = activeNote.content.split('\n').length || 1;
    return Array.from({ length: totalLines }, (_, i) => i + 1);
  }, [activeNote]);

  const fetchTickets = useCallback(async () => {
  try {
    const { data, error } = await supabase
      .from('ticket')
      .select(`
        id,
        cliente_id,
        n_tag,
        titolo,
        in_lavorazione_ora,
        numero_priorita,
        rilascio_in_collaudo,
        rilascio_in_produzione,
        note,
        percentuale_avanzamento,
        clienti ( nome )
      `)
      .order('n_tag', { ascending: false });

    if (error) {
      console.error('Errore caricamento ticket:', error);
      return;
    }

    if (data) {
      const formatted: TicketRecord[] = data.map((t: any) => ({
        id: t.id,
        cliente_id: t.cliente_id ?? null,
        n_tag: String(t.n_tag || '').trim(),
        titolo: String(t.titolo || '').trim(),
        in_lavorazione_ora: Boolean(t.in_lavorazione_ora),
        numero_priorita: t.numero_priorita ?? null,
        rilascio_in_collaudo: t.rilascio_in_collaudo ?? null,
        rilascio_in_produzione: t.rilascio_in_produzione ?? null,
        note: t.note ?? null,
        percentuale_avanzamento: t.percentuale_avanzamento ?? null,
        cliente: t.clienti ? String(t.clienti.nome || '').trim() : '',
      }));

      setAllTickets(formatted);
    }
  } catch (err) {
    console.error('Errore fetch ticket:', err);
  }
}, []);
const fetchClienti = useCallback(async () => {
  try {
    const { data, error } = await supabase
      .from('clienti')
      .select('id, nome')
      .order('nome', { ascending: true });

    if (error) {
      console.error('Errore caricamento clienti:', error);
      return;
    }

    setClienti((data || []).map((c: any) => ({
      id: c.id,
      nome: String(c.nome || '').trim(),
    })));
  } catch (err) {
    console.error('Errore fetchClienti:', err);
  }
}, []);
  const normalizeNote = (note: any): EditorNote => ({
    id: note.id,
    user_id: note.user_id,
    file_name: note.file_name,
    content: note.content || '',
    updated_at: note.updated_at,
    note_type:
      note.note_type === 'todo'
        ? 'todo'
        : note.note_type === 'taskmanager'
        ? 'taskmanager'
        : 'text',
    todo_items: Array.isArray(note.todo_items) ? note.todo_items : [],
      is_shared: Boolean(note.is_shared),
  shared_by_user_id: note.shared_by_user_id ?? null,
  shared_at: note.shared_at ?? null,
  });

  const createNote = useCallback(
    async (
      uid: string,
      fileName?: string,
      type: NoteType = 'text'
    ): Promise<EditorNote | null> => {
      const rawName =
        fileName?.trim() ||
        `${
          type === 'todo'
            ? 'todo'
            : type === 'taskmanager'
            ? 'taskmanager'
            : 'note'
        }-${Date.now()}`;

      const finalName = rawName.endsWith('') ? rawName : `${rawName}`;

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
              is_shared: false,
              shared_by_user_id: null,
              shared_at: null,
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
  const isOwnerOfActiveNote = useMemo(() => {
  return Boolean(activeNote && activeNote.user_id === userId);
}, [activeNote, userId]);
const canManageNote = useCallback(
  (note: EditorNote) => note.user_id === userId,
  [userId]
);
const [shareLoadingId, setShareLoadingId] = useState<string | null>(null);

const toggleShareNote = useCallback(
  async (note: EditorNote) => {
    if (!canManageNote(note)) return;

    try {
      setShareLoadingId(note.id);

      const nextShared = !note.is_shared;

      const payload = {
        is_shared: nextShared,
        shared_by_user_id: nextShared ? userId : null,
        shared_at: nextShared ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('editor_notes')
        .update(payload)
        .eq('id', note.id)
        .eq('user_id', userId);

      if (error) {
        console.error('Errore toggle share note:', error);
        return;
      }

      setNotes((prev) =>
        prev.map((n) =>
          n.id === note.id
            ? {
                ...n,
                ...payload,
              }
            : n
        )
      );
    } catch (err) {
      console.error('Errore toggleShareNote:', err);
    } finally {
      setShareLoadingId(null);
    }
  },
  [canManageNote, userId]
);
  const loadNotes = useCallback(
  async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('editor_notes')
        .select('*')
        .or(`user_id.eq.${uid},is_shared.eq.true`)
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
        const payload: any = { updated_at: now };

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
          const created = await createNote(userId, 'untitled', 'text');
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

  const extractTaskManagerEntries = useCallback(
    (content: string): TaskManagerMatch[] => {
      const lines = content.split('\n');
      const results: TaskManagerMatch[] = [];

      for (let startIndex = 0; startIndex < lines.length; startIndex++) {
        const firstLine = lines[startIndex];
        if (!firstLine.includes('@')) continue;

        const clientMatch = firstLine.match(/@([^\s]+)/);
        const tagMatch = firstLine.match(/#([\w\d-]+)/);
        const titleMatch = firstLine.match(/"(.*?)"/);

        const clientName = clientMatch ? clientMatch[1].trim() : null;
        const tag = tagMatch ? tagMatch[1].trim().toUpperCase() : null;
        const title = titleMatch ? titleMatch[1].trim() : null;

        const noteLines: string[] = [];

        const firstLineClean = firstLine
          .replace(/@([^\s]+)/g, '')
          .replace(/#([\w\d-]+)/g, '')
          .replace(/"(.*?)"/g, '')
          .replace(/\(coll:.*?\)/gi, '')
          .replace(/\(prod:.*?\)/gi, '')
          .replace(/\[perc:.*?\]/gi, '')
          .trim();

        if (firstLineClean) {
          noteLines.push(firstLineClean);
        }

        for (let i = startIndex + 1; i < lines.length; i++) {
          if (lines[i].includes('@')) break;
          const contentLine = lines[i].trim();
          if (contentLine) noteLines.push(contentLine);
        }

        const note = noteLines.join('\n');

        const percMatch = firstLine.match(/\[perc:\s*([^\]]+)\]/i);
        let percentuale_avanzamento: number | null | undefined = undefined;

        if (percMatch) {
          const raw = percMatch[1].trim().toLowerCase();
          if (raw === 'null') {
            percentuale_avanzamento = null;
          } else {
            const num = parseInt(raw.replace('%', ''), 10);
            if (!isNaN(num)) percentuale_avanzamento = num;
          }
        }

        const collMatch = firstLine.match(/\(coll:\s*([^)]+)\)/i);
        const prodMatch = firstLine.match(/\(prod:\s*([^)]+)\)/i);

        const rilascio_in_collaudo =
          collMatch && isValidDate(collMatch[1]) ? parseDateToISO(collMatch[1]) : undefined;

        const rilascio_in_produzione =
          prodMatch && isValidDate(prodMatch[1]) ? parseDateToISO(prodMatch[1]) : undefined;

        const normalizedClient = normalizeString(clientName);
        let queryField: 'n_tag' | 'titolo' | null = null;
        let queryValue: string | null = null;
        let matchedTicket: TicketRecord | null = null;
        let valid = true;
        let reason = '';

        if (!clientName) {
          valid = false;
          reason = 'Cliente mancante';
        } else // PRIORITÀ: titolo per tutti
if (title) {
  queryField = 'titolo';
  queryValue = title;

  matchedTicket =
    allTickets.find(
      (t) => normalizeString(t.titolo) === normalizeString(title)
    ) || null;

  if (!matchedTicket) {
    valid = false;
    reason = 'Nessun ticket trovato per titolo';
  }
  if (matchedTicket) {
  const ticketClient = normalizeString(matchedTicket.cliente);
  const noteClient = normalizeString(clientName);

  if (ticketClient !== noteClient) {
    valid = false;
    reason = `Cliente diverso (ticket: ${matchedTicket.cliente})`;
  }
}
}
// FALLBACK: solo per Esselunga → tag
else if (normalizedClient === 'esselunga' && tag) {
  queryField = 'n_tag';
  queryValue = tag;

  matchedTicket =
    allTickets.find(
      (t) => normalizeString(t.n_tag) === normalizeString(tag)
    ) || null;

  if (!matchedTicket) {
    valid = false;
    reason = 'Nessun ticket trovato per TAG';
  }
}
// ERRORE
else {
  valid = false;
  reason =
    normalizedClient === 'esselunga'
      ? 'Serve titolo o #TAG'
      : 'Serve il "titolo"';
}

        results.push({
          lineIndex: startIndex,
          rawLine: firstLine,
          clientName,
          tag,
          title,
          note,
          percentuale_avanzamento,
          rilascio_in_collaudo,
          rilascio_in_produzione,
          matchedTicket,
          queryField,
          queryValue,
          valid,
          reason: valid ? undefined : reason,
        });
      }

      return results;
    },
    [allTickets]
  );

  const handleScanTaskManager = useCallback(() => {
    if (!activeNote || activeNote.note_type !== 'taskmanager') return;

    try {
      setScanStatus('scanning');
      const matches = extractTaskManagerEntries(activeNote.content || '');
      setTaskMatches(matches);
      setScanStatus('done');
    } catch (err) {
      console.error('Errore scansione taskmanager:', err);
      setScanStatus('error');
    }
  }, [activeNote, extractTaskManagerEntries]);

  const handleUpdateMatchedTickets = useCallback(async () => {
    if (!activeNote || activeNote.note_type !== 'taskmanager') return;
    if (!taskMatches.length) return;

    try {
      setUpdateStatus('updating');

      for (const match of taskMatches) {
        if (!match.valid || !match.queryField || !match.queryValue) continue;
        if (!match.queryField || !match.queryValue) continue;
        const updates: any = {
          note: match.note || null,
          sprint: 'Sprint',
          in_lavorazione_ora: true,
          stato: 'In lavorazione',
        };

        if (match.percentuale_avanzamento !== undefined) {
          updates.percentuale_avanzamento = match.percentuale_avanzamento;
        }

        if (match.rilascio_in_collaudo !== undefined) {
          updates.rilascio_in_collaudo = match.rilascio_in_collaudo;
        }

        if (match.rilascio_in_produzione !== undefined) {
          updates.rilascio_in_produzione = match.rilascio_in_produzione;
        }

        const { error } = await supabase
          .from('ticket')
          .update(updates)
          .eq(match.queryField, match.queryValue);

        if (error) {
          console.error('Errore aggiornamento ticket:', error, match);
          continue;
        }

        setAllTickets((prev) =>
          prev.map((t) => {
            const isMatch =
              match.queryField === 'n_tag'
                ? normalizeString(t.n_tag) === normalizeString(match.queryValue)
                : normalizeString(t.titolo) === normalizeString(match.queryValue);

            return isMatch ? { ...t, ...updates } : t;
          })
        );
      }

      setUpdateStatus('done');
    } catch (err) {
      console.error('Errore update matched tickets:', err);
      setUpdateStatus('error');
    }
  }, [activeNote, taskMatches]);

  const handleEditorChange = useCallback(
    (value: string) => {
      if (!activeNote || (activeNote.note_type !== 'text' && activeNote.note_type !== 'taskmanager')) {
        return;
      }

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

      if (activeNote.note_type === 'text') {
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
      }
    },
    [activeNote, persistNote, syncTicketData]
  );

  const handleCreateNote = useCallback(
    async (type: NoteType) => {
      if (!userId) return;

      const created = await createNote(
        userId,
        `${
          type === 'todo'
            ? 'todo'
            : type === 'taskmanager'
            ? 'taskmanager'
            : 'note'
        }-${notes.length + 1}`,
        type
      );

      if (!created) return;

      setNotes((prev) =>
        [created, ...prev].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
      );
      setActiveNoteId(created.id);
      setTaskMatches([]);
      setShowPreview(false);
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
        ? activeNote.todo_items.map((item) => `${item.done ? '[x]' : '[ ]'} ${item.text}`).join('\n')
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
          : nextType === 'todo'
          ? { note_type: 'todo', content: '' }
          : { note_type: 'taskmanager', todo_items: [] };

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

      setTaskMatches([]);
      setShowPreview(false);
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
        await await Promise.all([fetchTickets(), fetchClienti(), loadNotes(userId)]);
      } catch (err) {
        console.error('Errore initData:', err);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [authReady, userId, fetchTickets, fetchClienti, loadNotes]);
  const isClienteMismatch = useCallback((match: TaskManagerMatch) => {
  return Boolean(
    match.matchedTicket &&
      !match.valid &&
      match.reason &&
      match.reason.toLowerCase().includes('cliente')
  );
}, []);

const handleFixCliente = useCallback(async (match: TaskManagerMatch) => {
  if (!activeNote || activeNote.note_type !== 'taskmanager') return;
  if (!match.matchedTicket?.cliente) return;

  const correctClient = match.matchedTicket.cliente.trim();
  const lines = (activeNote.content || '').split('\n');

  if (match.lineIndex < 0 || match.lineIndex >= lines.length) return;

  const originalLine = lines[match.lineIndex];

  const clientToken = correctClient.includes(' ')
    ? `@"${correctClient}"`
    : `@${correctClient}`;

  const updatedLine = originalLine.replace(/@"([^"]+)"|@([^\s]+)/, clientToken);

  lines[match.lineIndex] = updatedLine;

  const updatedContent = lines.join('\n');

  setNotes((prev) =>
    prev.map((note) =>
      note.id === activeNote.id
        ? {
            ...note,
            content: updatedContent,
            updated_at: new Date().toISOString(),
          }
        : note
    )
  );

  await persistNote(activeNote.id, { content: updatedContent });

  const rescanned = extractTaskManagerEntries(updatedContent);
  setTaskMatches(rescanned);
}, [activeNote, persistNote, extractTaskManagerEntries]);
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

  useEffect(() => {
    setTaskMatches([]);
    setScanStatus('idle');
    setUpdateStatus('idle');
    setShowPreview(false);
  }, [activeNoteId]);

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
            onClick={() => handleCreateNote('taskmanager')}
            className="flex-1 h-9 rounded bg-[#7a5c00] hover:bg-[#947000] text-white text-sm flex items-center justify-center gap-2"
          >
            <FileText size={14} />
            Task
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
              <div
  key={note.id}
  className={`w-full px-3 py-2 border-l-2 transition ${
    isActive
      ? 'bg-[#1e1e1e] border-l-[#ffd700] text-white'
      : 'bg-transparent border-l-transparent text-[#cccccc] hover:bg-white/5'
  }`}
>
  <div className="flex items-start justify-between gap-2">
    <button
      type="button"
      onClick={() => setActiveNoteId(note.id)}
      className="flex-1 min-w-0 text-left"
    >
      <div className="flex items-center gap-2">
        {note.note_type === 'todo' ? (
          <CheckSquare size={13} className="text-violet-300 shrink-0" />
        ) : note.note_type === 'taskmanager' ? (
          <FileText size={13} className="text-amber-300 shrink-0" />
        ) : (
          <FileText size={13} className="text-sky-300 shrink-0" />
        )}

        <div className="text-sm truncate">{note.file_name}</div>

        {note.is_shared && (
          <span className="shrink-0 rounded bg-green-500/20 px-1.5 py-0.5 text-[9px] text-green-300">
            shared
          </span>
        )}
      </div>

      <div className="mt-1 text-[10px] text-white/45 truncate">
        {new Date(note.updated_at).toLocaleString()}
      </div>
    </button>

    {canManageNote(note) && (
      <button
        type="button"
        title={note.is_shared ? 'Rendi privata' : 'Condividi con tutti'}
        onClick={(e) => {
          e.stopPropagation();
          toggleShareNote(note);
        }}
        disabled={shareLoadingId === note.id}
        className={`mt-0.5 h-8 w-8 shrink-0 rounded flex items-center justify-center transition ${
          note.is_shared
            ? 'bg-green-600/20 text-green-300 hover:bg-green-600/30'
            : 'bg-white/10 text-white/60 hover:bg-white/20'
        } disabled:opacity-50`}
      >
        <Users size={14} />
      </button>
    )}
  </div>
</div>
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
                const trimmed = e.target.value.trim() || 'untitled';
                const finalName = trimmed.endsWith('') ? trimmed : `${trimmed}`;
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
              <option value="todo">To do</option>
              <option value="taskmanager">TaskManager</option>
            </select>

            <span className="text-xs text-white/40 truncate">
              {activeNote?.updated_at
                ? `Ultima modifica: ${new Date(activeNote.updated_at).toLocaleString()}`
                : ''}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeNote?.note_type === 'taskmanager' && (
              <>
                <button
                  type="button"
                  onClick={handleScanTaskManager}
                  className="h-9 px-3 rounded bg-[#8b6b00] hover:bg-[#a07c00] text-white text-sm"
                >
                  Scansiona testo
                </button>

                <button
                  type="button"
                  onClick={handleUpdateMatchedTickets}
                  disabled={!taskMatches.length}
                  className="h-9 px-3 rounded bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 text-white text-sm"
                >
                  Aggiorna ticket
                </button>
              </>
            )}

            

            
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
          ) : activeNote?.note_type === 'taskmanager' ? (
            <>
              <div className="w-[60px] bg-[#1e1e1e] border-r border-white/5 text-right text-[#858585] text-sm py-4 px-2 overflow-hidden select-none">
                {lineNumbers.map((n) => (
                  <div key={n} className="leading-7 h-7">
                    {n}
                  </div>
                ))}
              </div>

              <div className="flex-1 min-w-0 grid grid-cols-2">
                <div className="relative border-r border-white/10">
                  <textarea
                    ref={editorRef}
                    value={activeNote?.content || ''}
                    onChange={(e) => handleEditorChange(e.target.value)}
                    onClick={updateCursorPosition}
                    onKeyUp={updateCursorPosition}
                    onSelect={updateCursorPosition}
                    spellCheck={false}
                    className="w-full h-full resize-none bg-[#1e1e1e] text-[#f8f8f2] outline-none border-none p-4 leading-7 text-sm caret-white"
                    placeholder={`Esempio:
@Esselunga #TAG123 "Errore login checkout" [perc: 50] (coll: 12/08/2025) (prod: 20/08/2025)
Analisi iniziale completata
In attesa test utente

@Sika "Dashboard KPI Vendite" [perc: 80]
Altra nota`}
                    style={{ tabSize: 2 }}
                  />
                </div>

                <div className="overflow-auto p-4 space-y-3 bg-[#202020]">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-white/50">
                      Risultato scansione
                    </div>
                    <div className="text-[10px] uppercase text-white/40">
                      {scanStatus === 'scanning'
                        ? 'Scansione...'
                        : scanStatus === 'done'
                        ? 'Scansione completata'
                        : scanStatus === 'error'
                        ? 'Errore scansione'
                        : 'In attesa'}
                    </div>
                  </div>

                  {taskMatches.length === 0 ? (
  <div className="text-sm text-white/40">
    Nessuna scansione eseguita
  </div>
) : (
  taskMatches.map((match, idx) => (
   <div
  key={`${match.lineIndex}-${idx}`}
  className={`rounded border p-3 ${
    match.matchedTicket && !match.valid && match.reason?.toLowerCase().includes('cliente')
      ? 'border-yellow-500/30 bg-yellow-500/10'
      : match.valid
      ? 'border-green-500/30 bg-green-500/10'
      : 'border-red-500/30 bg-red-500/10'
  }`}
>
  <div className="flex items-start justify-between gap-3 mb-2">
    <div className="text-xs text-white/50">
      Riga {match.lineIndex + 1}
    </div>
     {match.reason && (
    <div
      className={`mt-2 text-xs ${
        match.reason.toLowerCase().includes('cliente')
          ? 'text-yellow-300'
          : 'text-red-300'
      }`}
    >
      {match.reason.toLowerCase().includes('cliente') ? '⚠️' : '❌'} {match.reason}
    </div>
  )}

  {match.matchedTicket && (
    <div className="mt-2 text-xs text-green-300">
      ✅ Ticket:
      <div>
        • {match.matchedTicket.titolo} ({match.matchedTicket.n_tag})
      </div>
    </div>
  )}
    {!match.matchedTicket && (
      <button
        type="button"
        title={getCreateTicketTooltip(match)}
        onClick={() => handleCreateTicketFromMatch(match)}
        disabled={!canCreateTicketFromMatch(match)}
        className={`h-7 w-7 rounded flex items-center justify-center text-sm font-bold transition ${
          canCreateTicketFromMatch(match)
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-white/10 text-white/40 cursor-not-allowed'
        }`}
      >
        +
      </button>
    )}
  </div>

  <div className="space-y-1 text-sm text-white">
    <div>
      <strong>Cliente:</strong> {match.clientName || '-'}
    </div>
    <div>
      <strong>Titolo:</strong> {match.title || '-'}
    </div>
    <div>
      <strong>Tag:</strong> {match.tag || '-'}
    </div>
    <div>
      <strong>Match su:</strong> {match.queryField || '-'}
    </div>
    <div>
      <strong>Valore:</strong> {match.queryValue || '-'}
    </div>
  </div>

 

  <div className="mt-3 text-xs text-white/80 space-y-1">
    <div>
      <strong>Percentuale:</strong> {match.percentuale_avanzamento ?? '-'}
    </div>
    <div>
      <strong>Collaudo:</strong> {match.rilascio_in_collaudo || '-'}
    </div>
    <div>
      <strong>Produzione:</strong> {match.rilascio_in_produzione || '-'}
    </div>
  </div>

  {match.note && (
    <div className="mt-2 text-xs text-white/70 whitespace-pre-wrap">
      <strong>Note:</strong> {match.note}
    </div>


        
      )}
      {isClienteMismatch(match) && (
  <div className="mt-3">
    <button
      type="button"
      onClick={() => handleFixCliente(match)}
      disabled={fixingClienteKey === `${match.lineIndex}-${match.queryValue || match.matchedTicket?.id}`}
      className="h-8 px-3 rounded bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-xs font-bold"
    >
      {fixingClienteKey === `${match.lineIndex}-${match.queryValue || match.matchedTicket?.id}`
        ? 'Fix in corso...'
        : 'Fix Cliente'}
    </button>
  </div>
)}
      
    </div>
    
  ))
)}
                </div>
              </div>
            </>
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
            <span>
              {activeNote?.note_type === 'todo'
                ? 'TO DO NOTE'
                : activeNote?.note_type === 'taskmanager'
                ? 'TASK MANAGER'
                : 'PLAIN TEXT'}
            </span>
            {activeNote?.note_type === 'taskmanager' && (
              <span>
                {updateStatus === 'updating'
                  ? 'Updating tickets...'
                  : updateStatus === 'done'
                  ? 'Tickets updated'
                  : updateStatus === 'error'
                  ? 'Update error'
                  : 'Ready'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {activeNote?.note_type === 'text' || activeNote?.note_type === 'taskmanager' ? (
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