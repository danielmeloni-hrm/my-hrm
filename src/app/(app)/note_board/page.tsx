'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';
import {
  CheckSquare,
  Cloud,
  FileText,
  Pin,
  Plus,
  Search,
  Square,
  Trash2,
  Users,
  ChevronDown,
  ChevronRight,
  FolderOpen,
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

interface NoteGroup {
  id: string;
  name: string;
  sort_order: number;
}

type NoteType = 'text' | 'todo' | 'taskmanager';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

type ShareMode = 'private' | 'shared_view' | 'shared_edit';

interface EditorNote {
  id: string;
  user_id: string;
  file_name: string;
  content: string;
  updated_at: string;
  note_type: NoteType;
  todo_items: TodoItem[];
  share_mode: ShareMode;
  shared_by_user_id?: string | null;
  shared_at?: string | null;
  is_pinned?: boolean;
  sort_order?: number | null;
  group_name?: string | null;
}

interface NotePinRecord {
  note_id: string;
  user_id: string;
}

interface TaskManagerMatch {
  lineIndex: number;
  rawLine: string;
  clientName: string | null;
  tag: string | null;
  title: string | null;
  note: string;
  stato?: string | null;
  percentuale_avanzamento?: number | null;
  rilascio_in_collaudo?: string | null;
  rilascio_in_produzione?: string | null;
  matchedTicket?: TicketRecord | null;
  queryField?: 'n_tag' | 'title' | null;
  queryValue?: string | null;
  valid: boolean;
  reason?: string;
  warning?: boolean;
  tagOnlyTicket?: TicketRecord | null;
  clienteMismatch?: boolean;
}

const VALID_STATI = [
  'NON INIZIATO',
  'COMPLETATO',
  'IN STAND-BY',
  'IN LAVORAZIONE',
  'IN LAVORAZIONE OGGI',
  'ATTENZIONE BUSINESS',
] as const;

const STATO_MAP: Record<string, string> = {
  'NON INIZIATO': 'Non Iniziato',
  'COMPLETATO': 'Completato',
  'IN STAND-BY': 'In stand-by',
  'IN LAVORAZIONE': 'In lavorazione',
  'IN LAVORAZIONE OGGI': 'In lavorazione',
  'ATTENZIONE BUSINESS': 'Attenzione Business',
};

function isTicketStartLine(line: string) {
  return /^\s*-\s+/.test(line);
}

function normalizeString(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function extractClientName(line: string) {
  const quotedMatch = line.match(/@"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1].trim();

  const simpleMatch = line.match(/@([^\s]+)/);
  if (simpleMatch) return simpleMatch[1].trim();

  return null;
}

function extractStato(line: string): string | null {
  const matches = [...line.matchAll(/\(([^)]+)\)/g)];

  for (const match of matches) {
    const candidate = match[1].trim().toUpperCase();
    if (VALID_STATI.includes(candidate as (typeof VALID_STATI)[number])) {
      return candidate;
    }
  }

  return null;
}

function normalizeStato(stato: string | null | undefined) {
  if (!stato) return null;
  return STATO_MAP[stato] || stato;
}

function getInLavorazioneOra(stato: string | null | undefined) {
  if (!stato) return false;
  return stato.trim().toUpperCase() === 'IN LAVORAZIONE OGGI';
}

function stripIgnoredSegments(value: string) {
  return value.replace(/\/\/[\s\S]*?\/\//g, ' ').replace(/\s+/g, ' ').trim();
}

function sortTabs(items: EditorNote[]) {
  return [...items].sort((a, b) => {
    const pinnedA = a.is_pinned ? 1 : 0;
    const pinnedB = b.is_pinned ? 1 : 0;

    if (pinnedA !== pinnedB) return pinnedB - pinnedA;

    const orderA = a.sort_order ?? 0;
    const orderB = b.sort_order ?? 0;

    if (orderA !== orderB) return orderA - orderB;

    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function SortableTabItem({
  note,
  children,
}: {
  note: EditorNote;
  isActive: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: note.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function DroppableGroup({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-b border-white/5 transition-colors ${
        isOver ? 'bg-white/5' : ''
      }`}
    >
      {children}
    </div>
  );
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
  const [noteGroups, setNoteGroups] = useState<NoteGroup[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1 });
  const [showPreview, setShowPreview] = useState(false);
  const [editorValue, setEditorValue] = useState('');
  const [pinnedNoteIds, setPinnedNoteIds] = useState<string[]>([]);

  const [taskMatches, setTaskMatches] = useState<TaskManagerMatch[]>([]);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'updating' | 'done' | 'error'>(
    'idle'
  );

  const [newGroupName, setNewGroupName] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);

  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [shareLoadingId, setShareLoadingId] = useState<string | null>(null);
  const [showScanPanel, setShowScanPanel] = useState(false);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);

  const notesWithUserPins = useMemo(() => {
    const pinnedSet = new Set(pinnedNoteIds);
    return notes.map((note) => ({
      ...note,
      is_pinned: pinnedSet.has(note.id),
    }));
  }, [notes, pinnedNoteIds]);

  const matchStats = useMemo(() => {
    let matched = 0;
    let issues = 0;
    let noMatch = 0;

    taskMatches.forEach((m) => {
      if (!m.matchedTicket) {
        noMatch++;
      } else if (!m.valid) {
        issues++;
      } else {
        matched++;
      }
    });

    return { matched, issues, noMatch };
  }, [taskMatches]);

  const activeNote = useMemo(
    () => notesWithUserPins.find((n) => n.id === activeNoteId) || null,
    [notesWithUserPins, activeNoteId]
  );

  const currentEditorContent = useMemo(() => {
    if (!activeNote) return '';
    if (activeNote.note_type === 'text' || activeNote.note_type === 'taskmanager') {
      return editorValue;
    }
    return activeNote.content || '';
  }, [activeNote, editorValue]);

  const isOwnerOfActiveNote = useMemo(() => {
    return Boolean(activeNote && activeNote.user_id === userId);
  }, [activeNote, userId]);

  const canReadActiveNote = useMemo(() => {
    if (!activeNote) return false;
    if (activeNote.user_id === userId) return true;
    return activeNote.share_mode === 'shared_view' || activeNote.share_mode === 'shared_edit';
  }, [activeNote, userId]);

  const canEditActiveNote = useMemo(() => {
    if (!activeNote) return false;
    if (activeNote.user_id === userId) return true;
    return activeNote.share_mode === 'shared_edit';
  }, [activeNote, userId]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notesWithUserPins;
    return notesWithUserPins.filter(
      (note) =>
        note.file_name.toLowerCase().includes(q) ||
        (note.group_name || 'Generale').toLowerCase().includes(q)
    );
  }, [notesWithUserPins, search]);

  const groupedNotes = useMemo(() => {
    return noteGroups.map((group) => {
      const groupItems = sortTabs(
        filteredNotes.filter(
          (note) => (note.group_name || 'Generale').trim() === group.name.trim()
        )
      );

      return [group.name, groupItems] as const;
    });
  }, [noteGroups, filteredNotes]);

  const lineNumbers = useMemo(() => {
    if (!activeNote || (activeNote.note_type !== 'text' && activeNote.note_type !== 'taskmanager')) {
      return [1];
    }
    const totalLines = currentEditorContent.split('\n').length || 1;
    return Array.from({ length: totalLines }, (_, i) => i + 1);
  }, [activeNote, currentEditorContent]);

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
    share_mode:
      note.share_mode === 'shared_view' || note.share_mode === 'shared_edit'
        ? note.share_mode
        : note.is_shared
        ? 'shared_view'
        : 'private',
    shared_by_user_id: note.shared_by_user_id ?? null,
    shared_at: note.shared_at ?? null,
    is_pinned: false,
    sort_order: typeof note.sort_order === 'number' ? note.sort_order : null,
    group_name: note.group_name ?? 'Generale',
  });

  const canManageNote = useCallback((note: EditorNote) => note.user_id === userId, [userId]);

  function getNextShareMode(current?: ShareMode): ShareMode {
    if (!current || current === 'private') return 'shared_view';
    if (current === 'shared_view') return 'shared_edit';
    return 'private';
  }

  const getCreateTicketTooltip = useCallback((match: TaskManagerMatch) => {
    if (match.matchedTicket) return 'Ticket già esistente';
    return 'Crea ticket';
  }, []);

  const canCreateTicketFromMatch = useCallback((match: TaskManagerMatch) => {
    return !match.matchedTicket;
  }, []);

  const loadPinnedNotes = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('editor_note_pins')
        .select('note_id, user_id')
        .eq('user_id', uid);

      if (error) {
        console.error('Errore caricamento pin:', error);
        setPinnedNoteIds([]);
        return;
      }

      setPinnedNoteIds((data || []).map((row: NotePinRecord) => row.note_id));
    } catch (err) {
      console.error('Errore loadPinnedNotes:', err);
      setPinnedNoteIds([]);
    }
  }, []);

  const saveNotesOrder = useCallback(async (orderedNotes: EditorNote[]) => {
    try {
      const updates = orderedNotes.map((note, index) => ({
        id: note.id,
        sort_order: index,
      }));

      for (const item of updates) {
        const { error } = await supabase
          .from('editor_notes')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id);

        if (error) {
          console.error('Errore update sort_order:', error);
        }
      }
    } catch (err) {
      console.error('Errore saveNotesOrder:', err);
    }
  }, []);

  const loadGroups = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('editor_note_groups')
        .select('id, name, sort_order')
        .eq('user_id', uid)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Errore caricamento gruppi:', error);
        setNoteGroups([]);
        return;
      }

      const loadedGroups: NoteGroup[] = (data || []).map((g: any) => ({
        id: g.id,
        name: String(g.name || '').trim(),
        sort_order: typeof g.sort_order === 'number' ? g.sort_order : 0,
      }));

      const hasGenerale = loadedGroups.some(
        (g) => g.name.trim().toLowerCase() === 'generale'
      );

      if (!hasGenerale) {
        const { data: created, error: createError } = await supabase
          .from('editor_note_groups')
          .insert({
            user_id: uid,
            name: 'Generale',
            sort_order: loadedGroups.length,
          })
          .select('id, name, sort_order')
          .single();

        if (!createError && created) {
          loadedGroups.push({
            id: created.id,
            name: created.name,
            sort_order: created.sort_order ?? loadedGroups.length,
          });
        }
      }

      loadedGroups.sort((a, b) => a.sort_order - b.sort_order);
      setNoteGroups(loadedGroups);
    } catch (err) {
      console.error('Errore loadGroups:', err);
      setNoteGroups([]);
    }
  }, []);

  const createNote = useCallback(
    async (
      uid: string,
      fileName?: string,
      type: NoteType = 'text',
      groupName: string = 'Generale'
    ): Promise<EditorNote | null> => {
      const rawName =
        fileName?.trim() ||
        `${type === 'todo' ? 'todo' : type === 'taskmanager' ? 'taskmanager' : 'note'}-${Date.now()}`;

      const finalName = rawName.trim() || 'untitled';

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
            share_mode: 'private',
            shared_by_user_id: null,
            shared_at: null,
            sort_order: Date.now(),
            group_name: groupName,
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
          .in('share_mode', ['private', 'shared_view', 'shared_edit']);

        if (error) {
          console.error('Errore caricamento note:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          setNotes([]);
          return;
        }

        const visibleNotes = sortTabs(
          (data || []).filter(
            (note) =>
              note.user_id === uid ||
              note.share_mode === 'shared_view' ||
              note.share_mode === 'shared_edit'
          )
        );

        const loadedNotes = visibleNotes.map(normalizeNote);
        setNotes(loadedNotes);

        if (loadedNotes.length > 0) {
          setActiveNoteId(loadedNotes[0].id);
        } else {
          const created = await createNote(uid, 'untitled.txt', 'text', 'Generale');
          if (created) {
            setNotes([created]);
            setActiveNoteId(created.id);
          }
        }
      } catch (err) {
        console.error('Errore loadNotes:', err);
        setNotes([]);
      }
    },
    [createNote]
  );

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
          stato,
          sprint,
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
          stato: t.stato ?? null,
          sprint: t.sprint ?? null,
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

      setClienti(
        (data || []).map((c: any) => ({
          id: c.id,
          nome: String(c.nome || '').trim(),
        }))
      );
    } catch (err) {
      console.error('Errore fetchClienti:', err);
    }
  }, []);

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
        if (patch.share_mode !== undefined) payload.share_mode = patch.share_mode;
        if (patch.shared_by_user_id !== undefined) payload.shared_by_user_id = patch.shared_by_user_id;
        if (patch.shared_at !== undefined) payload.shared_at = patch.shared_at;
        if ((patch as any).sort_order !== undefined) payload.sort_order = (patch as any).sort_order;
        if ((patch as any).group_name !== undefined) payload.group_name = (patch as any).group_name;

        const noteToUpdate = notes.find((n) => n.id === noteId);

        if (!noteToUpdate) {
          setSaveStatus('error');
          return false;
        }

        const isOwner = noteToUpdate.user_id === userId;
        const isSharedEdit = noteToUpdate.share_mode === 'shared_edit';

        if (!isOwner) {
          if (!isSharedEdit) {
            setSaveStatus('error');
            return false;
          }

          const allowedNonOwnerKeys = ['content', 'todo_items', 'updated_at'];
          const invalidKey = Object.keys(payload).find((key) => !allowedNonOwnerKeys.includes(key));

          if (invalidKey) {
            setSaveStatus('error');
            return false;
          }
        }

        const { data, error } = await supabase
          .from('editor_notes')
          .update(payload)
          .eq('id', noteId)
          .select()
          .single();

        if (error) {
          console.error('Errore salvataggio nota:', error);
          setSaveStatus('error');
          return false;
        }

        const updatedNote = data ? normalizeNote(data) : null;

        setNotes((prev) =>
          prev.map((note) =>
            note.id === noteId
              ? {
                  ...note,
                  ...(updatedNote || patch),
                  updated_at: now,
                }
              : note
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
    [userId, notes]
  );

  const toggleShareNote = useCallback(
    async (note: EditorNote) => {
      if (!canManageNote(note)) return;

      try {
        setShareLoadingId(note.id);

        const nextShareMode = getNextShareMode(note.share_mode);

        const payload = {
          share_mode: nextShareMode,
          shared_by_user_id: nextShareMode !== 'private' ? userId : null,
          shared_at: nextShareMode !== 'private' ? new Date().toISOString() : null,
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

  const togglePinNote = useCallback(
    async (note: EditorNote) => {
      if (!userId) return;

      const alreadyPinned = pinnedNoteIds.includes(note.id);

      try {
        if (alreadyPinned) {
          const { error } = await supabase
            .from('editor_note_pins')
            .delete()
            .eq('user_id', userId)
            .eq('note_id', note.id);

          if (error) {
            console.error('Errore rimozione pin:', error);
            return;
          }

          setPinnedNoteIds((prev) => prev.filter((id) => id !== note.id));
        } else {
          const { error } = await supabase.from('editor_note_pins').insert({
            user_id: userId,
            note_id: note.id,
          });

          if (error) {
            console.error('Errore aggiunta pin:', error);
            return;
          }

          setPinnedNoteIds((prev) => [...prev, note.id]);
        }
      } catch (err) {
        console.error('Errore togglePinNote:', err);
      }
    },
    [userId, pinnedNoteIds]
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

        setPinnedNoteIds((prev) => prev.filter((id) => id !== noteId));

        const remaining = notes.filter((n) => n.id !== noteId);

        if (remaining.length === 0) {
          const created = await createNote(userId, 'untitled', 'text', 'Generale');
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

  const handleCreateGroup = useCallback(async () => {
    const finalName = newGroupName.trim();
    if (!finalName || !userId) return;

    const alreadyExists = noteGroups.some(
      (group) => group.name.trim().toLowerCase() === finalName.toLowerCase()
    );

    if (alreadyExists) {
      setNewGroupName('');
      return;
    }

    try {
      const newGroupPayload = {
        user_id: userId,
        name: finalName,
        sort_order: noteGroups.length,
      };

      const { data, error } = await supabase
        .from('editor_note_groups')
        .insert(newGroupPayload)
        .select('id, name, sort_order')
        .single();

      if (error) {
        console.error('Errore creazione gruppo:', error);
        return;
      }

      const createdGroup: NoteGroup = {
        id: data.id,
        name: String(data.name || '').trim(),
        sort_order: typeof data.sort_order === 'number' ? data.sort_order : noteGroups.length,
      };

      setNoteGroups((prev) =>
        [...prev, createdGroup].sort((a, b) => a.sort_order - b.sort_order)
      );
      setCollapsedGroups((prev) => ({
        ...prev,
        [createdGroup.name]: false,
      }));
      setNewGroupName('');
    } catch (err) {
      console.error('Errore handleCreateGroup:', err);
    }
  }, [newGroupName, userId, noteGroups]);

  const toggleGroupCollapse = useCallback((groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  }, []);

  const handleCreateTicketFromMatch = useCallback(
    (match: TaskManagerMatch) => {
      if (!activeNote || !isOwnerOfActiveNote) return;
      if (match.matchedTicket) return;

      const params = new URLSearchParams();

      if (match.clientName?.trim()) params.set('cliente', match.clientName.trim());
      if (match.title?.trim()) params.set('titolo', match.title.trim());
      if (match.tag?.trim()) params.set('n_tag', match.tag.trim());
      if (match.stato?.trim()) {
        params.set('stato', normalizeStato(match.stato) || match.stato.trim());
      }
      if (match.percentuale_avanzamento !== undefined && match.percentuale_avanzamento !== null) {
        params.set('percentuale_avanzamento', String(match.percentuale_avanzamento));
      }
      if (match.rilascio_in_collaudo) {
        params.set('rilascio_in_collaudo', match.rilascio_in_collaudo);
      }
      if (match.rilascio_in_produzione) {
        params.set('rilascio_in_produzione', match.rilascio_in_produzione);
      }
      if (match.note?.trim()) params.set('note', match.note.trim());
      if (userId) params.set('assignee', userId);

      window.open(`/new_ticket?${params.toString()}`, '_blank', 'noopener,noreferrer');
    },
    [activeNote, isOwnerOfActiveNote, userId]
  );

  const handleDragEnd = useCallback(
    async (event: any) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const activeDraggedNote = notesWithUserPins.find((n) => n.id === active.id);
      if (!activeDraggedNote) return;

      const overId = String(over.id);

      if (overId.startsWith('group:')) {
        const targetGroup = overId.replace('group:', '').trim();

        if (!targetGroup) return;
        if ((activeDraggedNote.group_name || 'Generale').trim() === targetGroup) return;

        setNotes((prev) =>
          prev.map((note) =>
            note.id === active.id
              ? {
                  ...note,
                  group_name: targetGroup,
                  updated_at: new Date().toISOString(),
                }
              : note
          )
        );

        await persistNote(String(active.id), { group_name: targetGroup });
        return;
      }

      const oldIndex = notesWithUserPins.findIndex((n) => n.id === active.id);
      const newIndex = notesWithUserPins.findIndex((n) => n.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const overNote = notesWithUserPins[newIndex];
      if (!overNote) return;

      if (
        (activeDraggedNote.group_name || 'Generale').trim() !==
        (overNote.group_name || 'Generale').trim()
      ) {
        return;
      }

      const reorderedWithPins = arrayMove(notesWithUserPins, oldIndex, newIndex).map((note, index) => ({
        ...note,
        sort_order: index,
      }));

      const reorderedRawNotes = reorderedWithPins.map(({ is_pinned, ...note }) => note);

      setNotes(reorderedRawNotes);
      await saveNotesOrder(reorderedWithPins);
    },
    [notesWithUserPins, persistNote, saveNotesOrder]
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

  const syncTicketData = useCallback(
    async (allLines: string[], startIndex: number) => {
      const firstLine = allLines[startIndex];
      if (!isTicketStartLine(firstLine)) return;

      const clientName = extractClientName(firstLine);
      const tagMatch = firstLine.match(/#([\w\d-]+)/);
      const titleMatch = firstLine.match(/"(.*?)"/);
      const stato = extractStato(firstLine);

      const tag = tagMatch ? tagMatch[1].trim().toUpperCase() : null;
      const title = titleMatch ? titleMatch[1].trim() : null;

      if (!clientName) return;
      if (!tag && !title) return;

      const multiLineNote: string[] = [];

      const firstLineClean = stripIgnoredSegments(
        firstLine
          .replace(/^\s*-\s+/, '')
          .replace(/@"([^"]+)"/g, '')
          .replace(/@([^\s]+)/g, '')
          .replace(/#([\w\d-]+)/g, '')
          .replace(/"(.*?)"/g, '')
          .replace(
            /\((NON INIZIATO|COMPLETATO|IN STAND-BY|IN LAVORAZIONE|IN LAVORAZIONE OGGI|ATTENZIONE BUSINESS)\)/gi,
            ''
          )
          .replace(/\(coll:.*?\)/gi, '')
          .replace(/\(prod:.*?\)/gi, '')
          .replace(/\[perc:.*?\]/gi, '')
          .trim()
      );

      if (firstLineClean) multiLineNote.push(firstLineClean);

      for (let i = startIndex + 1; i < allLines.length; i++) {
        if (isTicketStartLine(allLines[i])) break;
        const content = stripIgnoredSegments(allLines[i].trim());
        if (content) multiLineNote.push(content);
      }

      const finalNote = multiLineNote.join('\n');
      const statoNormalizzato = normalizeStato(stato);

      const updates: any = {
        note: finalNote,
      };

      if (statoNormalizzato !== null) {
        updates.stato = statoNormalizzato;
        updates.in_lavorazione_ora = getInLavorazioneOra(stato);
      }

      const percMatch = firstLine.match(/\[perc:\s*([^\]]+)\]/i);
      if (percMatch) {
        const val = percMatch[1].trim().toLowerCase();
        if (val === 'null') {
          updates.percentuale_avanzamento = null;
        } else {
          const num = parseInt(val.replace('%', ''), 10);
          if (!isNaN(num)) updates.percentuale_avanzamento = num;
        }
      }

      const collMatch = firstLine.match(/\(coll:\s*([^)]+)\)/i);
      const prodMatch = firstLine.match(/\(prod:\s*([^)]+)\)/i);

      if (collMatch && isValidDate(collMatch[1])) {
        updates.rilascio_in_collaudo = parseDateToISO(collMatch[1]);
      }

      if (prodMatch && isValidDate(prodMatch[1])) {
        updates.rilascio_in_produzione = parseDateToISO(prodMatch[1]);
      }

      try {
        let matchedTicket: TicketRecord | null = null;

        if (tag) {
          matchedTicket =
            allTickets.find(
              (t) =>
                normalizeString(t.cliente) === normalizeString(clientName) &&
                normalizeString(t.n_tag) === normalizeString(tag)
            ) || null;
        }

        if (!matchedTicket && !tag && title) {
          matchedTicket =
            allTickets.find(
              (t) =>
                normalizeString(t.cliente) === normalizeString(clientName) &&
                normalizeString(t.titolo) === normalizeString(title)
            ) || null;
        }

        if (!matchedTicket) return;

        const { error } = await supabase.from('ticket').update(updates).eq('id', matchedTicket.id);

        if (error) {
          console.error('Errore sync ticket:', error);
          return;
        }

        setAllTickets((prev) =>
          prev.map((t) => (t.id === matchedTicket!.id ? { ...t, ...updates } : t))
        );
      } catch (err) {
        console.error('Errore sync ticket:', err);
      }
    },
    [allTickets]
  );

  const syncAllTextTickets = useCallback(
    async (content: string) => {
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (isTicketStartLine(lines[i])) {
          await syncTicketData(lines, i);
        }
      }
    },
    [syncTicketData]
  );

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

        if (!isTicketStartLine(firstLine)) continue;

        const clientName = extractClientName(firstLine);
        const tagMatch = firstLine.match(/#([\w\d-]+)/);
        const titleMatch = firstLine.match(/"(.*?)"/);
        const stato = extractStato(firstLine);

        const tag = tagMatch ? tagMatch[1].trim().toUpperCase() : null;
        const title = titleMatch ? titleMatch[1].trim() : null;

        const noteLines: string[] = [];

        const firstLineClean = stripIgnoredSegments(
          firstLine
            .replace(/^\s*-\s+/, '')
            .replace(/@"([^"]+)"/g, '')
            .replace(/@([^\s]+)/g, '')
            .replace(/#([\w\d-]+)/g, '')
            .replace(/"(.*?)"/g, '')
            .replace(
              /\((NON INIZIATO|COMPLETATO|IN STAND-BY|IN LAVORAZIONE|IN LAVORAZIONE OGGI|ATTENZIONE BUSINESS)\)/gi,
              ''
            )
            .replace(/\(coll:.*?\)/gi, '')
            .replace(/\(prod:.*?\)/gi, '')
            .replace(/\[perc:.*?\]/gi, '')
            .trim()
        );

        if (firstLineClean) {
          noteLines.push(firstLineClean);
        }

        for (let i = startIndex + 1; i < lines.length; i++) {
          if (isTicketStartLine(lines[i])) break;
          const contentLine = stripIgnoredSegments(lines[i].trim());
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

        let queryField: 'n_tag' | 'title' | null = null;
        let queryValue: string | null = null;
        let matchedTicket: TicketRecord | null = null;
        let tagOnlyTicket: TicketRecord | null = null;
        let clienteMismatch = false;
        let valid = true;
        let reason = '';

        if (!clientName) {
          valid = false;
          reason = 'Cliente mancante';
        } else if (tag) {
          queryField = 'n_tag';
          queryValue = tag;

          matchedTicket =
            allTickets.find(
              (t) =>
                normalizeString(t.cliente) === normalizeString(clientName) &&
                normalizeString(t.n_tag) === normalizeString(tag)
            ) || null;

          if (!matchedTicket) {
            tagOnlyTicket =
              allTickets.find((t) => normalizeString(t.n_tag) === normalizeString(tag)) || null;

            if (tagOnlyTicket) {
              matchedTicket = tagOnlyTicket;
              clienteMismatch = true;
              valid = false;
              reason = 'Cliente diverso rispetto al ticket con questo TAG';
            } else {
              valid = false;
              reason = 'Nessun ticket trovato per cliente + TAG';
            }
          }
        } else if (title) {
          queryField = 'title';
          queryValue = title;

          matchedTicket =
            allTickets.find(
              (t) =>
                normalizeString(t.cliente) === normalizeString(clientName) &&
                normalizeString(t.titolo) === normalizeString(title)
            ) || null;

          if (!matchedTicket) {
            valid = false;
            reason = 'Nessun ticket trovato per cliente + titolo';
          }
        } else {
          valid = false;
          reason = 'TAG e titolo mancanti';
        }

        results.push({
          lineIndex: startIndex,
          rawLine: firstLine,
          clientName,
          tag,
          title,
          note,
          stato,
          percentuale_avanzamento,
          rilascio_in_collaudo,
          rilascio_in_produzione,
          matchedTicket,
          queryField,
          queryValue,
          valid,
          reason: valid ? undefined : reason,
          tagOnlyTicket,
          clienteMismatch,
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
      const matches = extractTaskManagerEntries(editorValue || '');
      setTaskMatches(matches);
      setShowScanPanel(true);
      setScanStatus('done');
    } catch (err) {
      console.error('Errore scansione taskmanager:', err);
      setScanStatus('error');
    }
  }, [activeNote, extractTaskManagerEntries, editorValue]);

  const handleUpdateMatchedTickets = useCallback(async () => {
    if (!activeNote || activeNote.note_type !== 'taskmanager') return;
    if (!taskMatches.length) return;
    if (!isOwnerOfActiveNote) return;

    try {
      setUpdateStatus('updating');

      for (const match of taskMatches) {
        if (!match.valid || !match.matchedTicket?.id) continue;

        const statoNormalizzato = normalizeStato(match.stato);

        const updates: any = {
          note: match.note || null,
          sprint: 'Sprint',
          stato: statoNormalizzato,
          in_lavorazione_ora: getInLavorazioneOra(match.stato),
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
          .eq('id', match.matchedTicket.id);

        if (error) {
          console.error('Errore aggiornamento ticket:', error, match);
          continue;
        }

        setAllTickets((prev) =>
          prev.map((t) => (t.id === match.matchedTicket?.id ? { ...t, ...updates } : t))
        );
      }

      setUpdateStatus('done');
      setTimeout(() => {
        setUpdateStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('Errore update matched tickets:', err);
      setUpdateStatus('error');
    }
  }, [activeNote, taskMatches, isOwnerOfActiveNote]);

  const handleEditorChange = useCallback(
    (value: string) => {
      if (
        !activeNote ||
        (activeNote.note_type !== 'text' && activeNote.note_type !== 'taskmanager') ||
        !canEditActiveNote
      ) {
        return;
      }

      setEditorValue(value);

      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }

      autosaveTimeoutRef.current = setTimeout(() => {
        persistNote(activeNote.id, { content: value });
      }, 700);
    },
    [activeNote, persistNote, canEditActiveNote]
  );

  const handleEditorBlur = useCallback(async () => {
    if (
      !activeNote ||
      (activeNote.note_type !== 'text' && activeNote.note_type !== 'taskmanager') ||
      !canEditActiveNote
    ) {
      return;
    }

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    await persistNote(activeNote.id, { content: editorValue });

    if (activeNote.note_type === 'text') {
      await syncAllTextTickets(editorValue);
    }
  }, [activeNote, canEditActiveNote, editorValue, persistNote, syncAllTextTickets]);

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== 'Tab') return;

      e.preventDefault();

      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const tab = '\t';

      const nextValue = value.slice(0, start) + tab + value.slice(end);

      setEditorValue(nextValue);

      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }

      if (activeNote && canEditActiveNote) {
        autosaveTimeoutRef.current = setTimeout(() => {
          persistNote(activeNote.id, { content: nextValue });
        }, 700);
      }

      requestAnimationFrame(() => {
        if (!editorRef.current) return;
        editorRef.current.selectionStart = start + tab.length;
        editorRef.current.selectionEnd = start + tab.length;
        updateCursorPosition();
      });
    },
    [activeNote, canEditActiveNote, persistNote, updateCursorPosition]
  );

  const handleCreateNote = useCallback(
    async (type: NoteType) => {
      if (!userId) return;

      const targetGroup =
        newGroupName.trim() && noteGroups.some((g) => g.name === newGroupName.trim())
          ? newGroupName.trim()
          : 'Generale';

      const created = await createNote(
        userId,
        `${type === 'todo' ? 'todo' : type === 'taskmanager' ? 'taskmanager' : 'note'}-${
          notes.length + 1
        }`,
        type,
        targetGroup
      );

      if (!created) return;

      setNotes((prev) => sortTabs([created, ...prev]));
      setActiveNoteId(created.id);
      setTaskMatches([]);
      setShowPreview(false);
      setEditorValue('');
    },
    [createNote, notes.length, userId, newGroupName, noteGroups]
  );

  const handleDeleteNote = useCallback(async () => {
    if (!activeNote || !isOwnerOfActiveNote) return;
    await deleteNote(activeNote.id);
  }, [activeNote, deleteNote, isOwnerOfActiveNote]);

  const handleManualSave = useCallback(async () => {
    if (!activeNote || !canEditActiveNote) return;

    if (activeNote.note_type === 'text' || activeNote.note_type === 'taskmanager') {
      await persistNote(activeNote.id, {
        content: editorValue,
        note_type: activeNote.note_type,
        file_name: activeNote.file_name,
        group_name: activeNote.group_name,
      });

      if (activeNote.note_type === 'text') {
        await syncAllTextTickets(editorValue);
      }

      return;
    }

    await persistNote(activeNote.id, {
      content: activeNote.content,
      note_type: activeNote.note_type,
      todo_items: activeNote.todo_items,
      file_name: activeNote.file_name,
      group_name: activeNote.group_name,
    });
  }, [activeNote, persistNote, canEditActiveNote, editorValue, syncAllTextTickets]);

  const updateActiveTodoItems = useCallback(
    async (updater: (items: TodoItem[]) => TodoItem[]) => {
      if (!activeNote || activeNote.note_type !== 'todo' || !canEditActiveNote) return;

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
    [activeNote, persistNote, canEditActiveNote]
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
        items.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item))
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
      if (!activeNote || activeNote.note_type === nextType || !isOwnerOfActiveNote) return;

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
    [activeNote, persistNote, isOwnerOfActiveNote]
  );

  const isClienteMismatch = useCallback((match: TaskManagerMatch) => {
    return Boolean(match.clienteMismatch && match.matchedTicket);
  }, []);

  const handleFixCliente = useCallback(
    async (match: TaskManagerMatch) => {
      if (!activeNote || activeNote.note_type !== 'taskmanager') return;
      if (!isOwnerOfActiveNote) return;
      if (!match.matchedTicket?.cliente) return;

      const key = `${match.lineIndex}-${match.queryValue || match.matchedTicket?.id}`;

      try {
        setFixingClienteKey(key);

        const correctClient = match.matchedTicket.cliente.trim();
        const lines = (editorValue || '').split('\n');

        if (match.lineIndex < 0 || match.lineIndex >= lines.length) return;

        const originalLine = lines[match.lineIndex];
        const clientToken = correctClient.includes(' ') ? `@"${correctClient}"` : `@${correctClient}`;
        const updatedLine = originalLine.replace(/@"([^"]+)"|@([^\s]+)/, clientToken);

        lines[match.lineIndex] = updatedLine;

        const updatedContent = lines.join('\n');

        setEditorValue(updatedContent);
        await persistNote(activeNote.id, { content: updatedContent });

        const rescanned = extractTaskManagerEntries(updatedContent);
        setTaskMatches(rescanned);
      } finally {
        setFixingClienteKey(null);
      }
    },
    [activeNote, persistNote, extractTaskManagerEntries, isOwnerOfActiveNote, editorValue]
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
        setPinnedNoteIds([]);
        setNoteGroups([]);
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  useEffect(() => {
    const initData = async () => {
      if (!authReady) return;

      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        await Promise.all([
          fetchTickets(),
          fetchClienti(),
          loadNotes(userId),
          loadGroups(userId),
          loadPinnedNotes(userId),
        ]);
      } catch (err) {
        console.error('Errore initData:', err);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [authReady, userId, fetchTickets, fetchClienti, loadNotes, loadGroups, loadPinnedNotes]);

  useEffect(() => {
    if (
      activeNote &&
      (activeNote.note_type === 'text' || activeNote.note_type === 'taskmanager')
    ) {
      setEditorValue(activeNote.content || '');
    } else {
      setEditorValue('');
    }
  }, [activeNoteId, activeNote?.content, activeNote?.note_type]);

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
    setShowScanPanel(false);
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
      <aside className="w-[320px] bg-[#252526] border-r border-white/10 flex flex-col shrink-0">
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
              placeholder="Cerca note o gruppi..."
              className="bg-transparent outline-none w-full text-sm text-white placeholder:text-white/40"
            />
          </div>
        </div>

        <div className="p-2 border-b border-white/10 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-white/40">
            Nuovo gruppo
          </div>
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateGroup();
              }
            }}
            placeholder="Scrivi nome gruppo e premi Invio"
            className="w-full h-9 rounded bg-[#1e1e1e] border border-white/10 px-2 text-sm text-white outline-none placeholder:text-white/30"
          />
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
            disabled={!activeNote || notes.length <= 1 || !isOwnerOfActiveNote}
            className="w-10 h-9 rounded bg-[#3c3c3c] hover:bg-[#4a4a4a] disabled:opacity-40 text-white flex items-center justify-center"
            title="Elimina nota"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={filteredNotes.map((note) => note.id)}
              strategy={verticalListSortingStrategy}
            >
              {groupedNotes.map(([groupName, groupItems]) => {
                const isCollapsed = Boolean(collapsedGroups[groupName]);

                return (
                  <DroppableGroup key={groupName} id={`group:${groupName}`}>
                    <button
                      type="button"
                      onClick={() => toggleGroupCollapse(groupName)}
                      className="w-full px-3 py-2 bg-[#2a2a2a] hover:bg-[#333] text-left text-[11px] uppercase tracking-wider text-white/60 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <FolderOpen size={12} />
                        {groupName}
                      </span>
                      <span>{isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</span>
                    </button>

                    {!isCollapsed &&
                      groupItems.map((note) => {
                        const isActive = note.id === activeNoteId;

                        return (
                          <SortableTabItem key={note.id} note={note} isActive={isActive}>
                            <div
                              onMouseEnter={() => setHoveredNoteId(note.id)}
                              onMouseLeave={() =>
                                setHoveredNoteId((prev) => (prev === note.id ? null : prev))
                              }
                              className={`w-full px-3 py-2 border-l-2 transition ${
                                isActive
                                  ? 'bg-[#1e1e1e] border-l-[#ffd700] text-white'
                                  : 'bg-transparent border-l-transparent text-[#cccccc] hover:bg-white/5'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setActiveNoteId(note.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setActiveNoteId(note.id);
                                    }
                                  }}
                                  className="flex-1 min-w-0 text-left cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    {hoveredNoteId === note.id ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          togglePinNote(note);
                                        }}
                                        className={`shrink-0 rounded p-0.5 transition ${
                                          note.is_pinned
                                            ? 'text-yellow-300 hover:text-yellow-200'
                                            : 'text-white/50 hover:text-yellow-300'
                                        }`}
                                        title={note.is_pinned ? 'Rimuovi pin personale' : 'Metti in alto per me'}
                                      >
                                        <Pin size={13} />
                                      </button>
                                    ) : note.note_type === 'todo' ? (
                                      <CheckSquare size={13} className="text-violet-300 shrink-0" />
                                    ) : note.note_type === 'taskmanager' ? (
                                      <FileText size={13} className="text-amber-300 shrink-0" />
                                    ) : (
                                      <FileText size={13} className="text-sky-300 shrink-0" />
                                    )}

                                    <div className="text-sm truncate">{note.file_name}</div>

                                    {note.is_pinned && (
                                      <Pin size={11} className="text-yellow-300 shrink-0" />
                                    )}

                                    {note.share_mode === 'shared_view' && (
                                      <span className="shrink-0 rounded bg-yellow-500/20 px-1.5 py-0.5 text-[9px] text-yellow-300">
                                        shared-view
                                      </span>
                                    )}

                                    {note.share_mode === 'shared_edit' && (
                                      <span className="shrink-0 rounded bg-green-500/20 px-1.5 py-0.5 text-[9px] text-green-300">
                                        shared-edit
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-1 text-[10px] text-white/45 truncate">
                                    {new Date(note.updated_at).toLocaleString()}
                                  </div>
                                </div>

                                {canManageNote(note) && (
                                  <button
                                    type="button"
                                    title={
                                      note.share_mode === 'private'
                                        ? 'Condividi in sola lettura'
                                        : note.share_mode === 'shared_view'
                                        ? 'Condividi in modifica'
                                        : 'Rimuovi condivisione'
                                    }
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleShareNote(note);
                                    }}
                                    disabled={shareLoadingId === note.id}
                                    className={`mt-0.5 h-8 w-8 shrink-0 rounded flex items-center justify-center transition ${
                                      note.share_mode === 'shared_view'
                                        ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30'
                                        : note.share_mode === 'shared_edit'
                                        ? 'bg-green-600/20 text-green-300 hover:bg-green-600/30'
                                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                                    } disabled:opacity-50`}
                                  >
                                    <Users size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </SortableTabItem>
                        );
                      })}

                    {!isCollapsed && groupItems.length === 0 && (
                      <div className="px-3 py-3 text-xs text-white/35">Gruppo vuoto</div>
                    )}
                  </DroppableGroup>
                );
              })}

              {groupedNotes.length === 0 && (
                <div className="px-3 py-4 text-xs text-white/40">Nessun gruppo trovato</div>
              )}
            </SortableContext>
          </DndContext>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="h-12 px-4 bg-[#2d2d2d] border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <input
              disabled={!isOwnerOfActiveNote}
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
                if (!activeNote || !isOwnerOfActiveNote) return;
                const trimmed = e.target.value.trim() || 'untitled';
                persistNote(activeNote.id, { file_name: trimmed });
              }}
              className={`bg-transparent outline-none text-sm text-white font-semibold min-w-0 max-w-[420px] border rounded px-2 py-1 ${
                isOwnerOfActiveNote
                  ? 'border-transparent focus:border-white/20'
                  : 'border-transparent opacity-60 cursor-not-allowed'
              }`}
            />

            <span className="text-xs text-white/40 truncate">
              Gruppo: {activeNote?.group_name || 'Generale'}
            </span>

            <select
              value={activeNote?.note_type || 'text'}
              onChange={(e) => changeNoteType(e.target.value as NoteType)}
              disabled={!isOwnerOfActiveNote}
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

            {activeNote && (
              <span
                className={`text-[10px] px-2 py-1 rounded ${
                  activeNote.share_mode === 'shared_view'
                    ? 'bg-yellow-500/20 text-yellow-300'
                    : activeNote.share_mode === 'shared_edit'
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-white/10 text-white/50'
                }`}
              >
                {activeNote.share_mode === 'shared_view'
                  ? 'shared-view'
                  : activeNote.share_mode === 'shared_edit'
                  ? 'shared-edit'
                  : 'private'}
              </span>
            )}
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
                  disabled={!taskMatches.length || !isOwnerOfActiveNote || updateStatus === 'updating'}
                  className={`h-9 px-3 rounded text-white text-sm transition ${
                    updateStatus === 'done'
                      ? 'bg-green-600'
                      : updateStatus === 'error'
                      ? 'bg-red-600'
                      : updateStatus === 'updating'
                      ? 'bg-yellow-600'
                      : 'bg-[#0e639c] hover:bg-[#1177bb]'
                  } disabled:opacity-50`}
                >
                  {updateStatus === 'updating'
                    ? 'Aggiornamento...'
                    : updateStatus === 'done'
                    ? '✔ Aggiornato'
                    : updateStatus === 'error'
                    ? 'Errore'
                    : 'Aggiorna ticket'}
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
                  disabled={!canEditActiveNote}
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
                      disabled={!canEditActiveNote}
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
                      disabled={!canEditActiveNote}
                      className={`flex-1 bg-transparent outline-none text-sm ${
                        item.done ? 'line-through text-white/40' : 'text-white'
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => deleteTodoItem(item.id)}
                      disabled={!canEditActiveNote}
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

              <div className="flex-1 min-w-0 relative">
                <div className="h-full pr-0">
                  <textarea
                    ref={editorRef}
                    value={editorValue}
                    onChange={(e) => handleEditorChange(e.target.value)}
                    onKeyDown={handleEditorKeyDown}
                    onBlur={handleEditorBlur}
                    onClick={updateCursorPosition}
                    onKeyUp={updateCursorPosition}
                    onSelect={updateCursorPosition}
                    spellCheck={false}
                    readOnly={!canEditActiveNote}
                    className={`w-full h-full resize-none bg-[#1e1e1e] text-[#f8f8f2] outline-none border-none p-4 leading-7 text-sm caret-white ${
                      !canEditActiveNote ? 'opacity-80 cursor-not-allowed' : ''
                    }`}
                    placeholder={`Esempio:
- @Esselunga #TAG123 (IN LAVORAZIONE) "Errore login checkout" [perc: 50] (coll: 12/08/2025) (prod: 20/08/2025)
Analisi iniziale completata
Questa parte viene ignorata // nota interna da ignorare //

- @Sika #TAG456 (IN STAND-BY) "Dashboard KPI Vendite" [perc: 80]
Altra nota`}
                    style={{ tabSize: 2 }}
                  />
                </div>

                <div
                  className={`absolute top-0 right-0 h-full transition-all duration-300 ease-in-out ${
                    showScanPanel ? 'w-[420px]' : 'w-0'
                  }`}
                >
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full`}>
                    <button
                      type="button"
                      onClick={() => setShowScanPanel((prev) => !prev)}
                      className="h-28 w-8 rounded-l-md border border-r-0 border-white/10 bg-[#2a2a2a] hover:bg-[#333] text-white/70 hover:text-white text-[10px] tracking-wide uppercase flex items-center justify-center"
                      title={showScanPanel ? 'Nascondi risultato scansione' : 'Mostra risultato scansione'}
                    >
                      <span className="[writing-mode:vertical-rl] rotate-180 select-none">Scan</span>
                    </button>
                  </div>

                  <div
                    className={`h-full border-l border-white/10 bg-[#202020] overflow-hidden ${
                      showScanPanel ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    } transition-opacity duration-200`}
                  >
                    <div className="h-full overflow-auto p-4 space-y-3">
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
                        <div className="text-sm text-white/40">Nessuna scansione eseguita</div>
                      ) : (
                        taskMatches.map((match, idx) => (
                          <div
                            key={`${match.lineIndex}-${idx}`}
                            className={`rounded border p-3 ${
                              isClienteMismatch(match)
                                ? 'border-yellow-500/30 bg-yellow-500/10'
                                : match.valid
                                ? 'border-green-500/30 bg-green-500/10'
                                : 'border-red-500/30 bg-red-500/10'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="text-xs text-white/50">Riga {match.lineIndex + 1}</div>

                              <div className="flex items-start gap-3">
                                {match.reason && (
                                  <div
                                    className={`mt-2 text-xs ${
                                      isClienteMismatch(match) ? 'text-yellow-300' : 'text-red-300'
                                    }`}
                                  >
                                    {isClienteMismatch(match) ? '⚠️' : '❌'} {match.reason}
                                  </div>
                                )}

                                {isClienteMismatch(match) && isOwnerOfActiveNote ? (
                                  <button
                                    type="button"
                                    onClick={() => handleFixCliente(match)}
                                    disabled={
                                      fixingClienteKey ===
                                      `${match.lineIndex}-${match.queryValue || match.matchedTicket?.id}`
                                    }
                                    className="h-8 px-3 rounded bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-xs font-bold"
                                  >
                                    {fixingClienteKey ===
                                    `${match.lineIndex}-${match.queryValue || match.matchedTicket?.id}`
                                      ? 'Fix in corso...'
                                      : 'Fix Cliente'}
                                  </button>
                                ) : !match.matchedTicket && isOwnerOfActiveNote ? (
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
                                ) : null}
                              </div>
                            </div>

                            {match.matchedTicket && (
                              <div
                                className={`mt-2 mb-3 text-xs ${
                                  isClienteMismatch(match) ? 'text-yellow-300' : 'text-green-300'
                                }`}
                              >
                                {isClienteMismatch(match) ? '' : '✅ Ticket Trovato'}
                              </div>
                            )}

                            <div className="space-y-1 text-sm text-white">
                              <div>
                                <strong>Cliente:</strong> {match.clientName || '-'}
                              </div>
                              <div>
                                <strong>Titolo:</strong>{' '}
                                {match.title?.trim() || match.matchedTicket?.titolo?.trim() || '-'}
                              </div>
                              <div>
                                <strong>Tag:</strong> {match.tag || '-'}
                              </div>
                              <div>
                                <strong>Stato:</strong> {match.stato || '-'}
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
                          </div>
                        ))
                      )}
                    </div>
                  </div>
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
                  value={editorValue}
                  onChange={(e) => handleEditorChange(e.target.value)}
                  onKeyDown={handleEditorKeyDown}
                  onBlur={handleEditorBlur}
                  onClick={updateCursorPosition}
                  onKeyUp={updateCursorPosition}
                  onSelect={updateCursorPosition}
                  spellCheck={false}
                  readOnly={!canEditActiveNote}
                  className={`w-full h-full resize-none bg-[#1e1e1e] text-[#f8f8f2] outline-none border-none p-4 leading-7 text-sm caret-white ${
                    !canEditActiveNote ? 'opacity-80 cursor-not-allowed' : ''
                  }`}
                  placeholder="Scrivi qui le tue note..."
                  style={{ tabSize: 2 }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-auto p-6 whitespace-pre-wrap text-sm leading-7 text-[#f8f8f2]">
              {currentEditorContent || 'Nessun contenuto'}
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

            {activeNote?.note_type === 'taskmanager' ? (
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-green-400" title="Ticket trovati e validi">
                  ✅ {matchStats.matched}
                </span>
                <span className="text-yellow-300" title="Ticket con problemi">
                  ⚠️ {matchStats.issues}
                </span>
                <span className="text-red-400" title="Nessun ticket trovato">
                  ❌ {matchStats.noMatch}
                </span>
              </div>
            ) : (
              <span>{allTickets.length} ticket caricati</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}