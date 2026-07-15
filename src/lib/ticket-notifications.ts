"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Notifiche realtime di modifica ticket (Supabase Realtime Broadcast).
 *
 * Quando un utente modifica un campo di un ticket NON suo, viene inviato
 * un evento broadcast. I destinatari (assegnatario del ticket e, in caso
 * di riassegnazione, anche il vecchio assegnatario) vedono un popup a
 * destra con numero ticket, modifica effettuata e autore.
 *
 * Per i cambi di assegnatario il popup mostra "Nome Cognome → Nome Cognome"
 * al posto degli id.
 *
 * IMPORTANTE: mittente e ricevitore condividono UN SOLO canale per client.
 * Il client browser di Supabase è un singleton: creare due canali con lo
 * stesso topic sullo stesso socket fa chiudere il primo (duplicate join).
 *
 * Nessuna modifica allo schema del database.
 */

export const TICKET_NOTIFICATIONS_CHANNEL = "ticket-change-notifications";
export const TICKET_NOTIFICATION_EVENT = "field_update";
export const NOTE_PING_EVENT = "note_ping";

/** Ping da menzione @ in una nota */
export type NotePingNotification = {
  noteId: string;
  noteTitle: string | null;
  targetUserId: string;
  authorId: string;
  authorName: string;
  /** ISO timestamp */
  at: string;
};

export type TicketChangeNotification = {
  ticketId: string;
  ticketTag: string | null;
  ticketTitle: string | null;
  /** Utenti a cui mostrare il popup (assegnatario attuale e/o precedente) */
  recipients: string[];
  authorId: string;
  authorName: string;
  /** Descrizioni leggibili, es. "Stato → In lavorazione" */
  changes: string[];
  /** ISO timestamp */
  at: string;
};

const FIELD_LABELS: Record<string, string> = {
  stato: "Stato",
  titolo: "Titolo",
  n_tag: "N° TAG",
  note_importanti: "Note importanti",
  percentuale_avanzamento: "Avanzamento",
  applicativo: "Applicativo",
  numero_priorita: "Priorità",
  priorita: "Priorità",
  sprint: "Sprint",
  assignee: "Assegnatario",
  in_lavorazione_ora: "In lavorazione ora",
  descrizione: "Descrizione",
  tipo_di_attivita: "Tipo attività",
  cliente_id: "Cliente",
  ricorsivo: "Ricorsivo",
  rilascio_in_collaudo: "Rilascio in collaudo",
  rilascio_in_produzione: "Rilascio in produzione",
};

// Campi tecnici/rumorosi da non mostrare nel popup
const IGNORED_FIELDS = new Set(["columnId", "ultimo_ping", "storia_ticket"]);

function formatValue(field: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "Sì" : "No";
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ") || "—";

  const text = String(value);
  const short = text.length > 60 ? `${text.slice(0, 60)}…` : text;

  if (field === "percentuale_avanzamento") return `${short}%`;
  return short;
}

/** Converte una patch { campo: valore } in descrizioni leggibili. */
export function describeTicketChanges(patch: Record<string, any>): string[] {
  return Object.entries(patch)
    .filter(([field]) => !IGNORED_FIELDS.has(field))
    .map(([field, value]) => {
      const label = FIELD_LABELS[field] || field;
      return `${label} → ${formatValue(field, value)}`;
    });
}

// --- Risoluzione nomi profili (con cache) ---

const nameCache = new Map<string, string>();

