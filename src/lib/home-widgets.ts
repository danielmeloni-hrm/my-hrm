// src/lib/home-widgets.ts
// Catalogo dei widget della home + logica derivata (SLA, ticket fermi, carico team).

import {
  APPLICATIVI_LIST,
  PRIORITA_LIST,
  PRIORITA_NUMBER_MAP,
  STATO_PROGRESS_MAP,
  STATO_TICKET_LIST,
  TICKET_FIELD_LABELS,
  TIPOLOGIA_TICKET,
} from "@/components/parametri_ticket/attivita";
import {
  filtroVuoto,
  migraFiltriLegacy,
  normalizzaFiltro,
  valutaFiltro,
  type FiltroAvanzato,
} from "@/lib/home-filters";

/* ------------------------------------------------------------------ */
/* Dimensioni delle card                                               */
/* ------------------------------------------------------------------ */

/**
 * Su desktop la home è una griglia a 12 colonne con righe da 24px.
 * La larghezza di una card è il numero di colonne occupate, l'altezza il
 * numero di righe: altezza N ≈ N * 24px + (N-1) * 20px di gap.
 * Sotto il breakpoint desktop la griglia torna a 1-2 colonne e l'altezza
 * è dettata dal contenuto, altrimenti su telefono le card si spezzano.
 */
export const COLONNE_GRIGLIA = 12;
export const LARGHEZZA_MIN = 2;
export const ALTEZZA_MIN = 3;
export const ALTEZZA_MAX = 24;

/** Altezza in pixel di una singola riga della griglia. */
export const ALTEZZA_RIGA_PX = 24;

/** Vecchie taglie fisse: restano solo per convertire i layout già salvati. */
export type WidgetSize = "sm" | "md" | "lg";

const LARGHEZZA_DA_SIZE: Record<WidgetSize, number> = {
  sm: 4,
  md: 6,
  lg: 12,
};

export function limitaLarghezza(valore: number): number {
  if (!Number.isFinite(valore)) return 6;
  return Math.min(COLONNE_GRIGLIA, Math.max(LARGHEZZA_MIN, Math.round(valore)));
}

export function limitaAltezza(valore: number): number {
  if (!Number.isFinite(valore)) return 7;
  return Math.min(ALTEZZA_MAX, Math.max(ALTEZZA_MIN, Math.round(valore)));
}

/** Altezza in pixel corrispondente a un numero di righe, gap compreso. */
export function altezzaInPixel(altezza: number, gap = 20): number {
  return altezza * ALTEZZA_RIGA_PX + (altezza - 1) * gap;
}

/* ------------------------------------------------------------------ */
/* Catalogo                                                            */
/* ------------------------------------------------------------------ */

export type HomeWidgetId =
  | "attivita_assegnate"
  | "ticket_urgenti"
  | "sla_in_scadenza"
  | "attivita_ferme"
  | "bloccati_business"
  | "ultimo_ping"
  | "note_importanti"
  | "notifiche_importanti"
  | "prossime_scadenze"
  | "carico_team"
  | "grafico_stati"
  | "grafico_tempi"
  | "ticket_custom"
  | "nota_singola";

export type HomeWidgetConfig = {
  id: HomeWidgetId;
  titolo: string;
  descrizione: string;
  /** Colonne occupate alla prima aggiunta (griglia a 12). */
  larghezzaDefault: number;
  /** Righe occupate alla prima aggiunta. */
  altezzaDefault: number;
  gruppo: "Operativo" | "Team" | "Analisi" | "Personalizzata";
  /**
   * Card che ammette più istanze sulla home, ognuna con la propria
   * configurazione. Le altre restano una sola e spariscono dal catalogo
   * una volta aggiunte.
   */
  multiplo?: boolean;
};

