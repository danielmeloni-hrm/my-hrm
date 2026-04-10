'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';

const supabase = createClient();

const BRAND = '#0150a0';
const BRAND_BG = '#eaf2fb';
const BRAND_SOFT_TEXT = '#0150a0CC';

const ESSELUNGA_APPS = [
  'APPECOM',
  'ECOM35',
  'EOL',
  'ESB',
  'IST35',
  'APPIST',
  'GCW',
  'B2B',
  'TOT',
  'Altro',
] as const;

const STEP_STATUSES_DOC = [
  'Da Fare',
  'Draft',
  'In Lavorazione',
  'Attenzione di Andrea',
  'Attenzione di Business',
  'Completato - Da Inviare',
  'Completato',
  'Inviato',
  'Sostituito',
] as const;

const STEP_STATUSES_GTM_GA = [
  'GA4 Da Configurare',
  'GTM Da Configurare',
  'GA4 Da Pubblicare',
  'GTM Da Pubblicare',
  'GTM OK',
  'GA4 OK',
  'Completato',
  'Non Necessaria',
  'Sostituito',
] as const;

const STEP_STATUSES_RILASCI = [
  'In attesa',
  'In Sviluppo',
  'Completato',
  'Sostituito',
] as const;
const STEP_STATUSES_REPORT = [
  'Da Fare',
  'In Lavorazione',
  'Da Completare',
  'Completato',
] as const;




const STEP_STATUSES_DEFAULT = [
  'Da Fare',
  'In Lavorazione',
  'Attenzione di Andrea',
  'Attenzione di Business',
  'Completato',
  'Non Necessaria',
  'Sostituito',
] as const;

type DocStepStatus = (typeof STEP_STATUSES_DOC)[number];
type GtmGaStepStatus = (typeof STEP_STATUSES_GTM_GA)[number];
type DefaultStepStatus = (typeof STEP_STATUSES_DEFAULT)[number];
type AnyStepStatus = DocStepStatus | GtmGaStepStatus | DefaultStepStatus;

const STATUS_STYLES: Record<string, string> = {
  'Da Fare': 'bg-gray-100 text-gray-600 border border-gray-200',
  'In attesa':'bg-gray-100 text-gray-600 border border-gray-200',
  Draft: 'bg-amber-100 text-amber-700 border border-amber-200',
  'In Sviluppo': 'bg-amber-100 text-amber-700 border border-amber-200',
  'In Lavorazione': 'bg-orange-100 text-orange-700 border border-orange-200',
  'Da Completare': 'bg-pink-200 text-pink-800 border border-pink-300',
  'Attenzione di Andrea': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  'Attenzione di Business': 'bg-purple-200 text-purple-800 border border-purple-300',
  'Completato - Da Inviare': 'bg-green-100 text-green-700 border border-green-200',
  Completato: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  Inviato: 'bg-green-200 text-green-800 border border-green-300',
  'GA4 Da Configurare': 'bg-amber-100 text-amber-700 border border-amber-200',
  'GTM Da Configurare': 'bg-orange-100 text-orange-700 border border-orange-200',
  'GA4 Da Pubblicare': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  'GTM Da Pubblicare': 'bg-yellow-200 text-yellow-800 border border-yellow-300',
  'GTM OK': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  'GA4 OK': 'bg-green-200 text-green-800 border border-green-300',
  'Non Necessaria': 'bg-slate-200 text-slate-600 border border-slate-300',
  Sostituito: 'bg-red-100 text-red-600 border border-red-200',
};

