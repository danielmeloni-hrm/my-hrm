// src/lib/home-filters.ts
// Motore dei filtri avanzati delle card personalizzate della home.
//
// Struttura: una card ha N gruppi di condizioni. Dentro ogni gruppo le
// condizioni si combinano con AND oppure OR; i gruppi fra loro con AND
// oppure OR. Un solo livello di annidamento, che copre praticamente ogni
// esigenza restando leggibile:
//
//   (stato è "In lavorazione" OR stato è "In attesa Sviluppo")
//   AND
//   (priorità non è "Bassa" AND cliente non è "HRM")

import {
  APPLICATIVI_LIST,
  ATTIVITA_LIST,
  PRIORITA_LIST,
  SPRINT_LIST,
  STATO_TICKET_LIST,
  TIPOLOGIA_TICKET,
} from "@/components/parametri_ticket/attivita";

export type TicketLike = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* Modello                                                             */
/* ------------------------------------------------------------------ */

export type LogicaFiltro = "and" | "or";

export type OperatoreFiltro =
  | "e"
  | "non_e"
  | "contiene"
  | "non_contiene"
  | "vuoto"
  | "non_vuoto"
  | "maggiore"
  | "minore"
  | "ultimi_giorni"
  | "oltre_giorni"
  | "vero"
  | "falso";

export type CondizioneFiltro = {
  id: string;
  campo: string;
  operatore: OperatoreFiltro;
  /** Usato dagli operatori a elenco (è / non è). */
  valori: string[];
  /** Usato dagli operatori a valore singolo (contiene, maggiore, giorni…). */
  valore: string;
};

export type GruppoFiltri = {
  id: string;
  /** Come si combinano le condizioni DENTRO il gruppo. */
  logica: LogicaFiltro;
  condizioni: CondizioneFiltro[];
};

export type FiltroAvanzato = {
  /** Come si combinano i gruppi FRA loro. */
  logica: LogicaFiltro;
  gruppi: GruppoFiltri[];
};

/* ------------------------------------------------------------------ */
/* Campi filtrabili                                                    */
/* ------------------------------------------------------------------ */

export type TipoCampoFiltro =
  | "testo"
  | "select"
  | "multi"
  | "numero"
  | "data"
  | "booleano";

export type CampoFiltro = {
  campo: string;
  label: string;
  tipo: TipoCampoFiltro;
  /** Opzioni fisse, per i campi a elenco chiuso. */
  opzioni?: readonly string[];
  /** Opzioni ricavate dai ticket caricati. */
  dinamico?: "clienti" | "assegnatari";
};

export const CAMPI_FILTRO: CampoFiltro[] = [
  { campo: "stato", label: "Stato", tipo: "select", opzioni: STATO_TICKET_LIST },
  { campo: "priorita", label: "Priorità", tipo: "select", opzioni: PRIORITA_LIST },
  {
    campo: "tipologia_ticket",
    label: "Tipologia",
    tipo: "select",
    opzioni: TIPOLOGIA_TICKET,
  },
  {
    campo: "tipo_di_attivita",
    label: "Tipo di attività",
    tipo: "select",
    opzioni: ATTIVITA_LIST,
  },
  { campo: "sprint", label: "Sprint", tipo: "select", opzioni: SPRINT_LIST },
  {
    campo: "applicativo",
    label: "Applicativo",
    tipo: "multi",
    opzioni: APPLICATIVI_LIST.filter((a) => a !== "ALL"),
  },
  { campo: "cliente", label: "Cliente", tipo: "select", dinamico: "clienti" },
  {
    campo: "assegnatario",
    label: "Assegnatario",
    tipo: "select",
    dinamico: "assegnatari",
  },
  { campo: "titolo", label: "Titolo", tipo: "testo" },
  { campo: "n_tag", label: "N° Tag", tipo: "testo" },
  { campo: "numero_storia", label: "N° Storia", tipo: "testo" },
  { campo: "descrizione", label: "Descrizione", tipo: "testo" },
  { campo: "note_importanti", label: "Note importanti", tipo: "testo" },
  {
    campo: "percentuale_avanzamento",
    label: "Avanzamento %",
    tipo: "numero",
  },
  { campo: "creato_at", label: "Data creazione", tipo: "data" },
  { campo: "ultimo_ping", label: "Ultimo ping", tipo: "data" },
  {
    campo: "rilascio_in_collaudo",
    label: "Rilascio in collaudo",
    tipo: "data",
  },
  {
    campo: "rilascio_in_produzione",
    label: "Rilascio in produzione",
    tipo: "data",
  },
  {
    campo: "data_chiusura_attivita",
    label: "Data chiusura",
    tipo: "data",
  },
  { campo: "i_ping", label: "I ping", tipo: "booleano" },
  {
    campo: "escalation_donatello",
    label: "Escalation Donatello",
    tipo: "booleano",
  },
  { campo: "email_andrea", label: "Email Andrea", tipo: "booleano" },
  {
    campo: "in_lavorazione_ora",
    label: "In lavorazione ora",
    tipo: "booleano",
  },
  { campo: "attivita_attive", label: "Attività attive", tipo: "booleano" },
];

