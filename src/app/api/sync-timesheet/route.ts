import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import Papa from "papaparse";

type SheetRow = {
  "ID Evento"?: string;
  Titolo?: string;
  "Data Inizio"?: string;
  "Ora Inizio"?: string;
  "Data Fine"?: string;
  "Ora Fine"?: string;
  "Durata (minuti)"?: string;
  "Durata (ore)"?: string;
  Risorsa?: string;
};

type ClienteRow = {
  id: string;
  nome: string;
};

type TimesheetRow = {
  id_attivita: string;
  id_evento: string;
  titolo: string | null;
  cliente: string | null;
  id_cliente: string | null;
  tipo_attivita: string | null;
  attivita: string | null;
  attivita_json: string[];
  data_inizio: string | null;
  ora_inizio: string | null;
  data_fine: string | null;
  ora_fine: string | null;
  durata_minuti: number;
  durata_ore: number;
  risorsa: string;
  updated_at: string;
};

function extractActivityInfo(titolo: string) {
  const cleanTitle = titolo.trim();

  if (!cleanTitle) {
    return {
      cliente: null,
      tipoAttivita: null,
      attivita: null,
    };
  }

  const parts = cleanTitle
    .split("-")
    .map((p) => p.trim())
    .filter(Boolean);

  const cliente = parts[0] ?? null;

  if (parts.length >= 3) {
    return {
      cliente,
      tipoAttivita: parts[1],
      attivita: parts.slice(2).join(" - "),
    };
  }

  if (parts.length === 2) {
    const secondPart = parts[1];
    const firstSpace = secondPart.indexOf(" ");

    if (firstSpace > 0) {
      return {
        cliente,
        tipoAttivita: secondPart.substring(0, firstSpace).trim(),
        attivita: secondPart.substring(firstSpace + 1).trim() || null,
      };
    }

    return {
      cliente,
      tipoAttivita: secondPart,
      attivita: null,
    };
  }

  return {
    cliente,
    tipoAttivita: null,
    attivita: null,
  };
}

function buildAttivitaJson(attivita: string | null): string[] {
  if (!attivita) return [];

  return attivita
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET() {
  const csvUrl =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQEzJGzHON3StXgoF5w-vA-uhUzt8oUMiHVIqYUJ2vfXSh-fqs1XXGG5itucvnkCVgi11-VIOuxYM1k/pub?gid=465598533&single=true&output=csv";

  const { data: clienti, error: clientiError } = await supabaseAdmin
    .from("clienti")
    .select("id,nome");

  if (clientiError) {
    return NextResponse.json(clientiError, { status: 500 });
  }

  const clientiMap = new Map(
    ((clienti || []) as ClienteRow[]).map((cliente) => [
      cliente.nome.trim().toLowerCase(),
      cliente.id,
    ])
  );

  const csv = await fetch(csvUrl).then((r) => r.text());

  const parsed = Papa.parse<SheetRow>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const rowsRaw: TimesheetRow[] = parsed.data
    .map((row): TimesheetRow => {
      const idEvento = String(row["ID Evento"] || "").trim();
      const risorsa = String(row["Risorsa"] || "").trim();
      const titolo = String(row["Titolo"] || "").trim();

      const { cliente, tipoAttivita, attivita } =
        extractActivityInfo(titolo);

      const idCliente = cliente
        ? clientiMap.get(cliente.toLowerCase()) ?? null
        : null;

      return {
        id_attivita: `${idEvento}_${risorsa}`,
        id_evento: idEvento,
        titolo: titolo || null,
        cliente,
        id_cliente: idCliente,
        tipo_attivita: tipoAttivita,
        attivita,
        attivita_json: buildAttivitaJson(attivita),
        data_inizio: row["Data Inizio"] || null,
        ora_inizio: row["Ora Inizio"] || null,
        data_fine: row["Data Fine"] || null,
        ora_fine: row["Ora Fine"] || null,
        durata_minuti: Number(row["Durata (minuti)"] || 0),
        durata_ore: Number(row["Durata (ore)"] || 0),
        risorsa,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((row): row is TimesheetRow =>
      Boolean(row.id_evento && row.risorsa)
    );

  const rows = Array.from(
    new Map(rowsRaw.map((row) => [row.id_attivita, row])).values()
  );

  const { error } = await supabaseAdmin.from("timesheet_events").upsert(rows, {
    onConflict: "id_attivita",
  });

  if (error) {
    return NextResponse.json(error, { status: 500 });
  }

  return NextResponse.json({
    imported: rows.length,
    totalRows: rowsRaw.length,
    duplicatesRemoved: rowsRaw.length - rows.length,
    clientiNonTrovati: rows.filter((row) => row.cliente && !row.id_cliente)
      .length,
  });
}