const STEP_COLUMNS = [
  {
    key: 'step_documento_operativo',
    noteKey: 'note_step_documento_operativo',
    label: 'Documento operativo',
    mode: 'single',
    options: STEP_STATUSES_DOC,
  },
  {
    key: 'step_gtm_ga4_coll',
    noteKey: 'note_step_gtm_ga4_coll',
    label: 'GTM+GA4 - COLL',
    mode: 'multi',
    options: STEP_STATUSES_GTM_GA,
  },
  {
    key: 'step_sviluppo_testing_coll',
    noteKey: 'note_step_sviluppo_testing_coll',
    label: 'Sviluppo & Testing - COLL',
    mode: 'single',
    options: STEP_STATUSES_RILASCI,
  },
  {
    key: 'step_gtm_ga4_prod',
    noteKey: 'note_step_gtm_ga4_prod',
    label: 'GTM+GA4 - PROD',
    mode: 'multi',
    options: STEP_STATUSES_GTM_GA,
  },
  {
    key: 'step_sviluppo_testing_prod',
    noteKey: 'note_step_sviluppo_testing_prod',
    label: 'Sviluppo & Testing - PROD',
    mode: 'single',
    options: STEP_STATUSES_RILASCI,
  },
  {
    key: 'step_ga4_realtime_rilascio',
    noteKey: 'note_step_ga4_realtime_rilascio',
    label: 'Monitoraggio GA4 RealTime Rilascio',
    mode: 'single',
    options: STEP_STATUSES_DEFAULT,
  },
  {
    key: 'step_report_manutenzione',
    noteKey: 'note_step_report_manutenzione',
    label: 'Report Manutenzione',
    mode: 'single',
    options: STEP_STATUSES_REPORT,
  },
  {
    key: 'step_modello_dati',
    noteKey: 'note_step_modello_dati',
    label: 'Modello Dati',
    mode: 'single',
    options: STEP_STATUSES_REPORT,
  },
  {
    key: 'step_doc_confronto_applicativi',
    noteKey: 'note_step_doc_confronto_applicativi',
    label: 'Doc Confronto Applicativi',
    mode: 'single',
    options: STEP_STATUSES_REPORT,
  },
  {
    key: 'step_report_business',
    noteKey: 'note_step_report_business',
    label: 'Report Business',
    mode: 'single',
    options: STEP_STATUSES_REPORT,
  },
  {
    key: 'step_powerbi',
    noteKey: 'note_step_powerbi',
    label: 'PowerBI',
    mode: 'single',
    options: STEP_STATUSES_REPORT,
  },
] as const;

type StepColumn = (typeof STEP_COLUMNS)[number];
type StepColumnKey = StepColumn['key'];
type StepNoteKey = StepColumn['noteKey'];
type ModalMode = 'create' | 'edit' | null;

type StepFieldValue = string | string[];
type StepFields = Record<StepColumnKey, StepFieldValue>;
type StepNoteFields = Record<StepNoteKey, string>;

interface ClienteRecord {
  id: string;
  nome: string;
}

interface OperationalProjectRecord extends StepFields, StepNoteFields {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  applicativo: string | null;
  versione: string | null;
  nome_evolutiva: string;
  numero_change: string | null;
  document_link: string;
  created_at: string;
  updated_at: string;
}

interface FormState extends StepFields, StepNoteFields {
  cliente_id: string;
  applicativo: string;
  versione: string;
  nome_evolutiva: string;
  numero_change: string;
  document_link: string;
}