export const WIDGET_CATALOG: HomeWidgetConfig[] = [
  {
    id: "attivita_assegnate",
    titolo: "Attività assegnate a me",
    descrizione: "I ticket aperti su cui risulti assegnatario.",
    larghezzaDefault: 6,
    altezzaDefault: 7,
    gruppo: "Operativo",
  },
  {
    id: "ticket_urgenti",
    titolo: "Ticket urgenti",
    descrizione: "Priorità Alta ancora aperti, ordinati per anzianità.",
    larghezzaDefault: 6,
    altezzaDefault: 7,
    gruppo: "Operativo",
  },
  {
    id: "sla_in_scadenza",
    titolo: "SLA in scadenza",
    descrizione:
      "Ticket vicini alla soglia SLA o già fuori tempo, in base alla priorità.",
    larghezzaDefault: 6,
    altezzaDefault: 7,
    gruppo: "Operativo",
  },
  {
    id: "attivita_ferme",
    titolo: "Attività ferme",
    descrizione: "Nessun aggiornamento da oltre 15 giorni.",
    larghezzaDefault: 6,
    altezzaDefault: 7,
    gruppo: "Operativo",
  },
  {
    id: "bloccati_business",
    titolo: "Bloccati da Business",
    descrizione:
      "In attesa di una risposta dal business, con i giorni di attesa.",
    larghezzaDefault: 6,
    altezzaDefault: 7,
    gruppo: "Operativo",
  },
  {
    id: "ultimo_ping",
    titolo: "Ultimo ping",
    descrizione: "Nessun contatto da oltre 15 giorni o mai pingati.",
    larghezzaDefault: 6,
    altezzaDefault: 7,
    gruppo: "Operativo",
  },
  {
    id: "note_importanti",
    titolo: "Note importanti",
    descrizione:
      "Scrivi e consulta le tue note, con filtro per tipo e creazione rapida.",
    larghezzaDefault: 6,
    altezzaDefault: 9,
    gruppo: "Operativo",
  },
  {
    id: "notifiche_importanti",
    titolo: "Notifiche importanti",
    descrizione:
      "Escalation, attenzione business e ticket con note importanti.",
    larghezzaDefault: 6,
    altezzaDefault: 7,
    gruppo: "Operativo",
  },
  {
    id: "prossime_scadenze",
    titolo: "Prossime scadenze",
    descrizione: "Rilasci in collaudo e produzione dei prossimi 14 giorni.",
    larghezzaDefault: 6,
    altezzaDefault: 7,
    gruppo: "Operativo",
  },
  {
    id: "carico_team",
    titolo: "Carico di lavoro del team",
    descrizione: "Ticket aperti per assegnatario, con urgenti e fermi.",
    larghezzaDefault: 12,
    altezzaDefault: 9,
    gruppo: "Team",
  },
  {
    id: "grafico_stati",
    titolo: "Distribuzione per stato",
    descrizione: "Quanti ticket ci sono in ogni stato.",
    larghezzaDefault: 6,
    altezzaDefault: 8,
    gruppo: "Analisi",
  },
  {
    id: "grafico_tempi",
    titolo: "Tempi di risoluzione",
    descrizione: "Giorni medi dalla creazione alla chiusura, per mese.",
    larghezzaDefault: 12,
    altezzaDefault: 8,
    gruppo: "Analisi",
  },
  {
    id: "ticket_custom",
    titolo: "Card personalizzata",
    descrizione:
      "Scegli quali ticket vedere, come visualizzarli e quali campi mostrare.",
    larghezzaDefault: 6,
    altezzaDefault: 7,
    gruppo: "Personalizzata",
    multiplo: true,
  },
  {
    id: "nota_singola",
    titolo: "Nota",
    descrizione:
      "Tieni sotto gli occhi una nota del note board, con le sue voci da spuntare.",
    larghezzaDefault: 4,
    altezzaDefault: 8,
    gruppo: "Personalizzata",
    multiplo: true,
  },
];

/** Id delle card che possono comparire più volte sulla home. */
export const WIDGET_MULTIPLI = new Set<HomeWidgetId>(
  WIDGET_CATALOG.filter((widget) => widget.multiplo).map((widget) => widget.id)
);

export const WIDGET_BY_ID = new Map(
  WIDGET_CATALOG.map((widget) => [widget.id, widget])
);

/* ------------------------------------------------------------------ */
/* Card personalizzata: configurazione                                 */
/* ------------------------------------------------------------------ */

export type ModoVisualizzazione = "lista" | "tabella" | "conteggio";

export type OrdinamentoCard = "priorita" | "recenti" | "vecchi" | "ping";

/** Campi del ticket selezionabili nella card personalizzata. */
export const CAMPI_TICKET_CARD = [
  "n_tag",
  "titolo",
  "stato",
  "priorita",
  "tipo_di_attivita",
  "tipologia_ticket",
  "sprint",
  "applicativo",
  "percentuale_avanzamento",
  "cliente",
  "assegnatario",
  "data_chiusura_attivita",
  "rilascio_in_produzione",
  "ultimo_ping",
  "note_importanti",
  "creato_at",
] as const;

export type CampoTicketCard = (typeof CAMPI_TICKET_CARD)[number];

export function etichettaCampoCard(campo: string): string {
  if (campo === "cliente") return "Cliente";
  if (campo === "assegnatario") return "Assegnatario";
  return (TICKET_FIELD_LABELS as Record<string, string>)[campo] ?? campo;
}

export type CustomCardConfig = {
  titolo: string;
  /** Filtri avanzati: gruppi di condizioni in AND/OR, inclusione ed esclusione. */
  filtri: FiltroAvanzato;
  soloMiei: boolean;
  soloAperti: boolean;
  modo: ModoVisualizzazione;
  ordina: OrdinamentoCard;
  limite: number;
  campi: string[];
};

export function defaultCustomConfig(): CustomCardConfig {
  return {
    titolo: "Nuova card",
    filtri: filtroVuoto(),
    soloMiei: false,
    soloAperti: true,
    modo: "lista",
    ordina: "priorita",
    limite: 15,
    campi: ["stato", "priorita", "cliente"],
  };
}

