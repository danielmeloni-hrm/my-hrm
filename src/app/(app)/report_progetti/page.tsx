"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type ChartType = "bar" | "horizontal_bar" | "line" | "pie";
type Period = "all" | "thisYear" | "last12" | "last90" | "last30";
type FilterToOmit = "risorsa" | "cliente" | "tipo" | "tag" | null;

type TimesheetEvent = {
  id_attivita: string;
  id_evento: string | null;
  titolo: string | null;
  cliente: string | null;
  id_cliente: string | null;
  tipo_attivita: string | null;
  attivita: string | null;
  attivita_json: string[] | null;
  data_inizio: string | null;
  durata_minuti: number | null;
  durata_ore: number | null;
  risorsa: string | null;
};

type SavedChart = {
  id: string;
  title: string;
  chart_type: ChartType;
  dimension: string;
  metric: string;
  position: number;
  col_span: number;
};

const UI = {
  bg: "#f6f8fb",
  card: "#ffffff",
  border: "#e6eaf0",
  text: "#1f2937",
  subtext: "#6b7280",
  primary: "#0150a0",
  danger: "#dc2626",
};

const DIMENSIONS = [
  { value: "cliente", label: "Cliente" },
  { value: "risorsa", label: "Risorsa" },
  { value: "tipo_attivita", label: "Tipo attività" },
  { value: "attivita", label: "Attività" },
  { value: "tag_attivita", label: "TAG attività" },
  { value: "mese", label: "Mese" },
  { value: "giorno", label: "Giorno" },
];

const METRICS = [
  { value: "durata_ore", label: "Somma ore" },
  { value: "durata_minuti", label: "Somma minuti" },
  { value: "eventi", label: "Numero eventi" },
];

const CHART_TYPES = [
  { value: "bar", label: "Barre verticali" },
  { value: "horizontal_bar", label: "Barre orizzontali" },
  { value: "line", label: "Linea" },
  { value: "pie", label: "Torta" },
];

const COL_SPANS = [
  { value: 1, label: "1/4" },
  { value: 2, label: "2/4" },
  { value: 3, label: "3/4" },
  { value: 4, label: "4/4" },
];

const PIE_COLORS = [
  "#0150a0",
  "#2563eb",
  "#60a5fa",
  "#93c5fd",
  "#bfdbfe",
  "#1d4ed8",
];

function formatHours(h: number) {
  return `${Math.round(h * 100) / 100}`.replace(".", ",");
}