export const CAMPO_FILTRO_BY_ID = new Map(
  CAMPI_FILTRO.map((campo) => [campo.campo, campo])
);

/** Operatori ammessi per ogni tipo di campo. */
export const OPERATORI_PER_TIPO: Record<TipoCampoFiltro, OperatoreFiltro[]> = {
  testo: ["contiene", "non_contiene", "e", "non_e", "vuoto", "non_vuoto"],
  select: ["e", "non_e", "vuoto", "non_vuoto"],
  multi: ["e", "non_e", "vuoto", "non_vuoto"],
  numero: ["e", "non_e", "maggiore", "minore", "vuoto", "non_vuoto"],
  data: [
    "ultimi_giorni",
    "oltre_giorni",
    "maggiore",
    "minore",
    "vuoto",
    "non_vuoto",
  ],
  booleano: ["vero", "falso"],
};

export const ETICHETTE_OPERATORE: Record<OperatoreFiltro, string> = {
  e: "è uno di",
  non_e: "non è nessuno di",
  contiene: "contiene",
  non_contiene: "non contiene",
  vuoto: "è vuoto",
  non_vuoto: "non è vuoto",
  maggiore: "dopo / maggiore di",
  minore: "prima / minore di",
  ultimi_giorni: "negli ultimi N giorni",
  oltre_giorni: "da più di N giorni",
  vero: "è sì",
  falso: "è no",
};

/** Operatori che non richiedono alcun valore. */
export const OPERATORI_SENZA_VALORE: OperatoreFiltro[] = [
  "vuoto",
  "non_vuoto",
  "vero",
  "falso",
];

/** Operatori che lavorano su un elenco di valori selezionati. */
export const OPERATORI_A_ELENCO: OperatoreFiltro[] = ["e", "non_e"];

/* ------------------------------------------------------------------ */
/* Lettura del valore dal ticket                                       */
/* ------------------------------------------------------------------ */

function leggiValore(ticket: TicketLike, campo: string): unknown {
  if (campo === "cliente") {
    const clienti = ticket.clienti as { nome?: unknown } | null | undefined;
    return clienti?.nome ?? null;
  }

  if (campo === "assegnatario") {
    const profili = ticket.profili as
      | { nome_completo?: unknown }
      | null
      | undefined;
    const alternativo = ticket.assegnatario_profilo as
      | { nome_completo?: unknown }
      | null
      | undefined;
    return profili?.nome_completo ?? alternativo?.nome_completo ?? null;
  }

  return ticket[campo] ?? null;
}

