import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
    .replace(/\s+/g, " ")
    .trim();
}

function extractCodes(value?: string | null) {
  const text = value || "";

  const standardCodes = Array.from(
    text.matchAll(/\b(TAG|INC|CHG)\d+\b/gi)
  ).map((match) => match[0].toUpperCase());

  const hashCodes = Array.from(
    text.matchAll(/#[A-Z0-9_-]{2,30}/gi)
  ).map((match) => match[0].replace("#", "").toUpperCase());

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

function getIntent(message: string) {
  const text = normalizeText(message);
  const codes = extractCodes(message);

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

  const isGeneric = !asksMail && !asksTicket && !asksClienti && !asksDocumenti;

  return {
    asksMail,
    asksTicket,
    asksClienti,
    asksDocumenti,
    asksOverview,
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
          internet_message_id: email.internet_message_id || row.internet_message_id,
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
    const emailDate = row.received_at || row.sent_at || row.created_at || row.data_invio;

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

export async function POST(req: Request) {
  try {
    const user = await getUser(req);

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { message, conversationId } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "Messaggio mancante" },
        { status: 400 }
      );
    }

    const intent = getIntent(message);
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

    const ticketsPromise =
      intent.asksTicket || intent.isGeneric || intent.asksMail
        ? supabaseAdmin
            .from("ticket")
            .select("id, n_tag, titolo, stato, priorita, cliente_id, creato_at")
            .order("creato_at", { ascending: false })
            .limit(intent.isGeneric ? 20 : 100)
        : Promise.resolve({ data: [] });

    const clientiPromise =
      intent.asksClienti || intent.isGeneric || intent.asksMail
        ? supabaseAdmin
            .from("clienti")
            .select("id, nome, creato_at")
            .order("creato_at", { ascending: false })
            .limit(intent.isGeneric ? 30 : 100)
        : Promise.resolve({ data: [] });

    const documentiPromise =
      intent.asksDocumenti || intent.isGeneric
        ? supabaseAdmin
            .from("documenti_operativi")
            .select(
              "id, cliente_id, applicativo, versione, nome_evolutiva, numero_change, created_at"
            )
            .order("created_at", { ascending: false })
            .limit(intent.isGeneric ? 20 : 80)
        : Promise.resolve({ data: [] });

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
        : Promise.resolve({ data: [] });

    const [
      insertUserMessageResult,
      oldMessagesResult,
      ticketsResult,
      clientiResult,
      documentiResult,
      mailThreadsResult,
    ] = await Promise.all([
      insertUserMessagePromise,
      oldMessagesPromise,
      ticketsPromise,
      clientiPromise,
      documentiPromise,
      mailThreadsPromise,
    ]);

    if (insertUserMessageResult.error) throw insertUserMessageResult.error;
    if ("error" in oldMessagesResult && oldMessagesResult.error) throw oldMessagesResult.error;
    if ("error" in ticketsResult && ticketsResult.error) throw ticketsResult.error;
    if ("error" in clientiResult && clientiResult.error) throw clientiResult.error;
    if ("error" in documentiResult && documentiResult.error) throw documentiResult.error;
    if ("error" in mailThreadsResult && mailThreadsResult.error) throw mailThreadsResult.error;

    const oldMessages = [...(oldMessagesResult.data ?? [])].reverse();
    const tickets = ticketsResult.data ?? [];
    const clienti = clientiResult.data ?? [];
    const documenti = documentiResult.data ?? [];
    const mailThreadsRaw = mailThreadsResult.data ?? [];
    const mailThreads = buildMailThreadContext(mailThreadsRaw);

    const clientiMap = new Map(
      clienti.map((cliente: any) => [
        cliente.id,
        cliente.ragione_sociale || cliente.nome,
      ])
    );

    const ticketsWithClient = tickets.map((ticket: any) => ({
      ...ticket,
      cliente_nome: clientiMap.get(ticket.cliente_id) || null,
    }));

    const mailThreadsWithTicket = mailThreads.map((thread: any) => {
      const ticket = ticketsWithClient.find(
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
      filteredMailThreads.length > 0 ? filteredMailThreads : mailThreadsWithTicket;

    console.log("AI MAIL DEBUG", {
      message,
      searchText: intent.searchText,
      codes: intent.codes,
      rawRows: mailThreadsRaw.length,
      groupedThreads: mailThreadsWithTicket.length,
      filteredThreads: filteredMailThreads.length,
      firstSubjects: mailThreadsWithTicket.slice(0, 5).map((t: any) => t.subject),
    });

    const context = {
      intent,
      oldMessages,
      tickets: ticketsWithClient,
      clienti,
      documenti,
      mailThreads: finalMailThreads,
      mailThreadsRawCount: mailThreadsRaw.length,
      mailThreadGroupsCount: mailThreadsWithTicket.length,
      filteredMailThreadGroupsCount: filteredMailThreads.length,
    };

    const prompt = `
Sei l'assistente AI interno del gestionale MyHRM.

Regole:
- Rispondi sempre in italiano.
- Rispondi in modo pratico, chiaro e utile.
- Usa solo i dati presenti nel contesto.
- Se i dati non sono sufficienti, dillo chiaramente.
- Non inventare dati.

Dati email disponibili:
- "mailThreads" contiene i thread email raggruppati.
- Il campo autorevole per identificare un thread email è "subject".
- "topic" è solo informativo e non deve essere usato come identificatore principale.
- Ogni thread ha: n_tag, subject, raw_subject, topic, ticket, totalEmails, lastEmailAt, emails.
- Ogni elemento in emails è una singola email.
- Le email vengono lette prima dal campo jsonb mail_threads.emails.
- Se mail_threads.emails è vuoto, viene usato il contenuto della riga mail_threads.
- Per ogni email puoi usare: subject, raw_subject, direction, from_email, date, text, preview, body_text.
- Il campo più importante per capire il contenuto della mail è "text" oppure "body_text".
- Usa n_tag per collegarlo al ticket quando disponibile.

Resoconti email:
Quando l'utente chiede un resoconto, una sintesi o un riepilogo di un thread email:
- Prima identifica il thread più pertinente usando subject/raw_subject.
- Leggi tutte le email del thread in ordine cronologico.
- Scrivi un resoconto discorsivo e parlante, come se stessi spiegando a un collega cosa è successo.
- Non limitarti a un elenco puntato.
- Cita data, mittente e passaggi principali quando sono disponibili.
- Concludi con stato finale e punti aperti se emergono dai dati.

Quando l'utente chiede "quali thread ci sono", "mostrami i thread", "thread email":
- Elenca i thread disponibili con subject, n_tag, cliente, numero email e ultima email.
- Se non ci sono email importate, specifica che il thread è solo collegato.

DOMANDA UTENTE:
${message}

CONTESTO DISPONIBILE:
${JSON.stringify(context, null, 2)}
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