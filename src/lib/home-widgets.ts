// src/lib/home-widgets.ts
// Catalogo dei widget della home + logica derivata (SLA, ticket fermi, carico team).

import {
  PRIORITA_NUMBER_MAP,
  STATO_PROGRESS_MAP,
} from "@/components/parametri_ticket/attivita";

/* ------------------------------------------------------------------ */
/* Catalogo                                                            */
/* ------------------------------------------------------------------ */

export type WidgetSize = "sm" | "md" | "lg";

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
  | "grafico_tempi";

export type HomeWidgetConfig = {
  id: HomeWidgetId;
  titolo: string;
  descrizione: string;
  /** Larghezza di default in colonne (griglia a 6 colonne su desktop). */
  defaultSize: WidgetSize;
  /** Dimensioni ammesse per questo widget. */
  sizes: WidgetSize[];
  gruppo: "Operativo" | "Team" | "Analisi";
};

export const WIDGET_CATALOG: HomeWidgetConfig[] = [
  {
    id: "attivita_assegnate",
    titolo: "Attività assegnate a me",
    descrizione: "I ticket aperti su cui risulti assegnatario.",
    defaultSize: "md",
    sizes: ["sm", "md", "lg"],
    gruppo: "Operativo",
  },
  {
    id: "ticket_urgenti",
    titolo: "Ticket urgenti",
    descrizione: "Priorità Alta ancora aperti, ordinati per anzianità.",
    defaultSize: "md",
    sizes: ["sm", "md", "lg"],
    gruppo: "Operativo",
  },
  {
    id: "sla_in_scadenza",
    titolo: "SLA in scadenza",
    descrizione:
      "Ticket vicini alla soglia SLA o già fuori tempo, in base alla priorità.",
    defaultSize: "md",
    sizes: ["sm", "md", "lg"],
    gruppo: "Operativo",
  },
  {
    id: "attivita_ferme",
    titolo: "Attività ferme",
    descrizione: "Nessun aggiornamento da oltre 15 giorni.",
    defaultSize: "md",
    sizes: ["sm", "md", "lg"],
    gruppo: "Operativo",
  },
  {
    id: "bloccati_business",
    titolo: "Bloccati da Business",
    descrizione:
      "In attesa di una risposta dal business, con i giorni di attesa.",
    defaultSize: "md",
    sizes: ["sm", "md", "lg"],
    gruppo: "Operativo",
  },
  {
    id: "ultimo_ping",
    titolo: "Ultimo ping",
    descrizione: "Nessun contatto da oltre 15 giorni o mai pingati.",
    defaultSize: "md",
    sizes: ["sm", "md", "lg"],
    gruppo: "Operativo",
  },
  {
    id: "note_importanti",
    titolo: "Note importanti",
    descrizione:
      "Scrivi e consulta le tue note, con filtro per tipo e creazione rapida.",
    defaultSize: "md",
    sizes: ["md", "lg"],
    gruppo: "Operativo",
  },
  {
    id: "notifiche_importanti",
    titolo: "Notifiche importanti",
    descrizione:
      "Escalation, attenzione business e ticket con note importanti.",
    defaultSize: "md",
    sizes: ["sm", "md", "lg"],
    gruppo: "Operativo",
  },
  {
    id: "prossime_scadenze",
    titolo: "Prossime scadenze",
    descrizione: "Rilasci in collaudo e produzione dei prossimi 14 giorni.",
    defaultSize: "md",
    sizes: ["sm", "md", "lg"],
    gruppo: "Operativo",
  },
  {
    id: "carico_team",
    titolo: "Carico di lavoro del team",
    descrizione: "Ticket aperti per assegnatario, con urgenti e fermi.",
    defaultSize: "lg",
    sizes: ["md", "lg"],
    gruppo: "Team",
  },
  {
    id: "grafico_stati",
    titolo: "Distribuzione per stato",
    descrizione: "Quanti ticket ci sono in ogni stato.",
    defaultSize: "md",
    sizes: ["md", "lg"],
    gruppo: "Analisi",
  },
  {
    id: "grafico_tempi",
    titolo: "Tempi di risoluzione",
    descrizione: "Giorni medi dalla creazione alla chiusura, per mese.",
    defaultSize: "lg",
    sizes: ["md", "lg"],
    gruppo: "Analisi",
  },
];

export const WIDGET_BY_ID = new Map(
  WIDGET_CATALOG.map((widget) => [widget.id, widget])
);

