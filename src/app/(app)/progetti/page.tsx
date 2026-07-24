"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import AppPage from "@/components/ui/AppPage";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import {
  ChevronDown,
  ChevronUp,
  CircleDashed,
  ExternalLink,
  Pencil,
  Plus,
  FileChartColumnIncreasing,
  BarChart3,
  Save,
  Bug,
  BugPlay,
  ClipboardPlus,
  Search,
  FileText,
  Send,
  Trash2,
  X,
  Columns3,
} from "lucide-react";
import {
  SiGoogletagmanager,
  SiGoogleanalytics,
  SiGooglebigquery,
  SiLooker,
} from "@icons-pack/react-simple-icons";

const supabase = createClient();

const BRAND = "#0150a0";
const BRAND_BG = "#eaf2fb";
const BRAND_SOFT_TEXT = "#0150a0CC";

const ESSELUNGA_APPS = [
  "APPECOM",
  "ECOM35",
  "EOL",
  "ESB",
  "IST35",
  "APPIST",
  "GCW",
  "B2B",
  "TOT",
  "Altro",
] as const;

const STEP_STATUSES_DOC = [
  "Da Fare",
  "Draft",
  "In Lavorazione",
  "Attenzione di Andrea",
  "Attenzione di Business",
  "Completato - Da Inviare",
  "Completato",
  "Inviato",
  "Sostituito",
] as const;

const STEP_STATUSES_GTM_GA = [
  "GA4 Da Configurare",
  "GTM Da Configurare",
  "GA4 Da Pubblicare",
  "GTM Da Pubblicare",
  "GTM OK",
  "GA4 OK",
  "Completato",
  "Non Necessaria",
  "Sostituito",
] as const;

const STEP_STATUSES_RILASCI = [
  "In attesa",
  "In Sviluppo",
  "Completato",
  "Sostituito",
] as const;

const STEP_STATUSES_REPORT = [
  "Da Fare",
  "In Lavorazione",
  "Da Completare",
  "Completato",
] as const;

const STEP_STATUSES_DEFAULT = [
  "Da Fare",
  "In Lavorazione",
  "Attenzione di Andrea",
  "Attenzione di Business",
  "Completato",
  "Non Necessaria",
  "Sostituito",
] as const;

const SVILUPPO_STATI = ["Sviluppato", "Non Sviluppato", "Sostituito"] as const;

const TABLE_COLUMNS = [
  { key: "cliente", label: "Cliente" },
  { key: "applicativo", label: "Applicativo" },
  { key: "versione", label: "Versione" },
  { key: "nome_evolutiva", label: "Nome evolutiva" },
  { key: "numero_change", label: "Numero change" },
  { key: "documento", label: "Documento" },
  { key: "sviluppo", label: "Sviluppo" },
  { key: "step_workflow", label: "Step Workflow" },
] as const;

type TableColumnKey = (typeof TABLE_COLUMNS)[number]["key"];
type ColumnVisibility = Record<TableColumnKey, boolean>;

const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = TABLE_COLUMNS.reduce(
  (acc, col) => {
    acc[col.key] = true;
    return acc;
  },
  {} as ColumnVisibility,
);

const COLUMN_VISIBILITY_STORAGE_KEY = "progetti_operativi_column_visibility";

const STATUS_STYLES: Record<string, string> = {
  "Da Fare": "bg-gray-100 text-gray-600 border border-gray-200",
  "In attesa": "bg-gray-100 text-gray-600 border border-gray-200",
  Draft: "bg-amber-100 text-amber-700 border border-amber-200",
  "In Sviluppo": "bg-amber-100 text-amber-700 border border-amber-200",
  "In Lavorazione": "bg-yellow-100 text-yellow-700 border border-yellow-200",
  "Da Completare": "bg-orange-200 text-orange-800 border border-orange-300",
  "Attenzione di Andrea":
    "bg-purple-100 text-purple-700 border border-purple-200",
  "Attenzione di Business":
    "bg-purple-200 text-purple-800 border border-purple-300",
  "Completato - Da Inviare":
    "bg-yellow-100 text-green-700 border border-yellow-200",
  Completato: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  Inviato: "bg-green-200 text-green-800 border border-green-300",
  "GA4 Da Configurare": "bg-red-100 text-red-700 border border-red-200",
  "GTM Da Configurare": "bg-red-100 text-red-700 border border-red-200",
  "GA4 Da Pubblicare": "bg-yellow-100 text-yellow-700 border border-yellow-200",
  "GTM Da Pubblicare": "bg-yellow-200 text-yellow-800 border border-yellow-300",
  "GTM OK": "bg-emerald-100 text-emerald-700 border border-emerald-200",
  "GA4 OK": "bg-green-200 text-green-800 border border-green-300",
  "Non Necessaria": "bg-slate-200 text-slate-600 border border-slate-300",
  Sostituito: "bg-blue-100 text-blue-600 border border-blue-200",
  Sviluppato: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  "Non Sviluppato": "bg-red-100 text-red-700 border border-red-200",
};

const STEP_COLUMNS = [
  {
    key: "step_documento_operativo",
    noteKey: "note_step_documento_operativo",
    label: "Documento operativo",
    mode: "single",
    options: STEP_STATUSES_DOC,
  },
  {
    key: "step_gtm_ga4_coll",
    noteKey: "note_step_gtm_ga4_coll",
    label: "GTM+GA4 - COLL",
    mode: "multi",
    options: STEP_STATUSES_GTM_GA,
  },
  {
    key: "step_sviluppo_testing_coll",
    noteKey: "note_step_sviluppo_testing_coll",
    label: "Sviluppo & Testing - COLL",
    mode: "single",
    options: STEP_STATUSES_RILASCI,
  },
  {
    key: "step_gtm_ga4_prod",
    noteKey: "note_step_gtm_ga4_prod",
    label: "GTM+GA4 - PROD",
    mode: "multi",
    options: STEP_STATUSES_GTM_GA,
  },
  {
    key: "step_sviluppo_testing_prod",
    noteKey: "note_step_sviluppo_testing_prod",
    label: "Sviluppo & Testing - PROD",
    mode: "single",
    options: STEP_STATUSES_RILASCI,
  },
  {
    key: "step_ga4_realtime_rilascio",
    noteKey: "note_step_ga4_realtime_rilascio",
    label: "Monitoraggio GA4 RealTime Rilascio",
    mode: "single",
    options: STEP_STATUSES_DEFAULT,
  },
  {
    key: "step_report_manutenzione",
    noteKey: "note_step_report_manutenzione",
    label: "Report Manutenzione",
    mode: "single",
    options: STEP_STATUSES_REPORT,
  },
  {
    key: "step_modello_dati_bq",
    noteKey: "note_step_modello_dati_bq",
    label: "Modello Dati BigQuery",
    mode: "single",
    options: STEP_STATUSES_REPORT,
  },
  {
    key: "step_modello_dati",
    noteKey: "note_step_modello_dati",
    label: "Modello Dati",
    mode: "single",
    options: STEP_STATUSES_REPORT,
  },
  {
    key: "step_doc_confronto_applicativi",
    noteKey: "note_step_doc_confronto_applicativi",
    label: "Doc Confronto Applicativi",
    mode: "single",
    options: STEP_STATUSES_REPORT,
  },
  {
    key: "step_report_business",
    noteKey: "note_step_report_business",
    label: "Report Business",
    mode: "single",
    options: STEP_STATUSES_REPORT,
  },
  {
    key: "step_powerbi",
    noteKey: "note_step_powerbi",
    label: "PowerBI",
    mode: "single",
    options: STEP_STATUSES_REPORT,
  },
] as const;

type StepColumn = (typeof STEP_COLUMNS)[number];
type StepColumnKey = StepColumn["key"];
type StepNoteKey = StepColumn["noteKey"];
type ClienteFlowMap = Record<string, StepColumnKey[]>;

type ModalMode = "create" | "edit" | null;
type StepFieldValue = string | string[];
type StepFields = Record<StepColumnKey, StepFieldValue>;
type StepNoteFields = Record<StepNoteKey, string>;

