// components/parametri_ticket/change.ts

// =========================
// COSTANTI CAMPI CHANGE
// =========================

export const STATO_CHANGE_LIST = [
  "Aperto",
  "In Attesa",
  "In Collaudo",
  "In Produzione",
  "In Produzione + Regressione",
  "Annullata",
  "Completato",
] as const;

export const TIPO_CHANGE_LIST = [
  "Regressione",
  "Impattante",
  "Richiesta dal Business",
  "Non_impattante",
] as const;

export const APPLICATIVI_CHANGE_LIST = [
  "APPECOM",
  "ECOM35",
  "EOL",
  "IST35",
  "ESB",
  "GCW",
  "ESJ",
  "PARAFARMACIA",
] as const;

export const IMPATTO_CHANGE_LIST = [
  "Basso",
  "Medio",
  "Alto",
  "Critico",
] as const;

export const TIPO_EVOLUTIVA_LIST = [
  "GA4",
  "BigQuery",
  "Tracking",
  "Reporting",
  "Infrastrutturale",
  "Bugfix",
  "Altro",
] as const;

export const STATO_CTASK_LIST = [
  "Da fare",
  "In corso",
  "Completato",
  "Bloccato",
] as const;

export const DEFAULT_CHANGE_VALUES = {
  stato: "Aperto",
  approvata: false,
  escalation_donatello: false,
  primo_ping_eseguito: false,
  ticket_analisi: false,
  ticket_test: false,
  ticket_rilascio: false,
} as const;

// =========================
// LABEL UI
// =========================

export const CHANGE_FIELD_LABELS = {
  id: "ID",
  info: "Informazioni",
  change_id: "Change ID",
  breve_descrizione: "Breve descrizione",
  descrizione: "Descrizione",
  applicativo: "Applicativo",
  stato: "Stato",
  impatto: "Impatto",
  tipo_di_evolutiva: "Tipo di evolutiva",
  rilascio_in_collaudo: "Rilascio in collaudo",
  rilascio_in_produzione: "Rilascio in produzione",
  data_creazione: "Data creazione",
  ultimo_ping: "Ultimo ping",
  ticket_ref: "Ticket di riferimento",
  note_hrm: "Note HRM",
  inc_correlato: "INC correlato",
  note_sviluppatori: "Note sviluppatori",
  approvata: "Approvata",
  tracciamenti: "Tracciamenti",
  change_tracciamento: "Change tracciamento",
  stato_ctask: "Stato CTask",
  chg_tracciamenti: "CHG tracciamenti",
  escalation_donatello: "Escalation Donatello",
  primo_ping_eseguito: "Primo ping eseguito",
  ticket_analisi: "Ticket analisi",
  ticket_test: "Ticket test",
  ticket_rilascio: "Ticket rilascio",
  ticket: "Ticket",
  tipo_change: "Tipo change",
} as const;

// =========================
// TIPI CAMPI
// =========================

export const CHANGE_FIELD_TYPES = {
  id: "uuid",
  info: "textarea",
  change_id: "text",
  breve_descrizione: "textarea",
  descrizione: "textarea",
  applicativo: "multiselect",
  stato: "select",
  impatto: "select",
  tipo_di_evolutiva: "select",
  rilascio_in_collaudo: "date",
  rilascio_in_produzione: "date",
  data_creazione: "datetime",
  ultimo_ping: "datetime",
  ticket_ref: "text",
  note_hrm: "textarea",
  inc_correlato: "text",
  note_sviluppatori: "textarea",
  approvata: "boolean",
  tracciamenti: "textarea",
  change_tracciamento: "text",
  stato_ctask: "select",
  chg_tracciamenti: "text",
  escalation_donatello: "boolean",
  primo_ping_eseguito: "boolean",
  ticket_analisi: "boolean",
  ticket_test: "boolean",
  ticket_rilascio: "boolean",
  ticket: "computed",
  tipo_change: "select",
} as const;

// =========================
// OPZIONI SELECT
// =========================

export const CHANGE_FIELD_OPTIONS = {
  stato: STATO_CHANGE_LIST,
  tipo_change: TIPO_CHANGE_LIST,
  applicativo: APPLICATIVI_CHANGE_LIST,
  impatto: IMPATTO_CHANGE_LIST,
  tipo_di_evolutiva: TIPO_EVOLUTIVA_LIST,
  stato_ctask: STATO_CTASK_LIST,
} as const;

// =========================
// GRUPPI CAMPI
// =========================

export const CHANGE_BOOLEAN_FIELDS = [
  "approvata",
  "escalation_donatello",
  "primo_ping_eseguito",
  "ticket_analisi",
  "ticket_test",
  "ticket_rilascio",
] as const;

export const CHANGE_DATE_FIELDS = [
  "rilascio_in_collaudo",
  "rilascio_in_produzione",
] as const;

export const CHANGE_DATETIME_FIELDS = [
  "data_creazione",
  "ultimo_ping",
] as const;

export const CHANGE_REQUIRED_FIELDS = [
  "change_id",
] as const;

// =========================
// TYPE SCRIPT TYPES
// =========================

export type StatoChange = typeof STATO_CHANGE_LIST[number];
export type TipoChange = typeof TIPO_CHANGE_LIST[number];
export type ApplicativoChange = typeof APPLICATIVI_CHANGE_LIST[number];
export type ImpattoChange = typeof IMPATTO_CHANGE_LIST[number];
export type TipoDiEvolutiva = typeof TIPO_EVOLUTIVA_LIST[number];
export type StatoCTask = typeof STATO_CTASK_LIST[number];

export type ChangeBooleanField = typeof CHANGE_BOOLEAN_FIELDS[number];
export type ChangeDateField = typeof CHANGE_DATE_FIELDS[number];
export type ChangeDateTimeField = typeof CHANGE_DATETIME_FIELDS[number];
export type ChangeRequiredField = typeof CHANGE_REQUIRED_FIELDS[number];

// =========================
// INTERFACCIA PRINCIPALE
// =========================

export interface Change {
  id: string;
  info?: string | null;
  change_id?: string | null;
  breve_descrizione?: string | null;
  descrizione?: string | null;
  applicativo?: ApplicativoChange[] | null;
  stato?: StatoChange | null;
  impatto?: ImpattoChange | null;
  tipo_di_evolutiva?: TipoDiEvolutiva | null;
  rilascio_in_collaudo?: string | null;
  rilascio_in_produzione?: string | null;
  data_creazione?: string | null;
  ultimo_ping?: string | null;
  ticket_ref?: string | null;
  note_hrm?: string | null;
  inc_correlato?: string | null;
  note_sviluppatori?: string | null;
  approvata?: boolean | null;
  tracciamenti?: string | null;
  change_tracciamento?: string | null;
  stato_ctask?: StatoCTask | null;
  chg_tracciamenti?: string | null;
  escalation_donatello?: boolean | null;
  primo_ping_eseguito?: boolean | null;
  ticket_analisi?: boolean | null;
  ticket_test?: boolean | null;
  ticket_rilascio?: boolean | null;
  ticket?: string | null; // generated column
  tipo_change?: TipoChange | null;
}