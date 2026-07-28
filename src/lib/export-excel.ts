import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { Ticket } from "@/components/parametri_ticket/attivita";

/* ------------------------------------------------------------------ */
/* Generatore XLSX minimale (OOXML) senza dipendenze extra: usa jszip  */
/* e file-saver, già presenti nel progetto.                            */
/* ------------------------------------------------------------------ */

export type ExcelCell = string | number | null | undefined;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Indice colonna (0-based) → lettera Excel (0 → A, 26 → AA). */
function colLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Costruisce e scarica un file .xlsx con un'unica intestazione in grassetto.
 */
export async function exportToExcel(
  filename: string,
  headers: string[],
  rows: ExcelCell[][],
  sheetName = "Foglio1"
): Promise<void> {
  const allRows: ExcelCell[][] = [headers, ...rows];

  const rowsXml = allRows
    .map((row, rowIndex) => {
      const r = rowIndex + 1;
      const isHeader = rowIndex === 0;

      const cellsXml = row
        .map((cell, colIndex) => {
          const ref = `${colLetter(colIndex)}${r}`;

          if (cell === null || cell === undefined || cell === "") {
            return isHeader ? `<c r="${ref}" s="1"/>` : `<c r="${ref}"/>`;
          }

          if (typeof cell === "number" && Number.isFinite(cell)) {
            return `<c r="${ref}"><v>${cell}</v></c>`;
          }

          const style = isHeader ? ' s="1"' : "";
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(
            String(cell)
          )}</t></is></c>`;
        })
        .join("");

      return `<row r="${r}">${cellsXml}</row>`;
    })
    .join("");

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;

  const safeSheet = escapeXml(sheetName).slice(0, 31);
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeSheet}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.folder("_rels")!.file(".rels", rootRels);

  const xl = zip.folder("xl")!;
  xl.file("workbook.xml", workbookXml);
  xl.folder("_rels")!.file("workbook.xml.rels", workbookRels);
  xl.file("styles.xml", stylesXml);
  xl.folder("worksheets")!.file("sheet1.xml", sheetXml);

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const name = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  saveAs(blob, name);
}

/* ------------------------------------------------------------------ */
/* Mappatura ticket → valore per l'export, riusabile dalle due pagine   */
/* (tutti-i-ticket e tutti-gli-incident condividono le stesse colonne).*/
/* ------------------------------------------------------------------ */

type TicketExport = Ticket & {
  clienti?: { nome?: string | null } | null;
  profili?: { nome_completo?: string | null } | null;
  numero_ore?: number;
  ricorsivo?: boolean;
};

/** Formatta una data ISO in gg/mm/aaaa (o stringa vuota). */
function formatDate(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 10).split("-").reverse().join("/");
}

/** Valore testuale/numerico di una colonna per l'export Excel. */
export function valoreColonnaExport(
  ticket: TicketExport,
  colId: string
): ExcelCell {
  switch (colId) {
    case "n_tag":
      return ticket.n_tag ?? "";
    case "inc_padre":
      return ticket.inc_padre ?? "";
    case "inc_padre_link":
      return ticket.inc_padre_link ?? "";
    case "numero_storia":
      return ticket.numero_storia ?? "";
    case "titolo":
      return ticket.titolo ?? "";
    case "priorita":
      return ticket.priorita ?? "";
    case "ricorsivo":
      return ticket.ricorsivo ? "Sì" : "No";
    case "stato":
      return ticket.stato ?? "";
    case "progress":
      return Number(ticket.percentuale_avanzamento ?? 0);
    case "assignee":
      return ticket.profili?.nome_completo ?? "";
    case "applicativo":
      return Array.isArray(ticket.applicativo)
        ? ticket.applicativo.join(", ")
        : ticket.applicativo ?? "";
    case "tipo_di_attivita":
      return ticket.tipo_di_attivita ?? "";
    case "cliente":
      return ticket.clienti?.nome ?? "";
    case "sprint":
      return ticket.sprint ?? "";
    case "rilascio_in_collaudo":
      return formatDate(ticket.rilascio_in_collaudo);
    case "rilascio_in_produzione":
      return formatDate(ticket.rilascio_in_produzione);
    case "data_apertura_attivita":
      return formatDate(ticket.creato_at);
    case "data_chiusura_attivita":
      return formatDate(ticket.data_chiusura_attivita);
    case "ultimo_ping":
      return formatDate(ticket.ultimo_ping);
    case "numero_ore":
      return Number(ticket.numero_ore ?? 0);
    default:
      return (ticket as Record<string, unknown>)[colId] as ExcelCell;
  }
}

/**
 * Esporta una lista di ticket già filtrati, rispettando le colonne
 * visibili (id + label) nell'ordine mostrato in tabella.
 */
export async function esportaTicketExcel(
  filenameBase: string,
  colonne: { id: string; label: string }[],
  ticket: TicketExport[],
  sheetName = "Ticket"
): Promise<void> {
  const headers = colonne.map((c) => c.label);
  const rows = ticket.map((t) =>
    colonne.map((c) => valoreColonnaExport(t, c.id))
  );

  const oggi = new Date().toISOString().slice(0, 10);
  await exportToExcel(`${filenameBase}_${oggi}`, headers, rows, sheetName);
}
