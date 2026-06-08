import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    if (!question) {
      return NextResponse.json(
        { error: "Domanda mancante" },
        { status: 400 }
      );
    }

    const { data: tickets, error: ticketError } = await supabaseAdmin
      .from("ticket")
      .select("*")
      .limit(50);

    if (ticketError) {
      return NextResponse.json(
        { error: ticketError.message },
        { status: 500 }
      );
    }

    const { data: clienti, error: clientiError } = await supabaseAdmin
      .from("clienti")
      .select("*")
      .limit(50);

    if (clientiError) {
      return NextResponse.json(
        { error: clientiError.message },
        { status: 500 }
      );
    }

    const prompt = `
Sei l'assistente AI interno del gestionale MyHRM.

Rispondi in italiano, in modo breve e operativo.
Non inventare dati.
Se non trovi informazioni nei dati forniti, dillo chiaramente.

Domanda utente:
${question}

Dati ticket:
${JSON.stringify(tickets, null, 2)}

Dati clienti:
${JSON.stringify(clienti, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return NextResponse.json({
      answer: response.text || "Nessuna risposta generata.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Errore durante la generazione della risposta AI" },
      { status: 500 }
    );
  }
}