/** Il valore come lista di stringhe: i campi array restano tali. */
function comeLista(valore: unknown): string[] {
  if (valore === null || valore === undefined) return [];
  if (Array.isArray(valore)) {
    return valore.map((v) => String(v)).filter((v) => v !== "");
  }
  const testo = String(valore);
  return testo === "" ? [] : [testo];
}

function comeNumero(valore: unknown): number | null {
  if (valore === null || valore === undefined || valore === "") return null;
  const numero = Number(valore);
  return Number.isNaN(numero) ? null : numero;
}

function comeData(valore: unknown): Date | null {
  if (!valore) return null;
  const data = new Date(String(valore));
  return Number.isNaN(data.getTime()) ? null : data;
}

function giorniDa(data: Date, ora: Date): number {
  return Math.floor((ora.getTime() - data.getTime()) / (1000 * 60 * 60 * 24));
}

/* ------------------------------------------------------------------ */
/* Valutazione                                                         */
/* ------------------------------------------------------------------ */

/**
 * Valuta una singola condizione.
 *
 * Una condizione incompleta (nessun valore dove ne servirebbe uno) è
 * considerata NON applicata e restituisce true: altrimenti una riga
 * appena aggiunta nell'editor svuoterebbe la card mentre la si compila.
 */
export function valutaCondizione(
  ticket: TicketLike,
  condizione: CondizioneFiltro,
  ora = new Date()
): boolean {
  const definizione = CAMPO_FILTRO_BY_ID.get(condizione.campo);
  if (!definizione) return true;

  const grezzo = leggiValore(ticket, condizione.campo);
  const lista = comeLista(grezzo);

  switch (condizione.operatore) {
    case "vuoto":
      return lista.length === 0;

    case "non_vuoto":
      return lista.length > 0;

    case "vero":
      return grezzo === true;

    case "falso":
      return grezzo !== true;

    case "e": {
      if (condizione.valori.length === 0) return true;
      // Sui campi array (applicativo) basta una corrispondenza.
      return lista.some((v) => condizione.valori.includes(v));
    }

    case "non_e": {
      if (condizione.valori.length === 0) return true;
      return !lista.some((v) => condizione.valori.includes(v));
    }

    case "contiene": {
      const cercato = condizione.valore.trim().toLowerCase();
      if (!cercato) return true;
      return lista.some((v) => v.toLowerCase().includes(cercato));
    }

    case "non_contiene": {
      const cercato = condizione.valore.trim().toLowerCase();
      if (!cercato) return true;
      return !lista.some((v) => v.toLowerCase().includes(cercato));
    }

    case "maggiore":
    case "minore": {
      const atteso = condizione.valore.trim();
      if (!atteso) return true;

      if (definizione.tipo === "data") {
        const valoreData = comeData(grezzo);
        const limite = comeData(atteso);
        if (!valoreData || !limite) return false;
        return condizione.operatore === "maggiore"
          ? valoreData.getTime() > limite.getTime()
          : valoreData.getTime() < limite.getTime();
      }

      const valoreNumero = comeNumero(grezzo);
      const limite = comeNumero(atteso);
      if (valoreNumero === null || limite === null) return false;
      return condizione.operatore === "maggiore"
        ? valoreNumero > limite
        : valoreNumero < limite;
    }

    case "ultimi_giorni":
    case "oltre_giorni": {
      const giorni = comeNumero(condizione.valore);
      if (giorni === null) return true;

      const valoreData = comeData(grezzo);
      // Un campo data vuoto non è "negli ultimi N giorni", ma è a tutti
      // gli effetti fermo da più di N giorni: il ticket mai pingato deve
      // comparire fra quelli senza contatto.
      if (!valoreData) return condizione.operatore === "oltre_giorni";

      const trascorsi = giorniDa(valoreData, ora);
      return condizione.operatore === "ultimi_giorni"
        ? trascorsi >= 0 && trascorsi <= giorni
        : trascorsi > giorni;
    }

    default:
      return true;
  }
}