export type HomeWidgetLayoutItem = {
  id: HomeWidgetId;
  size: WidgetSize;
  color?: WidgetColor;
};

/* ------------------------------------------------------------------ */
/* Colori delle card                                                   */
/* ------------------------------------------------------------------ */

export type WidgetColor =
  | "bianco"
  | "grigio"
  | "blu"
  | "verde"
  | "ambra"
  | "rosso"
  | "viola";

export const WIDGET_COLORS: {
  id: WidgetColor;
  label: string;
  /** Classi applicate alla card. */
  card: string;
  /** Pastiglia mostrata nel selettore. */
  swatch: string;
}[] = [
  {
    id: "bianco",
    label: "Bianco",
    card: "bg-white border-slate-200/80",
    swatch: "bg-white border-slate-300",
  },
  {
    id: "grigio",
    label: "Grigio",
    card: "bg-slate-50 border-slate-200",
    swatch: "bg-slate-200 border-slate-300",
  },
  {
    id: "blu",
    label: "Blu",
    card: "bg-blue-50/70 border-blue-100",
    swatch: "bg-blue-200 border-blue-300",
  },
  {
    id: "verde",
    label: "Verde",
    card: "bg-emerald-50/70 border-emerald-100",
    swatch: "bg-emerald-200 border-emerald-300",
  },
  {
    id: "ambra",
    label: "Ambra",
    card: "bg-amber-50/70 border-amber-100",
    swatch: "bg-amber-200 border-amber-300",
  },
  {
    id: "rosso",
    label: "Rosso",
    card: "bg-red-50/70 border-red-100",
    swatch: "bg-red-200 border-red-300",
  },
  {
    id: "viola",
    label: "Viola",
    card: "bg-violet-50/70 border-violet-100",
    swatch: "bg-violet-200 border-violet-300",
  },
];

export const DEFAULT_WIDGET_COLOR: WidgetColor = "bianco";

const COLOR_IDS = new Set(WIDGET_COLORS.map((color) => color.id));

export function getWidgetColorClasses(color?: WidgetColor) {
  return (
    WIDGET_COLORS.find((item) => item.id === color)?.card ??
    WIDGET_COLORS[0].card
  );
}

export const DEFAULT_HOME_LAYOUT: HomeWidgetLayoutItem[] = [
  { id: "attivita_assegnate", size: "md" },
  { id: "sla_in_scadenza", size: "md" },
  { id: "ticket_urgenti", size: "md" },
  { id: "attivita_ferme", size: "md" },
  { id: "bloccati_business", size: "md" },
  { id: "ultimo_ping", size: "md" },
  { id: "note_importanti", size: "md" },
  { id: "carico_team", size: "lg" },
  { id: "grafico_stati", size: "md" },
];

/**
 * Classi di griglia responsive.
 * Mobile: 1 colonna · tablet: 2 colonne · desktop: 6 colonne.
 */
export const SIZE_CLASSES: Record<WidgetSize, string> = {
  sm: "col-span-1 sm:col-span-1 lg:col-span-2",
  md: "col-span-1 sm:col-span-2 lg:col-span-3",
  lg: "col-span-1 sm:col-span-2 lg:col-span-6",
};

export const SIZE_LABELS: Record<WidgetSize, string> = {
  sm: "Stretta",
  md: "Media",
  lg: "Piena",
};

/** Valida un layout arrivato dal client o dal database. */
export function normalizeLayout(value: unknown): HomeWidgetLayoutItem[] {
  if (!Array.isArray(value)) return DEFAULT_HOME_LAYOUT;

  const seen = new Set<string>();
  const layout: HomeWidgetLayoutItem[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;

    const { id, size, color } = item as {
      id?: unknown;
      size?: unknown;
      color?: unknown;
    };

    if (typeof id !== "string") continue;

    const config = WIDGET_BY_ID.get(id as HomeWidgetId);
    if (!config || seen.has(id)) continue;

    seen.add(id);

    layout.push({
      id: config.id,
      size:
        typeof size === "string" && config.sizes.includes(size as WidgetSize)
          ? (size as WidgetSize)
          : config.defaultSize,
      color:
        typeof color === "string" && COLOR_IDS.has(color as WidgetColor)
          ? (color as WidgetColor)
          : DEFAULT_WIDGET_COLOR,
    });
  }

  return layout;
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
