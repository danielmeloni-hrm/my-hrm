// @/lib/constants.ts

export const STATO_PROGRESS_MAP: Record<string, number> = {
  "Non Iniziato": 0,
  "In stand-by": 5,
  "Attività Sospesa": 5,
  "In lavorazione": 30,
  "In attesa Sviluppo": 50,
  "In attesa risposta Sviluppatore": 60,
  "Attenzione Business": 75,
  "Attenzione di Andrea": 85,
  "Completato - In attesa di chiusura": 95,
  "Completato": 100
};

export const APPLICATIVI_LIST = [
  "ALL",
  "APPECOM",
  "ECOM35",
  "EOL",
  "IST35",
  "ESB",
  "GCW",
  "ESJ",
  "PARAFARMACIA"
] as const;

export const PRIORITA_LIST = [
  "Bassa",
  "Media",
  "Alta",
  ] as const;

export const TIPOLOGIA_TICKET = [
  "Attività",
  "Incident",
  "Change",
  ] as const;
  
export const ATTIVITA_LIST = [
  "Preanalisi",
  "Evolutive GA4",
  "Evolutive BQ",
  "Incident Resolution",
  "Reporting",
  "Formazione",
  "Supporto Funzionale Business",
  "Analisi degli Impatti",
  "Supporto Tecnico"
] as const;

export const SPRINT_LIST = [
  "Sprint",
  "Backlog",
  "Opex"
] as const;

export const STATO_TICKET_LIST = [
  "Non Iniziato",
  "In stand-by",
  "Attività Sospesa",
  "In lavorazione",
  "In attesa Sviluppo",
  "In attesa risposta Sviluppatore",
  "Attenzione Business",
  "Attenzione di Andrea",
  "Completato - In attesa di chiusura",
  "Completato",
  "Cancellato"
] as const;

export const STATO_COLLAUDO_LIST = [
  "Da iniziare",
  "In corso",
  "Superato",
  "Fallito",
  "Bloccato"
] as const;

export const TOOL_LIST = [
  "GA4",
  "GTM",
  "BigQuery",
  "Looker Studio",
  "Power BI",
  "Databricks",
  "Altro"
] as const;

export const PERSON_LIST = [
  "Andrea",
  "Donatello",
  "Business",
  "Sviluppatore",
  "Cliente"
] as const;

export const PLACE_LIST = [
  "Produzione",
  "Collaudo",
  "Analisi",
  "Sviluppo"
] as const;

// Mapping priorità -> peso numerico
export const PRIORITA_NUMBER_MAP: Record<string, number> = {
  "Bassa": 1,
  "Media": 2,
  "Alta": 3,
  "Urgente": 4
};

// Default valori ticket
export const DEFAULT_TICKET_VALUES = {
  stato: "Non Iniziato",
  priorita: "Media",
  sprint: "Backlog",
  stato_collaudo: "Da iniziare",
  attivita_attive: false,
  check_collaudo: false,
  email_andrea: false,
  escalation_donatello: false,
  i_ping: false,
  rilascio_collaudo_eseguito: false,
  rilascio_produzione_eseguito: false,
  in_lavorazione_ora: false,
  numero_priorita: 0,
  percentuale_avanzamento: 0,
  applicativo: [] as string[],
  storia_ticket: [] as string[]
} as const;

// Etichette leggibili per UI/form
export const TICKET_FIELD_LABELS = {
  id: "ID",
  utente_id: "Utente",
  n_tag: "Tag",
  stato: "Stato",
  ultimo_ping: "Ultimo ping",
  priorita: "Priorità",
  tread_email: "Thread email",
  aggiornamento_storia: "Aggiornamento storia",
  applicativo: "Applicativo",
  assignee: "Assegnatario",
  attivita_attive: "Attività attive",
  check_collaudo: "Check collaudo",
  data_chiusura_attivita: "Data chiusura attività",
  descrizione: "Descrizione",
  email_andrea: "Email Andrea",
  escalation_donatello: "Escalation Donatello",
  i_ping: "I ping",
  note_importanti: "Note importanti",
  numero_storia: "Numero storia",
  person: "Persona",
  ping_email: "Ping email",
  place: "Ambiente / Place",
  rilascio_collaudo_eseguito: "Rilascio collaudo eseguito",
  rilascio_produzione_eseguito: "Rilascio produzione eseguito",
  rilascio_in_collaudo: "Rilascio in collaudo",
  rilascio_in_produzione: "Rilascio in produzione",
  sprint: "Sprint",
  stato_collaudo: "Stato collaudo",
  ultimo_controllo_collaudo: "Ultimo controllo collaudo",
  tipo_di_attivita: "Tipo di attività",
  tool: "Tool",
  documento_operativo_url: "Documento operativo URL",
  titolo: "Titolo",
  creato_at: "Creato il",
  cliente_id: "Cliente",
  id_change: "Change",
  in_lavorazione_ora: "In lavorazione ora",
  numero_priorita: "Numero priorità",
  percentuale_avanzamento: "Percentuale avanzamento",
  note: "Note",
  storia_ticket: "Storico ticket",
  link_tag: "Link tag"
} as const;