function valutaGruppo(
  ticket: TicketLike,
  gruppo: GruppoFiltri,
  ora: Date
): boolean {
  if (gruppo.condizioni.length === 0) return true;

  return gruppo.logica === "or"
    ? gruppo.condizioni.some((c) => valutaCondizione(ticket, c, ora))
    : gruppo.condizioni.every((c) => valutaCondizione(ticket, c, ora));
}

/** Valuta l'intero filtro di una card su un ticket. */
export function valutaFiltro(
  ticket: TicketLike,
  filtro: FiltroAvanzato | undefined,
  ora = new Date()
): boolean {
  if (!filtro || filtro.gruppi.length === 0) return true;

  // I gruppi privi di condizioni non contano: con logica OR un gruppo
  // vuoto (che vale true) farebbe passare tutto.
  const gruppiAttivi = filtro.gruppi.filter((g) => g.condizioni.length > 0);
  if (gruppiAttivi.length === 0) return true;

  return filtro.logica === "or"
    ? gruppiAttivi.some((g) => valutaGruppo(ticket, g, ora))
    : gruppiAttivi.every((g) => valutaGruppo(ticket, g, ora));
}

/* ------------------------------------------------------------------ */
/* Costruzione e normalizzazione                                       */
/* ------------------------------------------------------------------ */

export function nuovoId(prefisso: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefisso}-${crypto.randomUUID()}`;
  }
  return `${prefisso}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nuovaCondizione(campo = "stato"): CondizioneFiltro {
  const definizione = CAMPO_FILTRO_BY_ID.get(campo) ?? CAMPI_FILTRO[0];

  return {
    id: nuovoId("cond"),
    campo: definizione.campo,
    operatore: OPERATORI_PER_TIPO[definizione.tipo][0],
    valori: [],
    valore: "",
  };
}

export function nuovoGruppo(logica: LogicaFiltro = "and"): GruppoFiltri {
  return { id: nuovoId("gruppo"), logica, condizioni: [nuovaCondizione()] };
}

export function filtroVuoto(): FiltroAvanzato {
  return { logica: "and", gruppi: [] };
}

function normalizzaLogica(value: unknown): LogicaFiltro {
  return value === "or" ? "or" : "and";
}

function normalizzaCondizione(value: unknown): CondizioneFiltro | null {
  if (!value || typeof value !== "object") return null;

  const c = value as Record<string, unknown>;
  const campo = typeof c.campo === "string" ? c.campo : "";
  const definizione = CAMPO_FILTRO_BY_ID.get(campo);
  if (!definizione) return null;

  const ammessi = OPERATORI_PER_TIPO[definizione.tipo];
  const operatore =
    typeof c.operatore === "string" &&
    ammessi.includes(c.operatore as OperatoreFiltro)
      ? (c.operatore as OperatoreFiltro)
      : ammessi[0];

  return {
    id: typeof c.id === "string" && c.id ? c.id : nuovoId("cond"),
    campo,
    operatore,
    valori: Array.isArray(c.valori)
      ? c.valori.filter((v): v is string => typeof v === "string")
      : [],
    valore: typeof c.valore === "string" ? c.valore : "",
  };
}

export function normalizzaFiltro(value: unknown): FiltroAvanzato {
  if (!value || typeof value !== "object") return filtroVuoto();

  const f = value as Record<string, unknown>;
  if (!Array.isArray(f.gruppi)) return filtroVuoto();

  const gruppi: GruppoFiltri[] = [];

  for (const grezzo of f.gruppi) {
    if (!grezzo || typeof grezzo !== "object") continue;

    const g = grezzo as Record<string, unknown>;
    const condizioni = Array.isArray(g.condizioni)
      ? g.condizioni
          .map(normalizzaCondizione)
          .filter((c): c is CondizioneFiltro => c !== null)
      : [];

    gruppi.push({
      id: typeof g.id === "string" && g.id ? g.id : nuovoId("gruppo"),
      logica: normalizzaLogica(g.logica),
      condizioni,
    });
  }

  return { logica: normalizzaLogica(f.logica), gruppi };
}

