'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import {
  ArrowLeft,
  ChevronRight,
  Search,
  Settings2,
  Eye,
  EyeOff,
  FilterX,
  AlertTriangle,
  Pin,
  PinOff,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  APPLICATIVI_LIST,
  PRIORITA_LIST,
  ATTIVITA_LIST,
  SPRINT_LIST,
  STATO_TICKET_LIST,
  type Ticket,
} from '@/components/parametri_ticket/attivita';

type ColumnConfig = {
  id: string;
  label: string;
  visible: boolean;
  pinned: boolean;
};

type Profilo = {
  id: string;
  nome_completo: string;
};

type Cliente = {
  id: string;
  nome: string;
};

type TicketRow = Ticket & {
  clienti?: Cliente | null;
  profili?: Profilo | null;
  numero_ore?: number;
};

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'n_tag', label: 'N° Tag', visible: true, pinned: false },
  { id: 'numero_storia', label: 'N° Storia', visible: true, pinned: false },
  { id: 'titolo', label: 'Titolo', visible: true, pinned: false },
  { id: 'priorita', label: 'Priorità', visible: true, pinned: false },
  { id: 'stato', label: 'Stato', visible: true, pinned: false },
  { id: 'progress', label: 'Avanzamento %', visible: true, pinned: false },
  { id: 'assignee', label: 'Assegnatario', visible: true, pinned: false },
  { id: 'applicativo', label: 'App', visible: true, pinned: false },
  { id: 'tipo_di_attivita', label: 'Attività', visible: true, pinned: false },
  { id: 'cliente', label: 'Cliente', visible: true, pinned: false },
  { id: 'sprint', label: 'Sprint', visible: true, pinned: false },
  { id: 'rilascio_in_collaudo', label: 'Rilascio Collaudo', visible: true, pinned: false },
  { id: 'rilascio_in_produzione', label: 'Rilascio Produzione', visible: true, pinned: false },
  { id: 'data_apertura_attivita', label: 'Apertura Attività', visible: true, pinned: false },
  { id: 'data_chiusura_attivita', label: 'Chiusura Attività', visible: true, pinned: false },
  { id: 'ultimo_ping', label: 'Ultimo Ping', visible: true, pinned: false },
  { id: 'numero_ore', label: 'N° Ore', visible: true, pinned: false },
];

const getColWidthValue = (id: string) => {
  switch (id) {
    case 'titolo':
      return 400;
    case 'stato':
      return 180;
    case 'tipo_di_attivita':
      return 180;
    case 'n_tag':
      return 130;
    case 'progress':
      return 150;
    case 'cliente':
      return 140;
    case 'assignee':
      return 140;
    case 'ultimo_ping':
      return 120;
    case 'numero_ore':
      return 110;
    default:
      return 130;
  }
};

const getColWidthClass = (id: string) => {
  switch (id) {
    case 'titolo':
      return 'min-w-[400px]';
    case 'stato':
      return 'min-w-[180px]';
    case 'tipo_di_attivita':
      return 'min-w-[180px]';
    case 'n_tag':
      return 'min-w-[130px]';
    case 'progress':
      return 'min-w-[150px]';
    case 'cliente':
      return 'min-w-[140px]';
    case 'assignee':
      return 'min-w-[140px]';
    case 'ultimo_ping':
      return 'min-w-[120px]';
    case 'numero_ore':
      return 'min-w-[110px]';
    default:
      return 'min-w-[130px]';
  }
};

const normalizeColumns = (cols: ColumnConfig[]) => {
  const pinned = cols.filter((c) => c.pinned);
  const unpinned = cols.filter((c) => !c.pinned);
  return [...pinned, ...unpinned];
};

const mergeColumnConfig = (
  defaults: ColumnConfig[],
  saved?: ColumnConfig[] | null
): ColumnConfig[] => {
  if (!saved?.length) return defaults;

  const savedMap = new Map(saved.map((col) => [col.id, col]));
  const merged = defaults.map((def) => ({
    ...def,
    ...(savedMap.get(def.id) || {}),
  }));

  return normalizeColumns(merged);
};

type SortableColumnItemProps = {
  col: ColumnConfig;
  onToggleColumn: (id: string) => void;
  onTogglePinColumn: (id: string) => void;
};