/** Opzioni offerte nell'editor della card. */
export const OPZIONI_STATO = [...STATO_TICKET_LIST];
export const OPZIONI_PRIORITA = [...PRIORITA_LIST];
export const OPZIONI_APPLICATIVO = APPLICATIVI_LIST.filter((a) => a !== "ALL");
export const OPZIONI_TIPOLOGIA = [...TIPOLOGIA_TICKET];

export const MODI_VISUALIZZAZIONE: { value: ModoVisualizzazione; label: string }[] = [
  { value: "lista", label: "Lista" },
  { value: "tabella", label: "Tabella" },
  { value: "conteggio", label: "Solo conteggio" },
];

export const ORDINAMENTI_CARD: { value: OrdinamentoCard; label: string }[] = [
  { value: "priorita", label: "Priorità" },
  { value: "recenti", label: "Più recenti" },
  { value: "vecchi", label: "Più vecchi" },
  { value: "ping", label: "Ultimo ping" },
];

/* ------------------------------------------------------------------ */
/* Card legata a una nota                                              */
/* ------------------------------------------------------------------ */

export type NotaCardConfig = {
  /** Id della nota in editor_notes; null finché non se ne sceglie una. */
  noteId: string | null;
  /** Titolo della card; vuoto = si usa il nome della nota. */
  titolo: string;
  /** Sola lettura: la card mostra la nota ma non la lascia modificare. */
  soloLettura: boolean;
};

export function defaultNotaConfig(): NotaCardConfig {
  return { noteId: null, titolo: "", soloLettura: false };
}

function normalizeNotaConfig(value: unknown): NotaCardConfig {
  const base = defaultNotaConfig();
  if (!value || typeof value !== "object") return base;

  const c = value as Record<string, unknown>;

  return {
    noteId: typeof c.noteId === "string" && c.noteId ? c.noteId : null,
    titolo: typeof c.titolo === "string" ? c.titolo : "",
    soloLettura: c.soloLettura === true,
  };
}

export type HomeWidgetLayoutItem = {
  /** Chiave d'istanza univoca: per le card fisse coincide con l'id. */
  key: string;
  id: HomeWidgetId;
  /** Colonne occupate sulla griglia desktop a 12. */
  larghezza: number;
  /** Righe occupate sulla griglia desktop. */
  altezza: number;
  /** Id della tinta scelta dalla palette. */
  color?: WidgetColor;
  /** Colore libero in esadecimale; se presente ha la precedenza sulla palette. */
  colorHex?: string;
  /** Presente solo per le card personalizzate sui ticket. */
  config?: CustomCardConfig;
  /** Presente solo per le card legate a una nota. */
  notaConfig?: NotaCardConfig;
};

/* ------------------------------------------------------------------ */
/* Colori delle card                                                   */
/* ------------------------------------------------------------------ */

export type WidgetColor = string;

export type PaletteColor = {
  id: string;
  label: string;
  /** Tinta di partenza; vuota per il bianco/superficie neutra. */
  base: string;
};

/**
 * La palette elenca solo la tinta di partenza: sfondo e bordo, in chiaro
 * come in scuro, sono derivati da qui con la stessa formula usata per il
 * colore libero. Così una tinta scelta a mano si comporta esattamente
 * come una predefinita e resta sempre leggibile col testo scuro.
 */
export const WIDGET_COLORS: PaletteColor[] = [
  { id: "bianco", label: "Bianco", base: "" },
  { id: "slate", label: "Grigio", base: "#64748b" },
  { id: "stone", label: "Sabbia", base: "#78716c" },
  { id: "red", label: "Rosso", base: "#ef4444" },
  { id: "orange", label: "Arancio", base: "#f97316" },
  { id: "amber", label: "Ambra", base: "#f59e0b" },
  { id: "yellow", label: "Giallo", base: "#eab308" },
  { id: "lime", label: "Lime", base: "#84cc16" },
  { id: "green", label: "Verde", base: "#22c55e" },
  { id: "emerald", label: "Smeraldo", base: "#10b981" },
  { id: "teal", label: "Verde acqua", base: "#14b8a6" },
  { id: "cyan", label: "Ciano", base: "#06b6d4" },
  { id: "sky", label: "Celeste", base: "#0ea5e9" },
  { id: "blue", label: "Blu", base: "#3b82f6" },
  { id: "indigo", label: "Indaco", base: "#6366f1" },
  { id: "violet", label: "Viola", base: "#8b5cf6" },
  { id: "purple", label: "Porpora", base: "#a855f7" },
  { id: "fuchsia", label: "Fucsia", base: "#d946ef" },
  { id: "pink", label: "Rosa", base: "#ec4899" },
  { id: "rose", label: "Rosa antico", base: "#f43f5e" },
];

export const DEFAULT_WIDGET_COLOR: WidgetColor = "bianco";

