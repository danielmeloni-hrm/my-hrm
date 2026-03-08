"use client";
import React, { useEffect, useMemo, useState } from "react";
const UI = {
  bg: "#f6f8fb",
  card: "#ffffff",
  border: "#e6eaf0",
  text: "#1f2937",
  subtext: "#6b7280",

  primary: "#0150a0",
  primarySoft: "#dbeafe",

  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#dc2626",

  bar: "#0150a0",
  barSoft: "#93c5fd"
};
type SheetName = "Andrea" | "Daniel" | "Simone" | "Corrado" | "Alessandro";

type RawRow = {
  sheet: SheetName;
  idEvento: string;
  titolo: string;
  dataInizio: string;
  oraInizio: string;
  dataFine: string;
  oraFine: string;
  durataMinuti: number;
  durataOre: number;
};

type Period = "all" | "thisYear" | "last12" | "last90" | "last30";
type DateRange = { from: string; to: string }; // yyyy-mm-dd

const SPREADSHEET_ID = "1HrbA7vxZOuCK2bR6XQIy5nq4fVJhYh-SYsmDVGUGbco";
const SHEETS: SheetName[] = ["Andrea", "Daniel", "Simone", "Corrado", "Alessandro"];

const COLS = [
  "ID Evento",
  "Titolo",
  "Data Inizio",
  "Ora Inizio",
  "Data Fine",
  "Ora Fine",
  "Durata (minuti)",
  "Durata (ore)",
] as const;

type TitleParts = {
  cliente: string;
  attivita: string; // Tipo attività
  progetto: string; // opzionale
};

function normalizeLabel(s: string): string {
  return (s || "")
    .replace(/\u00A0/g, " ") // NBSP
    .replace(/\s+/g, " ")
    .trim();
}

function parseTitleParts(titolo: string): TitleParts {
  const raw = normalizeLabel(titolo);
  if (!raw) return { cliente: "", attivita: "", progetto: "" };

  // SOLO split su " - "
  const parts = raw
    .split(" - ")
    .map((p) => normalizeLabel(p))
    .filter(Boolean);

  const cliente = parts[0] ?? "";
  const attivitaFull = parts[1] ?? "";
  const attivita = (attivitaFull.split(" ")[0] || "").trim(); // prima parola
  const progetto = parts[2] ?? "";

  return { cliente, attivita, progetto };
}

/**
 * Supporta:
 * - "dd/mm/yyyy"
 * - "Date(YYYY,MM,DD)"
 */
function parseEventDate(d: string): Date | null {
  const s = (d || "").trim();

  const it = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (it) {
    const day = Number(it[1]);
    const month = Number(it[2]) - 1;
    const year = Number(it[3]);
    const dt = new Date(year, month, day);
    if (!Number.isNaN(dt.getTime())) {
      dt.setHours(0, 0, 0, 0);
      return dt;
    }
  }

  const gv = s.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)$/);
  if (gv) {
    const year = Number(gv[1]);
    const month = Number(gv[2]); // 0-based
    const day = Number(gv[3]);
    const dt = new Date(year, month, day);
    if (!Number.isNaN(dt.getTime())) {
      dt.setHours(0, 0, 0, 0);
      return dt;
    }
  }

  return null;
}

