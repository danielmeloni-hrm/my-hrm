// src/lib/ai-ticket-actions.ts
// SOLO SERVER. Non importare questo file da componenti client.

import crypto from "crypto";
import { Type } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  APPLICATIVI_LIST,
  ATTIVITA_LIST,
  PERSON_LIST,
  PLACE_LIST,
  PRIORITA_LIST,
  PRIORITA_NUMBER_MAP,
  SPRINT_LIST,
  STATO_COLLAUDO_LIST,
  STATO_PROGRESS_MAP,
  STATO_TICKET_LIST,
  TICKET_FIELD_LABELS,
  TOOL_LIST,
} from "@/components/parametri_ticket/attivita";

/* ------------------------------------------------------------------ */
/* Tipi                                                                */
/* ------------------------------------------------------------------ */

export type AiActionName =
  | "update_ticket"
  | "close_ticket"
  | "add_ticket_note"
  | "create_ticket";

export type AiPendingAction = {
  action: AiActionName;
  /** id reale del ticket su cui agire (null per create_ticket) */
  ticketId: string | null;
  /** etichetta leggibile del ticket, per la card di conferma */
  ticketLabel: string | null;
  /** payload già validato e normalizzato, pronto per l'update/insert */
  payload: Record<string, any>;
  /** descrizione discorsiva di cosa succederà */
  summary: string;
  /** righe campo -> valore da mostrare nella card */
  changes: { campo: string; valore: string }[];
  /** id utente proprietario dell'azione */
  userId: string;
  /** scadenza in ms epoch */
  expiresAt: number;
};

export type AiActionEnvelope = {
  action: AiPendingAction;
  signature: string;
};

export type ActionResolution =
  | { ok: true; action: AiPendingAction }
  | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* Firma HMAC: il frontend rimanda l'azione, ma non deve poterla alterare */
/* ------------------------------------------------------------------ */

const ACTION_TTL_MS = 15 * 60 * 1000;

function getActionSecret() {
  const secret =
    process.env.AI_ACTION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!secret) {
    throw new Error(
      "Secret mancante per la firma delle azioni AI (AI_ACTION_SECRET)."
    );
  }

  return secret;
}

export function signAction(action: AiPendingAction): AiActionEnvelope {
  const signature = crypto
    .createHmac("sha256", getActionSecret())
    .update(JSON.stringify(action))
    .digest("hex");

  return { action, signature };
}

export function verifyAction(
  envelope: unknown,
  userId: string
): ActionResolution {
  if (!envelope || typeof envelope !== "object") {
    return { ok: false, error: "Azione non valida." };
  }

  const { action, signature } = envelope as AiActionEnvelope;

  if (!action || typeof signature !== "string") {
    return { ok: false, error: "Azione non valida." };
  }

  const expected = crypto
    .createHmac("sha256", getActionSecret())
    .update(JSON.stringify(action))
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return { ok: false, error: "Firma dell'azione non valida." };
  }

  if (action.userId !== userId) {
    return {
      ok: false,
      error: "Questa azione è stata generata per un altro utente.",
    };
  }

  if (!action.expiresAt || Date.now() > action.expiresAt) {
    return {
      ok: false,
      error: "L'azione è scaduta. Richiedila di nuovo all'assistente.",
    };
  }

  return { ok: true, action };
}

/* ------------------------------------------------------------------ */
/* Campi scrivibili                                                    */
/* ------------------------------------------------------------------ */

/** Solo questi campi della tabella ticket possono essere scritti dall'AI. */
export const AI_WRITABLE_TICKET_FIELDS = [
  "stato",
  "priorita",
  "numero_priorita",
  "percentuale_avanzamento",
  "sprint",
  "stato_collaudo",
  "tipo_di_attivita",
  "tool",
  "person",
  "place",
  "applicativo",
  "assignee",
  "cliente_id",
  "titolo",
  "descrizione",
  "note",
  "note_importanti",
  "aggiornamento_storia",
  "data_chiusura_attivita",
  "rilascio_in_collaudo",
  "rilascio_in_produzione",
  "rilascio_collaudo_eseguito",
  "rilascio_produzione_eseguito",
  "check_collaudo",
  "attivita_attive",
  "in_lavorazione_ora",
  "email_andrea",
  "escalation_donatello",
  "i_ping",
  "ultimo_ping",
  "ultimo_controllo_collaudo",
  "documento_operativo_url",
  "link_tag",
  "numero_storia",
  "tread_email",
] as const;