const COLOR_BY_ID = new Map(WIDGET_COLORS.map((color) => [color.id, color]));

/** Vecchi identificativi italiani salvati prima della palette estesa. */
const COLORI_LEGACY: Record<string, string> = {
  grigio: "slate",
  blu: "blue",
  verde: "emerald",
  ambra: "amber",
  rosso: "red",
  viola: "violet",
};

const HEX_VALIDO = /^#[0-9a-f]{6}$/i;

export function normalizzaHex(value: unknown): string | null {
  if (typeof value !== "string") return null;

  let hex = value.trim();
  if (!hex.startsWith("#")) hex = `#${hex}`;

  // Forma corta #abc -> #aabbcc
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }

  return HEX_VALIDO.test(hex) ? hex.toLowerCase() : null;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Fonde due colori: quota 0 = tutto `a`, quota 1 = tutto `b`. */
function mescola(a: string, b: string, quota: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);

  return rgbToHex([
    r1 + (r2 - r1) * quota,
    g1 + (g2 - g1) * quota,
    b1 + (b2 - b1) * quota,
  ]);
}

/** Superfici neutre usate come base della fusione nei due temi. */
const SUPERFICIE_CHIARA = "#ffffff";
const SUPERFICIE_SCURA = "#12161d";

export type ColoriCard = {
  sfondoChiaro: string;
  bordoChiaro: string;
  sfondoScuro: string;
  bordoScuro: string;
  /** Tinta piena, per la pastiglia del selettore. */
  pastiglia: string;
};

/**
 * Deriva le quattro tinte di una card da un colore di partenza.
 *
 * Lo sfondo resta una velatura molto tenue della tinta scelta: in questo
 * modo il testo scuro della card rimane leggibile qualunque colore venga
 * scelto, e non serve ricalcolare il colore del testo.
 */
export function derivaColoriCard(base: string | null | undefined): ColoriCard {
  const tinta = normalizzaHex(base ?? "");

  if (!tinta) {
    return {
      sfondoChiaro: SUPERFICIE_CHIARA,
      bordoChiaro: "#e2e8f0",
      sfondoScuro: SUPERFICIE_SCURA,
      bordoScuro: "#252b36",
      pastiglia: SUPERFICIE_CHIARA,
    };
  }

  return {
    sfondoChiaro: mescola(tinta, SUPERFICIE_CHIARA, 0.88),
    bordoChiaro: mescola(tinta, SUPERFICIE_CHIARA, 0.7),
    sfondoScuro: mescola(tinta, SUPERFICIE_SCURA, 0.84),
    bordoScuro: mescola(tinta, SUPERFICIE_SCURA, 0.66),
    pastiglia: tinta,
  };
}

/** Colori effettivi di una card, dando la precedenza al colore libero. */
export function coloriDellaCard(item: {
  color?: WidgetColor;
  colorHex?: string;
}): ColoriCard {
  const libero = normalizzaHex(item.colorHex);
  if (libero) return derivaColoriCard(libero);

  const id = item.color ?? DEFAULT_WIDGET_COLOR;
  const palette = COLOR_BY_ID.get(COLORI_LEGACY[id] ?? id);

  return derivaColoriCard(palette?.base || null);
}

/** Variabili CSS da applicare alla card; il tema scuro le usa da globals.css. */
export function variabiliColoreCard(item: {
  color?: WidgetColor;
  colorHex?: string;
}): Record<string, string> {
  const colori = coloriDellaCard(item);

  return {
    "--card-bg": colori.sfondoChiaro,
    "--card-border": colori.bordoChiaro,
    "--card-bg-dark": colori.sfondoScuro,
    "--card-border-dark": colori.bordoScuro,
  };
}

export const DEFAULT_HOME_LAYOUT: HomeWidgetLayoutItem[] = WIDGET_CATALOG.filter(
  (widget) =>
    [
      "attivita_assegnate",
      "sla_in_scadenza",
      "ticket_urgenti",
      "attivita_ferme",
      "bloccati_business",
      "ultimo_ping",
      "note_importanti",
      "carico_team",
      "grafico_stati",
    ].includes(widget.id)
).map((widget) => ({
  key: widget.id,
  id: widget.id,
  larghezza: widget.larghezzaDefault,
  altezza: widget.altezzaDefault,
  color: DEFAULT_WIDGET_COLOR,
}));