function parseISODate(d: string): Date | null {
  const m = (d || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const dt = new Date(year, month, day);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function isoDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function clampPeriod(rows: any[], period: Period): any[] {
  if (period === "all") return rows;

  const now = new Date();
  const start = new Date(now);

  if (period === "thisYear") start.setMonth(0, 1);
  else if (period === "last12") start.setMonth(start.getMonth() - 12);
  else if (period === "last90") start.setDate(start.getDate() - 90);
  else if (period === "last30") start.setDate(start.getDate() - 30);

  start.setHours(0, 0, 0, 0);

  return rows.filter((r) => {
    const di = parseEventDate(r.dataInizio);
    if (!di) return true;
    return di >= start && di <= now;
  });
}

function clampDateRange(rows: any[], range: DateRange): any[] {
  const from = parseISODate(range.from);
  const to = parseISODate(range.to);

  if (!from && !to) return rows;

  const toEnd = to ? new Date(to) : null;
  if (toEnd) toEnd.setHours(23, 59, 59, 999);

  return rows.filter((r) => {
    const di = parseEventDate(r.dataInizio);
    if (!di) return true;
    const t = di.getTime();
    if (from && t < from.getTime()) return false;
    if (toEnd && t > toEnd.getTime()) return false;
    return true;
  });
}

async function fetchSheetTab(tab: SheetName): Promise<RawRow[]> {
  const query = encodeURIComponent("select A,B,C,D,E,F,G,H");
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=${encodeURIComponent(
    tab
  )}&tq=${query}`;

  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  const jsonMatch = text.match(/setResponse\(([\s\S]+)\);\s*$/);
  if (!jsonMatch) throw new Error("Risposta GViz non valida (sheet privato o struttura diversa).");

  const payload = JSON.parse(jsonMatch[1]);
  if (payload.status !== "ok") {
    throw new Error(payload.errors?.[0]?.detailed_message || "Errore GViz");
  }

  const rows = payload.table?.rows ?? [];

  return rows
    .map((r: any) => (r.c || []).map((cell: any) => (cell ? cell.v : null)))
    .filter((arr: any[]) => arr.some((x) => x !== null && x !== ""))
    .map((arr: any[]) => {
      const [idEvento, titolo, dataInizio, oraInizio, dataFine, oraFine, durataMinuti, durataOre] = arr;

      return {
        sheet: tab,
        idEvento: String(idEvento ?? ""),
        titolo: String(titolo ?? ""),
        dataInizio: String(dataInizio ?? ""),
        oraInizio: String(oraInizio ?? ""),
        dataFine: String(dataFine ?? ""),
        oraFine: String(oraFine ?? ""),
        durataMinuti: Number(durataMinuti ?? 0) || 0,
        durataOre: Number(durataOre ?? 0) || 0,
      };
    });
}

function normalizeKey(s: string): string {
  const label = normalizeLabel(s);
  if (!label) return "";
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // rimuove accenti
    .replace(/\s+/g, " ")
    .trim();
}

function firstPartBeforeDash(titolo: string): string {
  // prende tutto PRIMA del primo " - " (spazio-trattino-spazio)
  const raw = normalizeLabel(titolo);
  if (!raw) return "";
  const i = raw.indexOf(" - ");
  return i >= 0 ? normalizeLabel(raw.slice(0, i)) : normalizeLabel(raw);
}

/** Legge SOLO i clienti validi da Voci!A */
async function fetchValidClients(): Promise<Array<{ key: string; label: string }>> {
  const query = encodeURIComponent("select A");
  const url =
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=${encodeURIComponent("Voci")}&tq=${query}` +
    `&headers=1`;

  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  const jsonMatch = text.match(/setResponse\(([\s\S]+)\);\s*$/);
  if (!jsonMatch) throw new Error("Risposta GViz non valida per tab Voci (permessi/nome tab).");

  const payload = JSON.parse(jsonMatch[1]);
  if (payload.status !== "ok") {
    throw new Error(payload.errors?.[0]?.detailed_message || "Errore GViz (Voci)");
  }

  const rows = payload.table?.rows ?? [];
  const map = new Map<string, string>(); // key -> label

  for (const r of rows) {
    const cell = r?.c?.[0];
    const raw = String(cell?.f ?? cell?.v ?? "");
    const label = normalizeLabel(raw);
    if (!label) continue;

    // scarta l'header se viene incluso
    if (label.toLowerCase() === "clienti") continue;

    const key = normalizeKey(label);
    if (!key) continue;

    if (!map.has(key)) map.set(key, label);
  }

  return Array.from(map.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "it"));
}



function downloadTextFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(rows: any[]): string {
  const header = ["Tab", "Cliente", "Attività", "Progetto", ...COLS];
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.sheet,
        r.cliente,
        r.attivita,
        r.progetto,
        r.idEvento,
        r.titolo,
        r.dataInizio,
        r.oraInizio,
        r.dataFine,
        r.oraFine,
        r.durataMinuti,
        r.durataOre,
      ]
        .map(esc)
        .join(",")
    ),
  ];
  return lines.join("\n");
}

function formatHours(h: number): string {
  const v = Math.round(h * 100) / 100;
  return `${v}`.replace(".", ",");
}

/* -------------------- NEW: aggregazioni e matrici -------------------- */

