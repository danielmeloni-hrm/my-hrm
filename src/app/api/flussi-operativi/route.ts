import { NextResponse } from "next/server";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

/**
 * Fonti dati dei flussi operativi per cliente.
 *
 * I file restano su Google Drive: la pagina li legge in tempo reale
 * tramite il service account, quindi quando i file vengono aggiornati
 * il flusso mostrato resta aggiornato senza toccare il codice.
 *
 * NOTA: i file devono essere condivisi (in sola lettura) con l'email
 * del service account (GOOGLE_SERVICE_ACCOUNT_EMAIL).
 */
const FLUSSI_CONFIG: Record<
  string,
  { label: string; docId?: string; diagramId?: string }
> = {
  esselunga: {
    label: "Esselunga",
    // Documento Google con la descrizione dei flussi operativi
    docId: "1jGIBBj8yyRAsy7LtTJjEdaHdaOM0jqEh",
    // Diagramma draw.io (diagrams.net) salvato su Drive
    diagramId: "1kWZguJr9jN_XJC9taHKiJSGNtiPwUxL9",
  },
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cliente = (searchParams.get("cliente") || "").toLowerCase().trim();

    // Senza parametro: elenco dei clienti con flussi configurati
    if (!cliente) {
      return NextResponse.json({
        clienti: Object.entries(FLUSSI_CONFIG).map(([key, value]) => ({
          key,
          label: value.label,
        })),
      });
    }

    const config = FLUSSI_CONFIG[cliente];

    if (!config) {
      return NextResponse.json(
        { error: `Nessun flusso configurato per "${cliente}"` },
        { status: 404 }
      );
    }

    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY
    ) {
      return NextResponse.json(
        { error: "Variabili Google mancanti" },
        { status: 500 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });

    let docHtml: string | null = null;
    let docTitle: string | null = null;
    let docModifiedAt: string | null = null;
    let docError: string | null = null;

    let diagramXml: string | null = null;
    let diagramTitle: string | null = null;
    let diagramModifiedAt: string | null = null;
    let diagramError: string | null = null;

    // --- Documento Google: export HTML + metadati ---
    if (config.docId) {
      try {
        const [meta, exported] = await Promise.all([
          drive.files.get({
            fileId: config.docId,
            fields: "name, modifiedTime",
            supportsAllDrives: true,
          }),
          drive.files.export(
            { fileId: config.docId, mimeType: "text/html" },
            { responseType: "text" }
          ),
        ]);

        docTitle = meta.data.name ?? null;
        docModifiedAt = meta.data.modifiedTime ?? null;
        docHtml = String(exported.data ?? "");
      } catch (err: any) {
        docError =
          err?.response?.status === 404 || err?.code === 404
            ? "Documento non trovato o non condiviso con il service account"
            : err?.message || "Errore lettura documento";
      }
    }

    // --- Diagramma draw.io: contenuto XML + metadati ---
    if (config.diagramId) {
      try {
        const [meta, media] = await Promise.all([
          drive.files.get({
            fileId: config.diagramId,
            fields: "name, modifiedTime",
            supportsAllDrives: true,
          }),
          drive.files.get(
            {
              fileId: config.diagramId,
              alt: "media",
              supportsAllDrives: true,
            },
            { responseType: "text" }
          ),
        ]);

        diagramTitle = meta.data.name ?? null;
        diagramModifiedAt = meta.data.modifiedTime ?? null;
        diagramXml = String(media.data ?? "");
      } catch (err: any) {
        diagramError =
          err?.response?.status === 404 || err?.code === 404
            ? "Diagramma non trovato o non condiviso con il service account"
            : err?.message || "Errore lettura diagramma";
      }
    }

    return NextResponse.json(
      {
        cliente: config.label,
        doc: config.docId
          ? {
              id: config.docId,
              title: docTitle,
              modifiedAt: docModifiedAt,
              html: docHtml,
              error: docError,
              url: `https://docs.google.com/document/d/${config.docId}/edit`,
            }
          : null,
        diagram: config.diagramId
          ? {
              id: config.diagramId,
              title: diagramTitle,
              modifiedAt: diagramModifiedAt,
              xml: diagramXml,
              error: diagramError,
              url: `https://app.diagrams.net/#G${config.diagramId}`,
            }
          : null,
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Errore flussi operativi" },
      { status: 500 }
    );
  }
}
