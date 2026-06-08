import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

async function getUser(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) return null;

  return data.user;
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

    let activeConversationId = conversationId;

    if (!activeConversationId) {
      const { data: newConversation, error } = await supabaseAdmin
        .from("ai_conversations")
        .insert({
          user_id: user.id,
          title: message.slice(0, 40),
        })
        .select()
        .single();

      if (error) throw error;

      activeConversationId = newConversation.id;
    }

    await supabaseAdmin.from("ai_messages").insert({
      conversation_id: activeConversationId,
      role: "user",
      content: message,
    });

    const { data: tickets } = await supabaseAdmin
      .from("ticket")
      .select("*")
      .limit(80);

    const { data: clienti } = await supabaseAdmin
      .from("clienti")
      .select("*")
      .limit(80);

    const { data: documenti } = await supabaseAdmin
      .from("documenti_operativi")
      .select("*")
      .limit(50);

    const { data: mailThreads } = await supabaseAdmin
      .from("mail_threads")
      .select("*")
      .limit(50);

    const { data: oldMessages } = await supabaseAdmin
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", activeConversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const prompt = `
Sei l'assistente AI interno del gestionale MyHRM.

Rispondi sempre in italiano.
Rispondi in modo pratico, sintetico e utile.
Se non hai dati sufficienti, dillo chiaramente.
Non inventare dati.
Puoi analizzare ticket, clienti, documenti operativi e conversazioni email.

MESSAGGI PRECEDENTI:
${JSON.stringify(oldMessages, null, 2)}

DOMANDA UTENTE:
${message}

DATI SUPABASE DISPONIBILI:

TICKET:
${JSON.stringify(tickets, null, 2)}

CLIENTI:
${JSON.stringify(clienti, null, 2)}

DOCUMENTI OPERATIVI:
${JSON.stringify(documenti, null, 2)}

MAIL THREADS:
${JSON.stringify(mailThreads, null, 2)}
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

    await supabaseAdmin.from("ai_messages").insert({
      conversation_id: activeConversationId,
      role: "assistant",
      content: answer,
    });

    await supabaseAdmin
      .from("ai_conversations")
      .update({
        updated_at: new Date().toISOString(),
        title: message.slice(0, 40),
      })
      .eq("id", activeConversationId);

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