type SortKey =
  | "cliente_nome"
  | "applicativo"
  | "versione"
  | "nome_evolutiva"
  | "numero_change"
  | "updated_at";

type SortDirection = "asc" | "desc";

interface SviluppoVoce {
  id: string;
  descrizione: string;
  stato: string;
  sostituito_da: string;
}

interface ClienteRecord {
  id: string;
  nome: string;
}

interface OperationalProjectRecord extends StepFields, StepNoteFields {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  applicativo: string | null;
  versione: string | null;
  nome_evolutiva: string;
  numero_change: string | null;
  document_link: string;
  note_generali: string;
  sviluppo_voci: SviluppoVoce[];
  created_at: string;
  updated_at: string;
}

interface FormState extends StepFields, StepNoteFields {
  cliente_id: string;
  applicativo: string;
  versione: string;
  nome_evolutiva: string;
  numero_change: string;
  document_link: string;
  note_generali: string;
  sviluppo_voci: SviluppoVoce[];
}

function createSviluppoVoce(): SviluppoVoce {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `voce_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    descrizione: "",
    stato: "Non Sviluppato",
    sostituito_da: "",
  };
}

function normalizeSviluppoVoci(voci: SviluppoVoce[]) {
  return voci
    .map((voce) => ({
      id: voce.id,
      descrizione: voce.descrizione.trim(),
      stato: voce.stato || "Non Sviluppato",
      sostituito_da:
        voce.stato === "Sostituito" ? voce.sostituito_da.trim() : "",
    }))
    .filter((voce) => voce.descrizione.length > 0);
}

function getSviluppoCounts(voci: SviluppoVoce[]) {
  return voci.reduce(
    (acc, voce) => {
      acc.totale += 1;
      if (voce.stato === "Sviluppato") acc.sviluppati += 1;
      else if (voce.stato === "Sostituito") acc.sostituiti += 1;
      else acc.nonSviluppati += 1;
      return acc;
    },
    { totale: 0, sviluppati: 0, nonSviluppati: 0, sostituiti: 0 },
  );
}

const EMPTY_FORM: FormState = {
  cliente_id: "",
  applicativo: "",
  versione: "",
  nome_evolutiva: "",
  numero_change: "",
  document_link: "",
  note_generali: "",
  sviluppo_voci: [],

  step_documento_operativo: "Da Fare",
  step_gtm_ga4_coll: [],
  step_sviluppo_testing_coll: "Da Fare",
  step_gtm_ga4_prod: [],
  step_sviluppo_testing_prod: "Da Fare",
  step_ga4_realtime_rilascio: "Da Fare",
  step_report_manutenzione: "Da Fare",
  step_modello_dati: "Da Fare",
  step_modello_dati_bq: "Da Fare",
  step_doc_confronto_applicativi: "Da Fare",
  step_report_business: "Da Fare",
  step_powerbi: "Da Fare",

  note_step_documento_operativo: "",
  note_step_gtm_ga4_coll: "",
  note_step_sviluppo_testing_coll: "",
  note_step_gtm_ga4_prod: "",
  note_step_sviluppo_testing_prod: "",
  note_step_ga4_realtime_rilascio: "",
  note_step_report_manutenzione: "",
  note_step_modello_dati: "",
  note_step_modello_dati_bq: "",
  note_step_doc_confronto_applicativi: "",
  note_step_report_business: "",
  note_step_powerbi: "",
};

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function parseVersion(value: string | null | undefined): number[] {
  if (!value) return [0];
  const cleaned = value.replace(",", ".").trim();
  const parts = cleaned
    .split(".")
    .map((part) => {
      const n = Number.parseInt(part.replace(/[^0-9]/g, ""), 10);
      return Number.isNaN(n) ? 0 : n;
    });
  return parts.length > 0 ? parts : [0];
}

function compareVersions(
  a: string | null | undefined,
  b: string | null | undefined,
) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

function getStepBadgeClass(value: string) {
  return STATUS_STYLES[value] || STATUS_STYLES["Da Fare"];
}

function renderStepSummary(value: StepFieldValue) {
  if (Array.isArray(value)) {
    if (value.length === 0) return "Da Fare";
    return value.join(" • ");
  }

  return value || "Da Fare";
}

function getStatusColorClass(status: string | null | undefined) {
  if (!status) return "text-gray-400";

  if (
    status === "Completato" ||
    status === "Completato - Da Inviare" ||
    status === "Non Necessaria" ||
    status === "Inviato" ||
    status === "GTM OK" ||
    status === "GA4 OK"
  ) {
    return "text-green-500";
  }

  if (
    status === "Attenzione di Andrea" ||
    status === "Attenzione di Business"
  ) {
    return "text-purple-500";
  }

  if (
    status === "In Lavorazione" ||
    status === "In Sviluppo" ||
    status === "Draft" ||
    status === "GA4 Da Pubblicare" ||
    status === "GTM Da Pubblicare" ||
    status === "Da Completare"
  ) {
    return "text-yellow-500";
  }

  if (
    status === "Da Fare" ||
    status === "In attesa" ||
    status === "GA4 Da Configurare" ||
    status === "GTM Da Configurare"
  ) {
    return "text-red-500";
  }

  return "text-gray-400";
}

function getSingleGtmGaIconColor(status: string | null | undefined) {
  return getStatusColorClass(status);
}

function getGtmGaStatuses(value: StepFieldValue) {
  const values = Array.isArray(value) ? value : [value];

  const isCompleted =
    values.includes("Completato") || values.includes("Non Necessaria");

  if (isCompleted) {
    return {
      gtmStatus: values.includes("Non Necessaria")
        ? "Non Necessaria"
        : "Completato",
      ga4Status: values.includes("Non Necessaria")
        ? "Non Necessaria"
        : "Completato",
    };
  }

  return {
    gtmStatus: values.find((v) => v.includes("GTM")) || "GTM Da Configurare",
    ga4Status: values.find((v) => v.includes("GA4")) || "GA4 Da Configurare",
  };
}

function getStatusBoxClass(status: string | null | undefined) {
  if (status === "Completato - Da Inviare") {
    return "bg-yellow-100 border-yellow-200";
  }

  const colorClass = getStatusColorClass(status);

  if (colorClass === "text-green-500") return "bg-green-50 border-green-200";
  if (colorClass === "text-purple-500") return "bg-purple-50 border-purple-200";
  if (colorClass === "text-yellow-500") return "bg-yellow-50 border-yellow-200";
  if (colorClass === "text-red-500") return "bg-red-50 border-red-200";

  return "bg-slate-50 border-slate-200";
}

function getStatusBgColor(status: string | null | undefined) {
  if (status === "Completato - Da Inviare") return "#fef9c3";

  const colorClass = getStatusColorClass(status);

  if (colorClass === "text-green-500") return "#ecfdf5";
  if (colorClass === "text-purple-500") return "#faf5ff";
  if (colorClass === "text-yellow-500") return "#fefce8";
  if (colorClass === "text-red-500") return "#fef2f2";

  return "#f8fafc";
}

function getStatusBorderClass(status: string | null | undefined) {
  if (status === "Completato - Da Inviare") return "border-yellow-200";

  const colorClass = getStatusColorClass(status);

  if (colorClass === "text-green-500") return "border-green-200";
  if (colorClass === "text-purple-500") return "border-purple-200";
  if (colorClass === "text-yellow-500") return "border-yellow-200";
  if (colorClass === "text-red-500") return "border-red-200";

  return "border-slate-200";
}

function getStepIconColorClass(value: StepFieldValue) {
  const statuses = Array.isArray(value) ? value : [value];

  if (statuses.length === 0 || statuses.every((status) => !status?.trim())) {
    return "text-gray-400";
  }

  if (
    statuses.some((status) => getStatusColorClass(status) === "text-green-500")
  ) {
    return "text-green-500";
  }

  if (
    statuses.some((status) => getStatusColorClass(status) === "text-purple-500")
  ) {
    return "text-purple-500";
  }

  if (
    statuses.some((status) => getStatusColorClass(status) === "text-yellow-500")
  ) {
    return "text-yellow-500";
  }

  if (
    statuses.some((status) => getStatusColorClass(status) === "text-red-500")
  ) {
    return "text-red-500";
  }

  return "text-gray-400";
}

function getStepBrandIcon(col: StepColumn, value: StepFieldValue) {
  const colorClass = getStepIconColorClass(value);

  switch (col.key) {
    case "step_documento_operativo":
      return <Send size={16} className={colorClass} />;

    case "step_gtm_ga4_coll":
    case "step_gtm_ga4_prod": {
      const { gtmStatus, ga4Status } = getGtmGaStatuses(value);

      return (
        <div
          className="flex items-center justify-center gap-1"
          title={`GTM: ${gtmStatus} | GA4: ${ga4Status}`}
        >
          <SiGoogletagmanager
            size={13}
            className={getSingleGtmGaIconColor(gtmStatus)}
          />
          <SiGoogleanalytics
            size={13}
            className={getSingleGtmGaIconColor(ga4Status)}
          />
        </div>
      );
    }

    case "step_sviluppo_testing_coll":
      return <Bug size={16} className={colorClass} />;

    case "step_sviluppo_testing_prod":
      return <BugPlay size={16} className={colorClass} />;

    case "step_ga4_realtime_rilascio":
      return <SiGoogleanalytics size={16} className={colorClass} />;

    case "step_report_manutenzione":
      return <FileChartColumnIncreasing size={16} className={colorClass} />;

    case "step_modello_dati_bq":
      return <SiGooglebigquery size={16} className={colorClass} />;

    case "step_report_business":
      return <SiLooker size={16} className={colorClass} />;

    case "step_modello_dati":
      return <ClipboardPlus size={16} className={colorClass} />;

    case "step_doc_confronto_applicativi":
      return <FileText size={16} className={colorClass} />;

    case "step_powerbi":
      return <BarChart3 size={16} className={colorClass} />;

    default:
      return <CircleDashed size={16} className="text-gray-400" />;
  }
}

function StepIconsSummary({
  record,
  activeColumns,
}: {
  record: OperationalProjectRecord;
  activeColumns: readonly StepColumn[];
}) {
  return (
    <div className="flex flex-wrap gap-2 min-w-[320px]">
      {activeColumns.map((col) => {
        const value = record[col.key];

        const isDoubleIcon =
          col.key === "step_gtm_ga4_coll" || col.key === "step_gtm_ga4_prod";

        const { gtmStatus, ga4Status } = isDoubleIcon
          ? getGtmGaStatuses(value)
          : { gtmStatus: null, ga4Status: null };

        const boxClass = isDoubleIcon
          ? `w-12 ${getStatusBorderClass(gtmStatus)}`
          : getStatusBoxClass(Array.isArray(value) ? value[0] : value);

        const boxStyle = isDoubleIcon
          ? {
              background: `linear-gradient(90deg, ${getStatusBgColor(
                gtmStatus,
              )} 0%, ${getStatusBgColor(gtmStatus)} 50%, ${getStatusBgColor(
                ga4Status,
              )} 50%, ${getStatusBgColor(ga4Status)} 100%)`,
            }
          : undefined;

        return (
          <div
            key={col.key}
            aria-label={`${col.label}: ${renderStepSummary(value)}`}
            style={boxStyle}
            className={`
              group relative flex h-8 w-8 shrink-0 items-center justify-center
              rounded-lg border ${boxClass}
              [&>svg]:h-4 [&>svg]:w-4 [&_svg]:h-4 [&_svg]:w-4
            `}
          >
            {getStepBrandIcon(col, value)}

            <span
              className="
                pointer-events-none absolute -top-9 left-1/2 z-50 hidden -translate-x-1/2
                whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px]
                font-bold text-[#ffffff] shadow-lg group-hover:block
              "
            >
              {isDoubleIcon
                ? `GTM: ${gtmStatus} | GA4: ${ga4Status}`
                : `${col.label}: ${renderStepSummary(value)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StepSelectSingle({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-xl px-3 py-2 text-[11px] font-bold outline-none ${getStepBadgeClass(
        value,
      )}`}
    >
      {options.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}

function StepSelectMulti({
  values,
  options,
  onChange,
}: {
  values: string[];
  options: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const toggleValue = (option: string) => {
    if (values.includes(option)) {
      onChange(values.filter((v) => v !== option));
    } else {
      onChange([...values, option]);
    }
  };

  const summary = values.length > 0 ? values.join(" • ") : "Seleziona stato";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full min-h-[42px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-left flex items-center justify-between gap-3 hover:border-gray-300"
      >
        <span className="text-[11px] font-bold text-slate-700 truncate">
          {summary}
        </span>
        {open ? (
          <ChevronUp size={16} className="text-slate-500 shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-slate-500 shrink-0" />
        )}
      </button>

      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className={`inline-flex px-2 py-1 rounded-[8px] text-[11px] font-bold ${getStepBadgeClass(
                value,
              )}`}
            >
              {value}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-xl p-2 max-h-72 overflow-auto">
          <div className="grid grid-cols-1 gap-2">
            {options.map((option) => {
              const active = values.includes(option);

              return (
                <label
                  key={option}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition ${
                    active
                      ? getStepBadgeClass(option)
                      : "bg-white border-gray-200 text-slate-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleValue(option)}
                    className="rounded"
                  />
                  <span className="text-xs font-semibold">{option}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  currentSortKey,
  currentSortDirection,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  currentSortKey: SortKey;
  currentSortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  align?: "left" | "center" | "right";
}) {
  const active = currentSortKey === sortKey;

  const justifyClass =
    align === "center"
      ? "justify-center"
      : align === "right"
        ? "justify-end"
        : "justify-start";

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`w-full flex items-center gap-1 ${justifyClass} hover:opacity-80 transition`}
      title={`Ordina per ${label}`}
    >
      <span>{label}</span>
      {active ? (
        currentSortDirection === "asc" ? (
          <ChevronUp size={12} />
        ) : (
          <ChevronDown size={12} />
        )
      ) : (
        <ChevronDown size={12} className="opacity-30" />
      )}
    </button>
  );
}

function ColumnVisibilityMenu({
  visibility,
  onChange,
}: {
  visibility: ColumnVisibility;
  onChange: (next: ColumnVisibility) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const toggleColumn = (key: TableColumnKey) => {
    onChange({ ...visibility, [key]: !visibility[key] });
  };

  const hiddenCount = TABLE_COLUMNS.filter((col) => !visibility[col.key]).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <AppButton
        type="button"
        variant="secondary"
        onClick={() => setOpen((prev) => !prev)}
        className="h-11 inline-flex items-center gap-2"
        title="Scegli le colonne da mostrare"
      >
        <Columns3 size={16} />
        Colonne
        {hiddenCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-800 px-1 text-[10px] font-bold text-white">
            {hiddenCount}
          </span>
        )}
      </AppButton>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-xl p-2">
          <div className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Colonne visibili
          </div>

          <div className="max-h-72 overflow-auto">
            {TABLE_COLUMNS.map((col) => (
              <label
                key={col.key}
                className="flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={visibility[col.key]}
                  onChange={() => toggleColumn(col.key)}
                  className="rounded"
                />
                <span className="text-xs font-semibold text-slate-700">
                  {col.label}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-1 border-t border-gray-100 pt-2 px-2">
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_COLUMN_VISIBILITY })}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
            >
              Mostra tutte
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectModal({
  isOpen,
  mode,
  form,
  clienti,
  isEsselunga,
  saving,
  activeStepColumns,
  onClose,
  onSubmit,
  onChange,
  errorMessage,
  invalidFields,
}: {
  isOpen: boolean;
  mode: "create" | "edit";
  form: FormState;
  clienti: ClienteRecord[];
  isEsselunga: boolean;
  saving: boolean;
  activeStepColumns: readonly StepColumn[];
  onClose: () => void;
  onSubmit: () => void;
  onChange: (patch: Partial<FormState>) => void;
  errorMessage: string | null;
  invalidFields: string[];
}) {
  const [showStepsAnyway, setShowStepsAnyway] = useState(false);

  useEffect(() => {
    if (!isOpen) setShowStepsAnyway(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const isDocumentoSostituito = form.step_documento_operativo === "Sostituito";

  const documentoStepColumn = activeStepColumns.find(
    (col) => col.key === "step_documento_operativo",
  );

  const otherStepColumns = activeStepColumns.filter(
    (col) => col.key !== "step_documento_operativo",
  );

  const handleSetAllStepsSostituito = () => {
    const patch = otherStepColumns.reduce((acc, col) => {
      acc[col.key] = col.mode === "multi" ? ["Sostituito"] : "Sostituito";
      return acc;
    }, {} as Partial<StepFields>);

    onChange(patch as Partial<FormState>);
  };

  const renderStepRow = (col: StepColumn) => (
    <div
      key={col.key}
      className="grid grid-cols-1 lg:grid-cols-[280px_320px_1fr] gap-3 items-start rounded-xl border border-gray-200 bg-white px-4 py-4"
    >
      <div className="text-sm font-semibold text-slate-700 pt-2">
        {col.label}
      </div>

      <div>
        {col.mode === "multi" ? (
          <StepSelectMulti
            values={
              Array.isArray(form[col.key]) ? (form[col.key] as string[]) : []
            }
            options={col.options}
            onChange={(values) =>
              onChange({
                [col.key]: values,
              } as Partial<FormState>)
            }
          />
        ) : (
          <StepSelectSingle
            value={
              typeof form[col.key] === "string"
                ? (form[col.key] as string)
                : "Da Fare"
            }
            options={col.options}
            onChange={(value) =>
              onChange({
                [col.key]: value,
              } as Partial<FormState>)
            }
          />
        )}
      </div>

      <div>
        <textarea
          value={form[col.noteKey]}
          onChange={(e) =>
            onChange({
              [col.noteKey]: e.target.value,
            } as Partial<FormState>)
          }
          placeholder="Aggiungi note per questo step..."
          rows={2}
          className="w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none resize-none focus:ring-2 focus:ring-blue-100"
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <AppCard
        padded={false}
        className="flex w-full w-full max-h-[calc(90vh-100px)] flex-col overflow-hidden shadow-2xl"
      >
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {mode === "create" ? "Nuovo progetto" : "Modifica progetto"}
            </h2>
            <p className="text-xs text-slate-400">
              Gestisci evolutiva, change, documento, step e note operative
            </p>
          </div>

          <AppButton
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-10 w-10 p-0 flex items-center justify-center"
            title="Chiudi"
          >
            <X size={18} />
          </AppButton>
        </div>

        {errorMessage && (
          <div className="shrink-0 mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-8">
          <div>
            <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Nome evolutiva
            </label>
            <input
              value={form.nome_evolutiva}
              onChange={(e) => onChange({ nome_evolutiva: e.target.value })}
              placeholder="Nome evolutiva..."
              className={`w-full rounded-xl border px-4 py-3 text-2xl font-bold text-slate-800 outline-none focus:ring-2 ${
                invalidFields.includes("nome_evolutiva")
                  ? "border-red-400 bg-red-50 focus:ring-red-100"
                  : "border-gray-200 focus:ring-blue-100"
              }`}
            />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-slate-50/60 p-4">
            <div className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Dati principali
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Cliente
                </label>
                <select
                  value={form.cliente_id}
                  onChange={(e) =>
                    onChange({
                      cliente_id: e.target.value,
                      applicativo:
                        clienti.find((c) => c.id === e.target.value)?.nome ===
                        "Esselunga"
                          ? form.applicativo
                          : "",
                    })
                  }
                  className={`w-full rounded-xl border bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:ring-2 ${
                    invalidFields.includes("cliente_id")
                      ? "border-red-400 bg-red-50 focus:ring-red-100"
                      : "border-gray-200 focus:ring-blue-100"
                  }`}
                >
                  <option value="">Seleziona cliente</option>
                  {clienti.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Applicativo
                </label>
                {isEsselunga ? (
                  <select
                    value={form.applicativo}
                    onChange={(e) => onChange({ applicativo: e.target.value })}
                    className={`w-full rounded-xl border bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:ring-2 ${
                      invalidFields.includes("applicativo")
                        ? "border-red-400 bg-red-50 focus:ring-red-100"
                        : "border-gray-200 focus:ring-blue-100"
                    }`}
                  >
                    <option value="">Seleziona applicativo</option>
                    {ESSELUNGA_APPS.map((app) => (
                      <option key={app} value={app}>
                        {app}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-3 text-xs font-bold text-slate-400">
                    Disponibile solo per Esselunga
                  </div>
                )}
              </div>

              <div>
                <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Versione
                </label>
                <input
                  value={form.versione}
                  onChange={(e) => onChange({ versione: e.target.value })}
                  placeholder="Versione"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Numero change
                </label>
                <input
                  value={form.numero_change}
                  onChange={(e) => onChange({ numero_change: e.target.value })}
                  placeholder="Change"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="md:col-span-2 xl:col-span-2">
                <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Link documento
                </label>
                <input
                  value={form.document_link}
                  onChange={(e) => onChange({ document_link: e.target.value })}
                  placeholder="Link documento"
                  className={`w-full rounded-xl border bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:ring-2 ${
                    invalidFields.includes("document_link")
                      ? "border-red-400 bg-red-50 focus:ring-red-100"
                      : "border-gray-200 focus:ring-blue-100"
                  }`}
                />
              </div>

              <div className="md:col-span-2 xl:col-span-3">
                <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Note generali
                </label>
                <textarea
                  value={form.note_generali}
                  onChange={(e) => onChange({ note_generali: e.target.value })}
                  placeholder="Note generali del documento..."
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none resize-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-slate-50/60 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Sviluppo
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Elenca cosa dovrà essere sviluppato in questo documento, con lo stato di ciascuna voce
                </p>
              </div>

              <AppButton
                type="button"
                variant="secondary"
                onClick={() =>
                  onChange({
                    sviluppo_voci: [...form.sviluppo_voci, createSviluppoVoce()],
                  })
                }
                className="inline-flex items-center gap-2 shrink-0"
              >
                <Plus size={14} />
                Aggiungi Sviluppo
              </AppButton>
            </div>

            {form.sviluppo_voci.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm font-bold text-slate-400">
                Nessuna voce di sviluppo. Aggiungine una con &quot;Aggiungi Sviluppo&quot;.
              </div>
            ) : (
              <div className="space-y-3">
                {form.sviluppo_voci.map((voce, index) => (
                  <div
                    key={voce.id}
                    className="grid grid-cols-1 lg:grid-cols-[1fr_220px_220px_44px] gap-3 items-start rounded-xl border border-gray-200 bg-white px-4 py-4"
                  >
                    <div>
                      <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Cosa dovrà essere sviluppato
                      </label>
                      <textarea
                        value={voce.descrizione}
                        onChange={(e) =>
                          onChange({
                            sviluppo_voci: form.sviluppo_voci.map((v, i) =>
                              i === index
                                ? { ...v, descrizione: e.target.value }
                                : v,
                            ),
                          })
                        }
                        placeholder="Descrivi questa voce di sviluppo..."
                        rows={2}
                        className="w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none resize-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div>
                      <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Stato
                      </label>
                      <StepSelectSingle
                        value={voce.stato}
                        options={SVILUPPO_STATI}
                        onChange={(value) =>
                          onChange({
                            sviluppo_voci: form.sviluppo_voci.map((v, i) =>
                              i === index ? { ...v, stato: value } : v,
                            ),
                          })
                        }
                      />
                    </div>

                    <div>
                      {voce.stato === "Sostituito" && (
                        <>
                          <label className="block mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Sostituito dal documento n°
                          </label>
                          <input
                            value={voce.sostituito_da}
                            onChange={(e) =>
                              onChange({
                                sviluppo_voci: form.sviluppo_voci.map((v, i) =>
                                  i === index
                                    ? { ...v, sostituito_da: e.target.value }
                                    : v,
                                ),
                              })
                            }
                            placeholder="Es. 12"
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                          />
                        </>
                      )}
                    </div>

                    <div className="flex justify-end lg:justify-center pt-6">
                      <AppButton
                        type="button"
                        variant="danger"
                        onClick={() =>
                          onChange({
                            sviluppo_voci: form.sviluppo_voci.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                        className="h-9 w-9 p-0 flex items-center justify-center"
                        title="Rimuovi voce"
                      >
                        <Trash2 size={14} />
                      </AppButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Workflow</h3>
                <p className="text-xs text-slate-400">
                  Mostra solo gli step attivi per il cliente selezionato
                </p>
              </div>

              {isDocumentoSostituito && otherStepColumns.length > 0 && (
                <AppButton
                  type="button"
                  variant="secondary"
                  onClick={handleSetAllStepsSostituito}
                  className="inline-flex items-center gap-2 shrink-0"
                >
                  <Send size={14} />
                  Imposta tutti gli step su Sostituito
                </AppButton>
              )}
            </div>

            {!form.cliente_id ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-400">
                Seleziona un cliente per visualizzare il flusso progetto
              </div>
            ) : activeStepColumns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-400">
                Nessuno step attivo per questo cliente
              </div>
            ) : (
              <div className="space-y-3">
                {documentoStepColumn && renderStepRow(documentoStepColumn)}

                {otherStepColumns.length > 0 &&
                  (isDocumentoSostituito && !showStepsAnyway ? (
                    <button
                      type="button"
                      onClick={() => setShowStepsAnyway(true)}
                      className="w-full rounded-xl border border-dashed border-blue-200 bg-blue-50 px-4 py-4 text-center text-xs font-bold text-blue-600 hover:bg-blue-100"
                    >
                      Documento sostituito — {otherStepColumns.length} step
                      nascosti. Mostra comunque
                    </button>
                  ) : (
                    <>
                      {isDocumentoSostituito && (
                        <button
                          type="button"
                          onClick={() => setShowStepsAnyway(false)}
                          className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
                        >
                          Nascondi step
                        </button>
                      )}
                      {otherStepColumns.map((col) => renderStepRow(col))}
                    </>
                  ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <AppButton type="button" variant="secondary" onClick={onClose}>
              Annulla
            </AppButton>

            <AppButton
              type="button"
              onClick={onSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={16} />
              {mode === "create" ? "Salva" : "Aggiorna"}
            </AppButton>
          </div>
        </div>
      </AppCard>
    </div>
  );
}

export default function OperationalProjectsPage() {
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(
    null,
  );
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [clienti, setClienti] = useState<ClienteRecord[]>([]);
  const [clienteFlows, setClienteFlows] = useState<ClienteFlowMap>({});
  const [records, setRecords] = useState<OperationalProjectRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showLatest, setShowLatest] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  const [filterClienteId, setFilterClienteId] = useState("");
  const [filterApplicativo, setFilterApplicativo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(
    DEFAULT_COLUMN_VISIBILITY,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem(
        COLUMN_VISIBILITY_STORAGE_KEY,
      );
      if (!stored) return;

      const parsed = JSON.parse(stored);
      setColumnVisibility({ ...DEFAULT_COLUMN_VISIBILITY, ...parsed });
    } catch (err) {
      console.error("Errore lettura preferenze colonne:", err);
    }
  }, []);

  const handleColumnVisibilityChange = useCallback(
    (next: ColumnVisibility) => {
      setColumnVisibility(next);

      if (typeof window === "undefined") return;

      try {
        window.localStorage.setItem(
          COLUMN_VISIBILITY_STORAGE_KEY,
          JSON.stringify(next),
        );
      } catch (err) {
        console.error("Errore salvataggio preferenze colonne:", err);
      }
    },
    [],
  );

  const [expandedStepRows, setExpandedStepRows] = useState<Set<string>>(
    new Set(),
  );

  const toggleExpandedStepRow = useCallback((recordId: string) => {
    setExpandedStepRows((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  }, []);

  const getActiveStepColumns = useCallback(
    (clienteId: string) => {
      const activeSteps = clienteFlows[clienteId];

      if (!clienteId) return [];
      if (!activeSteps || activeSteps.length === 0) return STEP_COLUMNS;

      return STEP_COLUMNS.filter((col) => activeSteps.includes(col.key));
    },
    [clienteFlows],
  );

  const selectedCreateCliente = useMemo(
    () => clienti.find((c) => c.id === createForm.cliente_id) || null,
    [clienti, createForm.cliente_id],
  );

  const selectedEditCliente = useMemo(
    () => clienti.find((c) => c.id === editForm.cliente_id) || null,
    [clienti, editForm.cliente_id],
  );

  const selectedFilterCliente = useMemo(
    () => clienti.find((c) => c.id === filterClienteId) || null,
    [clienti, filterClienteId],
  );

  const isEsselungaCreate = selectedCreateCliente?.nome === "Esselunga";
  const isEsselungaEdit = selectedEditCliente?.nome === "Esselunga";
  const isEsselungaFilter = selectedFilterCliente?.nome === "Esselunga";

  const normalizeRecord = useCallback((item: any): OperationalProjectRecord => {
    const stepValues = STEP_COLUMNS.reduce((acc, col) => {
      const raw = item[col.key];

      if (col.mode === "multi") {
        acc[col.key] = Array.isArray(raw) ? raw : [];
      } else {
        acc[col.key] = typeof raw === "string" && raw ? raw : "Da Fare";
      }

      return acc;
    }, {} as StepFields);

    const stepNotes = STEP_COLUMNS.reduce((acc, col) => {
      acc[col.noteKey] = String(item[col.noteKey] || "");
      return acc;
    }, {} as StepNoteFields);

    return {
      id: item.id,
      cliente_id: item.cliente_id,
      cliente_nome: item.clienti?.nome || "—",
      applicativo: item.applicativo || null,
      versione: item.versione || null,
      nome_evolutiva: item.nome_evolutiva || "",
      numero_change: item.numero_change || null,
      document_link: item.document_link || "",
      note_generali: item.note_generali || "",
      sviluppo_voci: Array.isArray(item.sviluppo_voci)
        ? item.sviluppo_voci.map((voce: any) => ({
            id: String(voce?.id || createSviluppoVoce().id),
            descrizione: String(voce?.descrizione || ""),
            stato: String(voce?.stato || "Non Sviluppato"),
            sostituito_da: String(voce?.sostituito_da || ""),
          }))
        : [],
      created_at: item.created_at,
      updated_at: item.updated_at,
      ...stepValues,
      ...stepNotes,
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const [clientiRes, docsRes, flowsRes] = await Promise.all([
      supabase
        .from("clienti")
        .select("id, nome")
        .order("nome", { ascending: true }),

      supabase
        .from("documenti_operativi")
        .select(
          `
            id,
            cliente_id,
            applicativo,
            versione,
            nome_evolutiva,
            numero_change,
            document_link,
            note_generali,
            sviluppo_voci,
            created_at,
            updated_at,
            step_documento_operativo,
            step_gtm_ga4_coll,
            step_sviluppo_testing_coll,
            step_gtm_ga4_prod,
            step_sviluppo_testing_prod,
            step_ga4_realtime_rilascio,
            step_report_manutenzione,
            step_modello_dati_bq,
            step_modello_dati,
            step_doc_confronto_applicativi,
            step_report_business,
            step_powerbi,
            note_step_documento_operativo,
            note_step_gtm_ga4_coll,
            note_step_sviluppo_testing_coll,
            note_step_gtm_ga4_prod,
            note_step_sviluppo_testing_prod,
            note_step_ga4_realtime_rilascio,
            note_step_report_manutenzione,
            note_step_modello_dati_bq,
            note_step_modello_dati,
            note_step_doc_confronto_applicativi,
            note_step_report_business,
            note_step_powerbi,
            clienti:cliente_id ( nome )
          `,
        )
        .order("updated_at", { ascending: false }),

      supabase.from("clienti_flusso_progetto").select("cliente_id, steps"),
    ]);

    if (clientiRes.error) {
      console.error("Errore caricamento clienti:", clientiRes.error);
      setErrorMessage("Errore durante il caricamento dei clienti.");
    } else {
      setClienti(
        (clientiRes.data || []).map((item: any) => ({
          id: item.id,
          nome: String(item.nome || "").trim(),
        })),
      );
    }

    if (docsRes.error) {
      console.error("Errore caricamento documenti operativi:", docsRes.error);
      setErrorMessage("Errore durante il caricamento dei progetti.");
    } else {
      setRecords((docsRes.data || []).map(normalizeRecord));
    }

    if (flowsRes.error) {
      console.error("Errore caricamento flussi cliente:", flowsRes.error);
    } else {
      const mappedFlows = (flowsRes.data || []).reduce((acc, item: any) => {
        acc[item.cliente_id] = Array.isArray(item.steps) ? item.steps : [];
        return acc;
      }, {} as ClienteFlowMap);

      setClienteFlows(mappedFlows);
    }

    setLoading(false);
  }, [normalizeRecord]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeTable({
    supabase,
    table: "documenti_operativi",
    onChange: () => {
      void loadData();
    },
  });

  useRealtimeTable({
    supabase,
    table: "clienti_flusso_progetto",
    onChange: () => {
      void loadData();
    },
  });

  useEffect(() => {
    if (!isEsselungaFilter) {
      setFilterApplicativo("");
    }
  }, [isEsselungaFilter]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();

    return records.filter((row) => {
      const matchesSearch =
        !q ||
        [
          row.cliente_nome,
          row.applicativo || "",
          row.versione || "",
          row.nome_evolutiva,
          row.numero_change || "",
          row.document_link,
          row.note_generali || "",
          row.sviluppo_voci
            .map((v) => `${v.descrizione} ${v.sostituito_da}`)
            .join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesCliente =
        !filterClienteId || row.cliente_id === filterClienteId;

      const matchesApplicativo =
        !filterApplicativo ||
        (row.applicativo || "").toLowerCase() ===
          filterApplicativo.toLowerCase();

      return matchesSearch && matchesCliente && matchesApplicativo;
    });
  }, [records, search, filterClienteId, filterApplicativo]);

  const sortedRecords = useMemo(() => {
    const arr = [...filteredRecords];

    arr.sort((a, b) => {
      let compare = 0;

      switch (sortKey) {
        case "cliente_nome":
          compare = a.cliente_nome.localeCompare(b.cliente_nome, "it", {
            sensitivity: "base",
          });
          break;
        case "applicativo":
          compare = (a.applicativo || "").localeCompare(
            b.applicativo || "",
            "it",
            {
              sensitivity: "base",
            },
          );
          break;
        case "versione":
          compare = compareVersions(a.versione, b.versione);
          break;
        case "nome_evolutiva":
          compare = a.nome_evolutiva.localeCompare(b.nome_evolutiva, "it", {
            sensitivity: "base",
          });
          break;
        case "numero_change":
          compare = (a.numero_change || "").localeCompare(
            b.numero_change || "",
            "it",
            {
              sensitivity: "base",
            },
          );
          break;
        case "updated_at":
          compare =
            new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        default:
          compare = 0;
      }

      return sortDirection === "asc" ? compare : -compare;
    });

    return arr;
  }, [filteredRecords, sortKey, sortDirection]);

  const latestDocuments = useMemo(() => {
    const grouped = sortedRecords.reduce<
      Record<string, OperationalProjectRecord>
    >((acc, r) => {
      const key = `${r.cliente_nome}__${r.applicativo || "NA"}`;

      if (!acc[key] || compareVersions(r.versione, acc[key].versione) > 0) {
        acc[key] = r;
      }

      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => {
      const byClient = a.cliente_nome.localeCompare(b.cliente_nome);
      if (byClient !== 0) return byClient;
      return (a.applicativo || "").localeCompare(b.applicativo || "");
    });
  }, [sortedRecords]);

  const openCreateModal = useCallback(() => {
    setCreateForm(EMPTY_FORM);
    setEditingId(null);
    setErrorMessage(null);
    setModalMode("create");
    setModalErrorMessage(null);
    setInvalidFields([]);
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
    setEditingId(null);
    setModalErrorMessage(null);
    setInvalidFields([]);
  }, []);

  const startEdit = useCallback((record: OperationalProjectRecord) => {
    setEditingId(record.id);

    setEditForm({
      cliente_id: record.cliente_id,
      applicativo: record.applicativo || "",
      versione: record.versione || "",
      nome_evolutiva: record.nome_evolutiva,
      numero_change: record.numero_change || "",
      document_link: record.document_link,
      note_generali: record.note_generali || "",
      sviluppo_voci: record.sviluppo_voci.map((voce) => ({ ...voce })),

      step_documento_operativo: record.step_documento_operativo,
      step_gtm_ga4_coll: Array.isArray(record.step_gtm_ga4_coll)
        ? record.step_gtm_ga4_coll
        : [],
      step_sviluppo_testing_coll: record.step_sviluppo_testing_coll,
      step_gtm_ga4_prod: Array.isArray(record.step_gtm_ga4_prod)
        ? record.step_gtm_ga4_prod
        : [],
      step_sviluppo_testing_prod: record.step_sviluppo_testing_prod,
      step_ga4_realtime_rilascio: record.step_ga4_realtime_rilascio,
      step_report_manutenzione: record.step_report_manutenzione,
      step_modello_dati: record.step_modello_dati,
      step_modello_dati_bq: record.step_modello_dati_bq,
      step_doc_confronto_applicativi: record.step_doc_confronto_applicativi,
      step_report_business: record.step_report_business,
      step_powerbi: record.step_powerbi,

      note_step_documento_operativo: record.note_step_documento_operativo,
      note_step_gtm_ga4_coll: record.note_step_gtm_ga4_coll,
      note_step_sviluppo_testing_coll: record.note_step_sviluppo_testing_coll,
      note_step_gtm_ga4_prod: record.note_step_gtm_ga4_prod,
      note_step_sviluppo_testing_prod: record.note_step_sviluppo_testing_prod,
      note_step_ga4_realtime_rilascio: record.note_step_ga4_realtime_rilascio,
      note_step_report_manutenzione: record.note_step_report_manutenzione,
      note_step_modello_dati: record.note_step_modello_dati,
      note_step_modello_dati_bq: record.note_step_modello_dati_bq,
      note_step_doc_confronto_applicativi:
        record.note_step_doc_confronto_applicativi,
      note_step_report_business: record.note_step_report_business,
      note_step_powerbi: record.note_step_powerbi,
    });

    setErrorMessage(null);
    setModalMode("edit");
    setModalErrorMessage(null);
    setInvalidFields([]);
  }, []);

  const validateForm = useCallback((form: FormState, isEsselunga: boolean) => {
    const errors: string[] = [];
    const fields: string[] = [];

    if (!form.cliente_id) {
      errors.push("Seleziona un cliente");
      fields.push("cliente_id");
    }

    if (!form.nome_evolutiva.trim()) {
      errors.push("Inserisci il nome dell’evolutiva");
      fields.push("nome_evolutiva");
    }

    if (!form.document_link.trim()) {
      errors.push("Inserisci il link del documento operativo");
      fields.push("document_link");
    }

    if (isEsselunga && !form.applicativo.trim()) {
      errors.push("Seleziona l’applicativo per Esselunga");
      fields.push("applicativo");
    }

    return {
      message: errors.length > 0 ? errors.join(" • ") : null,
      fields,
    };
  }, []);

  const getStepPayload = useCallback(
    (form: FormState, activeColumns: readonly StepColumn[]) => {
      const stepPayload = activeColumns.reduce((acc, col) => {
        acc[col.key] = form[col.key];
        return acc;
      }, {} as Partial<StepFields>);

      const notesPayload = activeColumns.reduce((acc, col) => {
        acc[col.noteKey] = form[col.noteKey];
        return acc;
      }, {} as Partial<StepNoteFields>);

      return {
        ...stepPayload,
        ...notesPayload,
      };
    },
    [],
  );

  const handleCreate = useCallback(async () => {
    const validation = validateForm(createForm, isEsselungaCreate);

    if (validation.message) {
      setModalErrorMessage(validation.message);
      setInvalidFields(validation.fields);
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      const activeStepColumns = getActiveStepColumns(createForm.cliente_id);

      const payload = {
        cliente_id: createForm.cliente_id,
        applicativo: isEsselungaCreate
          ? createForm.applicativo.trim() || null
          : null,
        versione: createForm.versione.trim() || null,
        nome_evolutiva: createForm.nome_evolutiva.trim(),
        numero_change: createForm.numero_change.trim() || null,
        document_link: normalizeUrl(createForm.document_link),
        note_generali: createForm.note_generali.trim() || null,
        sviluppo_voci: normalizeSviluppoVoci(createForm.sviluppo_voci),
        ...getStepPayload(createForm, activeStepColumns),
      };

      const { data, error } = await supabase
        .from("documenti_operativi")
        .insert(payload)
        .select(
          `
            id,
            cliente_id,
            applicativo,
            versione,
            nome_evolutiva,
            numero_change,
            document_link,
            note_generali,
            sviluppo_voci,
            created_at,
            updated_at,
            step_documento_operativo,
            step_gtm_ga4_coll,
            step_sviluppo_testing_coll,
            step_gtm_ga4_prod,
            step_sviluppo_testing_prod,
            step_ga4_realtime_rilascio,
            step_report_manutenzione,
            step_modello_dati,
            step_modello_dati_bq,
            step_doc_confronto_applicativi,
            step_report_business,
            step_powerbi,
            note_step_documento_operativo,
            note_step_gtm_ga4_coll,
            note_step_sviluppo_testing_coll,
            note_step_gtm_ga4_prod,
            note_step_sviluppo_testing_prod,
            note_step_ga4_realtime_rilascio,
            note_step_report_manutenzione,
            note_step_modello_dati,
            note_step_modello_dati_bq,
            note_step_doc_confronto_applicativi,
            note_step_report_business,
            note_step_powerbi,
            clienti:cliente_id ( nome )
          `,
        )
        .single();

      if (error) {
        console.error("Errore creazione progetto:", error);
        setErrorMessage("Errore durante il salvataggio del progetto.");
        return;
      }

      setRecords((prev) => [normalizeRecord(data), ...prev]);
      closeModal();
      setCreateForm(EMPTY_FORM);
    } catch (err) {
      console.error("Errore handleCreate:", err);
      setErrorMessage("Errore imprevisto durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  }, [
    closeModal,
    createForm,
    getActiveStepColumns,
    getStepPayload,
    isEsselungaCreate,
    normalizeRecord,
    validateForm,
  ]);

  const handleUpdate = useCallback(async () => {
    if (!editingId) return;

    const validation = validateForm(editForm, isEsselungaEdit);

    if (validation.message) {
      setModalErrorMessage(validation.message);
      setInvalidFields(validation.fields);
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      const activeStepColumns = getActiveStepColumns(editForm.cliente_id);

      const payload = {
        cliente_id: editForm.cliente_id,
        applicativo: isEsselungaEdit
          ? editForm.applicativo.trim() || null
          : null,
        versione: editForm.versione.trim() || null,
        nome_evolutiva: editForm.nome_evolutiva.trim(),
        numero_change: editForm.numero_change.trim() || null,
        document_link: normalizeUrl(editForm.document_link),
        note_generali: editForm.note_generali.trim() || null,
        sviluppo_voci: normalizeSviluppoVoci(editForm.sviluppo_voci),
        updated_at: new Date().toISOString(),
        ...getStepPayload(editForm, activeStepColumns),
      };

      const { data, error } = await supabase
        .from("documenti_operativi")
        .update(payload)
        .eq("id", editingId)
        .select(
          `
            id,
            cliente_id,
            applicativo,
            versione,
            nome_evolutiva,
            numero_change,
            document_link,
            note_generali,
            sviluppo_voci,
            created_at,
            updated_at,
            step_documento_operativo,
            step_gtm_ga4_coll,
            step_sviluppo_testing_coll,
            step_gtm_ga4_prod,
            step_sviluppo_testing_prod,
            step_ga4_realtime_rilascio,
            step_report_manutenzione,
            step_modello_dati,
            step_modello_dati_bq,
            step_doc_confronto_applicativi,
            step_report_business,
            step_powerbi,
            note_step_documento_operativo,
            note_step_gtm_ga4_coll,
            note_step_sviluppo_testing_coll,
            note_step_gtm_ga4_prod,
            note_step_sviluppo_testing_prod,
            note_step_ga4_realtime_rilascio,
            note_step_report_manutenzione,
            note_step_modello_dati,
            note_step_modello_dati_bq,
            note_step_doc_confronto_applicativi,
            note_step_report_business,
            note_step_powerbi,
            clienti:cliente_id ( nome )
          `,
        )
        .single();

      if (error) {
        console.error("Errore aggiornamento progetto:", error);
        setErrorMessage("Errore durante l’aggiornamento del progetto.");
        return;
      }

      setRecords((prev) =>
        prev.map((row) => (row.id === editingId ? normalizeRecord(data) : row)),
      );
      closeModal();
    } catch (err) {
      console.error("Errore handleUpdate:", err);
      setErrorMessage("Errore imprevisto durante l’aggiornamento.");
    } finally {
      setSaving(false);
    }
  }, [
    closeModal,
    editForm,
    editingId,
    getActiveStepColumns,
    getStepPayload,
    isEsselungaEdit,
    normalizeRecord,
    validateForm,
  ]);

  const handleDelete = useCallback(async (recordId: string) => {
    try {
      setSaving(true);
      setErrorMessage(null);

      const { error } = await supabase
        .from("documenti_operativi")
        .delete()
        .eq("id", recordId);

      if (error) {
        console.error("Errore eliminazione progetto:", error);
        setErrorMessage("Errore durante l’eliminazione del progetto.");
        return;
      }

      setRecords((prev) => prev.filter((row) => row.id !== recordId));
    } catch (err) {
      console.error("Errore handleDelete:", err);
      setErrorMessage("Errore imprevisto durante l’eliminazione.");
    } finally {
      setSaving(false);
    }
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDirection((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevKey;
      }

      setSortDirection("asc");
      return key;
    });
  }, []);

  if (loading) {
    return (
      <AppPage
        title="PROGETTI OPERATIVI"
        subtitle="Archivio documenti e evolutive"
        icon={<FileChartColumnIncreasing size={22} />}
        maxWidth="full"
      >
        <AppCard className="h-[300px] flex items-center justify-center">
          <div className="text-sm font-bold text-slate-400">
            Caricamento progetti...
          </div>
        </AppCard>
      </AppPage>
    );
  }

  return (
    <AppPage
      title="PROGETTI OPERATIVI"
      subtitle={`Archivio documenti e evolutive. N Doc: ${sortedRecords.length}`}
      icon={<FileChartColumnIncreasing size={22} />}
      maxWidth="full"
      actions={
        <div className="flex items-center gap-2">
          <ColumnVisibilityMenu
            visibility={columnVisibility}
            onChange={handleColumnVisibilityChange}
          />

          <AppButton
            type="button"
            onClick={openCreateModal}
            className="h-11 w-11 p-0 flex items-center justify-center"
            title="Aggiungi progetto"
          >
            <Plus size={18} />
          </AppButton>
        </div>
      }
    >
      <div className="space-y-6">
        <AppCard>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_280px_1fr]">
            <select
              value={filterClienteId}
              onChange={(e) => setFilterClienteId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Tutti i clienti</option>
              {clienti.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>

            {isEsselungaFilter ? (
              <select
                value={filterApplicativo}
                onChange={(e) => setFilterApplicativo(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Tutti gli applicativi</option>
                {ESSELUNGA_APPS.map((app) => (
                  <option key={app} value={app}>
                    {app}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-slate-50 px-3 py-3 text-xs font-bold text-slate-400">
                Disponibile solo selezionando Esselunga
              </div>
            )}

            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-[12px] font-bold shadow-sm">
              <Search size={15} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca cliente / evolutiva / change..."
                className="w-full bg-transparent text-[12px] font-bold text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        </AppCard>

        {errorMessage && (
          <AppCard className="border-red-200 bg-red-50 text-sm font-bold text-red-700">
            {errorMessage}
          </AppCard>
        )}

        <AppCard padded={false} className="overflow-hidden">
          <button
            type="button"
            onClick={() => setShowLatest((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <ExternalLink size={16} style={{ color: BRAND }} />
              <span
                className="text-xs font-black uppercase"
                style={{ color: BRAND }}
              >
                Ultimi documenti consegnati
              </span>
            </div>

            {showLatest ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showLatest && (
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-3">
                {latestDocuments.length > 0 ? (
                  latestDocuments.map((r) => (
                    <a
                      key={r.id}
                      href={r.document_link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:text-[#ffffff]"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = BRAND;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "white";
                      }}
                    >
                      <ExternalLink size={14} />
                      {r.cliente_nome}
                      {r.applicativo ? ` - ${r.applicativo}` : ""}
                      {r.versione ? ` (v${r.versione})` : ""}
                    </a>
                  ))
                ) : (
                  <div className="text-sm font-bold text-slate-400">
                    Nessun documento disponibile
                  </div>
                )}
              </div>
            </div>
          )}
        </AppCard>

        <AppCard padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead style={{ background: BRAND_BG, color: BRAND }}>
                <tr>
                  {columnVisibility.cliente && (
                    <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                      <SortHeader
                        label="Cliente"
                        sortKey="cliente_nome"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                  )}
                  {columnVisibility.applicativo && (
                    <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                      <SortHeader
                        label="Applicativo"
                        sortKey="applicativo"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                  )}
                  {columnVisibility.versione && (
                    <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                      <SortHeader
                        label="Versione"
                        sortKey="versione"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                  )}
                  {columnVisibility.nome_evolutiva && (
                    <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                      <SortHeader
                        label="Nome evolutiva"
                        sortKey="nome_evolutiva"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                  )}
                  {columnVisibility.numero_change && (
                    <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                      <SortHeader
                        label="Numero change"
                        sortKey="numero_change"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                  )}
                  {columnVisibility.documento && (
                    <th className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest">
                      Documento
                    </th>
                  )}
                  {columnVisibility.sviluppo && (
                    <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                      Sviluppo
                    </th>
                  )}
                  {columnVisibility.step_workflow && (
                    <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">
                      Step Workflow
                    </th>
                  )}
                  <th className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-widest">
                    <SortHeader
                      label="Azioni"
                      sortKey="updated_at"
                      currentSortKey={sortKey}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                      align="right"
                    />
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="border-t border-gray-100 align-top hover:bg-slate-50"
                  >
                    {columnVisibility.cliente && (
                      <td className="px-4 py-4 font-bold text-slate-700">
                        {record.cliente_nome}
                      </td>
                    )}
                    {columnVisibility.applicativo && (
                      <td className="px-4 py-4 font-bold text-slate-700">
                        {record.applicativo || "—"}
                      </td>
                    )}
                    {columnVisibility.versione && (
                      <td className="px-4 py-4 font-bold text-slate-700">
                        {record.versione || "—"}
                      </td>
                    )}
                    {columnVisibility.nome_evolutiva && (
                      <td className="px-4 py-4">
                        <div className="font-black leading-tight text-slate-800">
                          {record.nome_evolutiva}
                        </div>
                        {record.note_generali && (
                          <div className="mt-1 max-w-md truncate text-[11px] font-semibold text-slate-400">
                            {record.note_generali}
                          </div>
                        )}
                      </td>
                    )}
                    {columnVisibility.numero_change && (
                      <td className="px-4 py-4 font-bold text-slate-700">
                        {record.numero_change || "—"}
                      </td>
                    )}
                    {columnVisibility.documento && (
                      <td className="px-4 py-4 text-center">
                        <a
                          href={record.document_link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-gray-200 bg-white text-slate-600 transition-colors hover:text-[#ffffff]"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = BRAND;
                            e.currentTarget.style.borderColor = BRAND;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "white";
                            e.currentTarget.style.borderColor = "#e5e7eb";
                          }}
                          title="Apri documento"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </td>
                    )}
                    {columnVisibility.sviluppo && (
                      <td className="px-4 py-4">
                        {record.sviluppo_voci.length === 0 ? (
                          <span className="text-[11px] font-bold text-slate-300">
                            —
                          </span>
                        ) : (
                          <div
                            className="flex flex-wrap gap-1.5"
                            title={record.sviluppo_voci
                              .map((v) => `${v.stato}: ${v.descrizione}`)
                              .join("\n")}
                          >
                            {(() => {
                              const counts = getSviluppoCounts(
                                record.sviluppo_voci,
                              );

                              return (
                                <>
                                  {counts.sviluppati > 0 && (
                                    <span
                                      className={`inline-flex px-2 py-1 rounded-[8px] text-[11px] font-bold ${getStepBadgeClass(
                                        "Sviluppato",
                                      )}`}
                                    >
                                      {counts.sviluppati} Sviluppati
                                    </span>
                                  )}
                                  {counts.nonSviluppati > 0 && (
                                    <span
                                      className={`inline-flex px-2 py-1 rounded-[8px] text-[11px] font-bold ${getStepBadgeClass(
                                        "Non Sviluppato",
                                      )}`}
                                    >
                                      {counts.nonSviluppati} Non Sviluppati
                                    </span>
                                  )}
                                  {counts.sostituiti > 0 && (
                                    <span
                                      className={`inline-flex px-2 py-1 rounded-[8px] text-[11px] font-bold ${getStepBadgeClass(
                                        "Sostituito",
                                      )}`}
                                    >
                                      {counts.sostituiti} Sostituiti
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </td>
                    )}
                    {columnVisibility.step_workflow && (
                      <td className="px-4 py-4">
                        {record.step_documento_operativo === "Sostituito" &&
                        !expandedStepRows.has(record.id) ? (
                          <button
                            type="button"
                            onClick={() => toggleExpandedStepRow(record.id)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-[8px] text-[11px] font-bold ${getStepBadgeClass(
                              "Sostituito",
                            )}`}
                            title="Documento sostituito — clicca per mostrare gli step"
                          >
                            Sostituito
                          </button>
                        ) : (
                          <div className="flex flex-wrap items-start gap-2">
                            <StepIconsSummary
                              record={record}
                              activeColumns={getActiveStepColumns(
                                record.cliente_id,
                              )}
                            />
                            {record.step_documento_operativo ===
                              "Sostituito" && (
                              <button
                                type="button"
                                onClick={() =>
                                  toggleExpandedStepRow(record.id)
                                }
                                className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                                title="Nascondi step"
                              >
                                Nascondi
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <AppButton
                          type="button"
                          onClick={() => startEdit(record)}
                          className="h-10 w-10 p-0 flex items-center justify-center"
                          title="Modifica"
                        >
                          <Pencil size={15} />
                        </AppButton>
                        <AppButton
                          type="button"
                          variant="danger"
                          onClick={() => handleDelete(record.id)}
                          className="h-10 w-10 p-0 flex items-center justify-center"
                          title="Elimina"
                        >
                          <Trash2 size={15} />
                        </AppButton>
                      </div>
                    </td>
                  </tr>
                ))}

                {sortedRecords.length === 0 && (
                  <tr>
                    <td
                      colSpan={
                        TABLE_COLUMNS.filter((col) => columnVisibility[col.key])
                          .length + 1
                      }
                      className="px-4 py-10 text-center font-bold text-slate-400"
                    >
                      Nessun progetto salvato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AppCard>

        <ProjectModal
          isOpen={modalMode === "create"}
          mode="create"
          form={createForm}
          clienti={clienti}
          isEsselunga={Boolean(isEsselungaCreate)}
          saving={saving}
          activeStepColumns={getActiveStepColumns(createForm.cliente_id)}
          onClose={closeModal}
          onSubmit={handleCreate}
          onChange={(patch) => setCreateForm((prev) => ({ ...prev, ...patch }))}
          errorMessage={modalErrorMessage}
          invalidFields={invalidFields}
        />

        <ProjectModal
          isOpen={modalMode === "edit"}
          mode="edit"
          form={editForm}
          clienti={clienti}
          isEsselunga={Boolean(isEsselungaEdit)}
          saving={saving}
          activeStepColumns={getActiveStepColumns(editForm.cliente_id)}
          onClose={closeModal}
          onSubmit={handleUpdate}
          onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
          errorMessage={modalErrorMessage}
          invalidFields={invalidFields}
        />
      </div>
    </AppPage>
  );
}
