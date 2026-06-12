import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function normalize(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function addressesToJson(recipients: any[] = []) {
  return recipients.map((item) => ({
    name: item?.emailAddress?.name || null,
    address: item?.emailAddress?.address || null,
  }));
}

async function getAccessToken() {
  const response = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: process.env.AZURE_REFRESH_TOKEN!,
        scope: "https://graph.microsoft.com/Mail.Read offline_access User.Read",
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error_description || "Errore token Microsoft Graph");
  }

  return data.access_token as string;
}

async function graphGet(accessToken: string, url: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Errore Microsoft Graph");
  }

  return data;
}

async function findFolderId(accessToken: string, folderName: string) {
  const data = await graphGet(
    accessToken,
    `${GRAPH_BASE}/me/mailFolders?$top=200`
  );

  const folder = data.value?.find(
    (item: any) => normalize(item.displayName) === normalize(folderName)
  );

  if (!folder) {
    throw new Error(`Cartella Outlook non trovata: ${folderName}`);
  }

  return folder.id as string;
}

export async function GET() {
  try {
    if (!process.env.AZURE_REFRESH_TOKEN) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Manca AZURE_REFRESH_TOKEN. Prima devi completare il login Microsoft una volta.",
        },
        { status: 500 }
      );
    }

    const accessToken = await getAccessToken();

    const folderName =
      process.env.OUTLOOK_GRAPH_FOLDER || "MyHRM Outlook Connector";

    const folderId = await findFolderId(accessToken, folderName);

    const { data: linkedThreads, error: linkedError } = await supabaseAdmin
      .from("mail_threads")
      .select("n_tag, topic, subject")
      .not("n_tag", "is", null);

    if (linkedError) {
      throw new Error(linkedError.message);
    }

    const links = (linkedThreads || [])
      .map((item) => ({
        n_tag: item.n_tag as string,
        threadName: normalize(item.topic || item.subject),
      }))
      .filter((item) => item.n_tag && item.threadName);

    const messagesData = await graphGet(
      accessToken,
      `${GRAPH_BASE}/me/mailFolders/${folderId}/messages?$top=50&$orderby=receivedDateTime desc&$select=id,conversationId,internetMessageId,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime`
    );

    let imported = 0;
    let skipped = 0;

    for (const message of messagesData.value || []) {
      const subject = message.subject || "";
      const normalizedSubject = normalize(subject);

      const linked = links.find(
        (link) =>
          normalizedSubject.includes(link.threadName) ||
          link.threadName.includes(normalizedSubject)
      );

      if (!linked) {
        skipped++;
        continue;
      }

      const { data: existing } = await supabaseAdmin
        .from("mail_threads")
        .select("id")
        .eq("outlook_message_id", message.id)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const receivedAt =
        message.receivedDateTime ||
        message.sentDateTime ||
        new Date().toISOString();

      const { error: insertError } = await supabaseAdmin
        .from("mail_threads")
        .insert({
          n_tag: linked.n_tag,
          data_invio: receivedAt.slice(0, 10),
          contenuto: message.bodyPreview || subject,
          topic: subject,
          subject,
          body_html: message.body?.content || null,
          outlook_conversation_id: message.conversationId || null,
          outlook_message_id: message.id,
          internet_message_id: message.internetMessageId || null,
          direction: "inbound",
          from_email: message.from?.emailAddress?.address || null,
          to_emails: addressesToJson(message.toRecipients),
          cc_emails: addressesToJson(message.ccRecipients),
          received_at: receivedAt,
          tread: {
            source: "graph",
            folder: folderName,
            graph_message_id: message.id,
            conversation_id: message.conversationId || null,
          },
        });

      if (insertError) {
        skipped++;
        console.error("Insert mail_threads error:", insertError);
        continue;
      }

      imported++;
    }

    return NextResponse.json({
      ok: true,
      folder: folderName,
      imported,
      skipped,
    });
  } catch (error: any) {
    console.error("GRAPH SYNC ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Errore sincronizzazione Outlook Graph",
      },
      { status: 500 }
    );
  }
}