export type AiWritableTicketField = (typeof AI_WRITABLE_TICKET_FIELDS)[number];

const BOOLEAN_FIELDS = new Set<string>([
  "rilascio_collaudo_eseguito",
  "rilascio_produzione_eseguito",
  "check_collaudo",
  "attivita_attive",
  "in_lavorazione_ora",
  "email_andrea",
  "escalation_donatello",
  "i_ping",
]);

const NUMBER_FIELDS = new Set<string>([
  "numero_priorita",
  "percentuale_avanzamento",
]);

const DATE_FIELDS = new Set<string>([
  "data_chiusura_attivita",
  "rilascio_in_collaudo",
  "rilascio_in_produzione",
]);

const DATETIME_FIELDS = new Set<string>([
  "ultimo_ping",
  "ultimo_controllo_collaudo",
]);

const ENUM_FIELDS: Record<string, readonly string[]> = {
  stato: STATO_TICKET_LIST,
  priorita: PRIORITA_LIST,
  sprint: SPRINT_LIST,
  stato_collaudo: STATO_COLLAUDO_LIST,
  tipo_di_attivita: ATTIVITA_LIST,
  tool: TOOL_LIST,
  person: PERSON_LIST,
  place: PLACE_LIST,
};

/* ------------------------------------------------------------------ */
/* Utility di normalizzazione                                          */
/* ------------------------------------------------------------------ */

