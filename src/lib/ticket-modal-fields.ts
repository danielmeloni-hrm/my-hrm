// src/lib/ticket-modal-fields.ts
// Cosa mostrare nel popup di dettaglio del ticket, per utente.

import { TICKET_FIELD_LABELS } from "@/components/parametri_ticket/attivita";

/* ------------------------------------------------------------------ */
/* Sezioni                                                             */
/* ------------------------------------------------------------------ */

export type SezioneId =
  | "badge_cliente"
  | "badge_applicativo"
  | "badge_tag"
  | "badge_sprint"
  | "azione_apri_ticket"
  | "azione_in_lavorazione"
  | "storia"
  | "avanzamento"
  | "mail_thread"
  | "note_bloccanti"
  | "dettagli";

export const SEZIONI: {
  id: SezioneId;
  label: string;
  gruppo: "Intestazione" | "Contenuto";
}[] = [
  { id: "badge_cliente", label: "Etichetta cliente", gruppo: "Intestazione" },
  { id: "badge_applicativo", label: "Etichetta applicativo", gruppo: "Intestazione" },
  { id: "badge_tag", label: "Etichetta n° tag", gruppo: "Intestazione" },
  { id: "badge_sprint", label: "Etichetta sprint", gruppo: "Intestazione" },
  { id: "azione_apri_ticket", label: "Pulsante Apri ticket", gruppo: "Intestazione" },
  {
    id: "azione_in_lavorazione",
    label: "Pulsante In lavorazione",
    gruppo: "Intestazione",
  },
  { id: "storia", label: "Storia dell'attività", gruppo: "Contenuto" },
  { id: "avanzamento", label: "Avanzamento", gruppo: "Contenuto" },
  { id: "mail_thread", label: "Thread email", gruppo: "Contenuto" },
  { id: "note_bloccanti", label: "Note bloccanti", gruppo: "Contenuto" },
  { id: "dettagli", label: "Scheda dettagli", gruppo: "Contenuto" },
];

/* ------------------------------------------------------------------ */
/* Campi mostrabili nella scheda "Dettagli"                            */
/* ------------------------------------------------------------------ */

/** Campi della tabella ticket selezionabili per la scheda dettagli. */
export const CAMPI_DETTAGLIO = [
  "stato",
  "priorita",
  "assignee",
  "tipo_di_attivita",
  "sprint",
  "stato_collaudo",
  "tool",
  "person",
  "place",
  "numero_priorita",
  "data_chiusura_attivita",
  "rilascio_in_collaudo",
  "rilascio_in_produzione",
  "ultimo_ping",
  "ultimo_controllo_collaudo",
  "numero_storia",
  "descrizione",
  "note",
  "link_tag",
  "documento_operativo_url",
  "creato_at",
] as const;

export type CampoDettaglio = (typeof CAMPI_DETTAGLIO)[number];

export function etichettaCampo(campo: string) {
  return (TICKET_FIELD_LABELS as Record<string, string>)[campo] ?? campo;
}

/* ------------------------------------------------------------------ */
/* Configurazione                                                      */
/* ------------------------------------------------------------------ */

export type TicketModalConfig = {
  sezioni: SezioneId[];
  campi: CampoDettaglio[];
};

/** Vista predefinita: com'era il popup prima della personalizzazione. */
export const CONFIG_PREDEFINITA: TicketModalConfig = {
  sezioni: [
    "badge_cliente",
    "badge_applicativo",
    "badge_tag",
    "badge_sprint",
    "azione_apri_ticket",
    "azione_in_lavorazione",
    "storia",
    "avanzamento",
    "mail_thread",
    "note_bloccanti",
  ],
  campi: ["stato", "priorita", "tipo_di_attivita", "rilascio_in_produzione"],
};

const SEZIONI_VALIDE = new Set(SEZIONI.map((sezione) => sezione.id));
const CAMPI_VALIDI = new Set<string>(CAMPI_DETTAGLIO);

/** Valida la configurazione che arriva dal client o dal database. */
export function normalizeTicketModalConfig(value: unknown): TicketModalConfig {
  if (!value || typeof value !== "object") return CONFIG_PREDEFINITA;

  const { sezioni, campi } = value as {
    sezioni?: unknown;
    campi?: unknown;
  };

  const sezioniValide = Array.isArray(sezioni)
    ? (sezioni.filter(
        (item): item is SezioneId =>
          typeof item === "string" && SEZIONI_VALIDE.has(item as SezioneId)
      ) as SezioneId[])
    : CONFIG_PREDEFINITA.sezioni;

  const campiValidi = Array.isArray(campi)
    ? (campi.filter(
        (item): item is CampoDettaglio =>
          typeof item === "string" && CAMPI_VALIDI.has(item)
      ) as CampoDettaglio[])
    : CONFIG_PREDEFINITA.campi;

  return {
    // Un array vuoto è legittimo: l'utente può nascondere tutto.
    sezioni: Array.isArray(sezioni) ? sezioniValide : CONFIG_PREDEFINITA.sezioni,
    campi: Array.isArray(campi) ? campiValidi : CONFIG_PREDEFINITA.campi,
  };
}

/** Formatta il valore di un campo per la sola lettura. */
export function formattaValore(campo: string, valore: unknown): string {
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
        year: "numeric",
      });
    }
  }

  return testo;
}