function SortableColumnItem({
  col,
  onToggleColumn,
  onTogglePinColumn,
}: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: col.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
        col.visible
          ? 'bg-white border-slate-200'
          : 'bg-slate-50 border-transparent opacity-50'
      } ${isDragging ? 'opacity-60 shadow-lg scale-[0.98] z-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleColumn(col.id)}
          className="flex items-center gap-2 text-[10px] font-bold uppercase"
        >
          {col.visible ? (
            <Eye size={12} className="text-blue-500" />
          ) : (
            <EyeOff size={12} />
          )}
          {col.label}
        </button>

        <button
          type="button"
          onClick={() => onTogglePinColumn(col.id)}
          className={`p-1 rounded hover:bg-slate-100 ${
            col.pinned ? 'text-amber-500' : 'text-slate-400'
          }`}
          title={col.pinned ? 'Sblocca colonna' : 'Blocca colonna'}
        >
          {col.pinned ? <Pin size={12} /> : <PinOff size={12} />}
        </button>
      </div>

      <button
        type="button"
        {...attributes}
        {...listeners}
        className="px-2 py-1 text-[9px] font-bold uppercase text-slate-400 rounded hover:bg-slate-100 cursor-grab active:cursor-grabbing"
        title="Trascina"
      >
        Drag
      </button>
    </div>
  );
}

