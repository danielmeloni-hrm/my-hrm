"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  GripVertical,
  LayoutGrid,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  DEFAULT_HOME_LAYOUT,
  SIZE_CLASSES,
  SIZE_LABELS,
  WIDGET_BY_ID,
  WIDGET_CATALOG,
  WIDGET_COLORS,
  creaCardPersonalizzata,
  getWidgetColorClasses,
  normalizeLayout,
  type CustomCardConfig,
  type HomeWidgetId,
  type HomeWidgetLayoutItem,
  type WidgetColor,
  type WidgetSize,
} from "@/lib/home-widgets";
import {
  WIDGET_COMPONENTS,
  TicketCustom,
  getWidgetCount,
  type HomeData,
} from "./widgets";
import CustomCardEditor from "./CustomCardEditor";

type Props = {
  data: HomeData;
};

/* ------------------------------------------------------------------ */
/* Card widget                                                         */
/* ------------------------------------------------------------------ */

function WidgetCard({
  item,
  data,
  editing,
  onRemove,
  onResize,
  onRecolor,
  onEditConfig,
}: {
  item: HomeWidgetLayoutItem;
  data: HomeData;
  editing: boolean;
  onRemove: (key: string) => void;
  onResize: (key: string, size: WidgetSize) => void;
  onRecolor: (key: string, color: WidgetColor) => void;
  onEditConfig: (key: string) => void;
}) {
  const widget = WIDGET_BY_ID.get(item.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key, disabled: !editing });

  if (!widget) return null;

  const isCustom = item.id === "ticket_custom";
  const Component = WIDGET_COMPONENTS[item.id];
  const count = getWidgetCount(item.id, data);

  // Titolo/descrizione: le card personalizzate usano la loro configurazione.
  const titolo = isCustom
    ? item.config?.titolo || "Card personalizzata"
    : widget.titolo;
  const descrizione = isCustom
    ? `${item.config?.modo ?? "lista"} · ${
        item.config?.limite ?? 15
      } ticket`
    : widget.descrizione;

  return (
    <div
      ref={setNodeRef}
      style={{
        // Translate (non Transform): le card hanno larghezze diverse e lo
        // scale del transform completo le deformerebbe durante il riordino.
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
      }}
      className={`${SIZE_CLASSES[item.size]} ${isDragging ? "opacity-40" : ""}`}
    >
      <div
        className={`flex h-full flex-col rounded-2xl border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] sm:p-5 ${getWidgetColorClasses(
          item.color
        )} ${editing ? "border-dashed" : ""}`}
      >
        <div
          // In modalità modifica tutta l'intestazione è la maniglia di trascinamento.
          ref={editing ? setActivatorNodeRef : undefined}
          {...(editing ? attributes : {})}
          {...(editing ? listeners : {})}
          className={`mb-4 flex items-start justify-between gap-3 ${
            editing
              ? "cursor-grab touch-none select-none active:cursor-grabbing"
              : ""
          }`}
        >
          <div className="flex min-w-0 items-start gap-2">
            {editing && (
              <GripVertical
                size={16}
                className="mt-0.5 shrink-0 text-slate-300"
                aria-hidden
              />
            )}

            <div className="min-w-0">
              <h2 className="truncate text-[13px] font-black uppercase tracking-tight text-slate-800">
                {titolo}
              </h2>
              <p className="truncate text-[10px] font-bold uppercase tracking-tight text-slate-400">
                {descrizione}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {count !== null && !editing && (
              <span className="text-2xl font-black tracking-tighter text-slate-900">
                {count}
              </span>
            )}

            {editing && isCustom && (
              <button
                type="button"
                onClick={() => onEditConfig(item.key)}
                onPointerDown={(event) => event.stopPropagation()}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition hover:bg-blue-50 hover:text-[#0150a0]"
                aria-label="Configura card"
              >
                <Pencil size={13} />
              </button>
            )}

            {editing && (
              <button
                type="button"
                onClick={() => onRemove(item.key)}
                // L'intestazione è la maniglia: fermiamo l'evento per non
                // avviare un trascinamento quando si clicca la X.
                onPointerDown={(event) => event.stopPropagation()}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Rimuovi card"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {editing && (
          <div className="mb-4 space-y-2">
            {widget.sizes.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {widget.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => onResize(item.key, size)}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-tight transition ${
                      item.size === size
                        ? "bg-slate-900 text-[#ffffff]"
                        : "bg-white/70 text-slate-500 hover:bg-white"
                    }`}
                  >
                    {SIZE_LABELS[size]}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              {WIDGET_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  title={color.label}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onRecolor(item.key, color.id)}
                  className={`h-5 w-5 rounded-full border transition ${color.swatch} ${
                    (item.color ?? "bianco") === color.id
                      ? "ring-2 ring-slate-900 ring-offset-1"
                      : "hover:scale-110"
                  }`}
                  aria-label={`Colore ${color.label}`}
                />
              ))}
            </div>
          </div>
        )}

        <div className={editing ? "pointer-events-none opacity-60" : ""}>
          {isCustom ? (
            <TicketCustom data={data} config={item.config!} />
          ) : (
            <Component data={data} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export default function HomeDashboard({ data }: Props) {
  const [layout, setLayout] = useState<HomeWidgetLayoutItem[]>(
    DEFAULT_HOME_LAYOUT
  );
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Chiave della card personalizzata in modifica (null = editor chiuso). */
  const [editKey, setEditKey] = useState<string | null>(null);

  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroTipologia, setFiltroTipologia] = useState("");
  /** Di default la home mostra solo i ticket dell'utente loggato. */
  const [soloMiei, setSoloMiei] = useState(true);

  /** Clienti e tipologie realmente presenti nei ticket caricati. */
  const opzioniCliente = useMemo(() => {
    const nomi = new Set<string>();

    for (const ticket of data.tickets) {
      const nome = ticket.clienti?.nome;
      if (nome) nomi.add(String(nome));
    }

    return Array.from(nomi).sort((a, b) => a.localeCompare(b));
  }, [data.tickets]);

  const opzioniTipologia = useMemo(() => {
    const tipologie = new Set<string>();

    for (const ticket of data.tickets) {
      if (ticket.tipologia_ticket) tipologie.add(String(ticket.tipologia_ticket));
    }

    return Array.from(tipologie).sort((a, b) => a.localeCompare(b));
  }, [data.tickets]);

  /** I widget lavorano solo sui ticket che passano i filtri. */
  const datiFiltrati: HomeData = useMemo(() => {
    const filtraPerAssegnatario = soloMiei && Boolean(data.userId);

    if (!filtroCliente && !filtroTipologia && !filtraPerAssegnatario) {
      return data;
    }

    return {
      ...data,
      tickets: data.tickets.filter((ticket) => {
        const okAssegnatario =
          !filtraPerAssegnatario ||
          String(ticket.assignee ?? "") === data.userId;

        const okCliente =
          !filtroCliente || String(ticket.clienti?.nome ?? "") === filtroCliente;

        const okTipologia =
          !filtroTipologia ||
          String(ticket.tipologia_ticket ?? "") === filtroTipologia;

        return okAssegnatario && okCliente && okTipologia;
      }),
    };
  }, [data, filtroCliente, filtroTipologia, soloMiei]);

  const filtriAttivi = Boolean(filtroCliente || filtroTipologia || soloMiei);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Su touch serve una pressione lunga, altrimenti lo scroll diventa un drag.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    let annullato = false;

    async function loadLayout() {
      try {
        const res = await fetch("/api/settings/home");
        const json = await res.json();

        if (!annullato && json?.ok) {
          setLayout(normalizeLayout(json.home_widgets));
        }
      } catch (error) {
        console.warn("Layout home non caricato:", error);
      } finally {
        if (!annullato) setLoaded(true);
      }
    }

    loadLayout();

    return () => {
      annullato = true;
    };
  }, []);

  async function persist(next: HomeWidgetLayoutItem[]) {
    setLayout(next);
    setSaving(true);

    try {
      await fetch("/api/settings/home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home_widgets: next }),
      });
    } catch (error) {
      console.error("Salvataggio layout home fallito:", error);
    } finally {
      setSaving(false);
    }
  }

  const disponibili = useMemo(
    // Le card fisse spariscono dal catalogo una volta aggiunte;
    // la card personalizzata resta sempre disponibile (istanze multiple).
    () =>
      WIDGET_CATALOG.filter(
        (widget) =>
          widget.id === "ticket_custom" ||
          !layout.some((i) => i.id === widget.id)
      ),
    [layout]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const from = layout.findIndex((item) => item.key === active.id);
    const to = layout.findIndex((item) => item.key === over.id);

    if (from < 0 || to < 0) return;

    persist(arrayMove(layout, from, to));
  }

  function addWidget(id: HomeWidgetId) {
    const widget = WIDGET_BY_ID.get(id);
    if (!widget) return;

    if (id === "ticket_custom") {
      // Ogni card personalizzata è una nuova istanza da configurare.
      const nuova = creaCardPersonalizzata();
      persist([...layout, nuova]);
      setCatalogOpen(false);
      setEditKey(nuova.key);
      return;
    }

    persist([...layout, { key: id, id, size: widget.defaultSize }]);
    setCatalogOpen(false);
  }

  function removeWidget(key: string) {
    persist(layout.filter((item) => item.key !== key));
  }

  function resizeWidget(key: string, size: WidgetSize) {
    persist(layout.map((item) => (item.key === key ? { ...item, size } : item)));
  }

  function recolorWidget(key: string, color: WidgetColor) {
    persist(layout.map((item) => (item.key === key ? { ...item, color } : item)));
  }

  function updateCardConfig(key: string, config: CustomCardConfig) {
    persist(layout.map((item) => (item.key === key ? { ...item, config } : item)));
  }

  const cardInModifica = editKey
    ? layout.find((item) => item.key === editKey)
    : null;

  const activeItem = activeId
    ? layout.find((item) => item.key === activeId)
    : null;
  const activeConfig = activeItem ? WIDGET_BY_ID.get(activeItem.id) : null;
  const activeTitolo =
    activeItem?.id === "ticket_custom"
      ? activeItem.config?.titolo || "Card personalizzata"
      : activeConfig?.titolo;

  if (!loaded) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-6">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-56 animate-pulse rounded-2xl border border-slate-200/80 bg-white sm:col-span-2 lg:col-span-3"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
          <LayoutGrid size={14} />
          Control center
          {saving && <span className="text-slate-300">· salvataggio…</span>}
          {filtriAttivi && (
            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] text-[#0150a0]">
              {datiFiltrati.tickets.length} ticket filtrati
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setSoloMiei(true)}
              className={`px-3 py-1.5 text-xs font-black transition ${
                soloMiei
                  ? "bg-slate-900 text-[#ffffff]"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              I miei ticket
            </button>

            <button
              type="button"
              onClick={() => setSoloMiei(false)}
              className={`px-3 py-1.5 text-xs font-black transition ${
                soloMiei
                  ? "text-slate-500 hover:bg-slate-50"
                  : "bg-slate-900 text-[#ffffff]"
              }`}
            >
              Tutti
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
            <SlidersHorizontal size={13} className="shrink-0 text-slate-400" />

            <select
              value={filtroCliente}
              onChange={(event) => setFiltroCliente(event.target.value)}
              className="max-w-[150px] cursor-pointer bg-transparent text-xs font-bold text-slate-700 outline-none"
              aria-label="Filtra per cliente"
            >
              <option value="">Tutti i clienti</option>
              {opzioniCliente.map((cliente) => (
                <option key={cliente} value={cliente}>
                  {cliente}
                </option>
              ))}
            </select>

            <span className="text-slate-200">|</span>

            <select
              value={filtroTipologia}
              onChange={(event) => setFiltroTipologia(event.target.value)}
              className="max-w-[150px] cursor-pointer bg-transparent text-xs font-bold text-slate-700 outline-none"
              aria-label="Filtra per tipologia"
            >
              <option value="">Tutte le tipologie</option>
              {opzioniTipologia.map((tipologia) => (
                <option key={tipologia} value={tipologia}>
                  {tipologia}
                </option>
              ))}
            </select>

            {(filtroCliente || filtroTipologia) && (
              <button
                type="button"
                onClick={() => {
                  setFiltroCliente("");
                  setFiltroTipologia("");
                }}
                className="flex h-5 w-5 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Azzera filtri"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {editing && (
            <>
              <button
                type="button"
                onClick={() => setCatalogOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Plus size={14} />
                Aggiungi card
                {disponibili.length > 0 && (
                  <span className="rounded-md bg-slate-100 px-1.5 text-[10px]">
                    {disponibili.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => persist(DEFAULT_HOME_LAYOUT)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-500 shadow-sm transition hover:bg-slate-50"
              >
                <RotateCcw size={14} />
                Ripristina
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setEditing((prev) => !prev);
              setCatalogOpen(false);
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black shadow-sm transition ${
              editing
                ? "bg-slate-900 text-[#ffffff] hover:bg-slate-800"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {editing ? <Check size={14} /> : <Settings2 size={14} />}
            {editing ? "Fine" : "Personalizza"}
          </button>
        </div>
      </div>

      {editing && (
        <p className="mb-4 text-[11px] font-bold text-slate-400">
          Trascina una card dall&apos;intestazione per riordinarla.
        </p>
      )}

      {editing && catalogOpen && (
        <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          {disponibili.length === 0 ? (
            <p className="text-xs font-bold text-slate-400">
              Hai già aggiunto tutte le card disponibili.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {disponibili.map((widget) => (
                <button
                  key={widget.id}
                  type="button"
                  onClick={() => addWidget(widget.id)}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-left transition hover:border-[#0150a0]/30 hover:bg-blue-50/40"
                >
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {widget.gruppo}
                  </span>
                  <p className="mt-1 text-[13px] font-black text-slate-800">
                    {widget.titolo}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                    {widget.descrizione}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {layout.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm font-bold text-slate-500">
            Nessuna card sulla home.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setCatalogOpen(true);
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-[#ffffff]"
          >
            <Plus size={14} />
            Aggiungi la prima card
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          // Le card cambiano larghezza e la griglia si ridispone: senza
          // rimisurazione continua le posizioni di rilascio sono sbagliate.
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext
            items={layout.map((item) => item.key)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-6">
              {layout.map((item) => (
                <WidgetCard
                  key={item.key}
                  item={item}
                  data={datiFiltrati}
                  editing={editing}
                  onRemove={removeWidget}
                  onResize={resizeWidget}
                  onRecolor={recolorWidget}
                  onEditConfig={setEditKey}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeTitolo && (
              <div className="rounded-2xl border border-[#0150a0]/30 bg-white p-5 shadow-2xl">
                <p className="text-[13px] font-black uppercase tracking-tight text-slate-800">
                  {activeTitolo}
                </p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {cardInModifica && cardInModifica.config && (
        <CustomCardEditor
          config={cardInModifica.config}
          clienti={opzioniCliente}
          onSave={(config) => {
            updateCardConfig(cardInModifica.key, config);
            setEditKey(null);
          }}
          onClose={() => setEditKey(null)}
        />
      )}
    </div>
  );
}
