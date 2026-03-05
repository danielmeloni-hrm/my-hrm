'use client';

import React, { useEffect, useMemo, useState, use } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type ChangeRow = {
  id: string;

  change_id: string;
  tipo_change: 'Regressione' | 'Impattante' | 'Richiesta dal Business' | 'Non_impattante' | '' | null;

  // in tabella supabase: applicativo è array? nel tuo dashboard lo usi come array
  applicativo: string[] | null;

  breve_descrizione: string | null;
  stato: 'In Attesa' | 'In Collaudo' | 'In Produzione' | 'In Produzione + Regressione' | 'Annullata' | string | null;


  rilascio_in_collaudo: string | null; // se invece usi questo, lo mostriamo comunque
  rilascio_in_produzione: string | null;

  ticket_analisi: boolean | null;
  ticket_test: boolean | null;
  ticket_rilascio: boolean | null;

  note_hrm: string | null;
  note_sviluppatori: string | null;

  // eventuali campi extra: non rompono il form
  [key: string]: any;
};

const BRAND = '#0150a0';
const BRAND_BG = '#eaf2fb';

const APPLICATIVI_OPTIONS = ['APPECOM', 'ECOM35', 'EOL', 'ESB', 'IST35', 'GCW', 'Parafarmacia'] as const;
const TIPO_CHANGE_OPTIONS = ['Regressione', 'Impattante', 'Richiesta dal Business', 'Non_impattante'] as const;
const STATO_OPTIONS = ['In Attesa', 'In Collaudo', 'In Produzione', 'In Produzione + Regressione', 'Annullata'] as const;

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(' ');
}