function normalizeCustomConfig(value: unknown): CustomCardConfig {
  const base = defaultCustomConfig();
  if (!value || typeof value !== "object") return base;

  const c = value as Record<string, unknown>;
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  // Le card salvate prima dei filtri avanzati hanno gli elenchi piatti:
  // vengono convertite una volta sola, mantenendo lo stesso risultato.
  const filtri =
    c.filtri !== undefined
      ? normalizzaFiltro(c.filtri)
      : migraFiltriLegacy({
          filtroTitolo: c.filtroTitolo,
          stati: c.stati,
          priorita: c.priorita,
          clienti: c.clienti,
          applicativi: c.applicativi,
          tipologie: c.tipologie,
        });

  return {
    titolo: typeof c.titolo === "string" && c.titolo.trim() ? c.titolo : base.titolo,
    filtri,
    soloMiei: c.soloMiei === true,
    soloAperti: c.soloAperti !== false,
    modo:
      c.modo === "lista" || c.modo === "tabella" || c.modo === "conteggio"
        ? c.modo
        : base.modo,
    ordina:
      c.ordina === "priorita" ||
      c.ordina === "recenti" ||
      c.ordina === "vecchi" ||
      c.ordina === "ping"
        ? c.ordina
        : base.ordina,
    limite:
      typeof c.limite === "number" && c.limite > 0 && c.limite <= 100
        ? Math.round(c.limite)
        : base.limite,
    campi: arr(c.campi).length > 0 ? arr(c.campi) : base.campi,
  };
}

function nuovaChiave() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Valida un layout arrivato dal client o dal database. */
export function normalizeLayout(value: unknown): HomeWidgetLayoutItem[] {
  if (!Array.isArray(value)) return DEFAULT_HOME_LAYOUT;

  const seen = new Set<string>();
  const layout: HomeWidgetLayoutItem[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const { id, size, larghezza, altezza, color, colorHex, key, config } =
      item as {
        id?: unknown;
        size?: unknown;
        larghezza?: unknown;
        altezza?: unknown;
        color?: unknown;
        colorHex?: unknown;
        key?: unknown;
        config?: unknown;
      };

    if (typeof id !== "string") continue;

    const widget = WIDGET_BY_ID.get(id as HomeWidgetId);
    if (!widget) continue;

    const isCustom = id === "ticket_custom";
    const isNota = id === "nota_singola";
    const isMultiplo = WIDGET_MULTIPLI.has(widget.id);

    // Le card fisse hanno una sola istanza (chiave = id); quelle multiple
    // possono ripetersi, ciascuna con la propria chiave.
    const chiave =
      isMultiplo && typeof key === "string" && key
        ? key
        : isMultiplo
          ? nuovaChiave()
          : id;

    if (seen.has(chiave)) continue;
    seen.add(chiave);

    // Layout salvati con le vecchie taglie fisse: sm/md/lg diventano
    // colonne, l'altezza parte da quella di catalogo.
    const larghezzaSalvata =
      typeof larghezza === "number"
        ? larghezza
        : typeof size === "string" && size in LARGHEZZA_DA_SIZE
          ? LARGHEZZA_DA_SIZE[size as WidgetSize]
          : widget.larghezzaDefault;

    const idColore =
      typeof color === "string"
        ? (COLORI_LEGACY[color] ?? color)
        : DEFAULT_WIDGET_COLOR;

    layout.push({
      key: chiave,
      id: widget.id,
      larghezza: limitaLarghezza(larghezzaSalvata),
      altezza: limitaAltezza(
        typeof altezza === "number" ? altezza : widget.altezzaDefault
      ),
      color: COLOR_BY_ID.has(idColore) ? idColore : DEFAULT_WIDGET_COLOR,
      ...(normalizzaHex(colorHex)
        ? { colorHex: normalizzaHex(colorHex) as string }
        : {}),
      ...(isCustom ? { config: normalizeCustomConfig(config) } : {}),
      ...(isNota
        ? {
            notaConfig: normalizeNotaConfig(
              (item as { notaConfig?: unknown }).notaConfig
            ),
          }
        : {}),
    });
  }

  return layout;
}

/** Crea una nuova istanza di card legata a una nota. */
export function creaCardNota(
  config?: Partial<NotaCardConfig>
): HomeWidgetLayoutItem {
  const widget = WIDGET_BY_ID.get("nota_singola")!;

  return {
    key: nuovaChiave(),
    id: "nota_singola",
    larghezza: widget.larghezzaDefault,
    altezza: widget.altezzaDefault,
    color: DEFAULT_WIDGET_COLOR,
    notaConfig: { ...defaultNotaConfig(), ...config },
  };
}

/** Crea una nuova istanza di card personalizzata. */
export function creaCardPersonalizzata(
  config?: Partial<CustomCardConfig>
): HomeWidgetLayoutItem {
  const widget = WIDGET_BY_ID.get("ticket_custom")!;

  return {
    key: nuovaChiave(),
    id: "ticket_custom",
    larghezza: widget.larghezzaDefault,
    altezza: widget.altezzaDefault,
    color: DEFAULT_WIDGET_COLOR,
    config: { ...defaultCustomConfig(), ...config },
  };
}

/* ------------------------------------------------------------------ */
/* Logica derivata sui ticket                                          */
/* ------------------------------------------------------------------ */

export type TicketLike = Record<string, any>;

/** Giorni concessi prima della scadenza SLA, per priorità. */
export const SLA_GIORNI_PER_PRIORITA: Record<string, number> = {
  Alta: 3,
  Media: 7,
  Bassa: 15,
};