export default function StoricoTicketPage() {
  const supabase = useMemo(() => createClient(), []);

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showConfig, setShowConfig] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCliente, setSelectedCliente] = useState('');
  const [selectedAssegnatario, setSelectedAssegnatario] = useState('');
  const [selectedSprint, setSelectedSprint] = useState('');
  const [selectedAttivita, setSelectedAttivita] = useState('');
  const [filterAttenzioneBusiness, setFilterAttenzioneBusiness] = useState(false);
  const [selectedStato, setSelectedStato] = useState('');

  const [listaAssegnatari, setListaAssegnatari] = useState<Profilo[]>([]);
  const [listaClienti, setListaClienti] = useState<Cliente[]>([]);
  async function fetchTagHoursMap(): Promise<Record<string, number>> {
  const sheetId = '1HrbA7vxZOuCK2bR6XQIy5nq4fVJhYh-SYsmDVGUGbco';
  const gid = '1523798548';
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?gid=${gid}&tqx=out:json`;

  const res = await fetch(url);
  const text = await res.text();

  const jsonText = text.substring(47, text.length - 2);
  const data = JSON.parse(jsonText);

  const rows = data?.table?.rows || [];
  const tagHoursMap: Record<string, number> = {};

  const normalizeNumber = (value: unknown) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return 0;
  };

  for (const row of rows) {
    const tag = row?.c?.[0]?.v?.toString()?.trim();
    const hours = normalizeNumber(row?.c?.[1]?.v);

    if (!tag) continue;

    tagHoursMap[tag] = (tagHoursMap[tag] || 0) + hours;
  }

  return tagHoursMap;
}
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({
    key: 'n_tag',
    direction: 'desc',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        key,
        direction: 'asc',
      };
    });
  };

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
            setCurrentUserId(user.id);
            setSelectedAssegnatario(user.id);

            const { data: profilo, error: profiloError } = await supabase
              .from('profili')
              .select('all_ticket_settings_colonne')
              .eq('id', user.id)
              .single();

            if (profiloError) throw profiloError;

            setColumnOrder(
              mergeColumnConfig(DEFAULT_COLUMNS, profilo?.all_ticket_settings_colonne)
            );
          } else {
            setColumnOrder(DEFAULT_COLUMNS);
          }

        const [tRes, pRes, cRes, tagHoursMap] = await Promise.all([
            supabase
              .from('ticket')
              .select('*, clienti:cliente_id(id, nome), profili:assignee(id, nome_completo)')
              .order('ultimo_ping', { ascending: false })
              .eq('tipologia_ticket', 'Attività'),
            supabase.from('profili').select('id, nome_completo'),
            supabase.from('clienti').select('id, nome'),
            fetchTagHoursMap(),
          ]);

        if (tRes.error) throw tRes.error;
        if (pRes.error) throw pRes.error;
        if (cRes.error) throw cRes.error;

        const ticketsWithHours: TicketRow[] = ((tRes.data as TicketRow[]) || []).map((ticket) => ({
      ...ticket,
      numero_ore: ticket.n_tag ? tagHoursMap[ticket.n_tag] || 0 : 0,
    }));

    setTickets(ticketsWithHours);
        setListaAssegnatari((pRes.data as Profilo[]) || []);
        setListaClienti((cRes.data as Cliente[]) || []);
      } catch (err: any) {
        setError(err.message || 'Errore durante il caricamento');
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [supabase]);

  const handleUpdate = async (id: string, field: string, value: any) => {
    const updatePayload: Record<string, any> = { [field]: value };

    const { error } = await supabase.from('ticket').update(updatePayload).eq('id', id);

    if (!error) {
  const [{ data }, tagHoursMap] = await Promise.all([
    supabase
      .from('ticket')
      .select('*, clienti:cliente_id(id, nome), profili:assignee(id, nome_completo)')
      .eq('id', id)
      .eq('tipologia_ticket', 'Attività')
      .single(),
    fetchTagHoursMap(),
  ]);

  if (data) {
    const updatedTicket = data as TicketRow;

    setTickets((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...updatedTicket,
              numero_ore: updatedTicket.n_tag
                ? tagHoursMap[updatedTicket.n_tag] || 0
                : 0,
            }
          : t
      )
    );
  }
}}

  const saveUserSettings = async (newConfig: ColumnConfig[]) => {
    setColumnOrder(newConfig);

    if (currentUserId) {
      await supabase
        .from('profili')
        .update({ all_ticket_settings_colonne: newConfig })
        .eq('id', currentUserId);
    }
  };

  const toggleColumn = (id: string) => {
    const newConfig = columnOrder.map((col) =>
      col.id === id ? { ...col, visible: !col.visible } : col
    );
    saveUserSettings(normalizeColumns(newConfig));
  };

  const togglePinColumn = (id: string) => {
    const updated = columnOrder.map((col) =>
      col.id === id ? { ...col, pinned: !col.pinned } : col
    );
    saveUserSettings(normalizeColumns(updated));
  };

  const formatDateOnly = (value?: string | null) => {
    if (!value) return '-';
    return value.slice(0, 10).split('-').reverse().join('/');
  };

  const filteredTickets = useMemo(() => {
    let data = tickets.filter((t) => {
      const matchesSearch =
        t.titolo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.n_tag?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCliente = selectedCliente === '' || String(t.cliente_id) === selectedCliente;
      const matchesAssegnatario =
        selectedAssegnatario === '' || String(t.assignee) === selectedAssegnatario;

      const matchesStato =
        selectedStato === '' ? t.stato !== 'Completato' : t.stato === selectedStato;

      const matchesSprint = selectedSprint === '' || t.sprint === selectedSprint;
      const matchesAttivita = selectedAttivita === '' || t.tipo_di_attivita === selectedAttivita;
      const matchesAttenzione =
        !filterAttenzioneBusiness || t.stato === 'Attenzione Business';

      return (
        matchesSearch &&
        matchesCliente &&
        matchesAssegnatario &&
        matchesStato &&
        matchesSprint &&
        matchesAttivita &&
        matchesAttenzione
      );
    });

    if (sortConfig.key) {
      const key = sortConfig.key;

      data = [...data].sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (key) {
          case 'progress':
            aVal = Number(a.percentuale_avanzamento) || 0;
            bVal = Number(b.percentuale_avanzamento) || 0;
            break;
          case 'cliente':
            aVal = a.clienti?.nome?.toLowerCase() || '';
            bVal = b.clienti?.nome?.toLowerCase() || '';
            break;
          case 'assignee':
            aVal = a.profili?.nome_completo?.toLowerCase() || '';
            bVal = b.profili?.nome_completo?.toLowerCase() || '';
            break;
          default:
            aVal = (a as any)[key];
            bVal = (b as any)[key];
        }

        if (aVal === bVal) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        const modifier = sortConfig.direction === 'asc' ? 1 : -1;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * modifier;
        }

        return (
          String(aVal).localeCompare(String(bVal), undefined, {
            numeric: true,
            sensitivity: 'base',
          }) * modifier
        );
      });
    }

    return data;
  }, [
    tickets,
    searchTerm,
    selectedCliente,
    selectedAssegnatario,
    selectedSprint,
    selectedAttivita,
    selectedStato,
    filterAttenzioneBusiness,
    sortConfig,
  ]);

  const getUrl = (url: string) => (url.startsWith('http') ? url : `https://${url}`);

  const visibleColumns = columnOrder.filter((c) => c.visible);

  const pinnedOffsets = useMemo(() => {
    let offset = 0;
    const result: Record<string, number> = {};

    for (const col of visibleColumns) {
      if (col.pinned) {
        result[col.id] = offset;
        offset += getColWidthValue(col.id);
      }
    }

    return result;
  }, [visibleColumns]);

  const getStickyStyles = (col: ColumnConfig, isHeader = false) => {
    if (!col.pinned) return {};

    return {
      position: 'sticky' as const,
      left: `${pinnedOffsets[col.id] || 0}px`,
      zIndex: isHeader ? 30 : 20,
      backgroundColor: isHeader ? 'rgb(248 250 252 / 0.95)' : 'white',
      boxShadow: '1px 0 0 rgb(226 232 240)',
    };
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCliente('');
    setSelectedAssegnatario('');
    setSelectedStato('');
    setSelectedSprint('');
    setSelectedAttivita('');
    setFilterAttenzioneBusiness(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = columnOrder.findIndex((col) => col.id === active.id);
    const newIndex = columnOrder.findIndex((col) => col.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const activeCol = columnOrder[oldIndex];
    const overCol = columnOrder[newIndex];

    if (activeCol.pinned !== overCol.pinned) return;

    const reordered = arrayMove(columnOrder, oldIndex, newIndex);
    saveUserSettings(reordered);
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#FDFDFD] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Inizializzazione Sistema
        </span>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-red-600 font-semibold">Errore: {error}</div>;
  }

  return (
    <div className="p-4 md:p-8 bg-[#FAFBFC] min-h-screen text-slate-900 font-sans">
      <header className="max-w-[1600px] mx-auto mb-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            

            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
              Database <span className="text-slate-400 font-light italic">Attività</span>
            </h1>

            <p className="mt-2 text-sm font-semibold text-slate-500">
              Numero Attività = <span className="text-slate-900">{filteredTickets.length}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={15}
              />
              <input
                type="text"
                placeholder="Cerca..."
                className="pl-9 pr-4 py-2 bg-slate-50 border-transparent rounded-xl text-sm w-40 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-10 bg-slate-50 p-1 rounded-xl border border-slate-100">
              <select
                className="bg-transparent px-2 py-1 text-[10px] font-bold uppercase text-slate-600 outline-none w-28"
                value={selectedCliente}
                onChange={(e) => setSelectedCliente(e.target.value)}
              >
                <option value="">Cliente</option>
                {listaClienti.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>

              <select
                className="bg-transparent px-2 py-1 text-[10px] font-bold uppercase text-slate-600 outline-none w-28"
                value={selectedSprint}
                onChange={(e) => setSelectedSprint(e.target.value)}
              >
                
                {SPRINT_LIST.filter((s) => s !== 'Opex').map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                className="bg-transparent px-2 py-1 text-[10px] font-bold uppercase text-slate-600 outline-none w-28"
                value={selectedAttivita}
                onChange={(e) => setSelectedAttivita(e.target.value)}
              >
                <option value="">Attività</option>
                {ATTIVITA_LIST.filter((a) => a !== 'Incident Resolution').map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>

              <select
                className="bg-transparent px-2 py-1 text-[10px] font-bold uppercase text-slate-600 outline-none w-32"
                value={selectedStato}
                onChange={(e) => setSelectedStato(e.target.value)}
              >
                <option value="">Tutti gli Stati</option>
                {STATO_TICKET_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                className="bg-transparent px-2 py-1 text-[10px] font-bold uppercase text-slate-600 outline-none w-32"
                value={selectedAssegnatario}
                onChange={(e) => setSelectedAssegnatario(e.target.value)}
              >
                <option value="">Assegnatario</option>
                {listaAssegnatari.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome_completo}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setFilterAttenzioneBusiness(!filterAttenzioneBusiness)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all border ${
                filterAttenzioneBusiness
                  ? 'bg-purple-500 text-white border-purple-600 shadow-lg shadow-purple-200'
                  : 'bg-white text-purple-600 border-purple-200 hover:bg-purple-50'
              }`}
            >
              <AlertTriangle size={14} />
              Att. Business
            </button>

            {(searchTerm ||
              selectedCliente ||
              selectedAssegnatario ||
              selectedSprint ||
              selectedAttivita ||
              selectedStato ||
              filterAttenzioneBusiness) && (
              <button
                onClick={resetFilters}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Resetta filtri"
              >
                <FilterX size={18} />
              </button>
            )}

            <div className="w-px h-6 bg-slate-200 mx-1" />

            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`p-2 rounded-xl ${
                showConfig ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Settings2 size={20} />
            </button>
          </div>
        </div>
      </header>

      {showConfig && (
        <div className="max-w-[1600px] mx-auto mb-8 animate-in fade-in slide-in-from-top-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columnOrder.map((col) => col.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {columnOrder.map((col) => (
                  <SortableColumnItem
                    key={col.id}
                    col={col}
                    onToggleColumn={toggleColumn}
                    onTogglePinColumn={togglePinColumn}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto">
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {visibleColumns.map((col) => (
                    <th
                      key={col.id}
                      onClick={() => handleSort(col.id)}
                      style={getStickyStyles(col, true)}
                      className={`px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 cursor-pointer select-none hover:text-slate-700 transition-colors ${getColWidthClass(
                        col.id
                      )} ${col.pinned ? 'sticky' : ''}`}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.pinned && <Pin size={11} className="text-amber-500" />}
                        {sortConfig.key === col.id &&
                          (sortConfig.direction === 'asc' ? (
                            <ChevronRight size={12} className="rotate-90" />
                          ) : (
                            <ChevronRight size={12} className="-rotate-90" />
                          ))}
                      </div>
                    </th>
                  ))}
                  <th className="px-5 py-4" />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((t) => (
                  <tr key={t.id} className="group hover:bg-slate-50/40 transition-colors">
                    {visibleColumns.map((col) => (
                      <td
                        key={col.id}
                        style={getStickyStyles(col)}
                        className={`px-5 py-3 ${col.pinned ? 'sticky bg-white' : ''}`}
                      >
                        {col.id === 'titolo' && (
                          <input
                            className="w-full min-w-[200px] bg-transparent font-semibold text-[13px] text-slate-800 outline-none focus:text-blue-600 transition-colors"
                            value={t.titolo || ''}
                            onChange={(e) => handleUpdate(t.id, 'titolo', e.target.value)}
                          />
                        )}
                        {col.id === 'numero_ore' && (
                          <span className="text-[10px] font-bold text-slate-700">
                            {(t.numero_ore || 0).toLocaleString('it-IT', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        )}
                        {col.id === 'tipo_di_attivita' && (
                          <select
                            className="bg-transparent text-[10px] font-bold text-slate-600 outline-none"
                            value={t.tipo_di_attivita || ''}
                            onChange={(e) =>
                              handleUpdate(t.id, 'tipo_di_attivita', e.target.value)
                            }
                          >
                            <option value="">Seleziona...</option>
                            {ATTIVITA_LIST.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        )}

                        {col.id === 'sprint' && (
                          <select
                            className="bg-transparent text-[10px] font-bold text-slate-600 outline-none"
                            value={t.sprint || ''}
                            onChange={(e) => handleUpdate(t.id, 'sprint', e.target.value)}
                          >
                            <option value="">-</option>
                            {SPRINT_LIST.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        )}

                        {col.id === 'stato' && (
                          <select
                            className={`text-[9px] font-bold uppercase px-2 py-1 rounded-lg outline-none cursor-pointer border ${
                              t.stato === 'Attenzione Business'
                                ? 'bg-amber-500 text-white border-amber-600'
                                : 'bg-slate-900 text-white border-transparent'
                            }`}
                            value={t.stato || ''}
                            onChange={(e) => handleUpdate(t.id, 'stato', e.target.value)}
                          >
                            {STATO_TICKET_LIST.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        )}

                        {col.id === 'n_tag' &&
                          (t.link_tag ? (
                            <a
                              href={getUrl(t.link_tag)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block bg-blue-50 text-blue-600 border border-blue-100 px-2 py-1 rounded text-[10px] font-mono font-bold hover:bg-blue-600 hover:text-white transition-colors"
                            >
                              {t.n_tag || 'Link'}
                            </a>
                          ) : (
                            <span className="px-2 py-1 text-[12px] font-mono text-black-400">
                              {t.n_tag || '-'}
                            </span>
                          ))}

                        {col.id === 'applicativo' && (
                          <div className="min-w-[220px]">
                            <div className="flex flex-wrap gap-1">
                              {APPLICATIVI_LIST.map((app) => {
                                const selected = (t.applicativo || []).includes(app);

                                return (
                                  <button
                                    key={app}
                                    type="button"
                                    onClick={() => {
                                      const current = t.applicativo || [];
                                      const next = selected
                                        ? current.filter((item) => item !== app)
                                        : [...current, app];

                                      handleUpdate(t.id, 'applicativo', next);
                                    }}
                                    className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase transition-colors ${
                                      selected
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    {app}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {col.id === 'numero_storia' && (
                          <input
                            className="bg-slate-50 border-transparent px-2 py-1 rounded text-[10px] font-mono w-20"
                            value={t.numero_storia || ''}
                            onChange={(e) =>
                              handleUpdate(t.id, 'numero_storia', e.target.value)
                            }
                          />
                        )}

                        {col.id === 'progress' && (
                          <div className="flex items-center gap-2 w-28 group/progress">
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="bg-slate-100/50 border-transparent px-1 py-0.5 rounded text-[10px] font-mono font-bold text-slate-600 w-10 outline-none focus:ring-1 focus:ring-green-500 focus:bg-white transition-all appearance-none"
                                value={t.percentuale_avanzamento ?? 0}
                                onChange={(e) => {
                                  const val = Math.min(
                                    100,
                                    Math.max(0, parseInt(e.target.value) || 0)
                                  );
                                  setTickets((prev) =>
                                    prev.map((tick) =>
                                      tick.id === t.id
                                        ? { ...tick, percentuale_avanzamento: val }
                                        : tick
                                    )
                                  );
                                }}
                                onBlur={(e) => {
                                  const val = Math.min(
                                    100,
                                    Math.max(0, parseInt(e.target.value) || 0)
                                  );
                                  handleUpdate(t.id, 'percentuale_avanzamento', val);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = Math.min(
                                      100,
                                      Math.max(
                                        0,
                                        parseInt((e.target as HTMLInputElement).value) || 0
                                      )
                                    );
                                    handleUpdate(t.id, 'percentuale_avanzamento', val);
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                              />
                              <span className="absolute -right-3 top-1/2 -translate-y-1/2 text-[8px] text-slate-400 font-bold">
                                %
                              </span>
                            </div>

                            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden ml-2">
                              <div
                                className={`h-full transition-all duration-500 ease-out ${
                                  (t.percentuale_avanzamento ?? 0) >= 100
                                    ? 'bg-emerald-500'
                                    : 'bg-green-600'
                                }`}
                                style={{ width: `${t.percentuale_avanzamento || 0}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {col.id === 'assignee' && (
                          <select
                            className="bg-transparent text-[10px] font-bold uppercase outline-none text-slate-600"
                            value={t.assignee || ''}
                            onChange={(e) => handleUpdate(t.id, 'assignee', e.target.value)}
                          >
                            <option value="">Nessuno</option>
                            {listaAssegnatari.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nome_completo}
                              </option>
                            ))}
                          </select>
                        )}

                        {col.id === 'cliente' && (
                          <select
                            className="bg-transparent text-[10px] font-bold uppercase outline-none text-slate-600"
                            value={t.cliente_id || ''}
                            onChange={(e) => handleUpdate(t.id, 'cliente_id', e.target.value)}
                          >
                            <option value="">Nessuno</option>
                            {listaClienti.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nome}
                              </option>
                            ))}
                          </select>
                        )}

                        {col.id === 'priorita' && (
                          <select
                            className={`text-[9px] font-bold uppercase px-2 py-1 rounded-lg outline-none border ${
                              t.priorita === 'Alta'
                                ? 'bg-red-50 text-red-600 border-red-100'
                                : t.priorita === 'Media'
                                ? 'bg-orange-50 text-orange-600 border-orange-100'
                                : t.priorita === 'Bassa'
                                ? 'bg-green-50 text-green-600 border-green-100'
                                : 'bg-slate-50 text-slate-600 border-slate-100'
                            }`}
                            value={t.priorita || ''}
                            onChange={(e) => handleUpdate(t.id, 'priorita', e.target.value)}
                          >
                            <option value="">-</option>
                            {PRIORITA_LIST.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        )}

                        {col.id === 'ultimo_ping' &&
                          (() => {
                            const pingDate = t.ultimo_ping ? new Date(t.ultimo_ping) : null;
                            const fifteenDaysAgo = new Date();
                            fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

                            const isStale = pingDate && pingDate < fifteenDaysAgo;

                            return (
                              <span
                                className={`text-[10px] font-bold ${
                                  isStale ? 'text-red-500' : 'text-slate-400'
                                }`}
                              >
                                {pingDate
                                  ? pingDate.toLocaleDateString('it-IT', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: '2-digit',
                                    })
                                  : '-'}
                              </span>
                            );
                          })()}

                        {col.id === 'rilascio_in_collaudo' && (
                          <div className="relative flex items-center gap-2 group">
                            <input
                              type="date"
                              className={`border-transparent px-2 py-1 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer appearance-none ${
                                t.rilascio_collaudo_eseguito
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-slate-100/50 text-slate-600'
                              }`}
                              value={t.rilascio_in_collaudo || ''}
                              onChange={(e) =>
                                handleUpdate(t.id, 'rilascio_in_collaudo', e.target.value)
                              }
                            />

                            <label className="flex items-center gap-1 text-[9px] font-bold uppercase text-slate-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!t.rilascio_collaudo_eseguito}
                                onChange={(e) =>
                                  handleUpdate(
                                    t.id,
                                    'rilascio_collaudo_eseguito',
                                    e.target.checked
                                  )
                                }
                                className="accent-green-600 w-3.5 h-3.5"
                              />
                              OK
                            </label>

                            {t.rilascio_in_collaudo && (
                              <button
                                onClick={() => handleUpdate(t.id, 'rilascio_in_collaudo', null)}
                                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                                title="Cancella data"
                              >
                                <FilterX size={12} />
                              </button>
                            )}
                          </div>
                        )}

                        {col.id === 'rilascio_in_produzione' && (
                          <div className="relative flex items-center gap-2 group">
                            <input
                              type="date"
                              className={`border-transparent px-2 py-1 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer appearance-none ${
                                t.rilascio_produzione_eseguito
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-slate-100/50 text-slate-600'
                              }`}
                              value={t.rilascio_in_produzione || ''}
                              onChange={(e) =>
                                handleUpdate(t.id, 'rilascio_in_produzione', e.target.value)
                              }
                            />

                            <label className="flex items-center gap-1 text-[9px] font-bold uppercase text-slate-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!t.rilascio_produzione_eseguito}
                                onChange={(e) =>
                                  handleUpdate(
                                    t.id,
                                    'rilascio_produzione_eseguito',
                                    e.target.checked
                                  )
                                }
                                className="accent-green-600 w-3.5 h-3.5"
                              />
                              OK
                            </label>

                            {t.rilascio_in_produzione && (
                              <button
                                onClick={() => handleUpdate(t.id, 'rilascio_in_produzione', null)}
                                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                                title="Cancella data"
                              >
                                <FilterX size={12} />
                              </button>
                            )}
                          </div>
                        )}

                        {col.id === 'data_chiusura_attivita' && (
                          <div className="relative flex items-center group">
                            <input
                              type="date"
                              className="bg-slate-100/50 border-transparent px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer appearance-none"
                              value={t.data_chiusura_attivita || ''}
                              onChange={(e) =>
                                handleUpdate(t.id, 'data_chiusura_attivita', e.target.value)
                              }
                            />
                            {t.data_chiusura_attivita && (
                              <button
                                onClick={() =>
                                  handleUpdate(t.id, 'data_chiusura_attivita', null)
                                }
                                className="ml-1 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                                title="Cancella data"
                              >
                                <FilterX size={12} />
                              </button>
                            )}
                          </div>
                        )}

                        {col.id === 'data_apertura_attivita' && (
                          <span className="text-[10px] font-bold text-slate-600">
                            {formatDateOnly(t.creato_at)}
                          </span>
                        )}
                      </td>
                    ))}

                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/ticket/${t.id}`}
                        className="p-2 inline-flex rounded-lg border border-slate-100 text-slate-300 hover:text-blue-600 hover:bg-blue-50"
                      >
                        <ChevronRight size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredTickets.length === 0 && (
              <div className="p-10 text-center text-slate-400 text-sm">
                Nessun ticket trovato con i filtri selezionati.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}