function safeStr(v: any) {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function toISODateOrEmpty(v: any) {
  const s = safeStr(v).trim();
  // se è già yyyy-mm-dd ok, altrimenti prova Date()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function EditChange({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const id = params.id;

  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ChangeRow>({
    id: '',
    change_id: '',
    tipo_change: '',
    applicativo: [],
    breve_descrizione: '',
    stato: 'In Attesa',
    rilascio_in_collaudo: '',
    rilascio_in_produzione: '',
    ticket_analisi: false,
    ticket_test: false,
    ticket_rilascio: false,
    note_hrm: '',
    note_sviluppatori: '',
  });

  useEffect(() => {
    let mounted = true;

    async function loadChange() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.from('changes').select('*').eq('id', id).single();

      if (!mounted) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // normalizzazioni minimali
      const row = data as ChangeRow;
      const apps = Array.isArray(row.applicativo) ? row.applicativo : [];

      setFormData({
        ...row,
        applicativo: apps,
        change_id: safeStr(row.change_id),
        breve_descrizione: safeStr(row.breve_descrizione),
        note_hrm: safeStr(row.note_hrm),
        note_sviluppatori: safeStr(row.note_sviluppatori),
    
        rilascio_in_collaudo: toISODateOrEmpty(row.rilascio_in_collaudo),
        rilascio_in_produzione: toISODateOrEmpty(row.rilascio_in_produzione),
        tipo_change: (row.tipo_change || '') as any,
        stato: (row.stato || 'In Attesa') as any,
        ticket_analisi: Boolean(row.ticket_analisi),
        ticket_test: Boolean(row.ticket_test),
        ticket_rilascio: Boolean(row.ticket_rilascio),
      });

      setLoading(false);
    }

    loadChange();
    return () => {
      mounted = false;
    };
  }, [id, supabase]);

  const toggleApp = (app: string) => {
    setFormData((p) => {
      const cur = Array.isArray(p.applicativo) ? p.applicativo : [];
      const next = cur.includes(app) ? cur.filter((x) => x !== app) : [...cur, app];
      return { ...p, applicativo: next };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
  e.preventDefault();
  setSaving(true);

  // ✅ NON scrivere "ticket" nel DB (causa errore)
  const { ticket, ...rest } = formData as any; // se ticket esiste in formData, lo escludiamo

  const { error } = await supabase
    .from("changes")
    .update({
      ...rest,
      // ✅ assicurati di salvare i flag
      ticket_analisi: Boolean(formData.ticket_analisi),
      ticket_test: Boolean(formData.ticket_test),
      ticket_rilascio: Boolean(formData.ticket_rilascio),
      // ✅ se applicativo è array:
      applicativo: Array.isArray(formData.applicativo) ? formData.applicativo : [],
    })
    .eq("id", id);

  if (error) {
    alert("Errore: " + error.message);
  } else {
    router.refresh();
  }
  setSaving(false);
};

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-5xl mx-auto bg-white rounded-[28px] border border-slate-100 shadow-sm p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-slate-100 rounded-xl" />
            <div className="h-4 w-96 bg-slate-100 rounded-xl" />
            <div className="h-40 bg-slate-100 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Top bar */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.35em]" style={{ color: `${BRAND}AA` }}>
              Change Management
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">Modifica Change</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-xs font-black rounded-full px-3 py-1 border shadow-sm bg-white"
              style={{ borderColor: `${BRAND}22`, color: BRAND }}
              title="Change ID"
            >
              {formData.change_id || '—'}
            </span>

            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase border border-slate-200 bg-white hover:bg-slate-50 transition"
            >
              Annulla
            </button>

            <button
              form="edit-change-form"
              type="submit"
              disabled={saving}
              className={cn(
                'px-5 py-2 rounded-xl text-xs font-black uppercase text-white transition shadow-sm',
                saving ? 'bg-slate-400' : 'hover:opacity-95'
              )}
              style={{ background: BRAND }}
            >
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <b>Errore:</b> {error}
          </div>
        ) : null}

        <form id="edit-change-form" onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: main */}
          <div className="lg:col-span-2 space-y-6">
            <Card title="Dettagli" subtitle="Dati principali della change">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Change ID" hint="Identificativo (sola lettura)">
                  <input
                    type="text"
                    value={formData.change_id}
                    disabled
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-mono text-slate-700 outline-none"
                  />
                </Field>

                <Field label="Tipo Change">
                  <select
                    value={formData.tipo_change || ''}
                    onChange={(e) => setFormData((p) => ({ ...p, tipo_change: e.target.value as any }))}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:ring-2"
                    style={{ boxShadow: `0 0 0 0 ${BRAND}` }}
                  >
                    <option value="">—</option>
                    {TIPO_CHANGE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Stato">
                  <select
                    value={formData.stato || ''}
                    onChange={(e) => setFormData((p) => ({ ...p, stato: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-800 outline-none"
                  >
                    {STATO_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Applicativi" hint="Selezione multipla">
                  <div className="flex flex-wrap gap-2">
                    {APPLICATIVI_OPTIONS.map((app) => {
                      const active = (formData.applicativo || []).includes(app);
                      return (
                        <button
                          type="button"
                          key={app}
                          onClick={() => toggleApp(app)}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-[10px] font-black uppercase border transition',
                            active ? 'text-white' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          )}
                          style={active ? { background: BRAND, borderColor: `${BRAND}55` } : {}}
                        >
                          {app}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <div className="md:col-span-2">
                  <Field label="Breve descrizione" hint="Una riga, concisa e chiara">
                    <textarea
                      rows={3}
                      value={formData.breve_descrizione || ''}
                      onChange={(e) => setFormData((p) => ({ ...p, breve_descrizione: e.target.value }))}
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                      placeholder="Scrivi una descrizione breve…"
                    />
                  </Field>
                </div>
              </div>
            </Card>

            <Card title="Note" subtitle="Informazioni extra e commenti">
              <div className="grid grid-cols-1 gap-4">
                <Field label="Note HRM (note_hrm)">
                  <textarea
                    rows={3}
                    value={formData.note_hrm || ''}
                    onChange={(e) => setFormData((p) => ({ ...p, note_hrm: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                    placeholder="Note HRM…"
                  />
                </Field>

                <Field label="Note sviluppatori (note_sviluppatori)">
                  <textarea
                    rows={4}
                    value={formData.note_sviluppatori || ''}
                    onChange={(e) => setFormData((p) => ({ ...p, note_sviluppatori: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                    placeholder="Note tecniche…"
                  />
                </Field>
              </div>
            </Card>
          </div>

          {/* RIGHT: sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card title="Checklist" subtitle="Flag documentali">
              <div className="flex items-center gap-3">
                <TicketSquare
                  label="A"
                  title="Ticket Analisi"
                  active={Boolean(formData.ticket_analisi)}
                  color="green"
                  onClick={() => setFormData((p) => ({ ...p, ticket_analisi: !Boolean(p.ticket_analisi) }))}
                />
                <TicketSquare
                  label="T"
                  title="Ticket Test"
                  active={Boolean(formData.ticket_test)}
                  color="blue"
                  onClick={() => setFormData((p) => ({ ...p, ticket_test: !Boolean(p.ticket_test) }))}
                />
                <TicketSquare
                  label="R"
                  title="Ticket Rilascio"
                  active={Boolean(formData.ticket_rilascio)}
                  color="purple"
                  onClick={() => setFormData((p) => ({ ...p, ticket_rilascio: !Boolean(p.ticket_rilascio) }))}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Anteprima campo Ticket</div>
                <div className="mt-1 text-xs font-bold text-slate-700">
                  {[
                    formData.ticket_analisi ? "Ticket Analisi" : null,
                    formData.ticket_test ? "Ticket Test" : null,
                    formData.ticket_rilascio ? "Ticket Rilascio" : null,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </div>
              </div>
            </Card>

            <Card title="Rilasci" subtitle="Collaudo e Produzione">
            <div className="grid grid-cols-1 gap-4">
              <Field label="Rilascio in collaudo">
                <input
                  type="date"
                  value={formData.rilascio_in_collaudo || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, rilascio_in_collaudo: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl bg-amber-50 border border-amber-100 text-sm font-mono text-amber-800 outline-none"
                />
              </Field>

              <Field label="Rilascio in produzione">
                <input
                  type="date"
                  value={formData.rilascio_in_produzione || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, rilascio_in_produzione: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-sm font-mono text-emerald-800 outline-none"
                />
              </Field>
            </div>
          </Card>


            <div className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: `${BRAND}AA` }}>
                Suggerimento
              </div>
              <div className="mt-2 text-sm text-slate-700 leading-relaxed">
                Se <b>applicativo</b> è un array in Supabase, questa UI ti permette selezione multipla senza rischio di typo.
              </div>
              <div className="mt-4 h-[1px] bg-slate-100" />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase border border-slate-200 bg-white hover:bg-slate-50 transition"
                >
                  Indietro
                </button>
                <button
                  form="edit-change-form"
                  type="submit"
                  disabled={saving}
                  className={cn('flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase text-white transition', saving ? 'bg-slate-400' : '')}
                  style={!saving ? { background: BRAND } : {}}
                >
                  {saving ? '...' : 'Salva'}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Debug: campi extra (solo visual) */}
        <div className="mt-6 text-[11px] text-slate-400">
          <span className="font-bold">Nota:</span> se in Supabase esistono altri campi nella riga, non vengono persi: vengono mantenuti nel payload
          grazie a <code className="px-1 py-0.5 bg-slate-100 rounded">...formData</code>.
        </div>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-slate-100 bg-white shadow-sm">
      <div className="px-6 pt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-sm font-black text-slate-900">{title}</div>
            {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
          </div>
          <div className="h-10 w-10 rounded-2xl" style={{ background: BRAND_BG }} />
        </div>
      </div>
      <div className="px-6 pb-6 pt-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
        {hint ? <div className="text-[10px] text-slate-400">{hint}</div> : null}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  color: 'green' | 'blue' | 'purple';
}) {
  const accent =
    color === 'green' ? 'accent-green-600' : color === 'blue' ? 'accent-blue-600' : 'accent-purple-600';

  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 cursor-pointer hover:bg-slate-100/60 transition">
      <div className="min-w-0">
        <div className="text-xs font-black text-slate-800 truncate">{label}</div>
        <div className="text-[10px] text-slate-500">Toggle</div>
      </div>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className={cn('w-5 h-5 cursor-pointer', accent)}
      />
    </label>
  );
}

function TicketSquare({
  label,
  title,
  active,
  color,
  onClick,
}: {
  label: string;
  title: string;
  active: boolean;
  color: "green" | "blue" | "purple";
  onClick: () => void;
}) {
  const palette =
    color === "green"
      ? { bg: "bg-green-500", border: "border-green-200", soft: "bg-green-50 text-green-700" }
      : color === "blue"
      ? { bg: "bg-blue-500", border: "border-blue-200", soft: "bg-blue-50 text-blue-700" }
      : { bg: "bg-purple-500", border: "border-purple-200", soft: "bg-purple-50 text-purple-700" };

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "w-10 h-10 rounded-xl border-2 flex items-center justify-center font-black text-sm transition-all",
        active ? `${palette.bg} border-transparent text-white shadow-sm` : `bg-white ${palette.border} text-slate-300 hover:${palette.soft}`
      )}
    >
      {label}
    </button>
  );
}