const EMPTY_FORM: FormState = {
  cliente_id: '',
  applicativo: '',
  versione: '',
  nome_evolutiva: '',
  numero_change: '',
  document_link: '',
  step_documento_operativo: 'Da Fare',
  step_gtm_ga4_coll: [],
  step_sviluppo_testing_coll: 'Da Fare',
  step_gtm_ga4_prod: [],
  step_sviluppo_testing_prod: 'Da Fare',
  step_ga4_realtime_rilascio: 'Da Fare',
  step_report_manutenzione: 'Da Fare',
  step_modello_dati: 'Da Fare',
  step_doc_confronto_applicativi: 'Da Fare',
  step_report_business: 'Da Fare',
  step_powerbi: 'Da Fare',
  note_step_documento_operativo: '',
  note_step_gtm_ga4_coll: '',
  note_step_sviluppo_testing_coll: '',
  note_step_gtm_ga4_prod: '',
  note_step_sviluppo_testing_prod: '',
  note_step_ga4_realtime_rilascio: '',
  note_step_report_manutenzione: '',
  note_step_modello_dati: '',
  note_step_doc_confronto_applicativi: '',
  note_step_report_business: '',
  note_step_powerbi: '',
};

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function parseVersion(value: string | null | undefined) {
  if (!value) return 0;
  const cleaned = value.replace(',', '.').trim();
  const n = Number.parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

function getStepBadgeClass(value: string) {
  return STATUS_STYLES[value] || STATUS_STYLES['Da Fare'];
}

function isCompletedValue(value: StepFieldValue) {
  if (Array.isArray(value)) {
    return value.includes('Completato') || (value.includes('GTM OK') && value.includes('GA4 OK'));
  }

  return value === 'Completato' || value === 'GTM OK' || value === 'GA4 OK' || value === 'Inviato';
}

function calculateCompletionPercentage(record: StepFields) {
  const total = STEP_COLUMNS.length;
  const completed = STEP_COLUMNS.filter((col) => isCompletedValue(record[col.key])).length;
  return Math.round((completed / total) * 100);
}

function renderStepSummary(value: StepFieldValue) {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Da Fare';
    return value.join(' • ');
  }
  return value || 'Da Fare';
}

