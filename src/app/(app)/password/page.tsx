'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  AppWindow,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  Plus,
  Save,
  Search,
  Share2,
  StickyNote,
  Trash2,
  User,
  X,
} from 'lucide-react';

const supabase = createClient();

type ShareMode = 'private' | 'shared_view' | 'shared_edit';

const BRAND = '#0150a0';
const BRAND_BG = '#eaf2fb';
const BRAND_SOFT_TEXT = '#0150a0CC';

interface VaultPasswordRecord {
  id: string;
  owner_user_id: string;
  description: string;
  cliente: string | null;
  note: string | null;
  link: string | null;
  email: string | null;
  password: string;
  share_mode: ShareMode;
  created_at: string;
  updated_at: string;
}

interface PasswordFormState {
  description: string;
  cliente: string;
  note: string;
  link: string;
  email: string;
  password: string;
  share_mode: ShareMode;
}

const EMPTY_FORM: PasswordFormState = {
  description: '',
  cliente: '',
  note: '',
  link: '',
  email: '',
  password: '',
  share_mode: 'private',
};

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function maskPassword(value: string) {
  if (!value) return '';
  return '•'.repeat(Math.max(8, value.length));
}

function getShareLabel(mode: ShareMode) {
  if (mode === 'private') return 'Privata';
  if (mode === 'shared_view') return 'Condivisa view';
  return 'Condivisa edit';
}

