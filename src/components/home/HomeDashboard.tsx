"use client";

import { useMemo, useEffect, useRef, useState } from "react";
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
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  ALTEZZA_RIGA_PX,
  COLONNE_GRIGLIA,
  DEFAULT_HOME_LAYOUT,
  DEFAULT_WIDGET_COLOR,
  WIDGET_BY_ID,
  WIDGET_CATALOG,
  WIDGET_COLORS,
  coloriDellaCard,
  creaCardPersonalizzata,
  limitaAltezza,
  limitaLarghezza,
  normalizeLayout,
  normalizzaHex,
  variabiliColoreCard,
  type CustomCardConfig,
  type HomeWidgetId,
  type HomeWidgetLayoutItem,
  type WidgetColor,
} from "@/lib/home-widgets";
import { descriviFiltro } from "@/lib/home-filters";
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

/** Gap della griglia, in pixel, ai vari breakpoint (vedi globals.css). */
const GAP_DEFAULT = 20;

/* ------------------------------------------------------------------ */
/* Card widget                                                         */
/* ------------------------------------------------------------------ */

function WidgetCard({
  item,
  data,
  editing,
  onRemove,
  onRecolor,
  onEditConfig,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: {
  item: HomeWidgetLayoutItem;
  data: HomeData;
  editing: boolean;
  onRemove: (key: string) => void;
  onRecolor: (key: string, color: WidgetColor, hex?: string) => void;
  onEditConfig: (key: string) => void;
  onResizeStart: (key: string, event: React.PointerEvent) => void;
  onResizeMove: (event: React.PointerEvent) => void;
  onResizeEnd: (event: React.PointerEvent) => void;
}) {
  const widget = WIDGET_BY_ID.get(item.id);
  const [pannelloColori, setPannelloColori] = useState(false);
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
  const coloreAttuale = normalizzaHex(item.colorHex) ?? "";

  // Titolo/descrizione: le card personalizzate usano la loro configurazione.
  const titolo = isCustom
    ? item.config?.titolo || "Card personalizzata"
    : widget.titolo;

  const riassuntoFiltri = isCustom ? descriviFiltro(item.config?.filtri) : "";
  const descrizione = isCustom
    ? riassuntoFiltri ||
      `${item.config?.modo ?? "lista"} · ${item.config?.limite ?? 15} ticket`
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
        // Su tablet una card larga più di metà griglia occupa due colonne.
        "--card-col-sm": item.larghezza > COLONNE_GRIGLIA / 2 ? 2 : 1,
        "--card-col-lg": item.larghezza,
        "--card-row-lg": item.altezza,
      } as React.CSSProperties}
      className={`home-card ${isDragging ? "opacity-40" : ""}`}
    >
      <div
        style={variabiliColoreCard(item) as React.CSSProperties}
        className={`home-card-surface relative flex h-full min-h-0 flex-col rounded-2xl border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] sm:p-5 ${
          editing ? "border-dashed" : ""
        }`}
      >
        <div
          // In modalità modifica tutta l'intestazione è la maniglia di trascinamento.
          ref={editing ? setActivatorNodeRef : undefined}
          {...(editing ? attributes : {})}
          {...(editing ? listeners : {})}
          className={`mb-4 flex shrink-0 items-start justify-between gap-3 ${
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
              <p
                className="truncate text-[10px] font-bold uppercase tracking-tight text-slate-400"
                title={descrizione}
              >
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

            {editing && (
              <button
                type="button"
                onClick={() => setPannelloColori((prev) => !prev)}
                onPointerDown={(event) => event.stopPropagation()}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                  pannelloColori
                    ? "bg-slate-900 text-[#ffffff]"
                    : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                }`}
                aria-label="Colore della card"
              >
                <Palette size={13} />
              </button>
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

        {editing && pannelloColori && (
          <div
            className="mb-4 shrink-0 rounded-xl border border-slate-200 bg-white/80 p-3"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {WIDGET_COLORS.map((colore) => {
                const anteprima = coloriDellaCard({ color: colore.id });
                const selezionato =
                  !coloreAttuale &&
                  (item.color ?? DEFAULT_WIDGET_COLOR) === colore.id;

                return (
                  <button
                    key={colore.id}
                    type="button"
                    title={colore.label}
                    onClick={() => onRecolor(item.key, colore.id, undefined)}
                    style={{
                      backgroundColor: anteprima.pastiglia,
                      borderColor: anteprima.bordoChiaro,
                    }}
                    className={`h-5 w-5 rounded-full border transition ${
                      selezionato
                        ? "ring-2 ring-slate-900 ring-offset-1"
                        : "hover:scale-110"
                    }`}
                    aria-label={`Colore ${colore.label}`}
                  />
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-tight text-slate-500">
                <input
                  type="color"
                  value={coloreAttuale || "#3b82f6"}
                  onChange={(event) =>
                    onRecolor(item.key, item.color ?? DEFAULT_WIDGET_COLOR, event.target.value)
                  }
                  className="h-6 w-8 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                  aria-label="Colore personalizzato"
                />
                Colore libero
              </label>

              {coloreAttuale && (
                <button
                  type="button"
                  onClick={() =>
                    onRecolor(item.key, item.color ?? DEFAULT_WIDGET_COLOR, undefined)
                  }
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 transition hover:bg-slate-200"
                >
                  Torna alla palette
                </button>
              )}
            </div>

            <p className="mt-2 text-[10px] font-medium text-slate-400">
              Il colore scelto viene velato: lo sfondo resta chiaro e il testo
              leggibile, anche in tema scuro.
            </p>
          </div>
        )}

        {/* Il contenuto scorre dentro l'altezza scelta, senza sbordare. */}
        <div
          className={`min-h-0 flex-1 overflow-y-auto ${
            editing ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {isCustom ? (
            <TicketCustom data={data} config={item.config!} />
          ) : (
            <Component data={data} />
          )}
        </div>

        {editing && (
          <>
            <div className="mt-2 hidden shrink-0 items-center justify-end gap-2 text-[10px] font-black uppercase tracking-tight text-slate-400 lg:flex">
              {item.larghezza}/{COLONNE_GRIGLIA} col · {item.altezza} righe
            </div>

            {/* Maniglia di ridimensionamento: solo da desktop, dove la
                griglia a 12 colonne e le righe fisse sono attive. */}
            <button
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
                onResizeStart(item.key, event);
              }}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeEnd}
              onPointerCancel={onResizeEnd}
              className="absolute bottom-1 right-1 hidden h-5 w-5 cursor-nwse-resize touch-none items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:flex"
              aria-label="Ridimensiona card"
              title="Trascina per cambiare larghezza e altezza"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                <path
                  d="M9 1v8H1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray="2 2"
                />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

type StatoRidimensiona = {
  key: string;
  startX: number;
  startY: number;
  larghezza: number;
  altezza: number;
  passoColonna: number;
  passoRiga: number;
};

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

  const gridRef = useRef<HTMLDivElement>(null);
  const ridimensionaRef = useRef<StatoRidimensiona | null>(null);
  /** Dimensioni mostrate durante il trascinamento, prima del salvataggio. */
  const [anteprimaResize, setAnteprimaResize] = useState<{
    key: string;
    larghezza: number;
    altezza: number;
  } | null>(null);

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

  /**
   * La home carica i ticket con `*, clienti(nome)`: l'embed di `profili` non
   * c'è, perché `ticket` ha due chiavi esterne verso quella tabella e
   * PostgREST rifiuta l'embed ambiguo. I profili arrivano quindi come elenco
   * separato e vanno riattaccati qui, altrimenti il filtro per assegnatario
   * e la colonna "Assegnatario" delle card restano sempre vuoti.
   */
  const profiloPerId = useMemo(() => {
    const mappa = new Map<string, Record<string, unknown>>();

    for (const profilo of data.profili ?? []) {
      const id = profilo?.id;
      if (typeof id === "string") mappa.set(id, profilo);
    }

    return mappa;
  }, [data.profili]);

  const datiArricchiti: HomeData = useMemo(() => {
    if (profiloPerId.size === 0) return data;

    return {
      ...data,
      tickets: data.tickets.map((ticket) =>
        ticket.profili
          ? ticket
          : {
              ...ticket,
              profili: profiloPerId.get(String(ticket.assignee ?? "")) ?? null,
            }
      ),
    };
  }, [data, profiloPerId]);

  /** Assegnatari selezionabili nei filtri della card personalizzata. */
  const opzioniAssegnatario = useMemo(() => {
    const nomi = new Set<string>();

    for (const profilo of data.profili ?? []) {
      const nome = profilo?.nome_completo ?? profilo?.nome;
      if (nome) nomi.add(String(nome));
    }

    return Array.from(nomi).sort((a, b) => a.localeCompare(b));
  }, [data.profili]);

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
      return datiArricchiti;
    }

    return {
      ...datiArricchiti,
      tickets: datiArricchiti.tickets.filter((ticket) => {
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
  }, [datiArricchiti, data.userId, filtroCliente, filtroTipologia, soloMiei]);

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

  /* ---------------------------------------------------------------- */
  /* Ridimensionamento con aggancio alla griglia                       */
  /* ---------------------------------------------------------------- */

  function iniziaRidimensiona(key: string, event: React.PointerEvent) {
    const item = layout.find((i) => i.key === key);
    const griglia = gridRef.current;
    if (!item || !griglia) return;

    const stile = window.getComputedStyle(griglia);
    const gapColonne = parseFloat(stile.columnGap) || GAP_DEFAULT;
    const gapRighe = parseFloat(stile.rowGap) || GAP_DEFAULT;

    // Passo orizzontale = larghezza di una colonna + il gap che la segue.
    const larghezzaColonna =
      (griglia.clientWidth - gapColonne * (COLONNE_GRIGLIA - 1)) /
      COLONNE_GRIGLIA;

    ridimensionaRef.current = {
      key,
      startX: event.clientX,
      startY: event.clientY,
      larghezza: item.larghezza,
      altezza: item.altezza,
      passoColonna: larghezzaColonna + gapColonne,
      passoRiga: ALTEZZA_RIGA_PX + gapRighe,
    };

    setAnteprimaResize({
      key,
      larghezza: item.larghezza,
      altezza: item.altezza,
    });

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function muoviRidimensiona(event: React.PointerEvent) {
    const stato = ridimensionaRef.current;
    if (!stato || stato.passoColonna <= 0 || stato.passoRiga <= 0) return;

    const colonne = Math.round(
      (event.clientX - stato.startX) / stato.passoColonna
    );
    const righe = Math.round((event.clientY - stato.startY) / stato.passoRiga);

    setAnteprimaResize({
      key: stato.key,
      larghezza: limitaLarghezza(stato.larghezza + colonne),
      altezza: limitaAltezza(stato.altezza + righe),
    });
  }

  function fineRidimensiona(event: React.PointerEvent) {
    const stato = ridimensionaRef.current;
    const anteprima = anteprimaResize;

    ridimensionaRef.current = null;
    setAnteprimaResize(null);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!stato || !anteprima) return;

    // Si salva solo se qualcosa è davvero cambiato: un clic sulla maniglia
    // non deve generare una scrittura inutile.
    if (
      anteprima.larghezza === stato.larghezza &&
      anteprima.altezza === stato.altezza
    ) {
      return;
    }

    persist(
      layout.map((item) =>
        item.key === stato.key
          ? {
              ...item,
              larghezza: anteprima.larghezza,
              altezza: anteprima.altezza,
            }
          : item
      )
    );
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

    persist([
      ...layout,
      {
        key: id,
        id,
        larghezza: widget.larghezzaDefault,
        altezza: widget.altezzaDefault,
        color: DEFAULT_WIDGET_COLOR,
      },
    ]);
    setCatalogOpen(false);
  }

  function removeWidget(key: string) {
    persist(layout.filter((item) => item.key !== key));
  }

  function recolorWidget(key: string, color: WidgetColor, hex?: string) {
    const valido = normalizzaHex(hex);

    persist(
      layout.map((item) => {
        if (item.key !== key) return item;

        const aggiornato: HomeWidgetLayoutItem = { ...item, color };

        if (valido) aggiornato.colorHex = valido;
        else delete aggiornato.colorHex;

        return aggiornato;
      })
    );
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
      <div className="home-grid">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            style={
              {
                "--card-col-sm": 2,
                "--card-col-lg": 6,
                "--card-row-lg": 7,
              } as React.CSSProperties
            }
            className="home-card animate-pulse rounded-2xl border border-slate-200/80 bg-white"
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
          Trascina una card dall&apos;intestazione per riordinarla, oppure
          l&apos;angolo in basso a destra per cambiarne larghezza e altezza.
          Le dimensioni valgono da schermo grande: su tablet e telefono le card
          si adattano da sole.
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
            <div ref={gridRef} className="home-grid">
              {layout.map((item) => {
                // Durante il trascinamento della maniglia si mostrano le
                // dimensioni in corso, che vengono salvate solo al rilascio.
                const conAnteprima =
                  anteprimaResize && anteprimaResize.key === item.key
                    ? {
                        ...item,
                        larghezza: anteprimaResize.larghezza,
                        altezza: anteprimaResize.altezza,
                      }
                    : item;

                return (
                  <WidgetCard
                    key={item.key}
                    item={conAnteprima}
                    data={datiFiltrati}
                    editing={editing}
                    onRemove={removeWidget}
                    onRecolor={recolorWidget}
                    onEditConfig={setEditKey}
                    onResizeStart={iniziaRidimensiona}
                    onResizeMove={muoviRidimensiona}
                    onResizeEnd={fineRidimensiona}
                  />
                );
              })}
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
          assegnatari={opzioniAssegnatario}
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