function StepSelectSingle({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-xl px-3 py-2 text-[11px] font-bold outline-none ${getStepBadgeClass(
        value
      )}`}
    >
      {options.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}

function StepSelectMulti({
  values,
  options,
  onChange,
}: {
  values: string[];
  options: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const toggleValue = (option: string) => {
    if (values.includes(option)) {
      onChange(values.filter((v) => v !== option));
    } else {
      onChange([...values, option]);
    }
  };

  const summary = values.length > 0 ? values.join(' • ') : 'Seleziona stato';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full min-h-[42px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-left flex items-center justify-between gap-3 hover:border-gray-300"
      >
        <span className="text-[11px] font-bold text-slate-700 truncate">{summary}</span>
        {open ? (
          <ChevronUp size={16} className="text-slate-500 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-slate-500 shrink-0" />
        )}
      </button>

      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className={`inline-flex px-2 py-1 rounded-[8px] text-[11px] font-bold ${getStepBadgeClass(
                value
              )}`}
            >
              {value}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-xl p-2 max-h-72 overflow-auto">
          <div className="grid grid-cols-1 gap-2">
            {options.map((option) => {
              const active = values.includes(option);

              return (
                <label
                  key={option}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition ${
                    active ? getStepBadgeClass(option) : 'bg-white border-gray-200 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleValue(option)}
                    className="rounded"
                  />
                  <span className="text-xs font-semibold">{option}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectModal({
  isOpen,
  mode,
  form,
  clienti,
  isEsselunga,
  saving,
  onClose,
  onSubmit,
  onChange,
}: {
  isOpen: boolean;
  mode: 'create' | 'edit';
  form: FormState;
  clienti: ClienteRecord[];
  isEsselunga: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onChange: (patch: Partial<FormState>) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {mode === 'create' ? 'Nuovo progetto' : 'Modifica progetto'}
            </h2>
            <p className="text-xs text-slate-400">
              Gestisci evolutiva, change, documento, step e note operative
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center"
            title="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-77px)] overflow-auto p-6 space-y-8">
          <div>
            <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Nome evolutiva
            </label>
            <input
              value={form.nome_evolutiva}
              onChange={(e) => onChange({ nome_evolutiva: e.target.value })}
              placeholder="Nome evolutiva..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-2xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-slate-50/60 p-4">
            <div className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Dati principali
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Cliente
                </label>
                <select
                  value={form.cliente_id}
                  onChange={(e) =>
                    onChange({
                      cliente_id: e.target.value,
                      applicativo:
                        clienti.find((c) => c.id === e.target.value)?.nome === 'Esselunga'
                          ? form.applicativo
                          : '',
                    })
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Seleziona cliente</option>
                  {clienti.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Applicativo
                </label>
                {isEsselunga ? (
                  <select
                    value={form.applicativo}
                    onChange={(e) => onChange({ applicativo: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Seleziona applicativo</option>
                    {ESSELUNGA_APPS.map((app) => (
                      <option key={app} value={app}>
                        {app}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-3 text-xs font-bold text-slate-400">
                    Disponibile solo per Esselunga
                  </div>
                )}
              </div>

              <div>
                <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Versione
                </label>
                <input
                  value={form.versione}
                  onChange={(e) => onChange({ versione: e.target.value })}
                  placeholder="Versione"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Numero change
                </label>
                <input
                  value={form.numero_change}
                  onChange={(e) => onChange({ numero_change: e.target.value })}
                  placeholder="Change"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="md:col-span-2 xl:col-span-2">
                <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Link documento
                </label>
                <input
                  value={form.document_link}
                  onChange={(e) => onChange({ document_link: e.target.value })}
                  placeholder="Link documento"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-700">Workflow</h3>
              <p className="text-xs text-slate-400">Uno step per riga, con stato e note operative</p>
            </div>

            <div className="space-y-3">
              {STEP_COLUMNS.map((col) => (
                <div
                  key={col.key}
                  className="grid grid-cols-1 lg:grid-cols-[280px_320px_1fr] gap-3 items-start rounded-xl border border-gray-200 bg-white px-4 py-4"
                >
                  <div className="text-sm font-semibold text-slate-700 pt-2">{col.label}</div>

                  <div>
                    {col.mode === 'multi' ? (
                      <StepSelectMulti
                        values={Array.isArray(form[col.key]) ? (form[col.key] as string[]) : []}
                        options={col.options}
                        onChange={(values) =>
                          onChange({ [col.key]: values } as Partial<FormState>)
                        }
                      />
                    ) : (
                      <StepSelectSingle
                        value={typeof form[col.key] === 'string' ? (form[col.key] as string) : 'Da Fare'}
                        options={col.options}
                        onChange={(value) =>
                          onChange({ [col.key]: value } as Partial<FormState>)
                        }
                      />
                    )}
                  </div>

                  <div>
                    <textarea
                      value={form[col.noteKey]}
                      onChange={(e) =>
                        onChange({ [col.noteKey]: e.target.value } as Partial<FormState>)
                      }
                      placeholder="Aggiungi note per questo step..."
                      rows={2}
                      className="w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none resize-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
            >
              Annulla
            </button>

            <button
              type="button"
              onClick={onSubmit}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Save size={16} />
              {mode === 'create' ? 'Salva' : 'Aggiorna'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OperationalProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [clienti, setClienti] = useState<ClienteRecord[]>([]);
  const [records, setRecords] = useState<OperationalProjectRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showLatest, setShowLatest] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  const selectedCreateCliente = useMemo(
    () => clienti.find((c) => c.id === createForm.cliente_id) || null,
    [clienti, createForm.cliente_id]
  );

  const selectedEditCliente = useMemo(
    () => clienti.find((c) => c.id === editForm.cliente_id) || null,
    [clienti, editForm.cliente_id]
  );

  const isEsselungaCreate = selectedCreateCliente?.nome === 'Esselunga';
  const isEsselungaEdit = selectedEditCliente?.nome === 'Esselunga';

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;

    return records.filter((row) =>
      [
        row.cliente_nome,
        row.applicativo || '',
        row.versione || '',
        row.nome_evolutiva,
        row.numero_change || '',
        row.document_link,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [records, search]);

  const latestDocuments = useMemo(() => {
    const grouped = filteredRecords.reduce<Record<string, OperationalProjectRecord>>((acc, r) => {
      const key = `${r.cliente_nome}__${r.applicativo || 'NA'}`;
      const currentVersion = parseVersion(r.versione);
      const existingVersion = parseVersion(acc[key]?.versione);

      if (!acc[key] || currentVersion > existingVersion) {
        acc[key] = r;
      }

      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => {
      const byClient = a.cliente_nome.localeCompare(b.cliente_nome);
      if (byClient !== 0) return byClient;
      return (a.applicativo || '').localeCompare(b.applicativo || '');
    });
  }, [filteredRecords]);

  const normalizeRecord = useCallback((item: any): OperationalProjectRecord => {
    const stepValues = STEP_COLUMNS.reduce((acc, col) => {
      const raw = item[col.key];

      if (col.mode === 'multi') {
        acc[col.key] = Array.isArray(raw) ? raw : [];
      } else {
        acc[col.key] = typeof raw === 'string' && raw ? raw : 'Da Fare';
      }

      return acc;
    }, {} as StepFields);

    const stepNotes = STEP_COLUMNS.reduce((acc, col) => {
      acc[col.noteKey] = String(item[col.noteKey] || '');
      return acc;
    }, {} as StepNoteFields);

    return {
      id: item.id,
      cliente_id: item.cliente_id,
      cliente_nome: item.clienti?.nome || '—',
      applicativo: item.applicativo || null,
      versione: item.versione || null,
      nome_evolutiva: item.nome_evolutiva || '',
      numero_change: item.numero_change || null,
      document_link: item.document_link || '',
      created_at: item.created_at,
      updated_at: item.updated_at,
      ...stepValues,
      ...stepNotes,
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const [clientiRes, docsRes] = await Promise.all([
      supabase.from('clienti').select('id, nome').order('nome', { ascending: true }),
      supabase
        .from('documenti_operativi')
        .select(
          `
            id,
            cliente_id,
            applicativo,
            versione,
            nome_evolutiva,
            numero_change,
            document_link,
            created_at,
            updated_at,
            step_documento_operativo,
            step_gtm_ga4_coll,
            step_sviluppo_testing_coll,
            step_gtm_ga4_prod,
            step_sviluppo_testing_prod,
            step_ga4_realtime_rilascio,
            step_report_manutenzione,
            step_modello_dati,
            step_doc_confronto_applicativi,
            step_report_business,
            step_powerbi,
            note_step_documento_operativo,
            note_step_gtm_ga4_coll,
            note_step_sviluppo_testing_coll,
            note_step_gtm_ga4_prod,
            note_step_sviluppo_testing_prod,
            note_step_ga4_realtime_rilascio,
            note_step_report_manutenzione,
            note_step_modello_dati,
            note_step_doc_confronto_applicativi,
            note_step_report_business,
            note_step_powerbi,
            clienti:cliente_id ( nome )
          `
        )
        .order('updated_at', { ascending: false }),
    ]);

    if (clientiRes.error) {
      console.error('Errore caricamento clienti:', clientiRes.error);
      setErrorMessage('Errore durante il caricamento dei clienti.');
    } else {
      setClienti(
        (clientiRes.data || []).map((item: any) => ({
          id: item.id,
          nome: String(item.nome || '').trim(),
        }))
      );
    }

    if (docsRes.error) {
      console.error('Errore caricamento documenti operativi:', docsRes.error);
      setErrorMessage('Errore durante il caricamento dei progetti.');
    } else {
      setRecords((docsRes.data || []).map(normalizeRecord));
    }

    setLoading(false);
  }, [normalizeRecord]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = useCallback(() => {
    setCreateForm(EMPTY_FORM);
    setEditingId(null);
    setErrorMessage(null);
    setModalMode('create');
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
    setEditingId(null);
  }, []);

  const startEdit = useCallback((record: OperationalProjectRecord) => {
    setEditingId(record.id);
    setEditForm({
      cliente_id: record.cliente_id,
      applicativo: record.applicativo || '',
      versione: record.versione || '',
      nome_evolutiva: record.nome_evolutiva,
      numero_change: record.numero_change || '',
      document_link: record.document_link,
      step_documento_operativo: record.step_documento_operativo,
      step_gtm_ga4_coll: Array.isArray(record.step_gtm_ga4_coll) ? record.step_gtm_ga4_coll : [],
      step_sviluppo_testing_coll: record.step_sviluppo_testing_coll,
      step_gtm_ga4_prod: Array.isArray(record.step_gtm_ga4_prod) ? record.step_gtm_ga4_prod : [],
      step_sviluppo_testing_prod: record.step_sviluppo_testing_prod,
      step_ga4_realtime_rilascio: record.step_ga4_realtime_rilascio,
      step_report_manutenzione: record.step_report_manutenzione,
      step_modello_dati: record.step_modello_dati,
      step_doc_confronto_applicativi: record.step_doc_confronto_applicativi,
      step_report_business: record.step_report_business,
      step_powerbi: record.step_powerbi,
      note_step_documento_operativo: record.note_step_documento_operativo,
      note_step_gtm_ga4_coll: record.note_step_gtm_ga4_coll,
      note_step_sviluppo_testing_coll: record.note_step_sviluppo_testing_coll,
      note_step_gtm_ga4_prod: record.note_step_gtm_ga4_prod,
      note_step_sviluppo_testing_prod: record.note_step_sviluppo_testing_prod,
      note_step_ga4_realtime_rilascio: record.note_step_ga4_realtime_rilascio,
      note_step_report_manutenzione: record.note_step_report_manutenzione,
      note_step_modello_dati: record.note_step_modello_dati,
      note_step_doc_confronto_applicativi: record.note_step_doc_confronto_applicativi,
      note_step_report_business: record.note_step_report_business,
      note_step_powerbi: record.note_step_powerbi,
    });
    setErrorMessage(null);
    setModalMode('edit');
  }, []);

  const validateForm = useCallback((form: FormState, isEsselunga: boolean) => {
    if (!form.cliente_id) return 'Seleziona un cliente';
    if (!form.nome_evolutiva.trim()) return 'Inserisci il nome dell’evolutiva';
    if (!form.document_link.trim()) return 'Inserisci il link del documento operativo';
    if (isEsselunga && !form.applicativo.trim()) {
      return 'Seleziona l’applicativo per Esselunga';
    }
    return null;
  }, []);

  const getStepPayload = useCallback((form: FormState) => {
    const stepPayload = STEP_COLUMNS.reduce((acc, col) => {
      acc[col.key] = form[col.key];
      return acc;
    }, {} as StepFields);

    const notesPayload = STEP_COLUMNS.reduce((acc, col) => {
      acc[col.noteKey] = form[col.noteKey];
      return acc;
    }, {} as StepNoteFields);

    return {
      ...stepPayload,
      ...notesPayload,
    };
  }, []);

  const handleCreate = useCallback(async () => {
    const validationError = validateForm(createForm, isEsselungaCreate);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      const payload = {
        cliente_id: createForm.cliente_id,
        applicativo: isEsselungaCreate ? createForm.applicativo.trim() || null : null,
        versione: createForm.versione.trim() || null,
        nome_evolutiva: createForm.nome_evolutiva.trim(),
        numero_change: createForm.numero_change.trim() || null,
        document_link: normalizeUrl(createForm.document_link),
        ...getStepPayload(createForm),
      };

      const { data, error } = await supabase
        .from('documenti_operativi')
        .insert(payload)
        .select(
          `
            id,
            cliente_id,
            applicativo,
            versione,
            nome_evolutiva,
            numero_change,
            document_link,
            created_at,
            updated_at,
            step_documento_operativo,
            step_gtm_ga4_coll,
            step_sviluppo_testing_coll,
            step_gtm_ga4_prod,
            step_sviluppo_testing_prod,
            step_ga4_realtime_rilascio,
            step_report_manutenzione,
            step_modello_dati,
            step_doc_confronto_applicativi,
            step_report_business,
            step_powerbi,
            note_step_documento_operativo,
            note_step_gtm_ga4_coll,
            note_step_sviluppo_testing_coll,
            note_step_gtm_ga4_prod,
            note_step_sviluppo_testing_prod,
            note_step_ga4_realtime_rilascio,
            note_step_report_manutenzione,
            note_step_modello_dati,
            note_step_doc_confronto_applicativi,
            note_step_report_business,
            note_step_powerbi,
            clienti:cliente_id ( nome )
          `
        )
        .single();

      if (error) {
        console.error('Errore creazione progetto:', error);
        setErrorMessage('Errore durante il salvataggio del progetto.');
        return;
      }

      setRecords((prev) => [normalizeRecord(data), ...prev]);
      closeModal();
      setCreateForm(EMPTY_FORM);
    } catch (err) {
      console.error('Errore handleCreate:', err);
      setErrorMessage('Errore imprevisto durante il salvataggio.');
    } finally {
      setSaving(false);
    }
  }, [closeModal, createForm, getStepPayload, isEsselungaCreate, normalizeRecord, validateForm]);

  const handleUpdate = useCallback(async () => {
    if (!editingId) return;

    const validationError = validateForm(editForm, isEsselungaEdit);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      const payload = {
        cliente_id: editForm.cliente_id,
        applicativo: isEsselungaEdit ? editForm.applicativo.trim() || null : null,
        versione: editForm.versione.trim() || null,
        nome_evolutiva: editForm.nome_evolutiva.trim(),
        numero_change: editForm.numero_change.trim() || null,
        document_link: normalizeUrl(editForm.document_link),
        updated_at: new Date().toISOString(),
        ...getStepPayload(editForm),
      };

      const { data, error } = await supabase
        .from('documenti_operativi')
        .update(payload)
        .eq('id', editingId)
        .select(
          `
            id,
            cliente_id,
            applicativo,
            versione,
            nome_evolutiva,
            numero_change,
            document_link,
            created_at,
            updated_at,
            step_documento_operativo,
            step_gtm_ga4_coll,
            step_sviluppo_testing_coll,
            step_gtm_ga4_prod,
            step_sviluppo_testing_prod,
            step_ga4_realtime_rilascio,
            step_report_manutenzione,
            step_modello_dati,
            step_doc_confronto_applicativi,
            step_report_business,
            step_powerbi,
            note_step_documento_operativo,
            note_step_gtm_ga4_coll,
            note_step_sviluppo_testing_coll,
            note_step_gtm_ga4_prod,
            note_step_sviluppo_testing_prod,
            note_step_ga4_realtime_rilascio,
            note_step_report_manutenzione,
            note_step_modello_dati,
            note_step_doc_confronto_applicativi,
            note_step_report_business,
            note_step_powerbi,
            clienti:cliente_id ( nome )
          `
        )
        .single();

      if (error) {
        console.error('Errore aggiornamento progetto:', error);
        setErrorMessage('Errore durante l’aggiornamento del progetto.');
        return;
      }

      setRecords((prev) => prev.map((row) => (row.id === editingId ? normalizeRecord(data) : row)));
      closeModal();
    } catch (err) {
      console.error('Errore handleUpdate:', err);
      setErrorMessage('Errore imprevisto durante l’aggiornamento.');
    } finally {
      setSaving(false);
    }
  }, [closeModal, editForm, editingId, getStepPayload, isEsselungaEdit, normalizeRecord, validateForm]);

  const handleDelete = useCallback(async (recordId: string) => {
    try {
      setSaving(true);
      setErrorMessage(null);

      const { error } = await supabase.from('documenti_operativi').delete().eq('id', recordId);

      if (error) {
        console.error('Errore eliminazione progetto:', error);
        setErrorMessage('Errore durante l’eliminazione del progetto.');
        return;
      }

      setRecords((prev) => prev.filter((row) => row.id !== recordId));
    } catch (err) {
      console.error('Errore handleDelete:', err);
      setErrorMessage('Errore imprevisto durante l’eliminazione.');
    } finally {
      setSaving(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFB] p-4 md:p-8">
        <div className="max-w-[2200px] mx-auto">
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-sm font-bold text-slate-400">Caricamento progetti...</div>
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
            <h1
              className="text-4xl font-black tracking-tighter flex items-center gap-3"
              style={{ color: BRAND }}
            >
              PROGETTI OPERATIVI
            </h1>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.3em]"
              style={{ color: BRAND_SOFT_TEXT }}
            >
              Archivio documenti, evolutive, change e avanzamento step
            </p>
          </div>

          <div className="flex gap-2 flex-wrap w-full lg:w-auto">
            <div className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white border border-gray-100 text-[12px] font-bold outline-none w-full lg:w-80 shadow-sm">
              <Search size={15} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca cliente / evolutiva / change..."
                className="bg-transparent outline-none w-full text-[12px] font-bold text-slate-700 placeholder:text-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="h-11 w-11 rounded-[10px] text-white flex items-center justify-center shadow-sm"
              style={{ background: BRAND }}
              title="Aggiungi progetto"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-[10px] border px-4 py-3 text-sm font-bold text-red-700 bg-red-50 border-red-200">
            {errorMessage}
          </div>
        )}

        <div className="mb-6 bg-white border border-gray-200 rounded-[10px] shadow-sm">
          <button
            type="button"
            onClick={() => setShowLatest((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <ExternalLink size={16} style={{ color: BRAND }} />
              <span className="text-xs font-black uppercase" style={{ color: BRAND }}>
                Ultimi documenti consegnati
              </span>
            </div>

            {showLatest ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showLatest && (
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-3">
                {latestDocuments.length > 0 ? (
                  latestDocuments.map((r) => (
                    <a
                      key={r.id}
                      href={r.document_link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-[10px] border border-gray-200 bg-white text-xs font-bold text-slate-600 hover:text-white"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = BRAND;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white';
                      }}
                    >
                      <ExternalLink size={14} />
                      {r.cliente_nome}
                      {r.applicativo ? ` - ${r.applicativo}` : ''}
                      {r.versione ? ` (v${r.versione})` : ''}
                    </a>
                  ))
                ) : (
                  <div className="text-sm font-bold text-slate-400">Nessun documento disponibile</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead style={{ background: BRAND_BG, color: BRAND }}>
                <tr>
                  <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                    Cliente
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                    Applicativo
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                    Versione
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                    Nome evolutiva
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                    Numero change
                  </th>
                  <th className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest">
                    Documento
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                    % completamento
                  </th>
                  <th className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-widest">
                    Azioni
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record) => {
                  const completion = calculateCompletionPercentage(record);

                  return (
                    <tr key={record.id} className="border-t border-gray-100 hover:bg-slate-50 align-top">
                      <td className="px-4 py-4 text-slate-700 font-bold">{record.cliente_nome}</td>
                      <td className="px-4 py-4 text-slate-700 font-bold">{record.applicativo || '—'}</td>
                      <td className="px-4 py-4 text-slate-700 font-bold">{record.versione || '—'}</td>
                      <td className="px-4 py-4">
                        <div className="font-black text-slate-800 leading-tight">{record.nome_evolutiva}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-700 font-bold">{record.numero_change || '—'}</td>

                      <td className="px-4 py-4 text-center">
                        <a
                          href={record.document_link}
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
                          title="Apri documento"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </td>

                      <td className="px-4 py-4 min-w-[180px]">
                        <div className="flex items-center gap-3">
                          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${completion}%`,
                                background: BRAND,
                              }}
                            />
                          </div>
                          <span className="text-sm font-black text-slate-700 min-w-[42px]">
                            {completion}%
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(record)}
                            className="h-10 w-10 rounded-[10px] text-white flex items-center justify-center"
                            style={{ background: BRAND }}
                            title="Modifica"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(record.id)}
                            className="h-10 w-10 rounded-[10px] bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
                            title="Elimina"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400 font-bold">
                      Nessun progetto salvato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <ProjectModal
          isOpen={modalMode === 'create'}
          mode="create"
          form={createForm}
          clienti={clienti}
          isEsselunga={Boolean(isEsselungaCreate)}
          saving={saving}
          onClose={closeModal}
          onSubmit={handleCreate}
          onChange={(patch) => setCreateForm((prev) => ({ ...prev, ...patch }))}
        />

        <ProjectModal
          isOpen={modalMode === 'edit'}
          mode="edit"
          form={editForm}
          clienti={clienti}
          isEsselunga={Boolean(isEsselungaEdit)}
          saving={saving}
          onClose={closeModal}
          onSubmit={handleUpdate}
          onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
        />
      </div>
    </div>
  );
}