/* ------------------------------------------------------------------ */
/* Migrazione dai vecchi filtri                                        */
/* ------------------------------------------------------------------ */

type FiltriLegacy = {
  filtroTitolo?: unknown;
  stati?: unknown;
  priorita?: unknown;
  clienti?: unknown;
  applicativi?: unknown;
  tipologie?: unknown;
};

function listaLegacy(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

/**
 * Converte i filtri della vecchia card (tutti in AND, sola inclusione)
 * nel nuovo modello, così le card già salvate continuano a mostrare
 * esattamente gli stessi ticket.
 */
export function migraFiltriLegacy(config: FiltriLegacy): FiltroAvanzato {
  const condizioni: CondizioneFiltro[] = [];

  const aggiungiElenco = (campo: string, valori: string[]) => {
    if (valori.length === 0) return;
    condizioni.push({
      id: nuovoId("cond"),
      campo,
      operatore: "e",
      valori,
      valore: "",
    });
  };

  aggiungiElenco("stato", listaLegacy(config.stati));
  aggiungiElenco("priorita", listaLegacy(config.priorita));
  aggiungiElenco("cliente", listaLegacy(config.clienti));
  aggiungiElenco("applicativo", listaLegacy(config.applicativi));
  aggiungiElenco("tipologia_ticket", listaLegacy(config.tipologie));

  const titolo =
    typeof config.filtroTitolo === "string" ? config.filtroTitolo.trim() : "";

  if (titolo) {
    condizioni.push({
      id: nuovoId("cond"),
      campo: "titolo",
      operatore: "contiene",
      valori: [],
      valore: titolo,
    });
  }

  if (condizioni.length === 0) return filtroVuoto();

  return {
    logica: "and",
    gruppi: [{ id: nuovoId("gruppo"), logica: "and", condizioni }],
  };
}

/* ------------------------------------------------------------------ */
/* Descrizione leggibile                                               */
/* ------------------------------------------------------------------ */

function descriviCondizione(condizione: CondizioneFiltro): string {
  const definizione = CAMPO_FILTRO_BY_ID.get(condizione.campo);
  const etichettaCampo = definizione?.label ?? condizione.campo;
  const operatore = ETICHETTE_OPERATORE[condizione.operatore];

  if (OPERATORI_SENZA_VALORE.includes(condizione.operatore)) {
    return `${etichettaCampo} ${operatore}`;
  }

  if (OPERATORI_A_ELENCO.includes(condizione.operatore)) {
    return `${etichettaCampo} ${operatore} ${condizione.valori.join(", ")}`;
  }

  return `${etichettaCampo} ${operatore} ${condizione.valore}`;
}

/** Riassunto testuale del filtro, usato nel sottotitolo della card. */
export function descriviFiltro(filtro: FiltroAvanzato | undefined): string {
  if (!filtro) return "";

  const gruppiAttivi = filtro.gruppi.filter((g) => g.condizioni.length > 0);
  if (gruppiAttivi.length === 0) return "";

  const separatoreGruppi = filtro.logica === "or" ? " OPPURE " : " E ";

  return gruppiAttivi
    .map((gruppo) => {
      const separatore = gruppo.logica === "or" ? " oppure " : " e ";
      const testo = gruppo.condizioni.map(descriviCondizione).join(separatore);
      return gruppiAttivi.length > 1 ? `(${testo})` : testo;
    })
    .join(separatoreGruppi);
}

/** Numero di condizioni effettivamente impostate. */
export function contaCondizioni(filtro: FiltroAvanzato | undefined): number {
  if (!filtro) return 0;
  return filtro.gruppi.reduce(
    (totale, gruppo) => totale + gruppo.condizioni.length,
    0
  );
}