async function resolveProfileNames(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, string>> {
  const missing = ids.filter((id) => id && !nameCache.has(id));

  if (missing.length > 0) {
    const { data, error } = await supabase
      .from("profili")
      .select("id, nome, nome_completo")
      .in("id", missing);

    if (error) {
      console.error("[ticket-notifications] errore lettura profili:", error.message);
    }

    (data || []).forEach((p: any) => {
      nameCache.set(p.id, p.nome_completo || p.nome || "Sconosciuto");
    });
  }

  return nameCache;
}

// --- Canale broadcast condiviso (uno per client) ---

type Listener = (notification: TicketChangeNotification) => void;
type PingListener = (notification: NotePingNotification) => void;

const listeners = new Set<Listener>();
const pingListeners = new Set<PingListener>();

type ChannelEntry = { channel: any; ready: Promise<void> };

const channelCache = new WeakMap<SupabaseClient, ChannelEntry>();

function getBroadcastChannel(supabase: SupabaseClient): ChannelEntry {
  let entry = channelCache.get(supabase);

  if (!entry) {
    const channel = supabase.channel(TICKET_NOTIFICATIONS_CHANNEL, {
      config: { broadcast: { self: false } },
    });

    // Il listener va agganciato PRIMA della subscribe: smista i messaggi
    // a tutti i ricevitori registrati (vedi subscribeTicketNotifications)
    channel.on(
      "broadcast",
      { event: TICKET_NOTIFICATION_EVENT },
      ({ payload }: { payload: TicketChangeNotification }) => {
        console.debug("[ticket-notifications] messaggio ricevuto:", payload);
        listeners.forEach((listener) => {
          try {
            listener(payload);
          } catch (err) {
            console.error("[ticket-notifications] errore listener:", err);
          }
        });
      }
    );

    // Ping da menzione @ nelle note
    channel.on(
      "broadcast",
      { event: NOTE_PING_EVENT },
      ({ payload }: { payload: NotePingNotification }) => {
        console.debug("[ticket-notifications] ping ricevuto:", payload);
        pingListeners.forEach((listener) => {
          try {
            listener(payload);
          } catch (err) {
            console.error("[ticket-notifications] errore ping listener:", err);
          }
        });
      }
    );

    const ready = new Promise<void>((resolve) => {
      channel.subscribe((status: string, err?: Error) => {
        if (status === "SUBSCRIBED") {
          console.debug("[ticket-notifications] canale pronto");
          resolve();
          return;
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          console.error(
            "[ticket-notifications] canale non disponibile:",
            status,
            err?.message ?? ""
          );
          resolve(); // non bloccare mai i salvataggi
        }
      });
    });

    entry = { channel, ready };
    channelCache.set(supabase, entry);
  }

  return entry;
}

/**
 * Registra un ricevitore di notifiche (usato dal TicketChangeToaster).
 * Ritorna la funzione di unsubscribe. Il canale resta attivo per i mittenti.
 */
export function subscribeTicketNotifications(
  supabase: SupabaseClient,
  listener: Listener
): () => void {
  getBroadcastChannel(supabase);
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Registra un ricevitore dei ping da menzione @ nelle note. */
export function subscribeNotePings(
  supabase: SupabaseClient,
  listener: PingListener
): () => void {
  getBroadcastChannel(supabase);
  pingListeners.add(listener);

  return () => {
    pingListeners.delete(listener);
  };
}

/**
 * Invia un ping realtime all'utente menzionato con @ in una nota.
 * Fire-and-forget: non interrompe mai il flusso dell'editor.
 */
export async function sendNotePingNotification(
  supabase: SupabaseClient,
  info: { noteId: string; noteTitle?: string | null; targetUserId: string }
): Promise<void> {
  try {
    if (!info.targetUserId) return;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return;

    // Auto-menzione: nessun ping
    if (info.targetUserId === user.id) return;

    if (!cachedAuthor || cachedAuthor.id !== user.id) {
      const { data: profilo, error: profiloError } = await supabase
        .from("profili")
        .select("id, nome, nome_completo")
        .eq("id", user.id)
        .maybeSingle();

      if (profiloError) {
        console.error("Errore lettura profilo autore:", profiloError.message);
      }

      cachedAuthor = {
        id: user.id,
        nome: profilo?.nome_completo || profilo?.nome || "Un collega",
      };
    }

    const payload: NotePingNotification = {
      noteId: info.noteId,
      noteTitle: info.noteTitle ?? null,
      targetUserId: info.targetUserId,
      authorId: user.id,
      authorName: cachedAuthor.nome,
      at: new Date().toISOString(),
    };

    const { channel, ready } = getBroadcastChannel(supabase);
    await ready;

    const status = await channel.send({
      type: "broadcast",
      event: NOTE_PING_EVENT,
      payload,
    });

    if (status !== "ok") {
      console.error("[ticket-notifications] invio ping fallito:", status);
    } else {
      console.debug("[ticket-notifications] ping inviato:", payload);
    }
  } catch (err) {
    console.error("Errore invio ping nota:", err);
  }
}

// Cache del profilo dell'autore (evita una query per ogni modifica)
let cachedAuthor: { id: string; nome: string } | null = null;

type TicketInfo = {
  id: string;
  n_tag?: string | null;
  titolo?: string | null;
  /** Assegnatario PRIMA della modifica */
  assignee?: string | null;
};

/**
 * Invia la notifica di modifica ai destinatari giusti.
 *
 * - `ticket` deve essere lo stato PRIMA della modifica (per conoscere il
 *   vecchio assegnatario), `patch` i campi modificati.
 * - Se la patch cambia l'assegnatario, vengono notificati sia il vecchio
 *   sia il nuovo assegnatario, con i nomi al posto degli id.
 * - Da chiamare DOPO un salvataggio riuscito. Fire-and-forget: non
 *   interrompe mai il flusso di salvataggio.
 */
export async function sendTicketChangeNotification(
  supabase: SupabaseClient,
  ticket: TicketInfo,
  patch: Record<string, any>
): Promise<void> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return;

    const oldAssignee: string | null = ticket.assignee ?? null;

    const hasAssigneeChange =
      Object.prototype.hasOwnProperty.call(patch, "assignee") &&
      (patch.assignee ?? null) !== oldAssignee;

    const newAssignee: string | null = hasAssigneeChange
      ? patch.assignee ?? null
      : oldAssignee;

    // Descrizioni leggibili; il cambio assegnatario è formattato con i nomi
    let changes: string[];

    if (hasAssigneeChange) {
      const names = await resolveProfileNames(
        supabase,
        [oldAssignee, newAssignee].filter(Boolean) as string[]
      );

      const oldName = oldAssignee
        ? names.get(oldAssignee) ?? "Sconosciuto"
        : "Nessuno";
      const newName = newAssignee
        ? names.get(newAssignee) ?? "Sconosciuto"
        : "Nessuno";

      const { assignee: _assignee, ...restPatch } = patch;

      changes = [
        `Assegnatario: ${oldName} → ${newName}`,
        ...describeTicketChanges(restPatch),
      ];
    } else {
      changes = describeTicketChanges(patch);
    }

    if (changes.length === 0) {
      console.debug(
        "[ticket-notifications] nessun campo significativo, skip",
        patch
      );
      return;
    }

    // Destinatari: assegnatario attuale e, se riassegnato, anche il vecchio.
    // Mai l'autore della modifica.
    const recipients = Array.from(
      new Set([oldAssignee, newAssignee].filter(Boolean) as string[])
    ).filter((id) => id !== user.id);

    if (recipients.length === 0) {
      console.debug(
        "[ticket-notifications] nessun destinatario (ticket proprio o senza assegnatario), skip"
      );
      return;
    }

    if (!cachedAuthor || cachedAuthor.id !== user.id) {
      const { data: profilo, error: profiloError } = await supabase
        .from("profili")
        .select("id, nome, nome_completo")
        .eq("id", user.id)
        .maybeSingle();

      if (profiloError) {
        console.error(
          "Errore lettura profilo autore:",
          profiloError.message
        );
      }

      cachedAuthor = {
        id: user.id,
        nome: profilo?.nome_completo || profilo?.nome || "Un collega",
      };
    }

    const payload: TicketChangeNotification = {
      ticketId: ticket.id,
      ticketTag: ticket.n_tag ?? null,
      ticketTitle: ticket.titolo ?? null,
      recipients,
      authorId: user.id,
      authorName: cachedAuthor.nome,
      changes,
      at: new Date().toISOString(),
    };

    const { channel, ready } = getBroadcastChannel(supabase);
    await ready;

    const status = await channel.send({
      type: "broadcast",
      event: TICKET_NOTIFICATION_EVENT,
      payload,
    });

    if (status !== "ok") {
      console.error("[ticket-notifications] invio fallito:", status);
    } else {
      console.debug("[ticket-notifications] notifica inviata:", payload);
    }
  } catch (err) {
    console.error("Errore invio notifica modifica ticket:", err);
  }
}