export default function PasswordVaultPage() {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [records, setRecords] = useState<VaultPasswordRecord[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showCreateRow, setShowCreateRow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedState, setCopiedState] = useState<Record<string, 'email' | 'password' | null>>(
    {}
  );
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<PasswordFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<PasswordFormState>(EMPTY_FORM);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;

    return records.filter((row) =>
      [row.description, row.cliente || '', row.note || '', row.link || '', row.email || '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [records, search]);

  const canManageRecord = useCallback(
    (record: VaultPasswordRecord) => record.owner_user_id === userId,
    [userId]
  );

  const canEditRecord = useCallback(
    (record: VaultPasswordRecord) => {
      if (record.owner_user_id === userId) return true;
      return record.share_mode === 'shared_edit';
    },
    [userId]
  );

  const fetchVaultRecords = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('password_vault')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Errore fetch password_vault:', error);
      setSaveError('Errore caricamento password');
      return;
    }

    const normalized: VaultPasswordRecord[] = (data || [])
      .map((item: any) => ({
        id: item.id,
        owner_user_id: item.owner_user_id,
        description: String(item.description || '').trim(),
        cliente: item.cliente ? String(item.cliente).trim() : null,
        note: item.note ? String(item.note).trim() : null,
        link: item.link ? String(item.link).trim() : null,
        email: item.email ? String(item.email).trim() : null,
        password: String(item.password || ''),
        share_mode:
          item.share_mode === 'shared_view' || item.share_mode === 'shared_edit'
            ? item.share_mode
            : 'private',
        created_at: item.created_at,
        updated_at: item.updated_at,
      }))
      .filter((item) => item.owner_user_id === uid || item.share_mode !== 'private');

    setRecords(normalized);
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      setAuthError(null);

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Errore auth session:', error);
      }

      const uid = data.session?.user?.id || '';

      if (!mounted) return;

      if (!uid) {
        setAuthError('Utente non autenticato');
        setLoading(false);
        return;
      }

      setUserId(uid);
      await fetchVaultRecords(uid);
      setLoading(false);
    };

    init();

    return () => {
      mounted = false;
    };
  }, [fetchVaultRecords]);

  const resetCreateForm = useCallback(() => {
    setCreateForm(EMPTY_FORM);
    setShowCreateRow(false);
  }, []);

  const startEdit = useCallback((record: VaultPasswordRecord) => {
    setEditingId(record.id);
    setEditForm({
      description: record.description,
      cliente: record.cliente || '',
      note: record.note || '',
      link: record.link || '',
      email: record.email || '',
      password: record.password,
      share_mode: record.share_mode,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }, []);

  const togglePasswordVisibility = useCallback((id: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const copyToClipboard = useCallback(
    async (value: string, id: string, type: 'email' | 'password') => {
      if (!value) return;

      try {
        await navigator.clipboard.writeText(value);
        setCopiedState((prev) => ({
          ...prev,
          [id]: type,
        }));

        window.setTimeout(() => {
          setCopiedState((prev) => ({
            ...prev,
            [id]: prev[id] === type ? null : prev[id],
          }));
        }, 1200);
      } catch (error) {
        console.error('Errore copia appunti:', error);
        setSaveError('Impossibile copiare negli appunti');
      }
    },
    []
  );

  const handleCreate = useCallback(async () => {
    if (!userId) return;

    if (!createForm.description.trim()) {
      setSaveError('Inserisci almeno la descrizione');
      return;
    }

    if (!createForm.password.trim()) {
      setSaveError('Inserisci la password');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);

      const payload = {
        owner_user_id: userId,
        description: createForm.description.trim(),
        cliente: createForm.cliente.trim() || null,
        note: createForm.note.trim() || null,
        link: createForm.link.trim() ? normalizeUrl(createForm.link) : null,
        email: createForm.email.trim() || null,
        password: createForm.password,
        share_mode: createForm.share_mode,
      };

      const { data, error } = await supabase
        .from('password_vault')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('Errore creazione password:', error);
        setSaveError('Errore durante il salvataggio');
        return;
      }

      const created: VaultPasswordRecord = {
        id: data.id,
        owner_user_id: data.owner_user_id,
        description: data.description,
        cliente: data.cliente,
        note: data.note,
        link: data.link,
        email: data.email,
        password: data.password,
        share_mode: data.share_mode,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      setRecords((prev) => [created, ...prev]);
      resetCreateForm();
    } catch (err) {
      console.error('Errore handleCreate:', err);
      setSaveError('Errore imprevisto');
    } finally {
      setSaving(false);
    }
  }, [createForm, resetCreateForm, userId]);

  const handleUpdate = useCallback(async () => {
    if (!editingId) return;

    const current = records.find((row) => row.id === editingId);
    if (!current || !canEditRecord(current)) return;

    if (!editForm.description.trim()) {
      setSaveError('Inserisci almeno la descrizione');
      return;
    }

    if (!editForm.password.trim()) {
      setSaveError('Inserisci la password');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);

      const payload = {
        description: editForm.description.trim(),
        cliente: editForm.cliente.trim() || null,
        note: editForm.note.trim() || null,
        link: editForm.link.trim() ? normalizeUrl(editForm.link) : null,
        email: editForm.email.trim() || null,
        password: editForm.password,
        share_mode: editForm.share_mode,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('password_vault')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single();

      if (error) {
        console.error('Errore update password:', error);
        setSaveError("Errore durante l'aggiornamento");
        return;
      }

      setRecords((prev) =>
        prev.map((row) =>
          row.id === editingId
            ? {
                ...row,
                description: data.description,
                cliente: data.cliente,
                note: data.note,
                link: data.link,
                email: data.email,
                password: data.password,
                share_mode: data.share_mode,
                updated_at: data.updated_at,
              }
            : row
        )
      );

      cancelEdit();
    } catch (err) {
      console.error('Errore handleUpdate:', err);
      setSaveError('Errore imprevisto');
    } finally {
      setSaving(false);
    }
  }, [editingId, records, canEditRecord, editForm, cancelEdit]);

  const handleDelete = useCallback(
    async (record: VaultPasswordRecord) => {
      if (!canManageRecord(record)) return;

      try {
        setSaving(true);
        setSaveError(null);

        const { error } = await supabase
          .from('password_vault')
          .delete()
          .eq('id', record.id)
          .eq('owner_user_id', userId);

        if (error) {
          console.error('Errore delete password:', error);
          setSaveError("Errore durante l'eliminazione");
          return;
        }

        setRecords((prev) => prev.filter((row) => row.id !== record.id));
      } catch (err) {
        console.error('Errore handleDelete:', err);
        setSaveError('Errore imprevisto');
      } finally {
        setSaving(false);
      }
    },
    [canManageRecord, userId]
  );

  const updateShareModeOnly = useCallback(
    async (record: VaultPasswordRecord, mode: ShareMode) => {
      if (!canManageRecord(record)) return;

      try {
        setSaving(true);
        setSaveError(null);

        const { data, error } = await supabase
          .from('password_vault')
          .update({
            share_mode: mode,
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id)
          .eq('owner_user_id', userId)
          .select()
          .single();

        if (error) {
          console.error('Errore share mode:', error);
          setSaveError('Errore aggiornamento condivisione');
          return;
        }

        setRecords((prev) =>
          prev.map((row) =>
            row.id === record.id
              ? {
                  ...row,
                  share_mode: data.share_mode,
                  updated_at: data.updated_at,
                }
              : row
          )
        );
      } finally {
        setSaving(false);
      }
    },
    [canManageRecord, userId]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFB] p-4 md:p-8">
        <div className="max-w-[2200px] mx-auto">
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-sm font-bold text-slate-400">Caricamento password...</div>
          </div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-[#FBFBFB] p-4 md:p-8">
        <div className="max-w-[2200px] mx-auto">
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-sm font-bold text-slate-400">{authError}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFB] p-4 md:p-8">
      <div className="max-w-[2200px] mx-auto">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-black tracking-tighter" style={{ color: BRAND }}>
              PASSWORD VAULT
            </h1>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.3em]"
              style={{ color: BRAND_SOFT_TEXT }}
            >
              Credenziali condivise, link rapidi e gestione globale
            </p>
          </div>

          <div className="flex gap-2 flex-wrap w-full lg:w-auto">
            <div className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white border border-gray-100 text-[12px] font-bold outline-none w-full lg:w-80 shadow-sm">
              <Search size={15} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca cliente / descrizione / email / note..."
                className="bg-transparent outline-none w-full text-[12px] font-bold text-slate-700 placeholder:text-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setShowCreateRow((prev) => !prev);
                setEditingId(null);
                setSaveError(null);
              }}
              className="h-11 w-11 rounded-[10px] text-white flex items-center justify-center shadow-sm"
              style={{ background: BRAND }}
              title="Aggiungi password"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {saveError && (
          <div className="mb-4 rounded-[10px] border px-4 py-3 text-sm font-bold text-red-700 bg-red-50 border-red-200">
            {saveError}
          </div>
        )}

        <div className="overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead style={{ background: BRAND_BG, color: BRAND }}>
                <tr>
                  <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                    Descrizione
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                    Cliente
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                    Note
                  </th>
                  <th className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest">
                    Link
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                    Email
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                    Password
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                    Condivisione
                  </th>
                  <th className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-widest">
                    Azioni
                  </th>
                </tr>
              </thead>

              <tbody>
                {showCreateRow && (
                  <tr className="border-t border-gray-100 bg-[#fbfdff] align-top">
                    <td className="px-4 py-3">
                      <input
                        value={createForm.description}
                        onChange={(e) =>
                          setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                        placeholder="Descrizione"
                        className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-slate-700 outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={createForm.cliente}
                        onChange={(e) =>
                          setCreateForm((prev) => ({ ...prev, cliente: e.target.value }))
                        }
                        placeholder="Cliente"
                        className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-slate-700 outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <textarea
                        value={createForm.note}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, note: e.target.value }))}
                        placeholder="Note"
                        rows={3}
                        className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-slate-700 outline-none resize-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={createForm.link}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, link: e.target.value }))}
                        placeholder="example.com"
                        className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-slate-700 outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={createForm.email}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="email@dominio.com"
                        className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-slate-700 outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={createForm.password}
                        onChange={(e) =>
                          setCreateForm((prev) => ({ ...prev, password: e.target.value }))
                        }
                        placeholder="Password"
                        className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-slate-700 outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={createForm.share_mode}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            share_mode: e.target.value as ShareMode,
                          }))
                        }
                        className="w-full rounded-[10px] border border-gray-200 bg-white px-2 py-2 text-slate-700 outline-none"
                      >
                        <option value="private">Privata</option>
                        <option value="shared_view">Condivisa view</option>
                        <option value="shared_edit">Condivisa edit</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleCreate}
                          disabled={saving}
                          className="h-10 w-10 rounded-[10px] bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center disabled:opacity-50"
                          title="Salva"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={resetCreateForm}
                          className="h-10 w-10 rounded-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center"
                          title="Annulla"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {filteredRecords.map((record) => {
                  const isEditing = editingId === record.id;
                  const isVisible = Boolean(visiblePasswords[record.id]);

                  return (
                    <tr key={record.id} className="border-t border-gray-100 hover:bg-slate-50 align-top">
                      {isEditing ? (
                        <>
                          <td className="px-4 py-3">
                            <input
                              value={editForm.description}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, description: e.target.value }))
                              }
                              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-slate-700 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              value={editForm.cliente}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, cliente: e.target.value }))
                              }
                              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-slate-700 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <textarea
                              value={editForm.note}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, note: e.target.value }))}
                              rows={3}
                              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-slate-700 outline-none resize-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              value={editForm.link}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, link: e.target.value }))}
                              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-slate-700 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              value={editForm.email}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-slate-700 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              value={editForm.password}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, password: e.target.value }))
                              }
                              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-slate-700 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={editForm.share_mode}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  share_mode: e.target.value as ShareMode,
                                }))
                              }
                              className="w-full rounded-[10px] border border-gray-200 bg-white px-2 py-2 text-slate-700 outline-none"
                            >
                              <option value="private">Privata</option>
                              <option value="shared_view">Condivisa view</option>
                              <option value="shared_edit">Condivisa edit</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleUpdate}
                                disabled={saving}
                                className="h-10 w-10 rounded-[10px] bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center disabled:opacity-50"
                                title="Salva modifiche"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="h-10 w-10 rounded-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center"
                                title="Annulla"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-4">
                            <div className="font-black text-slate-800 leading-tight">
                              {record.description}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-[10px]">
                              <User size={12} style={{ color: BRAND }} />
                              {record.cliente || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-4 max-w-[280px]">
                            <div className="flex items-start gap-2 text-[12px] text-slate-600">
                              <StickyNote size={14} className="mt-0.5 text-amber-500 shrink-0" />
                              <span className="line-clamp-3 whitespace-pre-wrap">{record.note || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {record.link ? (
                              <a
                                href={record.link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-gray-200 bg-white text-slate-600 hover:text-white transition-colors"
                                style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = BRAND;
                                  e.currentTarget.style.borderColor = BRAND;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'white';
                                  e.currentTarget.style.borderColor = '#e5e7eb';
                                }}
                                title="Apri link"
                              >
                                <ExternalLink size={16} />
                              </a>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-[10px] min-w-0">
                                <AppWindow size={12} style={{ color: BRAND }} />
                                <span className="truncate max-w-[200px]">{record.email || '—'}</span>
                              </div>
                              {record.email && (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(record.email || '', record.id, 'email')}
                                  className="h-10 w-10 rounded-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0"
                                  title="Copia email"
                                >
                                  <Copy size={14} />
                                </button>
                              )}
                              {copiedState[record.id] === 'email' && (
                                <span className="text-[11px] text-emerald-600 font-bold shrink-0">
                                  Copiata
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-[10px] min-w-[140px]">
                                <span className="truncate">
                                  {isVisible ? record.password : maskPassword(record.password)}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(record.password, record.id, 'password')
                                }
                                className="h-10 w-10 rounded-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center"
                                title="Copia password"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(record.id)}
                                className="h-10 w-10 rounded-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center"
                                title={isVisible ? 'Nascondi password' : 'Mostra password'}
                              >
                                {isVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                              {copiedState[record.id] === 'password' && (
                                <span className="text-[11px] text-emerald-600 font-bold shrink-0">
                                  Copiata
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 relative">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${
                                  record.share_mode === 'private'
                                    ? 'bg-slate-100 text-slate-500'
                                    : record.share_mode === 'shared_view'
                                    ? 'bg-yellow-50 text-yellow-700'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {getShareLabel(record.share_mode)}
                              </span>

                              {canManageRecord(record) && (
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShareMenuId((prev) => (prev === record.id ? null : record.id))
                                    }
                                    className="h-10 w-10 rounded-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center"
                                    title="Condivisione"
                                  >
                                    <Share2 size={15} />
                                  </button>

                                  {shareMenuId === record.id && (
                                    <div className="absolute right-0 z-20 mt-2 w-72 rounded-[10px] border border-gray-200 bg-white p-3 shadow-xl">
                                      <div
                                        className="mb-2 text-xs font-black uppercase tracking-wide"
                                        style={{ color: BRAND_SOFT_TEXT }}
                                      >
                                        Condivisione
                                      </div>

                                      <div className="grid grid-cols-1 gap-2">
                                        <button
                                          type="button"
                                          onClick={() => updateShareModeOnly(record, 'private')}
                                          className="rounded-[10px] bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 text-left"
                                        >
                                          Privata
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateShareModeOnly(record, 'shared_view')}
                                          className="rounded-[10px] bg-yellow-50 px-3 py-2 text-xs font-bold text-yellow-700 hover:bg-yellow-100 text-left"
                                        >
                                          Condivisa con tutti in sola lettura
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateShareModeOnly(record, 'shared_edit')}
                                          className="rounded-[10px] bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 text-left"
                                        >
                                          Condivisa con tutti in modifica
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(record)}
                                disabled={!canEditRecord(record)}
                                className="h-10 w-10 rounded-[10px] text-white flex items-center justify-center disabled:opacity-40"
                                style={{ background: BRAND }}
                                title="Modifica"
                              >
                                <Pencil size={15} />
                              </button>

                              {canManageRecord(record) && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(record)}
                                  className="h-10 w-10 rounded-[10px] bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
                                  title="Elimina"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}

                {filteredRecords.length === 0 && !showCreateRow && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400 font-bold">
                      Nessuna password salvata.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}