type Agg = { key: string; label: string; hours: number; events: number };

function topN<T>(arr: T[], n: number) {
  return arr.slice(0, n);
}

function groupByKey(rows: any[], keyFn: (r: any) => string, labelFn?: (r: any) => string): Agg[] {
  const map = new Map<string, Agg>();
  for (const r of rows) {
    const key = keyFn(r) || "";
    if (!key) continue;

    const label = (labelFn ? labelFn(r) : key) || key;
    const cur = map.get(key) ?? { key, label, hours: 0, events: 0 };
    cur.hours += Number(r.durataOre || 0);
    cur.events += 1;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
}

/** matrice: righe = rowKey, colonne = colKey, valore = hours */
function matrixHours(rows: any[], rowKeyFn: (r: any) => string, colKeyFn: (r: any) => string) {
  const map = new Map<string, Map<string, number>>();
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();

  for (const r of rows) {
    const rk = rowKeyFn(r);
    const ck = colKeyFn(r);
    if (!rk || !ck) continue;

    const h = Number(r.durataOre || 0);
    if (!map.has(rk)) map.set(rk, new Map());
    const inner = map.get(rk)!;
    inner.set(ck, (inner.get(ck) ?? 0) + h);

    rowTotals.set(rk, (rowTotals.get(rk) ?? 0) + h);
    colTotals.set(ck, (colTotals.get(ck) ?? 0) + h);
  }

  return { map, rowTotals, colTotals };
}

/* -------------------------------------------------------------------- */

export default function ClientReportsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allRows, setAllRows] = useState<RawRow[]>([]);
  const [validClients, setValidClients] = useState<Array<{ key: string; label: string }>>([]);

  const [sheetFilter, setSheetFilter] = useState<SheetName | "Tutte">("Tutte");
  const [clientFilter, setClientFilter] = useState<string>("all"); // key
  const [attivitaFilter, setAttivitaFilter] = useState<string>("Tutte");
  const [progettoFilter, setProgettoFilter] = useState<string>("Tutti");

  const [search, setSearch] = useState("");

  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [period, setPeriod] = useState<Period>("all");
  const [dateMode, setDateMode] = useState<"period" | "range">("period");
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientsFromVoci, ...parts] = await Promise.all([
        fetchValidClients(),
        ...SHEETS.map((s) => fetchSheetTab(s)),
      ]);

      setValidClients(clientsFromVoci);
      setAllRows(parts.flat());
    } catch (e: any) {
      setError(e?.message || "Errore caricamento dati");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Parse titolo -> cliente/attività/progetto + filtro cliente valido */
  const rowsWithParts = useMemo(() => {
    // mappa: key -> label (dal foglio Voci colonna A)
    const validMap = new Map(validClients.map((c) => [c.key, c.label]));

    return allRows
      .map((r) => {
        // match cliente: prima parte del titolo fino al primo " - "
        const first = firstPartBeforeDash(r.titolo);
        const firstKey = normalizeKey(first);

        const validLabel = validMap.get(firstKey);
        if (!validLabel) return null; // cliente NON valido -> scarta evento

        const p = parseTitleParts(r.titolo);

        return {
          ...r,
          cliente: validLabel, // label ufficiale
          clienteKey: firstKey, // chiave normalizzata per filtri
          attivita: p.attivita,
          progetto: p.progetto,
        };
      })
      .filter(Boolean) as any[];
  }, [allRows, validClients]);

  /** Clienti SOLO da Voci!A */
  const clients = useMemo(() => validClients, [validClients]);

  const attivitaOptions = useMemo(() => {
    let rows = rowsWithParts as any[];
    if (sheetFilter !== "Tutte") rows = rows.filter((r) => r.sheet === sheetFilter);
    if (clientFilter !== "all") rows = rows.filter((r) => r.clienteKey === clientFilter);

    const set = new Set(rows.map((r) => r.attivita).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "it"));
  }, [rowsWithParts, sheetFilter, clientFilter]);

  const progettoOptions = useMemo(() => {
    let rows = rowsWithParts as any[];
    if (sheetFilter !== "Tutte") rows = rows.filter((r) => r.sheet === sheetFilter);
    if (clientFilter !== "all") rows = rows.filter((r) => r.clienteKey === clientFilter);
    if (attivitaFilter !== "Tutte") rows = rows.filter((r) => r.attivita === attivitaFilter);

    const set = new Set(rows.map((r) => r.progetto).filter((p) => p && p.trim().length > 0));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "it"));
  }, [rowsWithParts, sheetFilter, clientFilter, attivitaFilter]);

  useEffect(() => {
    if (attivitaFilter !== "Tutte" && !attivitaOptions.includes(attivitaFilter)) setAttivitaFilter("Tutte");
    if (progettoFilter !== "Tutti" && !progettoOptions.includes(progettoFilter)) setProgettoFilter("Tutti");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetFilter, clientFilter, attivitaOptions, progettoOptions]);

  const filteredRows = useMemo(() => {
    let rows = rowsWithParts as any[];

    if (sheetFilter !== "Tutte") rows = rows.filter((r) => r.sheet === sheetFilter);
    if (clientFilter !== "all") rows = rows.filter((r) => r.clienteKey === clientFilter);

    if (attivitaFilter !== "Tutte") rows = rows.filter((r) => r.attivita === attivitaFilter);
    if (progettoFilter !== "Tutti") rows = rows.filter((r) => r.progetto === progettoFilter);

    const s = search.trim().toLowerCase();
    if (s) {
      rows = rows.filter((r) => {
        const hay = `${r.cliente} ${r.attivita} ${r.progetto} ${r.titolo} ${r.idEvento}`.toLowerCase();
        return hay.includes(s);
      });
    }

    const useRange = Boolean(dateRange.from || dateRange.to);
    rows = dateMode === "range" ? clampDateRange(rows, dateRange) : clampPeriod(rows, period);

    rows.sort((a, b) => {
      const da = parseEventDate(a.dataInizio)?.getTime() ?? 0;
      const db = parseEventDate(b.dataInizio)?.getTime() ?? 0;
      if (da !== db) return db - da;
      return String(b.oraInizio).localeCompare(String(a.oraInizio));
    });

    return rows;
  }, [rowsWithParts, sheetFilter, clientFilter, attivitaFilter, progettoFilter, search, period, dateRange, dateMode]);

  const selectedClientName = useMemo(() => {
    if (clientFilter === "all") return "Tutti";
    return validClients.find((c) => c.key === clientFilter)?.label ?? "Tutti";
  }, [clientFilter, validClients]);

  const kpis = useMemo(() => {
    const totalHours = filteredRows.reduce((sum, r: any) => sum + (r.durataOre || 0), 0);
    const totalMin = filteredRows.reduce((sum, r: any) => sum + (r.durataMinuti || 0), 0);
    const events = filteredRows.length;
    const avgMin = events ? totalMin / events : 0;

    const dates = filteredRows.map((r: any) => parseEventDate(r.dataInizio)).filter(Boolean) as Date[];

    const first = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
    const last = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

    const uniqueClients = new Set(filteredRows.map((r: any) => r.clienteKey)).size;

    return { totalHours, events, avgMin, first, last, uniqueClients };
  }, [filteredRows]);

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredRows as any[]) {
      const d = parseEventDate(r.dataInizio);
      if (!d) continue;
      const key = monthKey(d);
      map.set(key, (map.get(key) ?? 0) + (r.durataOre || 0));
    }
    const items = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return items.map(([k, v]) => ({ month: k, hours: v }));
  }, [filteredRows]);

  const bySheet = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredRows as any[]) {
      map.set(r.sheet, (map.get(r.sheet) ?? 0) + (r.durataOre || 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([sheet, hours]) => ({ sheet, hours }));
  }, [filteredRows]);

  const byClient = useMemo(() => {
    const map = new Map<string, { label: string; hours: number; events: number }>();
    for (const r of filteredRows as any[]) {
      const key = String(r.clienteKey || "");
      const label = String(r.cliente || "Senza cliente");
      const cur = map.get(key) ?? { label, hours: 0, events: 0 };
      cur.hours += Number(r.durataOre || 0);
      cur.events += 1;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([clienteKey, v]) => ({ clienteKey, cliente: v.label, hours: v.hours, events: v.events }))
      .sort((a, b) => b.hours - a.hours);
  }, [filteredRows]);

  // NEW: ore per attività
  const byAttivita = useMemo(() => {
    return groupByKey(
      filteredRows as any[],
      (r) => String(r.attivita || ""),
      (r) => String(r.attivita || "")
    );
  }, [filteredRows]);


  // NEW: Risorsa x Cliente