export const SLA_GIORNI_DEFAULT = 7;

/** Entro quanti giorni dalla scadenza un ticket è considerato "in scadenza". */
export const SLA_SOGLIA_ALERT_GIORNI = 2;

/** Giorni senza aggiornamenti oltre i quali un ticket è considerato fermo. */
export const GIORNI_TICKET_FERMO = 15;

const STATI_CHIUSI = new Set(["Completato", "Cancellato"]);

export function isTicketChiuso(ticket: TicketLike) {
  return STATI_CHIUSI.has(String(ticket.stato ?? ""));
}

export function isTicketAperto(ticket: TicketLike) {
  return !isTicketChiuso(ticket);
}

function toDate(value: unknown): Date | null {
  if (!value) return null;

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function giorniTra(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export type SlaInfo = {
  /** Giorni concessi in base alla priorità. */
  giorniConcessi: number;
  scadenza: Date | null;
  /** Negativo = già scaduto. */
  giorniResidui: number | null;
  scaduto: boolean;
  inScadenza: boolean;
};

export function getSlaInfo(ticket: TicketLike, now = new Date()): SlaInfo {
  const giorniConcessi =
    SLA_GIORNI_PER_PRIORITA[String(ticket.priorita ?? "")] ?? SLA_GIORNI_DEFAULT;

  const creazione = toDate(ticket.creato_at);

  if (!creazione || isTicketChiuso(ticket)) {
    return {
      giorniConcessi,
      scadenza: null,
      giorniResidui: null,
      scaduto: false,
      inScadenza: false,
    };
  }

  const scadenza = new Date(creazione);
  scadenza.setDate(scadenza.getDate() + giorniConcessi);

  const giorniResidui = giorniTra(now, scadenza);

  return {
    giorniConcessi,
    scadenza,
    giorniResidui,
    scaduto: giorniResidui < 0,
    inScadenza: giorniResidui >= 0 && giorniResidui <= SLA_SOGLIA_ALERT_GIORNI,
  };
}

/** Data dell'ultimo segnale di vita del ticket. */
export function getUltimoAggiornamento(ticket: TicketLike): Date | null {
  return (
    toDate(ticket.ultimo_ping) ??
    toDate(ticket.ultimo_controllo_collaudo) ??
    toDate(ticket.creato_at)
  );
}

export function getGiorniFermo(ticket: TicketLike, now = new Date()) {
  const ultimo = getUltimoAggiornamento(ticket);
  if (!ultimo) return null;

  return giorniTra(ultimo, now);
}

export function isTicketFermo(ticket: TicketLike, now = new Date()) {
  if (isTicketChiuso(ticket)) return false;
  if (ticket.in_lavorazione_ora) return false;

  const giorni = getGiorniFermo(ticket, now);
  return giorni !== null && giorni > GIORNI_TICKET_FERMO;
}

export function isTicketUrgente(ticket: TicketLike) {
  if (isTicketChiuso(ticket)) return false;

  const peso = PRIORITA_NUMBER_MAP[String(ticket.priorita ?? "")] ?? 0;
  return peso >= 3;
}

/* ------------------------------------------------------------------ */
/* Bloccati da Business                                                */
/* ------------------------------------------------------------------ */

/** Stati che indicano un'attesa esterna al team tecnico. */
const STATI_BLOCCO_BUSINESS = new Set([
  "Attenzione Business",
  "In stand-by",
  "Attività Sospesa",
]);

/** Interlocutori esterni al team di sviluppo. */
const PERSONE_BUSINESS = new Set(["Business", "Cliente"]);

export function isBloccatoDaBusiness(ticket: TicketLike) {
  if (isTicketChiuso(ticket)) return false;

  const stato = String(ticket.stato ?? "");
  const person = String(ticket.person ?? "");

  // "Attenzione Business" basta da solo; gli stati di attesa generica
  // contano solo se la palla è in mano al business o al cliente.
  if (stato === "Attenzione Business") return true;

  return STATI_BLOCCO_BUSINESS.has(stato) && PERSONE_BUSINESS.has(person);
}

/** Da quanti giorni il ticket è in attesa del business. */
export function getGiorniAttesaBusiness(ticket: TicketLike, now = new Date()) {
  const riferimento = getUltimoAggiornamento(ticket);
  if (!riferimento) return null;

  return giorniTra(riferimento, now);
}

/* ------------------------------------------------------------------ */
/* Ultimo ping                                                         */
/* ------------------------------------------------------------------ */

/** Giorni oltre i quali il ticket va ripingato. */
export const GIORNI_SOGLIA_PING = 15;

export type PingInfo = {
  /** null = mai pingato. */
  giorniDaUltimoPing: number | null;
  ultimoPing: Date | null;
  scaduto: boolean;
};

export function getPingInfo(ticket: TicketLike, now = new Date()): PingInfo {
  const ultimoPing = toDate(ticket.ultimo_ping);

  if (!ultimoPing) {
    return { giorniDaUltimoPing: null, ultimoPing: null, scaduto: true };
  }

  const giorni = giorniTra(ultimoPing, now);

  return {
    giorniDaUltimoPing: giorni,
    ultimoPing,
    scaduto: giorni > GIORNI_SOGLIA_PING,
  };
}

/** Ticket aperti mai pingati o senza contatto da oltre la soglia. */
export function isPingScaduto(ticket: TicketLike, now = new Date()) {
  if (isTicketChiuso(ticket)) return false;

  return getPingInfo(ticket, now).scaduto;
}

/** Motivi per cui un ticket finisce tra le notifiche importanti. */
export function getMotiviNotifica(ticket: TicketLike): string[] {
  if (isTicketChiuso(ticket)) return [];

  const motivi: string[] = [];

  if (ticket.escalation_donatello) motivi.push("Escalation");
  if (ticket.email_andrea) motivi.push("Email Andrea");
  if (String(ticket.stato ?? "") === "Attenzione Business")
    motivi.push("Attenzione Business");
  if (String(ticket.stato ?? "") === "Attenzione di Andrea")
    motivi.push("Attenzione Andrea");
  if (String(ticket.note_importanti ?? "").trim()) motivi.push("Nota importante");
  if (ticket.i_ping) motivi.push("Ping richiesto");

  return motivi;
}

/** Prossimi rilasci (collaudo/produzione) entro N giorni. */
export type ScadenzaRilascio = {
  ticket: TicketLike;
  tipo: "Collaudo" | "Produzione";
  data: Date;
  giorniResidui: number;
};

export function getProssimeScadenze(
  tickets: TicketLike[],
  giorni = 14,
  now = new Date()
): ScadenzaRilascio[] {
  const scadenze: ScadenzaRilascio[] = [];

  for (const ticket of tickets) {
    if (isTicketChiuso(ticket)) continue;

    const collaudo = toDate(ticket.rilascio_in_collaudo);
    const produzione = toDate(ticket.rilascio_in_produzione);

    if (collaudo && !ticket.rilascio_collaudo_eseguito) {
      const residui = giorniTra(now, collaudo);
      if (residui >= -1 && residui <= giorni) {
        scadenze.push({
          ticket,
          tipo: "Collaudo",
          data: collaudo,
          giorniResidui: residui,
        });
      }
    }

    if (produzione && !ticket.rilascio_produzione_eseguito) {
      const residui = giorniTra(now, produzione);
      if (residui >= -1 && residui <= giorni) {
        scadenze.push({
          ticket,
          tipo: "Produzione",
          data: produzione,
          giorniResidui: residui,
        });
      }
    }
  }

  return scadenze.sort((a, b) => a.data.getTime() - b.data.getTime());
}

/* ------------------------------------------------------------------ */
/* Aggregazioni                                                        */
/* ------------------------------------------------------------------ */

export type CaricoPersona = {
  id: string;
  nome: string;
  aperti: number;
  urgenti: number;
  fermi: number;
  inLavorazione: number;
  avanzamentoMedio: number;
};

export function getCaricoTeam(
  tickets: TicketLike[],
  profili: TicketLike[],
  now = new Date()
): CaricoPersona[] {
  const nomePerId = new Map(
    profili.map((profilo: any) => [
      profilo.id,
      profilo.nome_completo || profilo.nome || profilo.email || "Senza nome",
    ])
  );

  const gruppi = new Map<string, TicketLike[]>();

  for (const ticket of tickets) {
    if (isTicketChiuso(ticket)) continue;

    const key = ticket.assignee ? String(ticket.assignee) : "__non_assegnati__";
    const list = gruppi.get(key) ?? [];

    list.push(ticket);
    gruppi.set(key, list);
  }

  const carico: CaricoPersona[] = [];

  for (const [id, list] of gruppi.entries()) {
    const avanzamenti = list.map((ticket) => {
      if (typeof ticket.percentuale_avanzamento === "number") {
        return ticket.percentuale_avanzamento;
      }

      return STATO_PROGRESS_MAP[String(ticket.stato ?? "")] ?? 0;
    });

    carico.push({
      id,
      nome:
        id === "__non_assegnati__"
          ? "Non assegnati"
          : nomePerId.get(id) ?? "Sconosciuto",
      aperti: list.length,
      urgenti: list.filter(isTicketUrgente).length,
      fermi: list.filter((ticket) => isTicketFermo(ticket, now)).length,
      inLavorazione: list.filter((ticket) => ticket.in_lavorazione_ora).length,
      avanzamentoMedio: avanzamenti.length
        ? Math.round(
            avanzamenti.reduce((sum, value) => sum + value, 0) /
              avanzamenti.length
          )
        : 0,
    });
  }

  return carico.sort((a, b) => b.aperti - a.aperti);
}

export type DistribuzioneStato = {
  stato: string;
  totale: number;
};

export function getDistribuzioneStati(
  tickets: TicketLike[]
): DistribuzioneStato[] {
  const conteggi = new Map<string, number>();

  for (const ticket of tickets) {
    if (isTicketChiuso(ticket)) continue;

    const stato = String(ticket.stato ?? "Non definito");
    conteggi.set(stato, (conteggi.get(stato) ?? 0) + 1);
  }

  return Array.from(conteggi.entries())
    .map(([stato, totale]) => ({ stato, totale }))
    .sort((a, b) => b.totale - a.totale);
}

export type TempoRisoluzioneMese = {
  mese: string;
  giorniMedi: number;
  chiusi: number;
};

export function getTempiRisoluzione(
  tickets: TicketLike[],
  mesi = 6
): TempoRisoluzioneMese[] {
  const gruppi = new Map<string, number[]>();

  for (const ticket of tickets) {
    const chiusura =
      toDate(ticket.data_chiusura_attivita) ??
      (String(ticket.stato ?? "") === "Completato"
        ? toDate(ticket.ultimo_ping)
        : null);

    const creazione = toDate(ticket.creato_at);

    if (!chiusura || !creazione) continue;

    const giorni = giorniTra(creazione, chiusura);
    if (giorni < 0) continue;

    const key = `${chiusura.getFullYear()}-${String(
      chiusura.getMonth() + 1
    ).padStart(2, "0")}`;

    const list = gruppi.get(key) ?? [];
    list.push(giorni);
    gruppi.set(key, list);
  }

  return Array.from(gruppi.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-mesi)
    .map(([key, valori]) => {
      const [anno, mese] = key.split("-");
      const label = new Date(Number(anno), Number(mese) - 1, 1).toLocaleDateString(
        "it-IT",
        { month: "short", year: "2-digit" }
      );

      return {
        mese: label,
        giorniMedi:
          Math.round(
            (valori.reduce((sum, value) => sum + value, 0) / valori.length) * 10
          ) / 10,
        chiusi: valori.length,
      };
    });
}

/* ------------------------------------------------------------------ */
/* Card personalizzata: filtro, ordinamento e valore dei campi         */
/* ------------------------------------------------------------------ */

/** Applica filtri e ordinamento di una card personalizzata. */
export function filtraTicketCard(
  tickets: TicketLike[],
  config: CustomCardConfig,
  userId: string | null
): TicketLike[] {
  // Calcolato una volta sola: con "ultimi N giorni" ogni condizione
  // ricalcolerebbe l'ora corrente, e a cavallo della mezzanotte due
  // ticket identici potrebbero finire uno dentro e uno fuori.
  const ora = new Date();
  const filtrati = tickets.filter((ticket) => {
    if (config.soloMiei && userId && String(ticket.assignee ?? "") !== userId) {
      return false;
    }

    if (config.soloAperti && isTicketChiuso(ticket)) return false;

    return valutaFiltro(ticket, config.filtri, ora);
  });

  const ordinati = [...filtrati].sort((a, b) => {
    switch (config.ordina) {
      case "recenti":
        return (
          new Date(b.creato_at ?? 0).getTime() -
          new Date(a.creato_at ?? 0).getTime()
        );
      case "vecchi":
        return (
          new Date(a.creato_at ?? 0).getTime() -
          new Date(b.creato_at ?? 0).getTime()
        );
      case "ping":
        return (
          new Date(a.ultimo_ping ?? 0).getTime() -
          new Date(b.ultimo_ping ?? 0).getTime()
        );
      case "priorita":
      default:
        return (a.numero_priorita ?? 99) - (b.numero_priorita ?? 99);
    }
  });

  return ordinati.slice(0, config.limite || 15);
}

/** Valore leggibile di un campo per la card personalizzata. */
export function valoreCampoCard(ticket: TicketLike, campo: string): string {
  if (campo === "cliente") return ticket.clienti?.nome ?? "—";
  if (campo === "assegnatario") {
    return (
      ticket.profili?.nome_completo ??
      ticket.assegnatario_profilo?.nome_completo ??
      "—"
    );
  }

  const valore = (ticket as Record<string, unknown>)[campo];

  if (valore === null || valore === undefined || valore === "") return "—";
  if (typeof valore === "boolean") return valore ? "Sì" : "No";
  if (Array.isArray(valore)) return valore.join(", ") || "—";

  const testo = String(valore);
  const campiData = [
    "data_chiusura_attivita",
    "rilascio_in_collaudo",
    "rilascio_in_produzione",
    "ultimo_ping",
    "ultimo_controllo_collaudo",
    "creato_at",
  ];

  if (campiData.includes(campo)) {
    const data = new Date(testo);
    if (!Number.isNaN(data.getTime())) {
      return data.toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      });
    }
  }

  if (campo === "percentuale_avanzamento") return `${testo}%`;

  return testo;
}