function norm(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Etichetta leggibile di un campo ticket, per la card di conferma. */
function fieldLabel(field: string) {
  return (
    (TICKET_FIELD_LABELS as Record<string, string>)[field] ?? field
  );
}

function matchEnum(field: string, value: unknown): string | null {
  const options = ENUM_FIELDS[field];
  if (!options) return null;

  const target = norm(value);
  const exact = options.find((option) => norm(option) === target);
  if (exact) return exact;

  const partial = options.find(
    (option) => norm(option).includes(target) && target.length >= 3
  );

  return partial ?? null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;

  const text = norm(value);
  if (["true", "si", "sì", "yes", "1", "ok", "attivo"].includes(text))
    return true;
  if (["false", "no", "0", "inattivo"].includes(text)) return false;

  return null;
}

function parseDate(value: unknown): string | null {
  if (value === null) return null;

  const text = String(value ?? "").trim();
  if (!text) return null;

  const today = norm(text);
  if (["oggi", "today"].includes(today)) {
    return new Date().toISOString().slice(0, 10);
  }

  const itMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (itMatch) {
    const [, day, month, year] = itMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const isoMatch = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return text.slice(0, 10);

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString().slice(0, 10);
}

function parseDateTime(value: unknown): string | null {
  if (value === null) return null;

  const text = String(value ?? "").trim();
  if (!text) return null;

  if (["ora", "adesso", "now", "oggi"].includes(norm(text))) {
    return new Date().toISOString();
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

function getClienteNome(cliente: any) {
  return (
    cliente?.ragione_sociale ||
    cliente?.nome ||
    cliente?.nome_cliente ||
    cliente?.cliente ||
    null
  );
}

function getProfiloNome(profilo: any) {
  return profilo?.nome_completo || profilo?.nome || profilo?.email || null;
}

/* ------------------------------------------------------------------ */
/* Dichiarazioni tool per Gemini                                       */
/* ------------------------------------------------------------------ */

export const TICKET_ACTION_DECLARATIONS = [
  {
    name: "update_ticket",
    description:
      "Aggiorna uno o più campi di un ticket esistente. Usare solo se l'utente chiede esplicitamente una modifica.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        ticket_ref: {
          type: Type.STRING,
          description:
            "Riferimento al ticket indicato dall'utente: n_tag (es. TAG123, INC45) oppure parte del titolo.",
        },
        stato: { type: Type.STRING, enum: [...STATO_TICKET_LIST] },
        priorita: { type: Type.STRING, enum: [...PRIORITA_LIST] },
        sprint: { type: Type.STRING, enum: [...SPRINT_LIST] },
        stato_collaudo: { type: Type.STRING, enum: [...STATO_COLLAUDO_LIST] },
        tipo_di_attivita: { type: Type.STRING, enum: [...ATTIVITA_LIST] },
        tool: { type: Type.STRING, enum: [...TOOL_LIST] },
        person: { type: Type.STRING, enum: [...PERSON_LIST] },
        place: { type: Type.STRING, enum: [...PLACE_LIST] },
        applicativo: {
          type: Type.ARRAY,
          items: { type: Type.STRING, enum: [...APPLICATIVI_LIST] },
        },
        percentuale_avanzamento: { type: Type.NUMBER },
        numero_priorita: { type: Type.NUMBER },
        assignee_ref: {
          type: Type.STRING,
          description:
            "Nome, nome completo o email della persona a cui assegnare il ticket. Usare 'me' per l'utente loggato.",
        },
        cliente_ref: {
          type: Type.STRING,
          description: "Nome o ragione sociale del cliente da collegare.",
        },
        titolo: { type: Type.STRING },
        descrizione: { type: Type.STRING },
        note: { type: Type.STRING },
        note_importanti: { type: Type.STRING },
        aggiornamento_storia: { type: Type.STRING },
        data_chiusura_attivita: { type: Type.STRING, description: "YYYY-MM-DD" },
        rilascio_in_collaudo: { type: Type.STRING, description: "YYYY-MM-DD" },
        rilascio_in_produzione: { type: Type.STRING, description: "YYYY-MM-DD" },
        rilascio_collaudo_eseguito: { type: Type.BOOLEAN },
        rilascio_produzione_eseguito: { type: Type.BOOLEAN },
        check_collaudo: { type: Type.BOOLEAN },
        attivita_attive: { type: Type.BOOLEAN },
        in_lavorazione_ora: { type: Type.BOOLEAN },
        email_andrea: { type: Type.BOOLEAN },
        escalation_donatello: { type: Type.BOOLEAN },
        i_ping: { type: Type.BOOLEAN },
        documento_operativo_url: { type: Type.STRING },
        link_tag: { type: Type.STRING },
        numero_storia: { type: Type.STRING },
      },
      required: ["ticket_ref"],
    },
  },
  {
    name: "close_ticket",
    description:
      "Chiude un ticket: imposta lo stato a Completato, l'avanzamento al 100% e la data di chiusura a oggi.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        ticket_ref: {
          type: Type.STRING,
          description: "n_tag o parte del titolo del ticket da chiudere.",
        },
        nota_chiusura: {
          type: Type.STRING,
          description: "Nota facoltativa da aggiungere allo storico ticket.",
        },
      },
      required: ["ticket_ref"],
    },
  },
  {
    name: "add_ticket_note",
    description:
      "Aggiunge una nota allo storico (storia_ticket) di un ticket esistente.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        ticket_ref: { type: Type.STRING },
        nota: { type: Type.STRING },
      },
      required: ["ticket_ref", "nota"],
    },
  },
  {
    name: "create_ticket",
    description:
      "Crea un nuovo ticket. Usare solo se l'utente chiede esplicitamente di creare un ticket.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        titolo: { type: Type.STRING },
        descrizione: { type: Type.STRING },
        cliente_ref: { type: Type.STRING },
        assignee_ref: { type: Type.STRING },
        stato: { type: Type.STRING, enum: [...STATO_TICKET_LIST] },
        priorita: { type: Type.STRING, enum: [...PRIORITA_LIST] },
        sprint: { type: Type.STRING, enum: [...SPRINT_LIST] },
        tipo_di_attivita: { type: Type.STRING, enum: [...ATTIVITA_LIST] },
        applicativo: {
          type: Type.ARRAY,
          items: { type: Type.STRING, enum: [...APPLICATIVI_LIST] },
        },
        n_tag: { type: Type.STRING },
      },
      required: ["titolo"],
    },
  },
];

export const ACTION_NAMES = new Set<string>([
  "update_ticket",
  "close_ticket",
  "add_ticket_note",
  "create_ticket",
]);

/* ------------------------------------------------------------------ */
/* Rilevamento di intento "azione" (per evitare chiamate inutili)       */
/* ------------------------------------------------------------------ */

const ACTION_KEYWORDS = [
  "chiudi",
  "chiudere",
  "chiudilo",
  "riapri",
  "riaprire",
  "aggiorna",
  "aggiornare",
  "modifica",
  "modificare",
  "imposta",
  "impostare",
  "setta",
  "cambia",
  "cambiare",
  "metti",
  "mettere",
  "porta a",
  "assegna",
  "assegnare",
  "riassegna",
  "sposta",
  "spostare",
  "crea",
  "creare",
  "apri un ticket",
  "aggiungi nota",
  "aggiungi una nota",
  "annota",
  "segna come",
  "marca come",
  "completa",
  "completare",
];

