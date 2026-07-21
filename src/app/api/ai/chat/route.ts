import { NextResponse } from "next/server";
import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  ACTION_NAMES,
  TICKET_ACTION_DECLARATIONS,
  buildPendingAction,
  detectsWriteIntent,
  signAction,
  verifyAction,
} from "@/lib/ai-ticket-actions";
import type { AiPendingAction } from "@/lib/ai-ticket-actions";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

type StoredEmail = {
  html?: string | null;
  text?: string | null;
  index?: number;
  subject?: string | null;
  direction?: string | null;
  from_email?: string | null;
  received_at?: string | null;
  sent_at?: string | null;
  body_preview?: string | null;
  outlook_message_id?: string | null;
  internet_message_id?: string | null;
  [key: string]: any;
};

async function getUser(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user;
}

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function normalizeSubject(value?: string | null) {
  return (value || "")
    .replace(/^((re|r|fw|fwd|i):\s*)+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSearchText(message: string) {
  return message
    .replace(/fammi/gi, "")
    .replace(/resoconto/gi, "")
    .replace(/riepilogo/gi, "")
    .replace(/sintesi/gi, "")
    .replace(/riassunto/gi, "")
    .replace(/del/gi, "")
    .replace(/della/gi, "")
    .replace(/thread/gi, "")
    .replace(/tread/gi, "")
    .replace(/email/gi, "")
    .replace(/mail/gi, "")
    .replace(/ticket/gi, "")
    .replace(/cliente/gi, "")
    .replace(/documento/gi, "")
    .replace(/documenti/gi, "")
    .replace(/persona/gi, "")
    .replace(/persone/gi, "")
    .replace(/utente/gi, "")
    .replace(/utenti/gi, "")
    .replace(/profilo/gi, "")
    .replace(/profili/gi, "")
    .replace(/dipendente/gi, "")
    .replace(/dipendenti/gi, "")
    .replace(/attività/gi, "")
    .replace(/attivita/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCodes(value?: string | null) {
  const text = value || "";

  const standardCodes = Array.from(
    text.matchAll(/\b(TAG|INC|CHG)\d+\b/gi)
  ).map((match) => match[0].toUpperCase());

  const hashCodes = Array.from(text.matchAll(/#[A-Z0-9_-]{2,30}/gi)).map(
    (match) => match[0].replace("#", "").toUpperCase()
  );

  return Array.from(new Set([...standardCodes, ...hashCodes]));
}

function stripHtml(value?: string | null) {
  if (!value) return "";

  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getStoredEmailText(email: StoredEmail, fallbackRow?: any) {
  return (
    email.text ||
    email.body_preview ||
    stripHtml(email.html) ||
    fallbackRow?.body_text ||
    fallbackRow?.contenuto ||
    stripHtml(fallbackRow?.body_html) ||
    ""
  );
}

function getIntent(message: string, hasPendingAction = false) {
  const text = normalizeText(message);
  const codes = extractCodes(message);

  const asksPeople =
    text.includes("persona") ||
    text.includes("persone") ||
    text.includes("utente") ||
    text.includes("utenti") ||
    text.includes("profilo") ||
    text.includes("profili") ||
    text.includes("dipendente") ||
    text.includes("dipendenti") ||
    text.includes("tecnico") ||
    text.includes("tecnici") ||
    text.includes("assegnatario") ||
    text.includes("assignee") ||
    text.includes("ruolo") ||
    text.includes("accesso") ||
    text.includes("login") ||
    text.includes("loggato") ||
    text.includes("chi sono") ||
    text.includes("mio id") ||
    text.includes("id utente");

  const asksMail =
    text.includes("mail") ||
    text.includes("email") ||
    text.includes("thread") ||
    text.includes("tread") ||
    codes.some((code) => !/^(TAG|INC|CHG)\d+$/i.test(code));

  const asksTicket =
    text.includes("ticket") ||
    text.includes("segnalazione") ||
    text.includes("bug") ||
    text.includes("attività") ||
    text.includes("attivita") ||
    text.includes("lavorando") ||
    text.includes("lavora") ||
    text.includes("assegnato") ||
    text.includes("assegnati") ||
    asksPeople ||
    /\b(TAG|INC)\d+\b/i.test(message);

  const asksClienti = text.includes("cliente") || text.includes("clienti");

  const asksDocumenti =
    text.includes("documento") ||
    text.includes("documenti") ||
    text.includes("documenti operativi") ||
    text.includes("flusso") ||
    /\bCHG\d+\b/i.test(message);

  const asksOverview =
    text.includes("resoconto") ||
    text.includes("riepilogo") ||
    text.includes("sintesi") ||
    text.includes("riassunto") ||
    text.includes("cosa è successo") ||
    text.includes("cosa e successo") ||
    text.includes("cosa sai dirmi");

  const asksAction = detectsWriteIntent(message, hasPendingAction);

  const isGeneric =
    !asksMail && !asksTicket && !asksClienti && !asksDocumenti && !asksPeople;

  return {
    asksMail,
    asksTicket,
    asksClienti,
    asksDocumenti,
    asksPeople,
    asksOverview,
    asksAction,
    isGeneric,
    searchText: extractSearchText(message),
    codes,
  };
}

function buildMailThreadContext(rows: any[]) {
  const groups = new Map<string, any>();

  for (const row of rows) {
    const subject = normalizeSubject(row.subject || "Thread senza oggetto");
    const key = `${row.n_tag || "NO_TAG"}__${subject}`;

    if (!groups.has(key)) {
      groups.set(key, {
        n_tag: row.n_tag,
        topic: row.topic || null,
        subject,
        raw_subject: row.subject || null,
        threadLink: null,
        emails: [],
        totalEmails: 0,
        lastEmailAt: null,
      });
    }

    const group = groups.get(key);
    const type = row.tread?.type;

    if (type === "thread_link" || row.linked_manually) {
      group.threadLink = {
        id: row.id,
        created_at: row.created_at,
        linked_at: row.linked_at,
        link_status: row.link_status,
      };
      continue;
    }

    const emailsFromJsonb = Array.isArray(row.emails) ? row.emails : [];

    if (emailsFromJsonb.length > 0) {
      for (const [index, email] of emailsFromJsonb.entries()) {
        const emailText = getStoredEmailText(email, row);

        const emailDate =
          email.received_at ||
          email.sent_at ||
          row.received_at ||
          row.sent_at ||
          row.created_at ||
          row.data_invio;

        group.emails.push({
          id: `${row.id}-${email.outlook_message_id || email.internet_message_id || index}`,
          parent_mail_thread_id: row.id,
          email_index: index + 1,
          subject: normalizeSubject(email.subject || row.subject || subject),
          raw_subject: email.subject || row.subject || null,
          direction: email.direction || row.direction,
          from_email: email.from_email || row.from_email,
          to_emails: email.to_emails || row.to_emails,
          cc_emails: email.cc_emails || row.cc_emails,
          date: emailDate,
          text: emailText,
          preview: email.body_preview || emailText.slice(0, 300),
          body_text: emailText,
          outlook_message_id: email.outlook_message_id || row.outlook_message_id,
          internet_message_id:
            email.internet_message_id || row.internet_message_id,
        });

        group.totalEmails += 1;

        if (
          emailDate &&
          (!group.lastEmailAt ||
            new Date(emailDate).getTime() >
              new Date(group.lastEmailAt).getTime())
        ) {
          group.lastEmailAt = emailDate;
        }
      }

      continue;
    }

    const emailText = row.body_text || row.contenuto || stripHtml(row.body_html);
    const emailDate =
      row.received_at || row.sent_at || row.created_at || row.data_invio;

    group.emails.push({
      id: row.id,
      parent_mail_thread_id: row.id,
      email_index: 1,
      subject,
      raw_subject: row.subject || null,
      direction: row.direction,
      from_email: row.from_email,
      to_emails: row.to_emails,
      cc_emails: row.cc_emails,
      date: emailDate,
      text: emailText,
      preview: emailText.slice(0, 300),
      body_text: emailText,
      internet_message_id: row.internet_message_id,
      outlook_message_id: row.outlook_message_id,
    });

    group.totalEmails += 1;

    if (
      emailDate &&
      (!group.lastEmailAt ||
        new Date(emailDate).getTime() > new Date(group.lastEmailAt).getTime())
    ) {
      group.lastEmailAt = emailDate;
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      emails: group.emails.sort(
        (a: any, b: any) =>
          new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
      ),
    }))
    .sort(
      (a, b) =>
        new Date(b.lastEmailAt || 0).getTime() -
        new Date(a.lastEmailAt || 0).getTime()
    );
}

function threadMatchesSearch(thread: any, intent: any) {
  const haystack = [
    thread.subject,
    thread.raw_subject,
    thread.topic,
    thread.n_tag,
    thread.ticket?.n_tag,
    thread.ticket?.titolo,
    thread.ticket?.cliente_nome,
    ...(thread.emails || []).flatMap((email: any) => [
      email.subject,
      email.raw_subject,
      email.from_email,
      email.text,
      email.body_text,
      email.preview,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const searchText = intent.searchText.toLowerCase();
  const searchWords = searchText
    .split(/\s+/)
    .map((word: string) => word.trim())
    .filter((word: string) => word.length >= 3);

  const codeMatches = intent.codes.some((code: string) =>
    haystack.includes(code.toLowerCase())
  );

  const textMatches =
    searchWords.length === 0 ||
    searchWords.some((word: string) => haystack.includes(word));

  return codeMatches || textMatches;
}

function findProfiloForTicket(ticket: any, profili: any[]) {
  const ticketValues = [
    ticket.assignee,
    ticket.assegnatario,
    ticket.owner,
    ticket.user_id,
    ticket.profilo_id,
    ticket.tecnico_id,
    ticket.responsabile_id,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  if (ticketValues.length === 0) return null;

  return (
    profili.find((profilo: any) => {
      const profiloValues = [
        profilo.id,
        profilo.email,
        profilo.nome,
        profilo.nome_completo,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return ticketValues.some((ticketValue) =>
        profiloValues.includes(ticketValue)
      );
    }) || null
  );
}

/**
 * Il contesto completo può diventare enorme (mail con body integrali) e far
 * fallire la chiamata al modello. Se supera la soglia, riduciamo i testi email.
 */
const MAX_CONTEXT_CHARS = 350_000;

function serializeContext(context: any) {
  let json = JSON.stringify(context, null, 2);

  if (json.length <= MAX_CONTEXT_CHARS) return json;

  const compact = {
    ...context,
    mailThreads: (context.mailThreads ?? []).slice(0, 60).map((thread: any) => ({
      ...thread,
      emails: (thread.emails ?? []).slice(-20).map((email: any) => ({
        ...email,
        text: String(email.text ?? "").slice(0, 1500),
        body_text: undefined,
        preview: undefined,
      })),
    })),
  };

  json = JSON.stringify(compact, null, 2);

  if (json.length <= MAX_CONTEXT_CHARS) return json;

  return json.slice(0, MAX_CONTEXT_CHARS);
}

/* ------------------------------------------------------------------ */
/* Rilevamento azione (function calling)                               */
/* ------------------------------------------------------------------ */

type DetectActionInput = {
  message: string;
  oldMessages: { role: string; content: string }[];
  userId: string;
  tickets: any[];
  clienti: any[];
  profili: any[];
  previousAction?: AiPendingAction | null;
};

async function detectTicketAction(input: DetectActionInput): Promise<{
  answer: string;
  pendingAction: any | null;
} | null> {
  const {
    message,
    oldMessages,
    userId,
    tickets,
    clienti,
    profili,
    previousAction,
  } = input;

  // Contesto minimo: serve solo a far scegliere il ticket giusto.
  const ticketIndex = tickets.slice(0, 400).map((ticket: any) => ({
    n_tag: ticket.n_tag,
    titolo: ticket.titolo,
    stato: ticket.stato,
    priorita: ticket.priorita,
    sprint: ticket.sprint,
    assignee: ticket.assignee,
  }));

  const personeIndex = profili.slice(0, 300).map((profilo: any) => ({
    nome: profilo.nome_completo || profilo.nome,
    email: profilo.email,
  }));

  const clientiIndex = clienti
    .slice(0, 300)
    .map(
      (cliente: any) =>
        cliente.ragione_sociale || cliente.nome || cliente.nome_cliente
    )
    .filter(Boolean);

  const proposalBlock = previousAction
    ? `
PROPOSTA PRECEDENTE ANCORA APERTA (non ancora confermata dall'utente):
${JSON.stringify({
  azione: previousAction.action,
  ticket: previousAction.ticketLabel,
  ticket_ref: previousAction.ticketLabel?.split(" — ")[0] ?? null,
  modifiche: previousAction.payload,
})}

Il messaggio dell'utente può correggerla, completarla o annullarla:
- "scusa, è stato rilasciato in collaudo" => stessa azione e stesso ticket, ma
  il campo corretto è rilascio_in_collaudo invece di rilascio_in_produzione.
- "no, il 13" => stessa proposta con la data corretta.
- "anche la priorità alta" => stessa proposta più il campo aggiuntivo.
In questi casi richiama la funzione con TUTTI i campi corretti e definitivi,
riusando lo stesso ticket_ref della proposta precedente.
`
    : "";

  const prompt = `
Sei il modulo "azioni" dell'assistente MyHRM.

Il tuo unico compito è capire se l'utente vuole MODIFICARE dei dati
(aggiornare campi di un ticket, chiudere un ticket, aggiungere una nota allo
storico, creare un nuovo ticket).

Regole:
- Se l'utente sta solo chiedendo informazioni o facendo una domanda, NON
  chiamare nessuna funzione e rispondi con il testo esatto: NESSUNA_AZIONE
- Se l'utente chiede una modifica, chiama esattamente una funzione.
- Considera richiesta di modifica anche le frasi dichiarative che comunicano un
  fatto avvenuto su un ticket, non solo gli ordini diretti. Esempi:
  · "il TAG123 è stato rilasciato il 12/06/2026" => update_ticket con
    rilascio_in_produzione = 2026-06-12
  · "TAG123 è stato rilasciato in collaudo il 12/06/2026" => update_ticket con
    rilascio_in_collaudo = 2026-06-12 e rilascio_collaudo_eseguito = true
  · "TAG123 è andato in produzione" => rilascio_produzione_eseguito = true
  · "ho finito il TAG123" => close_ticket
  · "sto lavorando su TAG123" => update_ticket con stato "In lavorazione"
- Distingui collaudo e produzione: "collaudo"/"test"/"UAT" => campi
  rilascio_in_collaudo / rilascio_collaudo_eseguito / stato_collaudo;
  "produzione"/"prod"/"live" => rilascio_in_produzione /
  rilascio_produzione_eseguito.
- Le date vanno passate in formato YYYY-MM-DD. Le date scritte dall'utente sono
  in formato italiano giorno/mese/anno: "12/06/2026" significa 2026-06-12.
- Usa i valori esatti degli enum disponibili.
- In "ticket_ref" metti il n_tag se l'utente lo ha indicato, altrimenti il titolo.
- Non inventare ticket, clienti o persone che non sono negli elenchi.
${proposalBlock}
Ultimi messaggi della conversazione:
${JSON.stringify(oldMessages.slice(-6))}

RICHIESTA UTENTE:
${message}

TICKET DISPONIBILI:
${JSON.stringify(ticketIndex)}

PERSONE DISPONIBILI:
${JSON.stringify(personeIndex)}

CLIENTI DISPONIBILI:
${JSON.stringify(clientiIndex)}
`;

  let functionCall: { name?: string; args?: Record<string, any> } | null = null;
  let detectionFailed = true;

  for (const model of ["gemini-2.5-flash", "gemini-2.5-flash-lite"]) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          tools: [{ functionDeclarations: TICKET_ACTION_DECLARATIONS as any }],
          toolConfig: {
            functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
          },
        },
      });

      functionCall = response.functionCalls?.[0] ?? null;
      detectionFailed = false;
      break;
    } catch (error) {
      console.error(`Errore rilevamento azione AI (${model}):`, error);
    }
  }

  if (detectionFailed) {
    return {
      answer:
        "⚠️ Il servizio AI è momentaneamente occupato e non sono riuscito a interpretare la richiesta. Riprova tra qualche secondo.",
      pendingAction: null,
    };
  }

  if (!functionCall?.name || !ACTION_NAMES.has(functionCall.name)) {
    // L'utente ha risposto alla proposta senza modificarla: la teniamo viva.
    if (previousAction) {
      const text = message.trim().toLowerCase();

      if (
        /^(no|nope|annulla|lascia stare|non importa|niente|fermati)\b/.test(text)
      ) {
        return {
          answer: "Ok, ho annullato la proposta. Non ho modificato nulla.",
          pendingAction: null,
        };
      }

      if (/^(si|sì|ok|va bene|procedi|conferma|confermo|vai|esegui)\b/.test(text)) {
        return {
          answer:
            "Perfetto. Per applicare la modifica premi **Conferma** qui sotto.",
          pendingAction: signAction(previousAction),
        };
      }
    }

    return null;
  }

  const resolution = buildPendingAction(
    functionCall.name,
    (functionCall.args ?? {}) as Record<string, any>,
    { userId, tickets, clienti, profili }
  );

  if (!resolution.ok) {
    return { answer: resolution.error, pendingAction: null };
  }

  const dettaglio = resolution.action.changes
    .map((change) => `- **${change.campo}**: ${change.valore}`)
    .join("\n");

  return {
    answer: `${resolution.action.summary}\n\n${dettaglio}\n\nConfermi l'operazione?`,
    pendingAction: signAction(resolution.action),
  };
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const {
      message,
      conversationId,
      pendingAction: clientPendingAction,
    } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "Messaggio mancante" },
        { status: 400 }
      );
    }

    // Proposta ancora aperta lato client: la accettiamo solo se la firma è valida,
    // così il messaggio successivo può correggerla o completarla.
    let previousAction: AiPendingAction | null = null;

    if (clientPendingAction) {
      const verification = verifyAction(clientPendingAction, user.id);
      if (verification.ok) previousAction = verification.action;
    }

    const intent = getIntent(message, Boolean(previousAction));
    let activeConversationId = conversationId;

    if (!activeConversationId) {
      const { data: newConversation, error } = await supabaseAdmin
        .from("ai_conversations")
        .insert({
          user_id: user.id,
          title: message.slice(0, 40),
        })
        .select("id")
        .single();

      if (error) throw error;

      activeConversationId = newConversation.id;
    }

    const insertUserMessagePromise = supabaseAdmin.from("ai_messages").insert({
      conversation_id: activeConversationId,
      role: "user",
      content: message,
    });

    const oldMessagesPromise = supabaseAdmin
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", activeConversationId)
      .order("created_at", { ascending: false })
      .limit(8);

    const loggedUserProfilePromise = supabaseAdmin
      .from("profili")
      .select(
        "id, nome_completo, nome, email, ruolo, creato_at, kanban_columns, all_ticket_settings_colonne, all_ticket_settings_sort, all_incident_settings_colonne, tickek_setting_colonne, ore_ticket, sidebar_position"
      )
      .eq("id", user.id)
      .maybeSingle();

    const profiliPromise =
      intent.asksPeople || intent.asksTicket || intent.isGeneric || intent.asksAction
        ? supabaseAdmin
            .from("profili")
            .select(
              "id, nome_completo, nome, email, ruolo, creato_at, kanban_columns, all_ticket_settings_colonne, all_ticket_settings_sort, all_incident_settings_colonne, tickek_setting_colonne, ore_ticket, sidebar_position"
            )
            .order("creato_at", { ascending: false })
            .limit(300)
        : Promise.resolve({ data: [], error: null });

    const authUsersPromise =
      intent.asksPeople || intent.isGeneric
        ? supabaseAdmin.auth.admin.listUsers()
        : Promise.resolve({
            data: { users: [] },
            error: null,
          });

    const ticketsPromise =
      intent.asksTicket || intent.isGeneric || intent.asksMail || intent.asksAction
        ? supabaseAdmin
            .from("ticket")
            .select("*")
            .order("creato_at", { ascending: false })
            .limit(intent.isGeneric ? 80 : 300)
        : Promise.resolve({ data: [], error: null });

    const clientiPromise =
      intent.asksClienti ||
      intent.isGeneric ||
      intent.asksMail ||
      intent.asksTicket ||
      intent.asksAction
        ? supabaseAdmin
            .from("clienti")
            .select("*")
            .order("creato_at", { ascending: false })
            .limit(intent.isGeneric ? 80 : 200)
        : Promise.resolve({ data: [], error: null });

    const documentiPromise =
      intent.asksDocumenti || intent.isGeneric
        ? supabaseAdmin
            .from("documenti_operativi")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(intent.isGeneric ? 50 : 120)
        : Promise.resolve({ data: [], error: null });

    let mailThreadsQuery = supabaseAdmin
      .from("mail_threads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(intent.asksMail ? 500 : 150);

    if (intent.codes.length > 0) {
      const codeFilters = intent.codes
        .flatMap((code: string) => [
          `subject.ilike.%${code}%`,
          `n_tag.ilike.%${code}%`,
          `topic.ilike.%${code}%`,
          `contenuto.ilike.%${code}%`,
        ])
        .join(",");

      mailThreadsQuery = supabaseAdmin
        .from("mail_threads")
        .select("*")
        .or(codeFilters)
        .order("created_at", { ascending: false })
        .limit(500);
    } else if (intent.asksMail && intent.searchText.length >= 3) {
      const safeSearch = intent.searchText.replace(/[%(),]/g, " ").trim();

      mailThreadsQuery = supabaseAdmin
        .from("mail_threads")
        .select("*")
        .or(
          `subject.ilike.%${safeSearch}%,n_tag.ilike.%${safeSearch}%,topic.ilike.%${safeSearch}%,contenuto.ilike.%${safeSearch}%,from_email.ilike.%${safeSearch}%`
        )
        .order("created_at", { ascending: false })
        .limit(500);
    }

    const mailThreadsPromise =
      intent.asksMail || intent.isGeneric || intent.codes.length > 0
        ? mailThreadsQuery
        : Promise.resolve({ data: [], error: null });

    const [
      insertUserMessageResult,
      oldMessagesResult,
      loggedUserProfileResult,
      profiliResult,
      authUsersResult,
      ticketsResult,
      clientiResult,
      documentiResult,
      mailThreadsResult,
    ] = await Promise.all([
      insertUserMessagePromise,
      oldMessagesPromise,
      loggedUserProfilePromise,
      profiliPromise,
      authUsersPromise,
      ticketsPromise,
      clientiPromise,
      documentiPromise,
      mailThreadsPromise,
    ]);

    if (insertUserMessageResult.error) throw insertUserMessageResult.error;
    if (oldMessagesResult.error) throw oldMessagesResult.error;
    if (loggedUserProfileResult.error) throw loggedUserProfileResult.error;
    if (profiliResult.error) throw profiliResult.error;
    if (authUsersResult.error) throw authUsersResult.error;
    if (ticketsResult.error) throw ticketsResult.error;
    if (clientiResult.error) throw clientiResult.error;
    if (documentiResult.error) throw documentiResult.error;
    if (mailThreadsResult.error) throw mailThreadsResult.error;

    const oldMessages = [...(oldMessagesResult.data ?? [])].reverse();
    const profili = profiliResult.data ?? [];
    const tickets = ticketsResult.data ?? [];
    const clienti = clientiResult.data ?? [];
    const documenti = documentiResult.data ?? [];
    const mailThreadsRaw = mailThreadsResult.data ?? [];
    const mailThreads = buildMailThreadContext(mailThreadsRaw);

    /* ---------------------------------------------------------------- */
    /* Rilevamento azioni di scrittura sui ticket                        */
    /* ---------------------------------------------------------------- */

    if (intent.asksAction) {
      const actionResult = await detectTicketAction({
        message,
        oldMessages,
        userId: user.id,
        tickets,
        clienti,
        profili,
        previousAction,
      });

      if (actionResult) {
        await Promise.all([
          supabaseAdmin.from("ai_messages").insert({
            conversation_id: activeConversationId,
            role: "assistant",
            content: actionResult.answer,
          }),

          supabaseAdmin
            .from("ai_conversations")
            .update({
              updated_at: new Date().toISOString(),
              title: message.slice(0, 40),
            })
            .eq("id", activeConversationId),
        ]);

        return NextResponse.json({
          answer: actionResult.answer,
          pendingAction: actionResult.pendingAction,
          conversationId: activeConversationId,
        });
      }
    }

    const authUsers = (authUsersResult.data.users ?? []).map((authUser: any) => ({
      id: authUser.id,
      email: authUser.email,
      phone: authUser.phone,
      created_at: authUser.created_at,
      updated_at: authUser.updated_at,
      last_sign_in_at: authUser.last_sign_in_at,
      confirmed_at: authUser.confirmed_at,
      email_confirmed_at: authUser.email_confirmed_at,
      invited_at: authUser.invited_at,
      banned_until: authUser.banned_until,
      role: authUser.role,
      app_metadata: authUser.app_metadata,
      user_metadata: authUser.user_metadata,
    }));

    const loggedUserAuth = authUsers.find((item: any) => item.id === user.id);

    const loggedUser = {
      id: user.id,
      email: user.email ?? loggedUserAuth?.email ?? null,
      aud: user.aud,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_sign_in_at: loggedUserAuth?.last_sign_in_at ?? null,
      profilo: loggedUserProfileResult.data ?? null,
    };

    const utentiCompleti = authUsers.map((authUser: any) => {
      const profilo = profili.find((p: any) => p.id === authUser.id);

      return {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        confirmed_at: authUser.confirmed_at,
        nome: profilo?.nome ?? null,
        nome_completo: profilo?.nome_completo ?? null,
        ruolo_profilo: profilo?.ruolo ?? null,
        profilo,
      };
    });

    if (
      loggedUser.profilo &&
      !utentiCompleti.some((item: any) => item.id === loggedUser.id)
    ) {
      utentiCompleti.push({
        id: loggedUser.id,
        email: loggedUser.email,
        created_at: loggedUser.created_at,
        last_sign_in_at: loggedUser.last_sign_in_at,
        confirmed_at: null,
        nome: loggedUser.profilo.nome,
        nome_completo: loggedUser.profilo.nome_completo,
        ruolo_profilo: loggedUser.profilo.ruolo,
        profilo: loggedUser.profilo,
      });
    }

    const clientiMap = new Map(
      clienti.map((cliente: any) => [
        cliente.id,
        cliente.ragione_sociale || cliente.nome || cliente.nome_cliente,
      ])
    );

    const ticketsWithRelations = tickets.map((ticket: any) => {
      const profilo = findProfiloForTicket(ticket, profili);

      return {
        ...ticket,
        cliente_nome: clientiMap.get(ticket.cliente_id) || null,
        assegnatario_profilo: profilo
          ? {
              id: profilo.id,
              nome: profilo.nome,
              nome_completo: profilo.nome_completo,
              email: profilo.email,
              ruolo: profilo.ruolo,
            }
          : null,
      };
    });

    const attivitaPerPersona = utentiCompleti.map((utente: any) => {
      const relatedTickets = ticketsWithRelations.filter((ticket: any) => {
        const values = [
          ticket.assignee,
          ticket.assegnatario,
          ticket.owner,
          ticket.user_id,
          ticket.profilo_id,
          ticket.tecnico_id,
          ticket.responsabile_id,
          ticket.assegnatario_profilo?.id,
          ticket.assegnatario_profilo?.email,
          ticket.assegnatario_profilo?.nome,
          ticket.assegnatario_profilo?.nome_completo,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());

        const userValues = [
          utente.id,
          utente.email,
          utente.nome,
          utente.nome_completo,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());

        return values.some((value) => userValues.includes(value));
      });

      return {
        utente: {
          id: utente.id,
          email: utente.email,
          nome: utente.nome,
          nome_completo: utente.nome_completo,
          ruolo: utente.ruolo_profilo,
          last_sign_in_at: utente.last_sign_in_at,
        },
        totale_attivita: relatedTickets.length,
        attivita_aperte: relatedTickets.filter(
          (ticket: any) =>
            !String(ticket.stato || "").toLowerCase().includes("chius")
        ).length,
        attivita_chiuse: relatedTickets.filter((ticket: any) =>
          String(ticket.stato || "").toLowerCase().includes("chius")
        ).length,
        ticket: relatedTickets.slice(0, 80),
      };
    });

    const mailThreadsWithTicket = mailThreads.map((thread: any) => {
      const ticket = ticketsWithRelations.find(
        (item: any) => item.n_tag === thread.n_tag
      );

      return {
        ...thread,
        ticket: ticket
          ? {
              n_tag: ticket.n_tag,
              titolo: ticket.titolo,
              stato: ticket.stato,
              priorita: ticket.priorita,
              cliente_nome: ticket.cliente_nome,
              assegnatario: ticket.assegnatario_profilo,
            }
          : null,
      };
    });

    const filteredMailThreads =
      intent.asksMail || intent.codes.length > 0
        ? mailThreadsWithTicket.filter((thread: any) =>
            threadMatchesSearch(thread, intent)
          )
        : mailThreadsWithTicket;

    const finalMailThreads =
      filteredMailThreads.length > 0
        ? filteredMailThreads
        : mailThreadsWithTicket;

    console.log("AI DEBUG", {
      loggedUserId: loggedUser.id,
      loggedUserEmail: loggedUser.email,
      message,
      searchText: intent.searchText,
      codes: intent.codes,
      profili: profili.length,
      authUsers: authUsers.length,
      utentiCompleti: utentiCompleti.length,
      tickets: ticketsWithRelations.length,
      rawRows: mailThreadsRaw.length,
      groupedThreads: mailThreadsWithTicket.length,
      filteredThreads: filteredMailThreads.length,
      firstSubjects: mailThreadsWithTicket
        .slice(0, 5)
        .map((t: any) => t.subject),
    });

    const context = {
      loggedUser,
      intent,
      oldMessages,
      authUsers,
      profili,
      utentiCompleti,
      attivitaPerPersona,
      tickets: ticketsWithRelations,
      clienti,
      documenti,
      mailThreads: finalMailThreads,
      counts: {
        authUsers: authUsers.length,
        profili: profili.length,
        utentiCompleti: utentiCompleti.length,
        attivitaPerPersona: attivitaPerPersona.length,
        tickets: ticketsWithRelations.length,
        clienti: clienti.length,
        documenti: documenti.length,
        mailThreadsRaw: mailThreadsRaw.length,
        mailThreadGroups: mailThreadsWithTicket.length,
        filteredMailThreadGroups: filteredMailThreads.length,
      },
    };

    const prompt = `
Sei l'assistente AI interno del gestionale MyHRM.

Regole:
- Rispondi sempre in italiano.
- Rispondi in modo pratico, chiaro e utile.
- Usa solo i dati presenti nel contesto.
- Se i dati non sono sufficienti, dillo chiaramente.
- Non inventare dati.
- Puoi anche eseguire azioni sui ticket (aggiornare campi, chiudere un ticket,
  aggiungere una nota allo storico, creare un ticket). Ogni azione viene sempre
  proposta all'utente e applicata solo dopo la sua conferma esplicita.
- Se l'utente chiede se puoi modificare qualcosa, confermalo e invitalo a
  formulare la richiesta (es. "chiudi TAG123", "metti TAG45 in lavorazione").

Utente loggato:
- Nel contesto trovi "loggedUser".
- loggedUser.id è l'id Supabase Auth dell'utente attualmente loggato.
- loggedUser.email è l'email dell'utente loggato.
- loggedUser.profilo contiene il record della tabella profili collegato a loggedUser.id.
- Se l'utente chiede "chi sono", "qual è il mio id", "che ruolo ho", usa loggedUser.

Tabelle disponibili:
- authUsers: utenti Supabase Authentication.
- profili: profili applicativi collegati a auth.users tramite profili.id = auth.users.id.
- utentiCompleti: unione logica tra authUsers e profili.
- attivitaPerPersona: riepilogo dei ticket/attività associati alle persone.
- tickets: attività, ticket, incident e segnalazioni.
- clienti: anagrafiche clienti.
- documenti: documenti operativi.
- mailThreads: thread email raggruppati.

Dati utenti/accessi:
- authUsers contiene id, email, created_at, last_sign_in_at, confirmed_at.
- id di authUsers corrisponde a UID nella schermata Supabase Authentication.
- Se l'utente chiede utenti registrati, ultimo accesso, id utente, email o login, usa authUsers o utentiCompleti.
- Se l'utente chiede dati applicativi come ruolo, nome o impostazioni, usa profili o utentiCompleti.

Dati persone e attività:
- Per domande tipo "a cosa sta lavorando Mario", "quali attività ha Daniel", "ticket assegnati a X", usa prima attivitaPerPersona e poi tickets.
- Se non trovi un collegamento certo tra ticket e profilo, dillo chiaramente.

Dati email:
- "mailThreads" contiene i thread email raggruppati.
- Il campo autorevole per identificare un thread email è "subject".
- "topic" è solo informativo e non deve essere usato come identificatore principale.
- Ogni thread ha: n_tag, subject, raw_subject, topic, ticket, totalEmails, lastEmailAt, emails.
- Ogni elemento in emails è una singola email.
- Il campo più importante per capire il contenuto della mail è "text" oppure "body_text".

Resoconti email:
Quando l'utente chiede un resoconto, una sintesi o un riepilogo di un thread email:
- Prima identifica il thread più pertinente usando subject/raw_subject.
- Leggi tutte le email del thread in ordine cronologico.
- Scrivi un resoconto discorsivo e parlante.
- Cita data, mittente e passaggi principali quando sono disponibili.
- Concludi con stato finale e punti aperti se emergono dai dati.

DOMANDA UTENTE:
${message}

CONTESTO DISPONIBILE:
${serializeContext(context)}
`;

    let answer = "";

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      answer = response.text || "Non sono riuscito a generare una risposta.";
    } catch (firstError) {
      console.error("Errore Gemini 2.5 Flash:", firstError);

      try {
        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: prompt,
        });

        answer =
          fallbackResponse.text || "Non sono riuscito a generare una risposta.";
      } catch (secondError) {
        console.error("Errore Gemini 2.5 Flash Lite:", secondError);

        answer =
          "⚠️ Il servizio AI è momentaneamente occupato. Riprova tra qualche secondo.";
      }
    }

    const [insertAssistantMessageResult, updateConversationResult] =
      await Promise.all([
        supabaseAdmin.from("ai_messages").insert({
          conversation_id: activeConversationId,
          role: "assistant",
          content: answer,
        }),

        supabaseAdmin
          .from("ai_conversations")
          .update({
            updated_at: new Date().toISOString(),
            title: message.slice(0, 40),
          })
          .eq("id", activeConversationId),
      ]);

    if (insertAssistantMessageResult.error) {
      throw insertAssistantMessageResult.error;
    }

    if (updateConversationResult.error) {
      throw updateConversationResult.error;
    }

    return NextResponse.json({
      answer,
      conversationId: activeConversationId,
    });
  } catch (error) {
    console.error("Errore API AI:", error);

    return NextResponse.json(
      {
        error: "Errore durante la richiesta AI",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}