function parseDate(d: string | null) {
  if (!d) return null;
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDimensionValue(row: TimesheetEvent, dimension: string) {
  if (dimension === "mese") return row.data_inizio?.slice(0, 7) || "Senza mese";
  if (dimension === "giorno") return row.data_inizio || "Senza giorno";

  const value = row[dimension as keyof TimesheetEvent];
  return String(value || "").trim() || "Non valorizzato";
}

function getMetricValue(row: TimesheetEvent, metric: string) {
  if (metric === "eventi") return 1;
  if (metric === "durata_minuti") return Number(row.durata_minuti || 0);
  return Number(row.durata_ore || 0);
}

function buildChartData(
  rows: TimesheetEvent[],
  dimension: string,
  metric: string
) {
  const map = new Map<string, number>();

  for (const row of rows) {
    const keys =
      dimension === "tag_attivita"
        ? row.attivita_json?.length
          ? row.attivita_json
          : ["Senza TAG"]
        : [getDimensionValue(row, dimension)];

    for (const key of keys) {
      map.set(key, (map.get(key) || 0) + getMetricValue(row, metric));
    }
  }

  const data = Array.from(map.entries()).map(([label, value]) => ({
    label,
    value: Number(value.toFixed(2)),
  }));

  if (dimension === "mese" || dimension === "giorno") {
    return data.sort((a, b) => a.label.localeCompare(b.label)).slice(0, 30);
  }

  return data.sort((a, b) => b.value - a.value).slice(0, 20);
}

function metricFormatter(metric: string) {
  if (metric === "durata_ore") return (n: number) => `${formatHours(n)} h`;
  if (metric === "durata_minuti") return (n: number) => `${Math.round(n)} min`;
  return (n: number) => `${Math.round(n)}`;
}

export default function ReportBuilderPage() {
  const supabase = createClient();

  const [allRows, setAllRows] = useState<TimesheetEvent[]>([]);
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tagFilter, setTagFilter] = useState("Tutti");
  const [risorsaFilter, setRisorsaFilter] = useState("Tutte");
  const [clienteFilter, setClienteFilter] = useState("Tutti");
  const [tipoFilter, setTipoFilter] = useState("Tutte");
  const [period, setPeriod] = useState<Period>("all");
  const [search, setSearch] = useState("");

  const [chartTitle, setChartTitle] = useState("Nuovo grafico");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [chartDimension, setChartDimension] = useState("cliente");
  const [chartMetric, setChartMetric] = useState("durata_ore");
  const [chartColSpan, setChartColSpan] = useState(1);

  useEffect(() => {
    void loadData();
    void loadCharts();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data, error } = await supabase
      .from("timesheet_events")
      .select("*")
      .order("data_inizio", { ascending: false });

    if (!error) setAllRows((data || []) as TimesheetEvent[]);

    setLoading(false);
  }

  async function loadCharts() {
    const { data, error } = await supabase
      .from("report_charts")
      .select("id,title,chart_type,dimension,metric,position,col_span")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error) setSavedCharts((data || []) as SavedChart[]);
  }

  function applyFilters(sourceRows: TimesheetEvent[], omit: FilterToOmit = null) {
    let rows = [...sourceRows];

    if (omit !== "risorsa" && risorsaFilter !== "Tutte") {
      rows = rows.filter((r) => r.risorsa === risorsaFilter);
    }

    if (omit !== "cliente" && clienteFilter !== "Tutti") {
      rows = rows.filter((r) => r.cliente === clienteFilter);
    }

    if (omit !== "tipo" && tipoFilter !== "Tutte") {
      rows = rows.filter((r) => r.tipo_attivita === tipoFilter);
    }

    if (omit !== "tag" && tagFilter !== "Tutti") {
      rows = rows.filter((r) => r.attivita_json?.includes(tagFilter));
    }

    const s = search.trim().toLowerCase();

    if (s) {
      rows = rows.filter((r) =>
        `${r.cliente} ${r.risorsa} ${r.tipo_attivita} ${r.attivita} ${r.attivita_json?.join(
          " "
        )} ${r.titolo}`
          .toLowerCase()
          .includes(s)
      );
    }

    if (period !== "all") {
      const now = new Date();
      const start = new Date();

      if (period === "thisYear") start.setMonth(0, 1);
      if (period === "last12") start.setMonth(start.getMonth() - 12);
      if (period === "last90") start.setDate(start.getDate() - 90);
      if (period === "last30") start.setDate(start.getDate() - 30);

      rows = rows.filter((r) => {
        const d = parseDate(r.data_inizio);
        if (!d) return true;
        return d >= start && d <= now;
      });
    }

    return rows;
  }

  const filteredRows = useMemo(() => {
    return applyFilters(allRows);
  }, [
    allRows,
    risorsaFilter,
    clienteFilter,
    tipoFilter,
    tagFilter,
    search,
    period,
  ]);

  const risorse = useMemo(() => {
    return Array.from(
      new Set(
        applyFilters(allRows, "risorsa")
          .map((r) => r.risorsa)
          .filter(Boolean) as string[]
      )
    ).sort();
  }, [allRows, clienteFilter, tipoFilter, tagFilter, search, period]);

  const clienti = useMemo(() => {
    return Array.from(
      new Set(
        applyFilters(allRows, "cliente")
          .map((r) => r.cliente)
          .filter(Boolean) as string[]
      )
    ).sort();
  }, [allRows, risorsaFilter, tipoFilter, tagFilter, search, period]);

  const tipi = useMemo(() => {
    return Array.from(
      new Set(
        applyFilters(allRows, "tipo")
          .map((r) => r.tipo_attivita)
          .filter(Boolean) as string[]
      )
    ).sort();
  }, [allRows, risorsaFilter, clienteFilter, tagFilter, search, period]);

  const tags = useMemo(() => {
    const set = new Set<string>();

    applyFilters(allRows, "tag").forEach((row) => {
      row.attivita_json?.forEach((tag) => {
        if (tag) set.add(tag);
      });
    });

    return Array.from(set).sort();
  }, [allRows, risorsaFilter, clienteFilter, tipoFilter, search, period]);

  useEffect(() => {
    if (risorsaFilter !== "Tutte" && !risorse.includes(risorsaFilter)) {
      setRisorsaFilter("Tutte");
    }

    if (clienteFilter !== "Tutti" && !clienti.includes(clienteFilter)) {
      setClienteFilter("Tutti");
    }

    if (tipoFilter !== "Tutte" && !tipi.includes(tipoFilter)) {
      setTipoFilter("Tutte");
    }

    if (tagFilter !== "Tutti" && !tags.includes(tagFilter)) {
      setTagFilter("Tutti");
    }
  }, [
    risorse,
    clienti,
    tipi,
    tags,
    risorsaFilter,
    clienteFilter,
    tipoFilter,
    tagFilter,
  ]);

  const kpis = useMemo(() => {
    const ore = filteredRows.reduce(
      (sum, r) => sum + Number(r.durata_ore || 0),
      0
    );

    return {
      ore,
      eventi: filteredRows.length,
      clienti: new Set(filteredRows.map((r) => r.cliente).filter(Boolean)).size,
      risorse: new Set(filteredRows.map((r) => r.risorsa).filter(Boolean)).size,
    };
  }, [filteredRows]);

  const previewData = useMemo(
    () => buildChartData(filteredRows, chartDimension, chartMetric),
    [filteredRows, chartDimension, chartMetric]
  );

  async function saveChart() {
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Devi essere autenticato.");
      setSaving(false);
      return;
    }

    const nextPosition =
      savedCharts.length > 0
        ? Math.max(...savedCharts.map((c) => Number(c.position || 0))) + 1
        : 1;

    const { error } = await supabase.from("report_charts").insert({
      user_id: user.id,
      title: chartTitle.trim() || "Grafico senza titolo",
      chart_type: chartType,
      dimension: chartDimension,
      metric: chartMetric,
      col_span: chartColSpan,
      position: nextPosition,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setChartTitle("Nuovo grafico");
    setChartType("bar");
    setChartColSpan(1);
    await loadCharts();
  }

  async function deleteChart(id: string) {
    if (!confirm("Eliminare questo grafico?")) return;

    const { error } = await supabase.from("report_charts").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadCharts();
  }

  async function updateChartSize(chart: SavedChart, colSpan: number) {
    setSavedCharts((prev) =>
      prev.map((c) => (c.id === chart.id ? { ...c, col_span: colSpan } : c))
    );

    const { error } = await supabase
      .from("report_charts")
      .update({ col_span: colSpan })
      .eq("id", chart.id);

    if (error) {
      alert(error.message);
      await loadCharts();
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = savedCharts.findIndex((c) => c.id === active.id);
    const newIndex = savedCharts.findIndex((c) => c.id === over.id);

    const reordered = arrayMove(savedCharts, oldIndex, newIndex).map(
      (chart, index) => ({
        ...chart,
        position: index + 1,
      })
    );

    setSavedCharts(reordered);

    const results = await Promise.all(
      reordered.map((chart) =>
        supabase
          .from("report_charts")
          .update({ position: chart.position })
          .eq("id", chart.id)
      )
    );

    const hasError = results.find((r) => r.error);

    if (hasError?.error) {
      alert(hasError.error.message);
      await loadCharts();
    }
  }

  function renderChart(
    data: { label: string; value: number }[],
    type: ChartType,
    metric: string
  ) {
    if (data.length === 0) {
      return (
        <div style={{ fontSize: 12, color: UI.subtext }}>
          Nessun dato disponibile.
        </div>
      );
    }

    const formatter = metricFormatter(metric);

    if (type === "line") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => formatter(Number(v))} />
            <Line dataKey="value" stroke={UI.primary} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (type === "pie") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" label>
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatter(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (type === "horizontal_bar") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 11 }}
              width={120}
            />
            <Tooltip formatter={(v) => formatter(Number(v))} />
            <Bar dataKey="value" fill={UI.primary} radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => formatter(Number(v))} />
          <Bar dataKey="value" fill={UI.primary} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: UI.bg, color: UI.text }}>
      <div style={headerStyle}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Report clienti</div>
          <div style={{ fontSize: 12, color: UI.subtext, marginTop: 4 }}>
            Dashboard personalizzabile su 4 colonne
          </div>
        </div>

        <div style={filtersStyle}>
          <FilterSelect
            label="Risorsa"
            value={risorsaFilter}
            onChange={setRisorsaFilter}
            options={["Tutte", ...risorse]}
          />

          <FilterSelect
            label="Cliente"
            value={clienteFilter}
            onChange={setClienteFilter}
            options={["Tutti", ...clienti]}
          />

          <FilterSelect
            label="Tipo attività"
            value={tipoFilter}
            onChange={setTipoFilter}
            options={["Tutte", ...tipi]}
          />

          <FilterSelect
            label="TAG"
            value={tagFilter}
            onChange={setTagFilter}
            options={["Tutti", ...tags]}
          />

          <FilterSelect
            label="Periodo"
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={["all", "thisYear", "last12", "last90", "last30"]}
            labels={{
              all: "Tutto",
              thisYear: "Anno corrente",
              last12: "Ultimi 12 mesi",
              last90: "Ultimi 90 giorni",
              last30: "Ultimi 30 giorni",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={labelStyle}>Cerca</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="es. Esselunga, 2FTE..."
              style={inputStyle}
            />
          </div>

          <button
            style={buttonStyle}
            onClick={() => {
              setRisorsaFilter("Tutte");
              setClienteFilter("Tutti");
              setTipoFilter("Tutte");
              setTagFilter("Tutti");
              setPeriod("all");
              setSearch("");
            }}
          >
            Reset
          </button>

          <button
            style={{ ...buttonStyle, background: "#111", color: "#fff" }}
            onClick={() => void loadData()}
          >
            {loading ? "Caricamento..." : "Ricarica"}
          </button>
        </div>
      </div>

      <main style={{ padding: 14, display: "grid", gap: 14 }}>
        <div style={kpiGridStyle}>
          <KPI label="Ore totali" value={`${formatHours(kpis.ore)} h`} />
          <KPI label="Eventi" value={String(kpis.eventi)} />
          <KPI label="Clienti" value={String(kpis.clienti)} />
          <KPI label="Risorse" value={String(kpis.risorse)} />
        </div>

        <section style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            Crea grafico
          </div>

          <div style={builderStyle}>
            <TextInput
              label="Titolo"
              value={chartTitle}
              onChange={setChartTitle}
            />

            <FilterSelect
              label="Tipo grafico"
              value={chartType}
              onChange={(v) => setChartType(v as ChartType)}
              options={CHART_TYPES.map((c) => c.value)}
              labels={Object.fromEntries(
                CHART_TYPES.map((c) => [c.value, c.label])
              )}
            />

            <FilterSelect
              label="Dimensione"
              value={chartDimension}
              onChange={setChartDimension}
              options={DIMENSIONS.map((d) => d.value)}
              labels={Object.fromEntries(
                DIMENSIONS.map((d) => [d.value, d.label])
              )}
            />

            <FilterSelect
              label="Metrica"
              value={chartMetric}
              onChange={setChartMetric}
              options={METRICS.map((m) => m.value)}
              labels={Object.fromEntries(METRICS.map((m) => [m.value, m.label]))}
            />

            <FilterSelect
              label="Larghezza"
              value={String(chartColSpan)}
              onChange={(v) => setChartColSpan(Number(v))}
              options={COL_SPANS.map((c) => String(c.value))}
              labels={Object.fromEntries(
                COL_SPANS.map((c) => [String(c.value), c.label])
              )}
            />

            <button
              style={{ ...buttonStyle, background: UI.primary, color: "#fff" }}
              onClick={() => void saveChart()}
              disabled={saving}
            >
              {saving ? "Salvataggio..." : "Salva grafico"}
            </button>
          </div>

          <div style={{ marginTop: 16 }}>
            {renderChart(previewData, chartType, chartMetric)}
          </div>
        </section>

        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={savedCharts.map((chart) => chart.id)}
            strategy={rectSortingStrategy}
          >
            <section style={dashboardGridStyle}>
              {savedCharts.map((chart) => {
                const data = buildChartData(
                  filteredRows,
                  chart.dimension,
                  chart.metric
                );

                return (
                  <SortableChartCard
                    key={chart.id}
                    chart={chart}
                    onDelete={deleteChart}
                    onResize={updateChartSize}
                  >
                    {renderChart(data, chart.chart_type, chart.metric)}
                  </SortableChartCard>
                );
              })}
            </section>
          </SortableContext>
        </DndContext>
      </main>
    </div>
  );
}

