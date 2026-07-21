import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { executeAction, verifyAction } from "@/lib/ai-ticket-actions";

async function getUser(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user;
}

export async function POST(req: Request) {
  try {
    // L'utente viene sempre ricavato dal token lato server, mai dal body.
    const user = await getUser(req);

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
    }

    const { pendingAction, conversationId, confirmed } = body as {
      pendingAction?: unknown;
      conversationId?: string | null;
      confirmed?: boolean;
    };

    const verification = verifyAction(pendingAction, user.id);

    if (!verification.ok) {
      return NextResponse.json({ error: verification.error }, { status: 400 });
    }

    const action = verification.action;

    // Annullamento esplicito
    if (confirmed === false) {
      const answer = "Operazione annullata. Non ho modificato nulla.";

      if (conversationId) {
        await supabaseAdmin.from("ai_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: answer,
        });
      }

      return NextResponse.json({ ok: true, cancelled: true, answer });
    }

    const { data: profilo, error: profiloError } = await supabaseAdmin
      .from("profili")
      .select("id, nome, nome_completo, email, ruolo")
      .eq("id", user.id)
      .maybeSingle();

    if (profiloError) {
      console.error("Errore lettura profilo azione AI:", profiloError);
      return NextResponse.json(
        { error: "Errore durante la verifica del profilo utente." },
        { status: 500 }
      );
    }

    if (!profilo) {
      return NextResponse.json(
        { error: "Profilo utente non trovato: operazione bloccata." },
        { status: 403 }
      );
    }

    const autore =
      profilo.nome_completo || profilo.nome || profilo.email || user.email || "Utente";

    const result = await executeAction(action, autore);

    const answer = result.ok
      ? `✅ ${result.message}`
      : `⚠️ ${result.message}`;

    if (conversationId) {
      await supabaseAdmin.from("ai_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: answer,
      });
    }

    return NextResponse.json({
      ok: result.ok,
      answer,
      ticket: result.ticket ?? null,
    });
  } catch (error) {
    console.error("Errore API azione AI:", error);

    return NextResponse.json(
      {
        error: "Errore durante l'esecuzione dell'azione",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
