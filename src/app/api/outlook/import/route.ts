import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function normalizeSubject(value?: string | null) {
  return (value || "")
    .replace(/^((re|r|fw|fwd|i):\s*)+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTicketCode(value?: string | null) {
  return normalizeSubject(value)
    .match(/\b(TAG|INC)\d+\b/i)?.[0]
    ?.toUpperCase() || null;
}

function extractChangeCode(value?: string | null) {
  return normalizeSubject(value)
    .match(/\bCHG\d+\b/i)?.[0]
    ?.toUpperCase() || null;
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    if (payload.secret !== process.env.POWER_AUTOMATE_SECRET) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const rawSubject = payload.subject || "";
    const subject = normalizeSubject(rawSubject);
    const ticketCode = extractTicketCode(subject);
    const changeCode = extractChangeCode(subject);

    const receivedAt = payload.receivedAt || new Date().toISOString();
    const internetMessageId = payload.internetMessageId || null;
    const uniqueMessageId = internetMessageId || `${subject}-${receivedAt}`;

    const { data: existing } = await supabaseAdmin
      .from("mail_threads")
      .select("id")
      .eq("outlook_message_id", uniqueMessageId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Email già importata",
      });
    }

    let nTag: string | null = null;

    if (ticketCode) {
      const { data: ticket, error } = await supabaseAdmin
        .from("ticket")
        .select("n_tag")
        .eq("n_tag", ticketCode)
        .maybeSingle();

      if (error) throw error;

      if (ticket) {
        nTag = ticket.n_tag;
      }
    }

    if (!nTag && changeCode) {
        const { data: change, error } = await supabaseAdmin
            .from("changes")
            .select("n_tag, change_id")
            .eq("change_id", changeCode)
            .maybeSingle();

        if (error) throw error;

        if (change?.n_tag) {
            nTag = change.n_tag;
        }
    }

    if (!nTag) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Nessun TAG, INC o CHG collegato trovato",
        subject,
        ticketCode,
        changeCode,
      });
    }

    const { data: manualThread } = await supabaseAdmin
      .from("mail_threads")
      .select("id")
      .eq("n_tag", nTag)
      .eq("topic", subject)
      .eq("linked_manually", true)
      .maybeSingle();

    if (!manualThread) {
      const { error: threadError } = await supabaseAdmin
        .from("mail_threads")
        .insert({
          n_tag: nTag,
          data_invio: receivedAt.slice(0, 10),
          contenuto: "Thread creato automaticamente da Power Automate",
          topic: subject,
          subject,
          direction: "inbound",
          linked_manually: true,
          linked_at: new Date().toISOString(),
          link_status: "manual",
          tread: {
            type: "thread_link",
            source: "power_automate",
            auto_created: true,
            ticket_code: ticketCode,
            change_code: changeCode,
            original_subject: rawSubject,
          },
        });

      if (threadError) throw threadError;
    }

    const { error: insertError } = await supabaseAdmin
      .from("mail_threads")
      .insert({
        n_tag: nTag,
        data_invio: receivedAt.slice(0, 10),
        contenuto: payload.bodyPreview || subject,
        topic: subject,
        subject,
        body_html: payload.body || null,
        outlook_message_id: uniqueMessageId,
        internet_message_id: internetMessageId,
        direction: "inbound",
        from_email: payload.from || null,
        received_at: receivedAt,
        link_status: "auto",
        linked_manually: false,
        tread: {
          type: "email",
          source: "power_automate",
          ticket_code: ticketCode,
          change_code: changeCode,
          original_subject: rawSubject,
        },
      });

    if (insertError) throw insertError;

    return NextResponse.json({
      ok: true,
      imported: true,
      autoLinked: true,
      n_tag: nTag,
      subject,
      ticketCode,
      changeCode,
    });
  } catch (error: any) {
    console.error("OUTLOOK IMPORT ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore import Outlook",
      },
      { status: 500 }
    );
  }
}