function SortableChartCard({
  chart,
  children,
  onDelete,
  onResize,
}: {
  chart: SavedChart;
  children: React.ReactNode;
  onDelete: (id: string) => void;
  onResize: (chart: SavedChart, colSpan: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chart.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        ...cardStyle,
        gridColumn: `span ${chart.col_span || 1}`,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      <div style={chartHeaderStyle}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{chart.title}</div>
          <div style={{ fontSize: 12, color: UI.subtext }}>
            {chart.chart_type} · {chart.dimension} · {chart.metric}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={chart.col_span || 1}
            onChange={(e) => onResize(chart, Number(e.target.value))}
            style={smallSelectStyle}
          >
            <option value={1}>1/4</option>
            <option value={2}>2/4</option>
            <option value={3}>3/4</option>
            <option value={4}>4/4</option>
          </select>

          <button style={dragButtonStyle} {...attributes} {...listeners}>
            ↕ Drag
          </button>

          <button
            style={{ ...buttonStyle, color: UI.danger }}
            onClick={() => onDelete(chart.id)}
          >
            Elimina
          </button>
        </div>
      </div>

      {children}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 22, fontWeight: 800, color: UI.primary }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: UI.subtext }}>{label}</div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={labelStyle}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  labels = {},
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={labelStyle}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option] || option}
          </option>
        ))}
      </select>
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  background: "#fff",
  borderBottom: "1px solid #e9e9e9",
  padding: 20,
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  alignItems: "end",
};

const filtersStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "end",
  padding: 12,
  border: "1px solid #eee",
  borderRadius: 16,
  background: "#fff",
};

const builderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
  alignItems: "end",
};

const dashboardGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
  alignItems: "start",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e9e9e9",
  borderRadius: 16,
  padding: 14,
};

const chartHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #e5e5e5",
  borderRadius: 12,
  background: "#fff",
  fontSize: 12,
  outline: "none",
};

const smallSelectStyle: React.CSSProperties = {
  ...inputStyle,
  padding: "6px 8px",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #e5e5e5",
  borderRadius: 12,
  background: "#fff",
  cursor: "pointer",
  fontSize: 12,
};

const dragButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  cursor: "grab",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#555",
};