const risorsaXCliente = useMemo(() => {
  const { map, rowTotals, colTotals } = matrixHours(
    filteredRows as any[],
    (r) => String(r.sheet || ""),   // riga = risorsa
    (r) => String(r.cliente || "")  // colonna = cliente
  );

  const topRisorse = Array.from(rowTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k]) => k);

  const topClienti = Array.from(colTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k]) => k);

  return { map, topRisorse, topClienti };
}, [filteredRows]);

  // NEW: ore per progetto
  const byProgetto = useMemo(() => {
    return groupByKey(
      filteredRows as any[],
      (r) => String(r.progetto || "").trim(),
      (r) => String(r.progetto || "").trim()
    ).filter((x) => x.key.length > 0);
  }, [filteredRows]);

  // NEW: Cliente x Attività (Top 10 x Top 10)
  const clientXAttivita = useMemo(() => {
    const { map, rowTotals, colTotals } = matrixHours(
      filteredRows as any[],
      (r) => String(r.cliente || ""),
      (r) => String(r.attivita || "")
    );

    const topClients = Array.from(rowTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);

    const topActs = Array.from(colTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);

    return { map, topClients, topActs };
  }, [filteredRows]);

  // NEW: Cliente x Progetto (Top 10 x Top 10)
  const clientXProgetto = useMemo(() => {
    const { map, rowTotals, colTotals } = matrixHours(
      filteredRows as any[],
      (r) => String(r.cliente || ""),
      (r) => String(r.progetto || "").trim()
    );

    const topClients = Array.from(rowTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);

    const topProjects = Array.from(colTotals.entries())
      .filter(([k]) => k && k.trim().length > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);

    return { map, topClients, topProjects };
  }, [filteredRows]);

  const renderBars = (items: { label: string; value: number }[], valueFormatter?: (n: number) => string) => {
    const max = Math.max(1, ...items.map((i) => i.value));
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((i) => {
          const pct = Math.round((i.value / max) * 100);
          return (
            <div
              key={i.label}
              style={{
                display: "grid",
                gridTemplateColumns: "240px 1fr 80px",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#333",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={i.label}
              >
                {i.label}
              </div>
              <div style={{ background: UI.card, borderRadius: 999, height: 10, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${UI.bar}, ${UI.barSoft})` }} />
              </div>
              <div style={{ fontSize: 12, color: UI.text, textAlign: "right" }}>
                {valueFormatter ? valueFormatter(i.value) : i.value}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMatrix = (
  title: string,
  rowsKeys: string[],
  colsKeys: string[],
  getVal: (rk: string, ck: string) => number
) => {
  const max = Math.max(1, ...rowsKeys.flatMap((rk) => colsKeys.map((ck) => getVal(rk, ck))));

  return (
    <div style={{ background: "#fff", border: "1px solid #e9e9e9", borderRadius: 16, padding: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{title}</div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "4px" }}>
          <thead>
            <tr>
              <th
                style={{
                  position: "sticky",
                  left: 0,
                  background: "#fff",
                  borderBottom: "1px solid #eee",
                  padding: "10px 8px",
                  fontSize: 12,
                  zIndex: 10,
                }}
              >
                Risorsa
              </th>
              {colsKeys.map((c) => (
                <th
                  key={c}
                  style={{
                    borderBottom: "1px solid #eee",
                    padding: "10px 8px",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                    textAlign: "right"
                  }}
                  title={c}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsKeys.map((rk) => (
              <tr key={rk}>
                <td
                  style={{
                    position: "sticky",
                    left: 0,
                    background: "#fff",
                    borderBottom: "1px solid #f1f1f1",
                    padding: "10px 8px",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                    fontWeight: 700,
                    zIndex: 5,
                  }}
                  title={rk}
                >
                  {rk}
                </td>

                {colsKeys.map((ck) => {
                  const v = getVal(rk, ck);
                  const intensity = max > 0 ? v / max : 0;

                  return (
                    <td key={`${rk}-${ck}`} style={{ padding: 2 }}>
                      <div
                        style={{
                          background: v > 0 
                            ? `rgba(37, 99, 235, ${0.15 + intensity * 0.75})` 
                            : "transparent",
                          borderRadius: 6,
                          padding: "6px 8px",
                          textAlign: "right",
                          fontWeight: 600,
                          fontSize: 12,
                          color: intensity > 0.6 ? "white" : "#111",
                          transition: "all 0.2s ease",
                          minWidth: "60px"
                        }}
                      >
                        {v > 0 ? `${formatHours(v)} h` : "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
        Matrice ore: intensità basata sul massimo valore rilevato.
      </div>
    </div>
  );
};

  return (
    <div style={{ minHeight: "100vh", background: UI.bg, color: UI.text }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "#fff", borderBottom: "1px solid #e9e9e9" }}>
        <div style={{ margin: "0 auto", padding: "20px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Report clienti</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Fonte: Google Sheet → tab {SHEETS.join(", ")}</div>
            </div>

            {/* FILTRI */}
<div
  style={{
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "end",
    padding: 12,
    border: "1px solid #eee",
    borderRadius: 16,
    background: "#fff",
    boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
  }}
>
  {/* helper per stile input */}
  {/*
    NB: uso inline style per restare coerente col tuo file.
  */}
  {/* Risorsa */}
  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 160 }}>
    <label style={{ fontSize: 11, color: "#555" }}>Risorsa (tab)</label>
    <select
      value={sheetFilter}
      onChange={(e) => setSheetFilter(e.target.value as any)}
      style={{
        padding: "8px 10px",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        background: "#fff",
        fontSize: 12,
        outline: "none",
      }}
    >
      <option value="Tutte">Tutte</option>
      {SHEETS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  </div>

  {/* Cliente */}
  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
    <label style={{ fontSize: 11, color: "#555" }}>Cliente</label>
    <select
      value={clientFilter}
      onChange={(e) => setClientFilter(e.target.value)}
      style={{
        padding: "8px 10px",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        background: "#fff",
        fontSize: 12,
        outline: "none",
      }}
    >
      <option value="all">Tutti</option>
      {clients.map((c) => (
        <option key={c.key} value={c.key}>
          {c.label}
        </option>
      ))}
    </select>
  </div>
  
      
  {/* Tipo attività */}
  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200 }}>
    <label style={{ fontSize: 11, color: "#555" }}>Tipo attività</label>
    <select
      value={attivitaFilter}
      onChange={(e) => setAttivitaFilter(e.target.value)}
      style={{
        padding: "8px 10px",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        background: "#fff",
        fontSize: 12,
        outline: "none",
      }}
    >
      <option value="Tutte">Tutte</option>
      {attivitaOptions.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  </div>

  {/* Progetto */}
  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200 }}>
    <label style={{ fontSize: 11, color: "#555" }}>Progetto</label>
    <select
      value={progettoFilter}
      onChange={(e) => setProgettoFilter(e.target.value)}
      disabled={progettoOptions.length === 0}
      title={progettoOptions.length === 0 ? "Nessun progetto disponibile per i filtri attuali" : ""}
      style={{
        padding: "8px 10px",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        background: progettoOptions.length === 0 ? "#fafafa" : "#fff",
        fontSize: 12,
        outline: "none",
        color: progettoOptions.length === 0 ? "#999" : "#111",
      }}
    >
      <option value="Tutti">Tutti</option>
      {progettoOptions.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  </div>

  {/* Cerca */}
  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
    <label style={{ fontSize: 11, color: "#555" }}>Cerca</label>
    <input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="es. Esselunga, 2FTE, Clarity..."
      style={{
        padding: "8px 10px",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        background: "#fff",
        fontSize: 12,
        outline: "none",
      }}
    />
  </div>

  {/* Modalità data */}
  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 160 }}>
    <label style={{ fontSize: 11, color: "#555" }}>Modalità data</label>
    <select
      value={dateMode}
      onChange={(e) => {
        const mode = e.target.value as "period" | "range";
        setDateMode(mode);

        // pulizia automatica dell'altra modalità
        if (mode === "period") setDateRange({ from: "", to: "" });
        if (mode === "range") setPeriod("all");
      }}
      style={{
        padding: "8px 10px",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        background: "#fff",
        fontSize: 12,
        outline: "none",
      }}
    >
      <option value="period">Periodo</option>
      <option value="range">Intervallo date</option>
    </select>
  </div>

  {/* Date range (attivo solo se dateMode === "range") */}
  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 150 }}>
    <label style={{ fontSize: 11, color: "#555" }}>Da</label>
    <input
      type="date"
      value={dateRange.from}
      onChange={(e) => setDateRange((p) => ({ ...p, from: e.target.value }))}
      disabled={dateMode !== "range"}
      style={{
        padding: "8px 10px",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        background: dateMode !== "range" ? "#fafafa" : "#fff",
        fontSize: 12,
        outline: "none",
        color: dateMode !== "range" ? "#999" : "#111",
      }}
    />
  </div>

  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 150 }}>
    <label style={{ fontSize: 11, color: "#555" }}>A</label>
    <input
      type="date"
      value={dateRange.to}
      onChange={(e) => setDateRange((p) => ({ ...p, to: e.target.value }))}
      disabled={dateMode !== "range"}
      style={{
        padding: "8px 10px",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        background: dateMode !== "range" ? "#fafafa" : "#fff",
        fontSize: 12,
        outline: "none",
        color: dateMode !== "range" ? "#999" : "#111",
      }}
    />
  </div>

  {/* Periodo (attivo solo se dateMode === "period") */}
  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 170 }}>
    <label style={{ fontSize: 11, color: "#555" }}>Periodo</label>
    <select
      value={period}
      onChange={(e) => setPeriod(e.target.value as Period)}
      disabled={dateMode !== "period"}
      style={{
        padding: "8px 10px",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        background: dateMode !== "period" ? "#fafafa" : "#fff",
        fontSize: 12,
        outline: "none",
        color: dateMode !== "period" ? "#999" : "#111",
      }}
    >
      <option value="all">Tutto</option>
      <option value="thisYear">Anno corrente</option>
      <option value="last12">Ultimi 12 mesi</option>
      <option value="last90">Ultimi 90 giorni</option>
      <option value="last30">Ultimi 30 giorni</option>
    </select>
  </div>

  {/* Pulsanti */}
  <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
    <button
      onClick={() => {
        setSearch("");
        setSheetFilter("Tutte");
        setClientFilter("all");
        setAttivitaFilter("Tutte");
        setProgettoFilter("Tutti");
        setDateRange({ from: "", to: "" });
        setPeriod("all");
        setDateMode("period");
      }}
      style={{
        padding: "8px 10px",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        background: "#fff",
        cursor: "pointer",
        fontSize: 12,
      }}
      disabled={loading}
      title="Reset filtri"
    >
      Reset
    </button>

    <button
      onClick={() => void load()}
      style={{
        padding: "8px 10px",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        background: "#111",
        color: "#fff",
        cursor: "pointer",
        fontSize: 12,
      }}
      disabled={loading}
    >
      {loading ? "Caricamento..." : "Ricarica"}
    </button>
  </div>
</div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
            {error ? (
              <span style={{ color: "#b00020" }}>
                {error} — verifica permessi del foglio (pubblico in lettura) e che i nomi tab siano corretti.
              </span>
            ) : (
              <span>
                Righe caricate: <b>{allRows.length}</b> · Righe valide (cliente match): <b>{rowsWithParts.length}</b> · Righe filtrate:{" "}
                <b>{filteredRows.length}</b> · Cliente: <b>{selectedClientName}</b>
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ margin: "0 auto", padding: 14, display: "grid", gap: 12 }}>
        {/* KPI */}
        <div style={{ background: "#fff", border: "1px solid #e9e9e9", borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>KPIs</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
            <KPI label="Ore totali" value={formatHours(kpis.totalHours)} />
            <KPI label="# Eventi" value={String(kpis.events)} />
            <KPI label="Media (min)" value={String(Math.round(kpis.avgMin))} />
            <KPI label="Clienti unici" value={String(kpis.uniqueClients)} />
            <KPI label="Primo evento" value={kpis.first ? isoDayKey(kpis.first) : "—"} />
            <KPI label="Ultimo evento" value={kpis.last ? isoDayKey(kpis.last) : "—"} />
          </div>
        </div>

        {/* Charts */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12 }}>
          <div style={{ gridColumn: "span 12", background: "#fff", border: "1px solid #e9e9e9", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Ore per mese</div>
            {monthly.length === 0 ? (
              <div style={{ fontSize: 12, color: "#666" }}>Nessun dato nel periodo selezionato.</div>
            ) : (
              renderBars(
                monthly.map((m) => ({ label: m.month, value: m.hours })),
                (n) => `${formatHours(n)} h`
              )
            )}
          </div>

          <div style={{ gridColumn: "span 12", background: "#fff", border: "1px solid #e9e9e9", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Ore per risorsa (tab)</div>
            {bySheet.length === 0 ? (
              <div style={{ fontSize: 12, color: "#666" }}>Nessun dato nel periodo selezionato.</div>
            ) : (
              renderBars(
                bySheet.map((s) => ({ label: s.sheet, value: s.hours })),
                (n) => `${formatHours(n)} h`
              )
            )}
          </div>

          <div style={{ gridColumn: "span 12", background: "#fff", border: "1px solid #e9e9e9", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Ore per cliente (Top 20)</div>
            {byClient.length === 0 ? (
              <div style={{ fontSize: 12, color: "#666" }}>Nessun dato nel periodo selezionato.</div>
            ) : (
              renderBars(
                byClient.slice(0, 20).map((c) => ({
                  label: `${c.cliente} (${c.events})`,
                  value: c.hours,
                })),
                (n) => `${formatHours(n)} h`
              )
            )}
            <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>Tra parentesi: numero eventi.</div>
          </div>
          

          {/* NEW: Ore per attività */}
          <div style={{ gridColumn: "span 12", background: "#fff", border: "1px solid #e9e9e9", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Ore per tipo attività (Top 20)</div>
            {byAttivita.length === 0 ? (
              <div style={{ fontSize: 12, color: "#666" }}>Nessun dato nel periodo selezionato.</div>
            ) : (
              renderBars(
                topN(byAttivita, 20).map((a) => ({ label: `${a.label} (${a.events})`, value: a.hours })),
                (n) => `${formatHours(n)} h`
              )
            )}
          </div>

          {/* NEW: Ore per progetto */}
          <div style={{ gridColumn: "span 12", background: "#fff", border: "1px solid #e9e9e9", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Ore per progetto (Top 20)</div>
            {byProgetto.length === 0 ? (
              <div style={{ fontSize: 12, color: "#666" }}>Nessun progetto nel periodo selezionato.</div>
            ) : (
              renderBars(
                topN(byProgetto, 20).map((p) => ({ label: `${p.label} (${p.events})`, value: p.hours })),
                (n) => `${formatHours(n)} h`
              )
            )}
            <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>Tra parentesi: numero eventi.</div>
          </div>


            





          <div style={{ gridColumn: "span 12" }}>
            {renderMatrix(
              "Risorsa × Cliente (ore)",
              risorsaXCliente.topRisorse,
              risorsaXCliente.topClienti,
              (rk, ck) => risorsaXCliente.map.get(rk)?.get(ck) ?? 0
            )}
          </div>
          {/* NEW: Matrici */}
          <div style={{ gridColumn: "span 12" }}>
            {renderMatrix(
              "Cliente × Attività (ore)",
              clientXAttivita.topClients,
              clientXAttivita.topActs,
              (rk, ck) => clientXAttivita.map.get(rk)?.get(ck) ?? 0
            )}
          </div>

          <div style={{ gridColumn: "span 12" }}>
            {renderMatrix(
              "Cliente × Progetto (ore)",
              clientXProgetto.topClients,
              clientXProgetto.topProjects,
              (rk, ck) => clientXProgetto.map.get(rk)?.get(ck) ?? 0
            )}
          </div>
        </div>

        
      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: `1px solid ${UI.border}`,
        borderRadius: 16,
        padding: 14,
        background: UI.card,
        display: "flex",
        flexDirection: "column",
        gap: 4
      }}
    >
      <div
        style={{
          fontWeight: 800,
          fontSize: 20,
          color: UI.primary
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: 12,
          color: UI.subtext,
          fontWeight: 600
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        borderBottom: "1px solid #f1f1f1",
        padding: "10px 8px",
        fontSize: 12,
        color: "#222",
        verticalAlign: "top",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}