/**
 * Frasi dichiarative: l'utente non ordina, comunica un fatto avvenuto.
 * Esempio: "il TAG01588307 è stato rilasciato il 12/06/2026".
 */
const FACT_KEYWORDS = [
  "rilasciat",
  "rilascio",
  "collaud",
  "produzione",
  "chiuso",
  "chiusa",
  "completat",
  "finit",
  "terminat",
  "consegnat",
  "in lavorazione",
  "sospes",
  "stand-by",
  "standby",
  "stand by",
  "bloccat",
  "assegnat",
  "sprint",
  "backlog",
  "opex",
  "priorita",
  "avanzamento",
  "iniziat",
  "non iniziato",
  "attesa sviluppo",
  "attesa risposta",
  "attenzione business",
  "escalation",
  "ping",
];

/** Se il messaggio è chiaramente una domanda, non è una richiesta di modifica. */
const QUESTION_STARTERS =
  /^(chi|cosa|che\s|quali|quale|quando|quanto|quanti|quante|come|dove|perche|c'e|ci sono|mostrami|dimmi|elenca|fammi|riassumi|esiste|hai|sai|puoi dirmi)/;

const TICKET_CODE_REGEX = /\b(TAG|INC|CHG)\s?\d+\b/i;

export function detectsWriteIntent(message: string, hasPendingAction = false) {
  // Se c'è una proposta aperta, ogni messaggio successivo può correggerla
  // ("scusa è stato rilasciato in collaudo", "no, il 13", "anche la priorità alta").
  if (hasPendingAction) return true;

  const text = norm(message);

  const hasActionVerb = ACTION_KEYWORDS.some((keyword) =>
    text.includes(norm(keyword))
  );

  if (hasActionVerb) return true;

  const isQuestion = QUESTION_STARTERS.test(text) || text.trim().endsWith("?");
  if (isQuestion) return false;

  const hasFact = FACT_KEYWORDS.some((keyword) => text.includes(keyword));

  // Fatto dichiarato + riferimento esplicito a un ticket => proposta di update.
  return hasFact && TICKET_CODE_REGEX.test(message);
}

/* ------------------------------------------------------------------ */
/* Risoluzione riferimenti                                             */
/* ------------------------------------------------------------------ */

type ResolveContext = {
  userId: string;
  tickets: any[];
  clienti: any[];
  profili: any[];
};

function resolveTicket(ref: unknown, tickets: any[]) {
  const target = norm(ref);

  if (!target) {
    return { ticket: null, error: "Non ho capito a quale ticket ti riferisci." };
  }

  const byTag = tickets.filter((ticket) => norm(ticket.n_tag) === target);
  if (byTag.length === 1) return { ticket: byTag[0], error: null };

  const byId = tickets.filter((ticket) => norm(ticket.id) === target);
  if (byId.length === 1) return { ticket: byId[0], error: null };

  const byTagPartial = tickets.filter(
    (ticket) => ticket.n_tag && norm(ticket.n_tag).includes(target)
  );
  if (byTagPartial.length === 1) return { ticket: byTagPartial[0], error: null };

  const byTitle = tickets.filter(
    (ticket) =>
      ticket.titolo && target.length >= 3 && norm(ticket.titolo).includes(target)
  );
  if (byTitle.length === 1) return { ticket: byTitle[0], error: null };

  const candidates = byTagPartial.length > 0 ? byTagPartial : byTitle;

  if (candidates.length > 1) {
    const list = candidates
      .slice(0, 8)
      .map((ticket: any) => `${ticket.n_tag || "senza tag"} — ${ticket.titolo}`)
      .join("; ");

    return {
      ticket: null,
      error: `Ho trovato più ticket compatibili con "${String(
        ref
      )}": ${list}. Indicami il tag esatto.`,
    };
  }

  return {
    ticket: null,
    error: `Non ho trovato nessun ticket corrispondente a "${String(ref)}".`,
  };
}

function resolveProfilo(ref: unknown, context: ResolveContext) {
  const target = norm(ref);

  if (!target) return { profilo: null, error: null };

  if (["me", "io", "a me", "mio", "me stesso"].includes(target)) {
    const mine = context.profili.find((p: any) => p.id === context.userId);
    return mine
      ? { profilo: mine, error: null }
      : { profilo: null, error: "Non ho trovato il tuo profilo." };
  }

  const matches = context.profili.filter((profilo: any) => {
    const values = [profilo.id, profilo.email, profilo.nome, profilo.nome_completo]
      .filter(Boolean)
      .map(norm);

    return values.includes(target) || values.some((value) => value.includes(target));
  });

  if (matches.length === 1) return { profilo: matches[0], error: null };

  if (matches.length > 1) {
    return {
      profilo: null,
      error: `Ho trovato più persone compatibili con "${String(
        ref
      )}": ${matches.slice(0, 8).map(getProfiloNome).join(", ")}.`,
    };
  }

  return {
    profilo: null,
    error: `Non ho trovato nessun profilo corrispondente a "${String(ref)}".`,
  };
}

function resolveCliente(ref: unknown, context: ResolveContext) {
  const target = norm(ref);

  if (!target) return { cliente: null, error: null };

  const matches = context.clienti.filter((cliente: any) => {
    const value = norm(getClienteNome(cliente));
    return value === target || (target.length >= 3 && value.includes(target));
  });

  if (matches.length === 1) return { cliente: matches[0], error: null };

  if (matches.length > 1) {
    return {
      cliente: null,
      error: `Ho trovato più clienti compatibili con "${String(
        ref
      )}": ${matches.slice(0, 8).map(getClienteNome).join(", ")}.`,
    };
  }

  return {
    cliente: null,
    error: `Non ho trovato nessun cliente corrispondente a "${String(ref)}".`,
  };
}

/* ------------------------------------------------------------------ */
/* Costruzione della pending action a partire dalla functionCall        */
/* ------------------------------------------------------------------ */

function buildFieldUpdates(
  args: Record<string, any>,
  context: ResolveContext
): { payload: Record<string, any>; changes: { campo: string; valore: string }[]; error: string | null } {
  const payload: Record<string, any> = {};
  const changes: { campo: string; valore: string }[] = [];

  for (const [key, rawValue] of Object.entries(args)) {
    if (key === "ticket_ref" || rawValue === undefined) continue;

    if (key === "assignee_ref") {
      const { profilo, error } = resolveProfilo(rawValue, context);
      if (error) return { payload, changes, error };
      if (!profilo) continue;

      payload.assignee = profilo.id;
      changes.push({ campo: "Assegnatario", valore: getProfiloNome(profilo) ?? profilo.id });
      continue;
    }

    if (key === "cliente_ref") {
      const { cliente, error } = resolveCliente(rawValue, context);
      if (error) return { payload, changes, error };
      if (!cliente) continue;

      payload.cliente_id = cliente.id;
      changes.push({ campo: "Cliente", valore: getClienteNome(cliente) ?? cliente.id });
      continue;
    }

    if (!AI_WRITABLE_TICKET_FIELDS.includes(key as AiWritableTicketField)) {
      continue;
    }

    if (key === "applicativo") {
      const list = Array.isArray(rawValue) ? rawValue : [rawValue];
      const valid = list
        .map((item) =>
          APPLICATIVI_LIST.find((option) => norm(option) === norm(item))
        )
        .filter(Boolean) as string[];

      if (valid.length === 0) continue;

      payload.applicativo = valid;
      changes.push({ campo: "Applicativo", valore: valid.join(", ") });
      continue;
    }

    if (ENUM_FIELDS[key]) {
      const value = matchEnum(key, rawValue);

      if (!value) {
        return {
          payload,
          changes,
          error: `Valore "${String(rawValue)}" non ammesso per il campo ${key}. Valori validi: ${ENUM_FIELDS[
            key
          ].join(", ")}.`,
        };
      }

      payload[key] = value;
      changes.push({ campo: fieldLabel(key), valore: value });

      if (key === "stato" && args.percentuale_avanzamento === undefined) {
        const progress = STATO_PROGRESS_MAP[value];
        if (typeof progress === "number") {
          payload.percentuale_avanzamento = progress;
          changes.push({
            campo: fieldLabel("percentuale_avanzamento"),
            valore: `${progress}%`,
          });
        }
      }

      if (key === "priorita" && args.numero_priorita === undefined) {
        const weight = PRIORITA_NUMBER_MAP[value];
        if (typeof weight === "number") {
          payload.numero_priorita = weight;
          changes.push({
            campo: fieldLabel("numero_priorita"),
            valore: String(weight),
          });
        }
      }

      continue;
    }

    if (BOOLEAN_FIELDS.has(key)) {
      const value = parseBoolean(rawValue);
      if (value === null) continue;

      payload[key] = value;
      changes.push({ campo: fieldLabel(key), valore: value ? "Sì" : "No" });
      continue;
    }

    if (NUMBER_FIELDS.has(key)) {
      const value = Number(rawValue);
      if (!Number.isFinite(value)) continue;

      const clamped =
        key === "percentuale_avanzamento"
          ? Math.min(100, Math.max(0, Math.round(value)))
          : value;

      payload[key] = clamped;
      changes.push({ campo: fieldLabel(key), valore: String(clamped) });
      continue;
    }

    if (DATE_FIELDS.has(key)) {
      const value = parseDate(rawValue);
      if (value === null && rawValue !== null) continue;

      payload[key] = value;
      changes.push({ campo: fieldLabel(key), valore: value ?? "—" });
      continue;
    }

    if (DATETIME_FIELDS.has(key)) {
      const value = parseDateTime(rawValue);
      if (value === null && rawValue !== null) continue;

      payload[key] = value;
      changes.push({ campo: fieldLabel(key), valore: value ?? "—" });
      continue;
    }

    const text = rawValue === null ? null : String(rawValue);
    payload[key] = text;
    changes.push({ campo: fieldLabel(key), valore: text ?? "—" });
  }

  return { payload, changes, error: null };
}

function ticketLabel(ticket: any) {
  return `${ticket.n_tag ? `${ticket.n_tag} — ` : ""}${
    ticket.titolo || "Ticket senza titolo"
  }`;
}

export function buildPendingAction(
  name: string,
  args: Record<string, any>,
  context: ResolveContext
): ActionResolution {
  const expiresAt = Date.now() + ACTION_TTL_MS;

  if (name === "create_ticket") {
    const titolo = String(args.titolo ?? "").trim();

    if (!titolo) {
      return { ok: false, error: "Serve un titolo per creare il ticket." };
    }

    const { payload, changes, error } = buildFieldUpdates(
      { ...args, titolo: undefined },
      context
    );

    if (error) return { ok: false, error };

    if (args.n_tag) {
      payload.n_tag = String(args.n_tag).trim().toUpperCase();
      changes.push({ campo: fieldLabel("n_tag"), valore: payload.n_tag });
    }

    payload.titolo = titolo;
    payload.utente_id = context.userId;

    if (!payload.stato) payload.stato = "Non Iniziato";
    if (!payload.priorita) payload.priorita = "Media";
    if (!payload.sprint) payload.sprint = "Backlog";

    return {
      ok: true,
      action: {
        action: "create_ticket",
        ticketId: null,
        ticketLabel: titolo,
        payload,
        summary: `Creo un nuovo ticket "${titolo}".`,
        changes: [{ campo: fieldLabel("titolo"), valore: titolo }, ...changes],
        userId: context.userId,
        expiresAt,
      },
    };
  }

  const { ticket, error: ticketError } = resolveTicket(
    args.ticket_ref,
    context.tickets
  );

  if (!ticket) return { ok: false, error: ticketError ?? "Ticket non trovato." };

  if (name === "add_ticket_note") {
    const nota = String(args.nota ?? "").trim();

    if (!nota) return { ok: false, error: "La nota è vuota." };

    return {
      ok: true,
      action: {
        action: "add_ticket_note",
        ticketId: ticket.id,
        ticketLabel: ticketLabel(ticket),
        payload: { nota },
        summary: `Aggiungo una nota allo storico di ${ticketLabel(ticket)}.`,
        changes: [{ campo: "Nota storico", valore: nota }],
        userId: context.userId,
        expiresAt,
      },
    };
  }

  if (name === "close_ticket") {
    const payload: Record<string, any> = {
      stato: "Completato",
      percentuale_avanzamento: 100,
      data_chiusura_attivita: new Date().toISOString().slice(0, 10),
      in_lavorazione_ora: false,
      attivita_attive: false,
    };

    const nota = String(args.nota_chiusura ?? "").trim();
    if (nota) payload.__nota = nota;

    return {
      ok: true,
      action: {
        action: "close_ticket",
        ticketId: ticket.id,
        ticketLabel: ticketLabel(ticket),
        payload,
        summary: `Chiudo il ticket ${ticketLabel(ticket)} (stato attuale: ${
          ticket.stato ?? "non definito"
        }).`,
        changes: [
          { campo: fieldLabel("stato"), valore: "Completato" },
          { campo: fieldLabel("percentuale_avanzamento"), valore: "100%" },
          {
            campo: fieldLabel("data_chiusura_attivita"),
            valore: payload.data_chiusura_attivita,
          },
          ...(nota ? [{ campo: "Nota storico", valore: nota }] : []),
        ],
        userId: context.userId,
        expiresAt,
      },
    };
  }

  if (name === "update_ticket") {
    const { payload, changes, error } = buildFieldUpdates(args, context);

    if (error) return { ok: false, error };

    if (Object.keys(payload).length === 0) {
      return {
        ok: false,
        error: "Non ho capito quale campo del ticket vuoi modificare.",
      };
    }

    return {
      ok: true,
      action: {
        action: "update_ticket",
        ticketId: ticket.id,
        ticketLabel: ticketLabel(ticket),
        payload,
        summary: `Aggiorno il ticket ${ticketLabel(ticket)}.`,
        changes,
        userId: context.userId,
        expiresAt,
      },
    };
  }

  return { ok: false, error: `Azione "${name}" non supportata.` };
}

/* ------------------------------------------------------------------ */
/* Esecuzione                                                          */
/* ------------------------------------------------------------------ */

function formatLogEntry(text: string, autore: string) {
  const now = new Date();
  const date = now.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = now.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${date} ${time} - ${autore} (AI): ${text}`;
}

export async function executeAction(
  action: AiPendingAction,
  autore: string
): Promise<{ ok: boolean; message: string; ticket?: any }> {
  if (action.action === "create_ticket") {
    const { data, error } = await supabaseAdmin
      .from("ticket")
      .insert(action.payload)
      .select("*")
      .single();

    if (error) {
      console.error("Errore creazione ticket AI:", error);
      return { ok: false, message: `Errore durante la creazione: ${error.message}` };
    }

    return {
      ok: true,
      message: `Ticket creato: ${data?.n_tag ? `${data.n_tag} — ` : ""}${
        data?.titolo
      }.`,
      ticket: data,
    };
  }

  if (!action.ticketId) {
    return { ok: false, message: "Ticket non identificato." };
  }

  const { data: current, error: readError } = await supabaseAdmin
    .from("ticket")
    .select("*")
    .eq("id", action.ticketId)
    .maybeSingle();

  if (readError) {
    console.error("Errore lettura ticket AI:", readError);
    return { ok: false, message: `Errore di lettura: ${readError.message}` };
  }

  if (!current) {
    return { ok: false, message: "Il ticket non esiste più." };
  }

  if (action.action === "add_ticket_note") {
    const logs = Array.isArray(current.storia_ticket) ? current.storia_ticket : [];
    const entry = formatLogEntry(String(action.payload.nota ?? ""), autore);

    const { error } = await supabaseAdmin
      .from("ticket")
      .update({ storia_ticket: [...logs, entry] })
      .eq("id", action.ticketId);

    if (error) {
      console.error("Errore nota ticket AI:", error);
      return { ok: false, message: `Errore durante il salvataggio: ${error.message}` };
    }

    return {
      ok: true,
      message: `Nota aggiunta allo storico di ${action.ticketLabel}.`,
    };
  }

  const payload: Record<string, any> = { ...action.payload };
  const nota = payload.__nota;
  delete payload.__nota;

  const descrizioneModifiche = action.changes
    .map((change) => `${change.campo}: ${change.valore}`)
    .join(" | ");

  const logs = Array.isArray(current.storia_ticket) ? current.storia_ticket : [];
  const newLogs = [
    ...logs,
    formatLogEntry(
      nota
        ? `${nota} (${descrizioneModifiche})`
        : `Modifica da assistente AI — ${descrizioneModifiche}`,
      autore
    ),
  ];

  const { data, error } = await supabaseAdmin
    .from("ticket")
    .update({ ...payload, storia_ticket: newLogs })
    .eq("id", action.ticketId)
    .select("*")
    .single();

  if (error) {
    console.error("Errore update ticket AI:", error);
    return { ok: false, message: `Errore durante l'aggiornamento: ${error.message}` };
  }

  return {
    ok: true,
    message:
      action.action === "close_ticket"
        ? `Ticket ${action.ticketLabel} chiuso correttamente.`
        : `Ticket ${action.ticketLabel} aggiornato: ${descrizioneModifiche}.`,
    ticket: data,
  };
}