// Tipologia campi per generazione dinamica form/tabella
export const TICKET_FIELD_TYPES = {
  id: "uuid",
  utente_id: "uuid",
  n_tag: "text",
  stato: "select",
  ultimo_ping: "datetime",
  priorita: "select",
  tread_email: "text",
  aggiornamento_storia: "textarea",
  applicativo: "multiselect",
  assignee: "uuid",
  attivita_attive: "boolean",
  check_collaudo: "boolean",
  data_chiusura_attivita: "date",
  descrizione: "textarea",
  email_andrea: "boolean",
  escalation_donatello: "boolean",
  i_ping: "boolean",
  note_importanti: "textarea",
  numero_storia: "text",
  person: "select",
  ping_email: "text",
  place: "select",
  rilascio_collaudo_eseguito: "boolean",
  rilascio_produzione_eseguito: "boolean",
  rilascio_in_collaudo: "date",
  rilascio_in_produzione: "date",
  sprint: "select",
  stato_collaudo: "select",
  ultimo_controllo_collaudo: "datetime",
  tipo_di_attivita: "select",
  tool: "select",
  documento_operativo_url: "url",
  titolo: "text",
  creato_at: "datetime",
  cliente_id: "uuid",
  id_change: "uuid",
  in_lavorazione_ora: "boolean",
  numero_priorita: "number",
  percentuale_avanzamento: "number",
  note: "textarea",
  storia_ticket: "string-array",
  link_tag: "url"
} as const;

// Opzioni select associate ai campi
export const TICKET_FIELD_OPTIONS = {
  stato: STATO_TICKET_LIST,
  priorita: PRIORITA_LIST,
  applicativo: APPLICATIVI_LIST,
  sprint: SPRINT_LIST,
  stato_collaudo: STATO_COLLAUDO_LIST,
  tipo_di_attivita: ATTIVITA_LIST,
  tool: TOOL_LIST,
  person: PERSON_LIST,
  place: PLACE_LIST
} as const;

// Campi booleani
export const TICKET_BOOLEAN_FIELDS = [
  "attivita_attive",
  "check_collaudo",
  "email_andrea",
  "escalation_donatello",
  "i_ping",
  "rilascio_collaudo_eseguito",
  "rilascio_produzione_eseguito",
  "in_lavorazione_ora"
] as const;

// Campi data / datetime
export const TICKET_DATE_FIELDS = [
  "data_chiusura_attivita",
  "rilascio_in_collaudo",
  "rilascio_in_produzione"
] as const;

export const TICKET_DATETIME_FIELDS = [
  "ultimo_ping",
  "ultimo_controllo_collaudo",
  "creato_at"
] as const;

// Campi richiesti lato UI
export const TICKET_REQUIRED_FIELDS = [
  "titolo",
  "utente_id"
] as const;

// Tipizzazione utile per TypeScript
export type StatoTicket = typeof STATO_TICKET_LIST[number];
export type Applicativo = typeof APPLICATIVI_LIST[number];
export type Priorita = typeof PRIORITA_LIST[number];
export type TipoAttivita = typeof ATTIVITA_LIST[number];
export type Sprint = typeof SPRINT_LIST[number];
export type StatoCollaudo = typeof STATO_COLLAUDO_LIST[number];
export type Tool = typeof TOOL_LIST[number];
export type Person = typeof PERSON_LIST[number];
export type Place = typeof PLACE_LIST[number];

export type TicketBooleanField = typeof TICKET_BOOLEAN_FIELDS[number];
export type TicketDateField = typeof TICKET_DATE_FIELDS[number];
export type TicketDateTimeField = typeof TICKET_DATETIME_FIELDS[number];
export type TicketRequiredField = typeof TICKET_REQUIRED_FIELDS[number];

export interface Ticket {
  id: string;
  utente_id: string;
  n_tag?: string | null;
  stato?: StatoTicket | null;
  ultimo_ping?: string | null;
  priorita?: Priorita | null;
  tread_email?: string | null;
  aggiornamento_storia?: string | null;
  applicativo?: Applicativo[] | null;
  assignee?: string | null;
  attivita_attive?: boolean | null;
  check_collaudo?: boolean | null;
  data_chiusura_attivita?: string | null;
  descrizione?: string | null;
  email_andrea?: boolean | null;
  escalation_donatello?: boolean | null;
  i_ping?: boolean | null;
  note_importanti?: string | null;
  numero_storia?: string | null;
  person?: Person | null;
  ping_email?: string | null;
  place?: Place | null;
  rilascio_collaudo_eseguito?: boolean | null;
  rilascio_produzione_eseguito?: boolean | null;
  rilascio_in_collaudo?: string | null;
  rilascio_in_produzione?: string | null;
  sprint?: Sprint | null;
  stato_collaudo?: StatoCollaudo | null;
  ultimo_controllo_collaudo?: string | null;
  tipo_di_attivita?: TipoAttivita | null;
  tool?: Tool | null;
  documento_operativo_url?: string | null;
  titolo: string;
  creato_at?: string | null;
  cliente_id?: string | null;
  id_change?: string | null;
  in_lavorazione_ora?: boolean | null;
  numero_priorita?: number | null;
  percentuale_avanzamento?: number | null;
  note?: string | null;
  storia_ticket?: string[] | null;
  link_tag?: string | null;
}

export const DEFAULT_CLIENTE_NAME = [
  "Esselunga",
  "Sika",
  "Leclerc",
  "Azimut/Benetti",
  "HRM",
  "Pro-Keds"
] as const;