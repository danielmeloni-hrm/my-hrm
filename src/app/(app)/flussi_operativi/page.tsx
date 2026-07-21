"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  Filter,
  GitBranch,
  Image as ImageIcon,
  Link2,
  ListChecks,
  Loader2,
  Milestone,
  MoveHorizontal,
  MoveVertical,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  Undo2,
  Upload,
  Workflow,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import AppPage from "@/components/ui/AppPage";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

const supabase = createClient();

// --- Tipi ---

type ElementoTipo = "step" | "azione" | "decisione";

type LinkItem = { id: string; label: string; url: string };

type CampoItem = {
  id: string;
  label: string;
  /** A cosa serve il campo / come va valorizzato */
  descrizione: string;
  valore: string;
  /** "fisso" = il valore è sempre quello; "variabile" = può cambiare caso per caso */
  tipo_valore: "fisso" | "variabile";
};

type Ramo = {
  id: string;
  label: string;
  elementi: FlowElement[];
  /** Se valorizzato, questa strada torna a un elemento precedente (loop) */
  loop_to: string | null;
};

type FlowElement = {
  id: string;
  tipo: ElementoTipo;
  titolo: string;
  descrizione: string;
  descrizione_completa: string;
  /** Immagine (data URL ridimensionata o URL esterno) */
  immagine: string;
  links: LinkItem[];
  campi: CampoItem[];
  /** Solo per le decisioni: le strade in cui si divide il flusso */
  rami: Ramo[];
  /** Se valorizzato, la freccia in uscita punta a questo elemento (loop) */
  next_to: string | null;
};

type FlussoRecord = {
  id: string;
  nome: string;
  descrizione: string | null;
  cliente_id: string | null;
  elementi: FlowElement[];
  tags: string[];
  created_at?: string;
  updated_at?: string;
  clienti?: { id: string; nome: string } | null;
};

type ClienteOption = { id: string; nome: string };

// --- Costanti di stile per tipo elemento (colori base) ---

const TIPO_CONFIG: Record<
  ElementoTipo,
  {
    label: string;
    icon: typeof Zap;
    chip: string;
    iconBox: string;
    accent: string;
    headerGrad: string;
  }
> = {
  step: {
    label: "Step",
    icon: Milestone,
    chip: "bg-[#e6eef8] text-[#0150a0]",
    iconBox:
      "bg-gradient-to-br from-[#0150a0] to-[#013b76] text-[#ffffff] shadow-lg shadow-[#0150a0]/20",
    accent: "border-l-[#0150a0]",
    headerGrad: "from-[#eaf2fb] via-white to-white",
  },
  azione: {
    label: "Azione",
    icon: Zap,
    chip: "bg-emerald-50 text-emerald-700",
    iconBox:
      "bg-gradient-to-br from-emerald-500 to-emerald-700 text-[#ffffff] shadow-lg shadow-emerald-500/20",
    accent: "border-l-emerald-500",
    headerGrad: "from-emerald-50 via-white to-white",
  },
  decisione: {
    label: "Decisione",
    icon: GitBranch,
    chip: "bg-amber-50 text-amber-700",
    iconBox:
      "bg-gradient-to-br from-amber-400 to-amber-600 text-[#ffffff] shadow-lg shadow-amber-500/20",
    accent: "border-l-amber-400",
    headerGrad: "from-amber-50 via-white to-white",
  },
};

function newId() {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultRami(): Ramo[] {
  return [
    { id: newId(), label: "Sì", elementi: [], loop_to: null },
    { id: newId(), label: "No", elementi: [], loop_to: null },
  ];
}

function makeElement(tipo: ElementoTipo): FlowElement {
  return {
    id: newId(),
    tipo,
    titolo: `Nuovo ${TIPO_CONFIG[tipo].label.toLowerCase()}`,
    descrizione: "",
    descrizione_completa: "",
    immagine: "",
    links: [],
    campi: [],
    rami: tipo === "decisione" ? defaultRami() : [],
    next_to: null,
  };
}

function normalizeElement(raw: any): FlowElement {
  return {
    id: raw?.id || newId(),
    tipo: ["step", "azione", "decisione"].includes(raw?.tipo)
      ? raw.tipo
      : "step",
    titolo: raw?.titolo || "",
    descrizione: raw?.descrizione || "",
    descrizione_completa: raw?.descrizione_completa || "",
    immagine: raw?.immagine || "",
    links: Array.isArray(raw?.links)
      ? raw.links.map((l: any) => ({
          id: l?.id || newId(),
          label: l?.label || "",
          url: l?.url || "",
        }))
      : [],
    campi: Array.isArray(raw?.campi)
      ? raw.campi.map((c: any) => ({
          id: c?.id || newId(),
          label: c?.label || "",
          descrizione: c?.descrizione || "",
          valore: c?.valore || "",
          tipo_valore: c?.tipo_valore === "fisso" ? "fisso" : "variabile",
        }))
      : [],
    rami: Array.isArray(raw?.rami)
      ? raw.rami.map((r: any) => ({
          id: r?.id || newId(),
          label: r?.label || "",
          elementi: Array.isArray(r?.elementi)
            ? r.elementi.map(normalizeElement)
            : [],
          loop_to: r?.loop_to || null,
        }))
      : [],
    next_to: raw?.next_to || null,
  };
}

function normalizeFlusso(raw: any): FlussoRecord {
  return {
    ...raw,
    elementi: Array.isArray(raw?.elementi)
      ? raw.elementi.map(normalizeElement)
      : [],
    tags: Array.isArray(raw?.tags)
      ? raw.tags.map((t: any) => String(t)).filter(Boolean)
      : [],
  };
}

// --- Filtro percorso, export e immagini ---

/** Elenco piatto di tutti gli elementi (per i target dei loop) */
function flattenElements(
  list: FlowElement[]
): { id: string; titolo: string; tipo: ElementoTipo }[] {
  const out: { id: string; titolo: string; tipo: ElementoTipo }[] = [];

  const walk = (els: FlowElement[]) => {
    els.forEach((el) => {
      out.push({ id: el.id, titolo: el.titolo, tipo: el.tipo });
      el.rami.forEach((r) => walk(r.elementi));
    });
  };

  walk(list);
  return out;
}

/** Salti del flusso (next_to degli elementi + loop_to delle strade):
 *  coppie di id DOM sorgente → destinazione per disegnare le frecce */
function collectJumpLinks(
  list: FlowElement[]
): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];

  const walk = (els: FlowElement[]) => {
    els.forEach((el) => {
      if (el.next_to) {
        out.push({ from: `flow-jump-${el.id}`, to: `flow-el-${el.next_to}` });
      }
      el.rami.forEach((r) => {
        if (r.loop_to) {
          out.push({
            from: `flow-jump-ramo-${r.id}`,
            to: `flow-el-${r.loop_to}`,
          });
        }
        walk(r.elementi);
      });
    });
  };

  walk(list);
  return out;
}

/** Tutte le decisioni con strade, ovunque nell'albero (per il filtro) */
function collectDecisions(list: FlowElement[]): FlowElement[] {
  const out: FlowElement[] = [];

  const walk = (els: FlowElement[]) => {
    els.forEach((el) => {
      if (el.tipo === "decisione" && el.rami.length > 0) out.push(el);
      el.rami.forEach((r) => walk(r.elementi));
    });
  };

  walk(list);
  return out;
}

/** Applica il filtro percorso: tiene solo la strada scelta per ogni decisione */
function pruneByFilter(
  list: FlowElement[],
  filter: Record<string, string>
): FlowElement[] {
  return list.map((el) => ({
    ...el,
    rami: el.rami
      .filter((r) => !filter[el.id] || r.id === filter[el.id])
      .map((r) => ({ ...r, elementi: pruneByFilter(r.elementi, filter) })),
  }));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const PRINT_COLORS: Record<ElementoTipo, string> = {
  step: "#0150a0",
  azione: "#059669",
  decisione: "#f59e0b",
};

/** Conversione del flusso in testo per il file DOC:
 *  gli step/azioni sono passi numerati, le decisioni creano sotto-step */
function flowToDocHtml(
  elementi: FlowElement[],
  titles: Record<string, string> = {},
  prefix = ""
): string {
  let html = "";
  let n = 0;

  for (const el of elementi) {
    n++;
    const num = prefix ? `${prefix}.${n}` : `${n}`;
    const label = TIPO_CONFIG[el.tipo].label;

    html += `<p style="margin:8px 0 2px 0"><b>${num}. ${label}: ${escapeHtml(
      el.titolo || "Senza titolo"
    )}</b>${el.descrizione ? " — " + escapeHtml(el.descrizione) : ""}</p>`;

    if (el.descrizione_completa) {
      html += `<p style="margin:2px 0 4px 18px">${escapeHtml(
        el.descrizione_completa
      ).replace(/\n/g, "<br/>")}</p>`;
    }

    const links = el.links.filter((l) => l.url);
    if (links.length) {
      html += `<p style="margin:2px 0 4px 18px">Link: ${links
        .map(
          (l) =>
            `<a href="${escapeHtml(l.url)}">${escapeHtml(
              l.label || l.url
            )}</a>`
        )
        .join(", ")}</p>`;
    }

    if (el.campi.length) {
      html += `<p style="margin:2px 0 2px 18px"><i>Campi da valorizzare:</i></p><ul style="margin:0 0 4px 18px">${el.campi
        .map(
          (c) =>
            `<li><b>${escapeHtml(c.label || "Campo")}</b> = ${escapeHtml(
              c.valore || "—"
            )} <i>(${
              c.tipo_valore === "fisso"
                ? "valore fisso: sempre questo"
                : "valore variabile: può cambiare"
            })</i>${c.descrizione ? ` — ${escapeHtml(c.descrizione)}` : ""}</li>`
        )
        .join("")}</ul>`;
    }

    if (el.next_to) {
      html += `<p style="margin:2px 0 4px 18px"><i>→ La freccia prosegue verso il passo "${escapeHtml(
        titles[el.next_to] || "elemento"
      )}"</i></p>`;
    }

    if (el.tipo === "decisione" && el.rami.length > 0) {
      el.rami.forEach((ramo, ri) => {
        const letter = String.fromCharCode(97 + ri);

        if (ramo.loop_to) {
          html += `<p style="margin:4px 0 2px 18px"><b>${num}.${letter}) Se "${escapeHtml(
            ramo.label || "Strada"
          )}":</b> prosegue al passo "${escapeHtml(
            titles[ramo.loop_to] || "elemento"
          )}"</p>`;
          return;
        }

        html += `<p style="margin:4px 0 2px 18px"><b>${num}.${letter}) Se "${escapeHtml(
          ramo.label || "Strada"
        )}":</b></p><div style="margin-left:36px">${flowToDocHtml(
          ramo.elementi,
          titles,
          `${num}.${letter}`
        )}</div>`;
      });
    }
  }

  return html;
}

/** Rappresentazione grafica del flusso per la stampa/PDF */
function flowToPrintHtml(
  elementi: FlowElement[],
  titles: Record<string, string> = {}
): string {
  let html = "";

  elementi.forEach((el, i) => {
    if (i > 0) {
      html += `<div style="width:2px;height:18px;background:#cbd5e1;margin:0 auto"></div>`;
    }

    const color = PRINT_COLORS[el.tipo];

    html += `<div style="border:1px solid #e2e8f0;border-left:4px solid ${color};border-radius:12px;padding:10px 14px;max-width:560px;margin:0 auto;background:#fff">
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${color}">${
        TIPO_CONFIG[el.tipo].label
      }</div>
      <div style="font-size:13px;font-weight:800;color:#0f172a">${escapeHtml(
        el.titolo || "Senza titolo"
      )}</div>
      ${
        el.descrizione
          ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${escapeHtml(el.descrizione)}</div>`
          : ""
      }
      ${
        el.immagine
          ? `<img src="${el.immagine}" style="max-width:100%;max-height:160px;border-radius:8px;margin-top:6px"/>`
          : ""
      }
      ${
        el.campi.length
          ? `<div style="font-size:10px;color:#475569;margin-top:4px">${el.campi
              .map(
                (c) =>
                  `${escapeHtml(c.label || "Campo")}: <b>${escapeHtml(
                    c.valore || "—"
                  )}</b> <span style="font-size:8px;font-weight:800;text-transform:uppercase;color:${
                    c.tipo_valore === "fisso" ? "#0150a0" : "#d97706"
                  }">[${c.tipo_valore === "fisso" ? "fisso" : "variabile"}]</span>`
              )
              .join(" · ")}</div>`
          : ""
      }
    </div>`;

    if (el.next_to) {
      html += `<div style="text-align:center;font-size:9px;font-weight:800;text-transform:uppercase;color:#b45309;margin-top:4px">↩ Vai a: ${escapeHtml(
        titles[el.next_to] || "elemento"
      )}</div>`;
    }

    if (el.tipo === "decisione" && el.rami.length > 0) {
      html += `<div style="width:2px;height:14px;background:#fcd34d;margin:0 auto"></div>
      <div style="display:flex;gap:10px;align-items:stretch">`;

      el.rami.forEach((ramo) => {
        html += `<div style="flex:1;min-width:0;border:1px dashed #fbbf24;border-radius:12px;padding:8px;background:#fffbeb">
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#b45309;text-align:center;margin-bottom:6px">${escapeHtml(
            ramo.label || "Strada"
          )}</div>
          ${
            ramo.loop_to
              ? `<div style="font-size:10px;font-weight:800;color:#b45309;text-align:center">↩ Torna a: ${escapeHtml(
                  titles[ramo.loop_to] || "elemento"
                )}</div>`
              : ramo.elementi.length
                ? flowToPrintHtml(ramo.elementi, titles)
                : `<div style="font-size:10px;color:#b45309;text-align:center">—</div>`
          }
        </div>`;
      });

      html += `</div>`;
    }
  });

  return html;
}

/** Ridimensiona un'immagine lato client e la converte in data URL JPEG */
function fileToResizedDataUrl(file: File, maxSize = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new window.Image();

      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas non disponibile"));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };

      img.onerror = () => reject(new Error("Immagine non valida"));
      img.src = String(reader.result);
    };

    reader.onerror = () => reject(new Error("Lettura file fallita"));
    reader.readAsDataURL(file);
  });
}

// --- Utility ricorsive sull'albero degli elementi ---

function mapRami(el: FlowElement, fn: (list: FlowElement[]) => FlowElement[]): FlowElement {
  if (el.rami.length === 0) return el;
  return {
    ...el,
    rami: el.rami.map((r) => ({ ...r, elementi: fn(r.elementi) })),
  };
}

/** Sostituisce un elemento (ovunque si trovi nell'albero) */
function replaceElement(list: FlowElement[], updated: FlowElement): FlowElement[] {
  return list.map((el) => {
    if (el.id === updated.id) return updated;
    return mapRami(el, (children) => replaceElement(children, updated));
  });
}

/** Rimuove un elemento (ovunque si trovi nell'albero) */
function removeElementById(list: FlowElement[], id: string): FlowElement[] {
  return list
    .filter((el) => el.id !== id)
    .map((el) => mapRami(el, (children) => removeElementById(children, id)));
}

/** Sposta un elemento su/giù all'interno della propria lista */
function moveElementById(
  list: FlowElement[],
  id: string,
  direction: -1 | 1
): FlowElement[] {
  const index = list.findIndex((el) => el.id === id);

  if (index !== -1) {
    const target = index + direction;
    if (target < 0 || target >= list.length) return list;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  }

  return list.map((el) =>
    mapRami(el, (children) => moveElementById(children, id, direction))
  );
}

/** Aggiunge un elemento in coda a un ramo specifico */
function addElementToRamo(
  list: FlowElement[],
  ramoId: string,
  nuovo: FlowElement
): FlowElement[] {
  return list.map((el) => {
    if (el.rami.length === 0) return el;
    return {
      ...el,
      rami: el.rami.map((r) =>
        r.id === ramoId
          ? { ...r, elementi: [...r.elementi, nuovo] }
          : { ...r, elementi: addElementToRamo(r.elementi, ramoId, nuovo) }
      ),
    };
  });
}

// =====================================================================
// PAGINA
// =====================================================================

export default function FlussiOperativiPage() {
  const [tab, setTab] = useState<"flussi" | "google">("flussi");

  // Filtri elenco flussi (mostrati nelle azioni in alto a destra)
  const [filterCliente, setFilterCliente] = useState("");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterMeta, setFilterMeta] = useState<{
    tags: string[];
    clienti: { id: string; nome: string }[];
  }>({ tags: [], clienti: [] });

  const handleMeta = useCallback(
    (meta: { tags: string[]; clienti: { id: string; nome: string }[] }) => {
      setFilterMeta(meta);
    },
    []
  );

  return (
    <AppPage
      title="Flussi Operativi"
      subtitle="Crea e gestisci i flussi operativi per le attività dei clienti"
      icon={<Workflow size={22} />}
      maxWidth="full"
      actions={
        tab === "flussi" ? (
          <>
            <select
              value={filterCliente}
              onChange={(e) => setFilterCliente(e.target.value)}
              className="rounded-xl border border-transparent bg-slate-50 px-4 py-2.5 text-[11px] font-black uppercase outline-none transition-all focus:border-slate-200"
            >
              <option value="">Tutti i clienti</option>
              {filterMeta.clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>

            {filterMeta.tags.length > 0 && (
              <div className="flex max-w-md flex-wrap items-center gap-1.5">
                {filterMeta.tags.map((t) => {
                  const active = filterTags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setFilterTags((prev) =>
                          active
                            ? prev.filter((x) => x !== t)
                            : [...prev, t]
                        )
                      }
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase transition-all ${
                        active
                          ? "bg-[#0150a0] text-[#ffffff] shadow-sm"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      #{t}
                    </button>
                  );
                })}
              </div>
            )}

            {(filterCliente || filterTags.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setFilterCliente("");
                  setFilterTags([]);
                }}
                className="text-[10px] font-black uppercase text-slate-400 transition hover:text-slate-700"
              >
                Azzera
              </button>
            )}

            <div className="mx-1 h-6 w-px bg-slate-200" />

            <AppButton
              type="button"
              variant="ghost"
              onClick={() => setTab("google")}
              className="gap-1.5 text-[10px] font-black uppercase"
            >
              <FileText size={12} /> Fonti Google
            </AppButton>
          </>
        ) : (
          <AppButton
            type="button"
            variant="secondary"
            onClick={() => setTab("flussi")}
            className="gap-1.5 text-[10px] font-black uppercase"
          >
            <Workflow size={12} /> I miei flussi
          </AppButton>
        )
      }
    >
      {tab === "flussi" ? (
        <FlussiBuilder
          filterCliente={filterCliente}
          filterTags={filterTags}
          onMeta={handleMeta}
        />
      ) : (
        <FontiGoogleView />
      )}
    </AppPage>
  );
}

// =====================================================================
// BUILDER FLUSSI
// =====================================================================

function FlussiBuilder({
  filterCliente,
  filterTags,
  onMeta,
}: {
  filterCliente: string;
  filterTags: string[];
  onMeta: (meta: {
    tags: string[];
    clienti: { id: string; nome: string }[];
  }) => void;
}) {
  const [flussi, setFlussi] = useState<FlussoRecord[]>([]);
  const [clienti, setClienti] = useState<ClienteOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [flussoModal, setFlussoModal] = useState<{
    mode: "create" | "edit";
    id?: string;
    nome: string;
    descrizione: string;
    cliente_id: string;
    tags: string[];
  } | null>(null);
  const [tagInput, setTagInput] = useState("");

  const [elementModal, setElementModal] = useState<FlowElement | null>(null);
  const [savingElement, setSavingElement] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const openElementPanel = (el: FlowElement) => {
    setDocPreview(null);
    setElementModal({ ...el });
    setPanelCollapsed(false);
  };

  // Filtro percorso (decisione -> strada scelta) e salvataggio esplicito
  const [branchFilter, setBranchFilter] = useState<Record<string, string>>({});
  const [savingFlusso, setSavingFlusso] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Orientamento di visualizzazione del flusso (non modifica i dati)
  const [orientation, setOrientation] = useState<"v" | "h">("v");

  // Anteprima DOC nella sidebar destra
  const [docPreview, setDocPreview] = useState<string | null>(null);

  // Lightbox immagine di un elemento (click sull'immagine) con zoom e pan
  const [imagePreview, setImagePreview] = useState<{
    src: string;
    titolo: string;
  } | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  const imageDragRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  useEffect(() => {
    const onImage = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.src) {
        setImagePreview({ src: detail.src, titolo: detail.titolo || "" });
        setImageZoom(1);
        setImagePan({ x: 0, y: 0 });
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImagePreview(null);
    };

    window.addEventListener("flussi:image", onImage);
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("flussi:image", onImage);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Frecce dei salti (next_to / loop_to) disegnate come curve SVG
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [jumpPaths, setJumpPaths] = useState<{ key: string; d: string }[]>([]);

  const selectedFlusso = useMemo(
    () => flussi.find((f) => f.id === selectedId) || null,
    [flussi, selectedId]
  );

  const decisions = useMemo(
    () => (selectedFlusso ? collectDecisions(selectedFlusso.elementi) : []),
    [selectedFlusso]
  );

  // Elenco piatto degli elementi (target per i loop delle decisioni)
  const allElementsFlat = useMemo(
    () => (selectedFlusso ? flattenElements(selectedFlusso.elementi) : []),
    [selectedFlusso]
  );

  const titlesById = useMemo(
    () =>
      Object.fromEntries(
        allElementsFlat.map((e) => [e.id, e.titolo || "Senza titolo"])
      ) as Record<string, string>,
    [allElementsFlat]
  );

  // Tutti i tag esistenti e clienti usati nei flussi (per i filtri)
  const allTags = useMemo(
    () =>
      Array.from(new Set(flussi.flatMap((f) => f.tags))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [flussi]
  );

  const clientiUsati = useMemo(() => {
    const map = new Map<string, string>();
    flussi.forEach((f) => {
      if (f.cliente_id && f.clienti?.nome) map.set(f.cliente_id, f.clienti.nome);
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [flussi]);

  // Comunica al componente pagina tag e clienti disponibili per i filtri
  useEffect(() => {
    onMeta({ tags: allTags, clienti: clientiUsati });
  }, [allTags, clientiUsati, onMeta]);

  // Elenco flussi filtrato per cliente e tag
  const visibleFlussi = useMemo(
    () =>
      flussi.filter((f) => {
        const matchCliente = !filterCliente || f.cliente_id === filterCliente;
        const matchTags =
          filterTags.length === 0 ||
          filterTags.every((t) => f.tags.includes(t));
        return matchCliente && matchTags;
      }),
    [flussi, filterCliente, filterTags]
  );

  // Reset del filtro quando cambia il flusso selezionato
  useEffect(() => {
    setBranchFilter({});
  }, [selectedId]);

  // Calcola le curve delle frecce dei salti misurando il DOM
  useEffect(() => {
    const container = canvasRef.current;

    if (!container || !selectedFlusso) {
      setJumpPaths([]);
      return;
    }

    const compute = () => {
      const links = collectJumpLinks(selectedFlusso.elementi);
      const crect = container.getBoundingClientRect();
      const paths: { key: string; d: string }[] = [];

      // Sfalsamento degli ingressi quando più frecce puntano allo stesso target:
      // le punte vengono distribuite e centrate sul lato del nodo di destinazione,
      // così non si sovrappongono tutte sullo stesso punto.
      const targetCounts = new Map<string, number>();
      links.forEach((l) =>
        targetCounts.set(l.to, (targetCounts.get(l.to) ?? 0) + 1)
      );
      const targetSeen = new Map<string, number>();

      links.forEach((link, i) => {
        const s = document.getElementById(link.from)?.getBoundingClientRect();
        const t = document.getElementById(link.to)?.getBoundingClientRect();
        if (!s || !t) return; // sorgente o destinazione non visibili (filtro)

        const count = targetCounts.get(link.to) ?? 1;
        const idx = targetSeen.get(link.to) ?? 0;
        targetSeen.set(link.to, idx + 1);
        // scostamento centrato: es. 3 frecce -> -16, 0, +16
        const spread = (idx - (count - 1) / 2) * 16;

        if (orientation === "h") {
          // Percorso ortogonale: giù → corsia in fondo al canvas
          // (nel padding sotto tutto il flusso) → su, dentro il target
          // dal basso al centro. Le ancore invisibili sono sul fondo
          // della card, quindi la discesa parte centrata.
          const x0 = s.left - crect.left + s.width / 2;
          const y0 = s.bottom - crect.top;
          const x1 = t.left - crect.left + t.width / 2 + spread;
          const y1 = t.bottom - crect.top;
          const lane = crect.height - 10 - i * 12;

          paths.push({
            key: `${link.from}->${link.to}`,
            d: `M ${x0} ${y0 + 2} L ${x0} ${lane} L ${x1} ${lane} L ${x1} ${y1 + 8}`,
          });
        } else if (link.from.startsWith("flow-jump-ramo-")) {
          // Salto di una strada: la tratteggiata esce ORIZZONTALE dal
          // fianco destro del chip (es. "NO"), raggiunge la corsia
          // esterna al flusso e rientra nel target dal lato destro
          const x0 = s.right - crect.left + 2; // fianco destro del chip
          const y0 = s.top - crect.top + s.height / 2; // in linea col chip
          const x1 = t.right - crect.left;
          const y1 = t.top - crect.top + t.height / 2 + spread;
          const lane = Math.max(x0, x1) + 32 + i * 14;

          paths.push({
            key: `${link.from}->${link.to}`,
            d: `M ${x0} ${y0} L ${lane} ${y0} L ${lane} ${y1} L ${x1 + 8} ${y1}`,
          });
        } else if (s.width <= 2) {
          // Ancora sul fianco destro della card (strada inline):
          // la tratteggiata esce ORIZZONTALE dal lato opposto dell'entità
          const x0 = s.right - crect.left + 2;
          const y0 = s.top - crect.top + s.height / 2;
          const x1 = t.right - crect.left;
          const y1 = t.top - crect.top + t.height / 2 + spread;
          const lane = Math.max(x0, x1) + 32 + i * 14;

          paths.push({
            key: `${link.from}->${link.to}`,
            d: `M ${x0} ${y0} L ${lane} ${y0} L ${lane} ${y1} L ${x1 + 8} ${y1}`,
          });
        } else {
          // Freccia in uscita di un elemento: giù dal nodo "Vai a",
          // corsia verticale esterna e ingresso nel target da destra
          const x0 = s.left - crect.left + s.width / 2;
          const y0 = s.bottom - crect.top;
          const x1 = t.right - crect.left;
          const y1 = t.top - crect.top + t.height / 2 + spread;
          const lane = Math.max(x0, x1) + 32 + i * 14;

          paths.push({
            key: `${link.from}->${link.to}`,
            d: `M ${x0} ${y0 + 2} L ${x0} ${y0 + 14} L ${lane} ${y0 + 14} L ${lane} ${y1} L ${x1 + 8} ${y1}`,
          });
        }
      });

      setJumpPaths(paths);
    };

    // Doppio raf + retry ritardato: evita misure prese a layout non
    // ancora assestato (es. subito dopo il cambio di orientamento)
    let raf2 = 0;
    const raf = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(compute);
    });
    const retry = setTimeout(compute, 300);

    const observer = new ResizeObserver(() => compute());
    observer.observe(container);
    window.addEventListener("resize", compute);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(raf2);
      clearTimeout(retry);
      observer.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [selectedFlusso, orientation, branchFilter]);

  const loadFlussi = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("flussi_operativi")
      .select("*, clienti:cliente_id(id, nome)")
      .order("updated_at", { ascending: false });

    if (loadError) {
      setError(
        loadError.message.includes("does not exist") ||
          loadError.message.includes("schema cache")
          ? "Tabella flussi_operativi mancante: esegui lo script supabase/flussi_operativi.sql nell'SQL Editor di Supabase."
          : loadError.message
      );
      setLoading(false);
      return;
    }

    setError(null);
    const normalized = (data || []).map(normalizeFlusso);
    setFlussi(normalized);
    setSelectedId((prev) =>
      prev && normalized.some((f) => f.id === prev)
        ? prev
        : normalized[0]?.id ?? null
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadFlussi();

    supabase
      .from("clienti")
      .select("id, nome")
      .order("nome")
      .then(({ data }) => setClienti((data as ClienteOption[]) || []));
  }, [loadFlussi]);

  useRealtimeTable({
    supabase,
    table: "flussi_operativi",
    onChange: () => {
      void loadFlussi();
    },
  });

  // --- CRUD flusso ---

  const saveFlussoModal = async () => {
    if (!flussoModal || !flussoModal.nome.trim()) return;

    if (flussoModal.mode === "create") {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error: insertError } = await supabase
        .from("flussi_operativi")
        .insert({
          nome: flussoModal.nome.trim(),
          descrizione: flussoModal.descrizione.trim() || null,
          cliente_id: flussoModal.cliente_id || null,
          elementi: [],
          tags: flussoModal.tags,
          creato_da: user?.id ?? null,
        })
        .select("*, clienti:cliente_id(id, nome)")
        .single();

      if (insertError) {
        alert(
          insertError.message.includes("tags")
            ? "Colonna tags mancante: esegui la migrazione in supabase/flussi_operativi.sql"
            : `Errore creazione flusso: ${insertError.message}`
        );
        return;
      }

      if (data) {
        const created = normalizeFlusso(data);
        setFlussi((prev) => [created, ...prev]);
        setSelectedId(created.id);
      }
    } else if (flussoModal.id) {
      const patch = {
        nome: flussoModal.nome.trim(),
        descrizione: flussoModal.descrizione.trim() || null,
        cliente_id: flussoModal.cliente_id || null,
        tags: flussoModal.tags,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("flussi_operativi")
        .update(patch)
        .eq("id", flussoModal.id);

      if (updateError) {
        alert(`Errore salvataggio flusso: ${updateError.message}`);
        return;
      }

      setFlussi((prev) =>
        prev.map((f) =>
          f.id === flussoModal.id
            ? {
                ...f,
                ...patch,
                clienti:
                  clienti.find((c) => c.id === patch.cliente_id) || null,
              }
            : f
        )
      );
    }

    setFlussoModal(null);
  };

  const deleteFlusso = async (flusso: FlussoRecord) => {
    if (
      !confirm(
        `Eliminare il flusso "${flusso.nome}"? L'operazione non è reversibile.`
      )
    ) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("flussi_operativi")
      .delete()
      .eq("id", flusso.id);

    if (deleteError) {
      alert(`Errore eliminazione: ${deleteError.message}`);
      return;
    }

    setFlussi((prev) => prev.filter((f) => f.id !== flusso.id));
    setSelectedId((prev) => (prev === flusso.id ? null : prev));
  };

  // --- Elementi (albero ricorsivo) ---

  const persistElements = async (
    flussoId: string,
    elementi: FlowElement[]
  ): Promise<boolean> => {
    setFlussi((prev) =>
      prev.map((f) => (f.id === flussoId ? { ...f, elementi } : f))
    );

    const { error: updateError } = await supabase
      .from("flussi_operativi")
      .update({ elementi, updated_at: new Date().toISOString() })
      .eq("id", flussoId);

    if (updateError) {
      alert(`Errore salvataggio elementi: ${updateError.message}`);
      void loadFlussi();
      return false;
    }

    return true;
  };

  const addElement = (tipo: ElementoTipo) => {
    if (!selectedFlusso) return;

    const nuovo = makeElement(tipo);
    void persistElements(selectedFlusso.id, [
      ...selectedFlusso.elementi,
      nuovo,
    ]);
    openElementPanel(nuovo);
  };

  const addElementInRamo = (ramoId: string, tipo: ElementoTipo) => {
    if (!selectedFlusso) return;

    const nuovo = makeElement(tipo);
    void persistElements(
      selectedFlusso.id,
      addElementToRamo(selectedFlusso.elementi, ramoId, nuovo)
    );
    openElementPanel(nuovo);
  };

  const saveElement = async (element: FlowElement) => {
    if (!selectedFlusso) return;

    setSavingElement(true);
    const ok = await persistElements(
      selectedFlusso.id,
      replaceElement(selectedFlusso.elementi, element)
    );
    setSavingElement(false);

    if (ok) setElementModal(null);
  };

  const deleteElement = async (element: FlowElement) => {
    if (!selectedFlusso) return;
    if (!confirm(`Eliminare "${element.titolo || "elemento"}"?`)) return;

    await persistElements(
      selectedFlusso.id,
      removeElementById(selectedFlusso.elementi, element.id)
    );
    setElementModal(null);
  };

  const moveElement = (id: string, direction: -1 | 1) => {
    if (!selectedFlusso) return;

    void persistElements(
      selectedFlusso.id,
      moveElementById(selectedFlusso.elementi, id, direction)
    );
  };

  // Salvataggio esplicito del flusso corrente
  const saveFlussoNow = async () => {
    if (!selectedFlusso) return;

    setSavingFlusso(true);
    const ok = await persistElements(
      selectedFlusso.id,
      selectedFlusso.elementi
    );
    setSavingFlusso(false);

    if (ok) {
      setLastSavedAt(
        new Date().toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
  };

  // Costruisce l'HTML del DOC (flusso convertito in passi numerati)
  const buildDocHtml = (): string | null => {
    if (!selectedFlusso) return null;

    const elementi = pruneByFilter(selectedFlusso.elementi, branchFilter);

    return `<html><head><meta charset="utf-8"><title>${escapeHtml(
      selectedFlusso.nome
    )}</title></head><body style="font-family:Calibri,Arial,sans-serif;font-size:12pt">
      <h1 style="font-size:16pt">${escapeHtml(selectedFlusso.nome)}</h1>
      ${
        selectedFlusso.descrizione
          ? `<p style="color:#555">${escapeHtml(selectedFlusso.descrizione)}</p>`
          : ""
      }
      <p style="color:#888;font-size:9pt">Generato il ${new Date().toLocaleString("it-IT")}${
        Object.keys(branchFilter).length
          ? " — percorso filtrato"
          : ""
      }</p><hr/>
      ${flowToDocHtml(elementi, titlesById)}
    </body></html>`;
  };

  // Apre l'anteprima del DOC nella sidebar destra
  const exportDoc = () => {
    const html = buildDocHtml();
    if (!html) return;
    setElementModal(null);
    setDocPreview(html);
  };

  // Scarica il file DOC dall'anteprima
  const downloadDoc = () => {
    if (!docPreview || !selectedFlusso) return;

    const blob = new Blob([docPreview], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedFlusso.nome.replace(/[^\w\dàèéìòù -]/gi, "")}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PDF: apre la vista di stampa del grafico (Salva come PDF)
  const exportPdf = () => {
    if (!selectedFlusso) return;

    const elementi = pruneByFilter(selectedFlusso.elementi, branchFilter);

    const html = `<html><head><meta charset="utf-8"><title>${escapeHtml(
      selectedFlusso.nome
    )}</title></head><body style="font-family:Arial,sans-serif;background:#fff;padding:24px">
      <h1 style="font-size:18px;color:#0f172a;margin:0 0 4px 0">${escapeHtml(
        selectedFlusso.nome
      )}</h1>
      ${
        selectedFlusso.descrizione
          ? `<p style="color:#64748b;font-size:12px;margin:0 0 12px 0">${escapeHtml(selectedFlusso.descrizione)}</p>`
          : ""
      }
      <div style="text-align:center;margin-bottom:6px"><span style="background:#0f172a;color:#fff;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:1px;padding:3px 10px;border-radius:99px">Inizio</span></div>
      <div style="width:2px;height:14px;background:#cbd5e1;margin:0 auto"></div>
      ${flowToPrintHtml(elementi, titlesById)}
      <div style="width:2px;height:14px;background:#cbd5e1;margin:0 auto"></div>
      <div style="text-align:center;margin-top:6px"><span style="border:1px solid #e2e8f0;color:#94a3b8;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:1px;padding:3px 10px;border-radius:99px">Fine</span></div>
    </body></html>`;

    const win = window.open("", "_blank");
    if (!win) {
      alert("Sblocca i popup per esportare il PDF");
      return;
    }

    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  // --- Render ---

  if (loading) {
    return (
      <AppCard className="flex min-h-[300px] items-center justify-center">
        <span className="animate-pulse text-sm font-black uppercase tracking-widest text-slate-300">
          Caricamento flussi...
        </span>
      </AppCard>
    );
  }

  if (error) {
    return (
      <AppCard className="border-red-200 bg-red-50">
        <p className="text-sm font-bold text-red-700">{error}</p>
      </AppCard>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 gap-6 ${
        docPreview
          ? "xl:grid-cols-[300px_1fr_440px]"
          : elementModal
            ? panelCollapsed
              ? "xl:grid-cols-[300px_1fr_56px]"
              : "xl:grid-cols-[300px_1fr_400px]"
            : "xl:grid-cols-[320px_1fr]"
      }`}
    >
      {/* Elenco flussi */}
      <div className="space-y-3">
        <AppButton
          type="button"
          onClick={() => {
            setTagInput("");
            setFlussoModal({
              mode: "create",
              nome: "",
              descrizione: "",
              cliente_id: "",
              tags: [],
            });
          }}
          className="w-full gap-2 text-[10px] font-black uppercase"
        >
          <Plus size={14} /> Nuovo flusso
        </AppButton>

        {flussi.length === 0 && (
          <AppCard className="text-center text-sm text-slate-400">
            Nessun flusso creato. Inizia con &quot;Nuovo flusso&quot;.
          </AppCard>
        )}

        {flussi.length > 0 && visibleFlussi.length === 0 && (
          <AppCard className="text-center text-sm text-slate-400">
            Nessun flusso corrisponde ai filtri.
          </AppCard>
        )}

        {visibleFlussi.map((f) => (
          <AppCard
            key={f.id}
            padded={false}
            className={`cursor-pointer border-l-4 p-4 transition-all hover:shadow-md ${
              selectedId === f.id
                ? "border-l-[#0150a0] ring-2 ring-[#0150a0]/15"
                : "border-l-transparent"
            }`}
            onClick={() => setSelectedId(f.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black text-slate-900">
                  {f.nome}
                </h3>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {f.clienti?.nome || "Nessun cliente"} ·{" "}
                  {f.elementi.length} elementi
                </p>
                {f.descrizione && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {f.descrizione}
                  </p>
                )}

                {f.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {f.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-[#e6eef8] px-2 py-0.5 text-[9px] font-black uppercase text-[#0150a0]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTagInput("");
                    setFlussoModal({
                      mode: "edit",
                      id: f.id,
                      nome: f.nome,
                      descrizione: f.descrizione || "",
                      cliente_id: f.cliente_id || "",
                      tags: f.tags,
                    });
                  }}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Modifica flusso"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteFlusso(f);
                  }}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label="Elimina flusso"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </AppCard>
        ))}
      </div>

      {/* Canvas del flusso selezionato (min-w-0: lo scroll orizzontale
          resta confinato al canvas, non alla pagina) */}
      <div className="min-w-0">
        {!selectedFlusso ? (
          <AppCard className="flex min-h-[300px] items-center justify-center text-sm text-slate-400">
            Seleziona o crea un flusso per iniziare
          </AppCard>
        ) : (
          <AppCard padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-black tracking-tight text-slate-900">
                  {selectedFlusso.nome}
                </h2>
                {selectedFlusso.descrizione && (
                  <p className="text-sm text-slate-500">
                    {selectedFlusso.descrizione}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <AppButton
                  type="button"
                  variant="secondary"
                  onClick={() => addElement("step")}
                  className="gap-1.5 text-[10px] font-black uppercase"
                >
                  <Milestone size={12} className="text-[#0150a0]" /> Step
                </AppButton>
                <AppButton
                  type="button"
                  variant="secondary"
                  onClick={() => addElement("azione")}
                  className="gap-1.5 text-[10px] font-black uppercase"
                >
                  <Zap size={12} className="text-emerald-600" /> Azione
                </AppButton>
                <AppButton
                  type="button"
                  variant="secondary"
                  onClick={() => addElement("decisione")}
                  className="gap-1.5 text-[10px] font-black uppercase"
                >
                  <GitBranch size={12} className="text-amber-500" /> Decisione
                </AppButton>

                <div className="mx-1 h-6 w-px bg-slate-200" />

                {/* Orientamento vista (non modifica il flusso) */}
                <div className="flex rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setOrientation("v")}
                    title="Vista verticale"
                    className={`rounded-lg px-2.5 py-2 transition-all ${
                      orientation === "v"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <MoveVertical size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation("h")}
                    title="Vista orizzontale"
                    className={`rounded-lg px-2.5 py-2 transition-all ${
                      orientation === "h"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <MoveHorizontal size={13} />
                  </button>
                </div>

                <AppButton
                  type="button"
                  onClick={() => void saveFlussoNow()}
                  disabled={savingFlusso}
                  className="gap-1.5 text-[10px] font-black uppercase"
                >
                  {savingFlusso ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}
                  Salva
                </AppButton>
                <AppButton
                  type="button"
                  variant="secondary"
                  onClick={exportPdf}
                  className="gap-1.5 text-[10px] font-black uppercase"
                  title="Apre la stampa: scegli 'Salva come PDF'"
                >
                  <Printer size={12} /> PDF
                </AppButton>
                <AppButton
                  type="button"
                  variant="secondary"
                  onClick={exportDoc}
                  className="gap-1.5 text-[10px] font-black uppercase"
                >
                  <FileDown size={12} /> DOC
                </AppButton>

                {lastSavedAt && (
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">
                    Salvato {lastSavedAt}
                  </span>
                )}
              </div>
            </div>

            {/* Filtro percorso per decisione */}
            {decisions.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <Filter size={12} className="text-[#0150a0]" /> Filtra
                  percorso
                </span>

                {decisions.map((dec) => (
                  <label
                    key={dec.id}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5"
                  >
                    <span className="max-w-[160px] truncate text-[10px] font-black uppercase text-amber-600">
                      {dec.titolo || "Decisione"}
                    </span>
                    <select
                      value={branchFilter[dec.id] || ""}
                      onChange={(e) =>
                        setBranchFilter((prev) => {
                          const next = { ...prev };
                          if (e.target.value) next[dec.id] = e.target.value;
                          else delete next[dec.id];
                          return next;
                        })
                      }
                      className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase outline-none"
                    >
                      <option value="">Tutte le strade</option>
                      {dec.rami.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label || "Strada"}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}

                {Object.keys(branchFilter).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBranchFilter({})}
                    className="rounded-lg px-2 py-1 text-[10px] font-black uppercase text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    Azzera filtro
                  </button>
                )}
              </div>
            )}

            <div className="custom-scrollbar overflow-x-auto p-5">
              {selectedFlusso.elementi.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
                    <Workflow size={26} />
                  </div>
                  <p className="text-sm font-bold text-slate-500">
                    Il flusso è vuoto
                  </p>
                  <p className="max-w-xs text-xs text-slate-400">
                    Aggiungi il primo elemento con i pulsanti{" "}
                    <span className="font-black text-[#0150a0]">Step</span>,{" "}
                    <span className="font-black text-emerald-600">
                      Azione
                    </span>{" "}
                    o{" "}
                    <span className="font-black text-amber-500">
                      Decisione
                    </span>{" "}
                    in alto.
                  </p>
                </div>
              ) : (
                <div ref={canvasRef} className="relative">
                  {/* Frecce dei salti (a step precedenti o oltre) */}
                  {jumpPaths.length > 0 && (
                    <svg
                      className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
                      aria-hidden="true"
                    >
                      <defs>
                        <marker
                          id="flow-jump-arrow"
                          markerWidth="8"
                          markerHeight="8"
                          refX="7"
                          refY="4"
                          orient="auto"
                        >
                          <path d="M0,0 L8,4 L0,8 Z" fill="#f59e0b" />
                        </marker>
                      </defs>
                      {jumpPaths.map((p) => (
                        <path
                          key={p.key}
                          d={p.d}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="2"
                          strokeDasharray="6 5"
                          strokeLinecap="round"
                          markerEnd="url(#flow-jump-arrow)"
                          opacity="0.75"
                          className="animate-flow-dash"
                        />
                      ))}
                    </svg>
                  )}

                <div
                  className={
                    orientation === "h"
                      ? "flex min-w-max items-center px-2 py-12"
                      : "mx-auto flex w-max min-w-full max-w-none flex-col items-center px-2"
                  }
                >
                  {/* Inizio */}
                  <span className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-[8px] font-black uppercase tracking-widest text-[#ffffff] shadow-sm">
                    Inizio
                  </span>

                  {selectedFlusso.elementi.map((el, index) => (
                    <Fragment key={el.id}>
                      <FlowConnector horizontal={orientation === "h"} />
                      <ElementNode
                        element={el}
                        index={index}
                        total={selectedFlusso.elementi.length}
                        compact={false}
                        horizontal={orientation === "h"}
                        branchFilter={branchFilter}
                        titlesById={titlesById}
                        onOpen={openElementPanel}
                        onMove={moveElement}
                        onAddInRamo={addElementInRamo}
                      />
                    </Fragment>
                  ))}

                  <FlowConnector horizontal={orientation === "h"} />

                  {/* Fine */}
                  <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[8px] font-black uppercase tracking-widest text-slate-400 shadow-sm">
                    Fine
                  </span>
                </div>
                </div>
              )}
            </div>
          </AppCard>
        )}
      </div>

      {/* Modale crea/modifica flusso */}
      {flussoModal && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setFlussoModal(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0150a0] to-[#013b76] text-[#ffffff] shadow-lg shadow-[#0150a0]/20">
                  <Workflow size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-slate-900">
                    {flussoModal.mode === "create"
                      ? "Nuovo flusso"
                      : "Modifica flusso"}
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {flussoModal.mode === "create"
                      ? "Definisci il flusso, poi aggiungi gli elementi"
                      : "Aggiorna nome, descrizione o cliente"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFlussoModal(null)}
                className="rounded-full p-2 text-slate-400 transition-all hover:rotate-90 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Chiudi"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Nome flusso *
                </label>
                <input
                  value={flussoModal.nome}
                  onChange={(e) =>
                    setFlussoModal({ ...flussoModal, nome: e.target.value })
                  }
                  placeholder="Es. Gestione incident Esselunga"
                  className="w-full rounded-xl border border-transparent bg-slate-50 px-4 py-2.5 text-sm font-semibold outline-none transition-all focus:border-slate-300 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Descrizione
                </label>
                <textarea
                  value={flussoModal.descrizione}
                  onChange={(e) =>
                    setFlussoModal({
                      ...flussoModal,
                      descrizione: e.target.value,
                    })
                  }
                  rows={3}
                  placeholder="A cosa serve questo flusso"
                  className="w-full resize-none rounded-xl border border-transparent bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:border-slate-300 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Cliente
                </label>
                <select
                  value={flussoModal.cliente_id}
                  onChange={(e) =>
                    setFlussoModal({
                      ...flussoModal,
                      cliente_id: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-transparent bg-slate-50 px-4 py-2.5 text-sm font-semibold outline-none transition-all focus:border-slate-300 focus:bg-white"
                >
                  <option value="">Nessun cliente</option>
                  {clienti.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Tag
                </label>

                {flussoModal.tags.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {flussoModal.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full bg-[#e6eef8] px-2.5 py-1 text-[10px] font-black uppercase text-[#0150a0]"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() =>
                            setFlussoModal({
                              ...flussoModal,
                              tags: flussoModal.tags.filter((x) => x !== t),
                            })
                          }
                          className="rounded-full p-0.5 transition hover:bg-[#0150a0]/10"
                          aria-label={`Rimuovi tag ${t}`}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      const nuovo = tagInput.trim().replace(/^#/, "");
                      if (nuovo && !flussoModal.tags.includes(nuovo)) {
                        setFlussoModal({
                          ...flussoModal,
                          tags: [...flussoModal.tags, nuovo],
                        });
                      }
                      setTagInput("");
                    }
                  }}
                  placeholder="Scrivi un tag e premi Invio (es. CHG, Incident)"
                  className="w-full rounded-xl border border-transparent bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:border-slate-300 focus:bg-white"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <AppButton
                type="button"
                variant="secondary"
                onClick={() => setFlussoModal(null)}
              >
                Annulla
              </AppButton>
              <AppButton
                type="button"
                onClick={() => void saveFlussoModal()}
                disabled={!flussoModal.nome.trim()}
              >
                {flussoModal.mode === "create" ? "Crea flusso" : "Salva"}
              </AppButton>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox immagine elemento con zoom e pan */}
      {imagePreview && (
        <div
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden bg-black/85 p-6 backdrop-blur-sm"
          onClick={() => setImagePreview(null)}
          onWheel={(e) => {
            setImageZoom((z) =>
              Math.min(5, Math.max(0.5, z * (e.deltaY < 0 ? 1.15 : 0.87)))
            );
          }}
        >
          <button
            type="button"
            onClick={() => setImagePreview(null)}
            className="absolute right-5 top-5 z-10 rounded-full bg-white/10 p-2.5 text-[#ffffff] transition-all hover:rotate-90 hover:bg-white/20"
            aria-label="Chiudi immagine"
          >
            <X size={20} />
          </button>

          {/* Controlli zoom */}
          <div
            className="absolute left-1/2 top-5 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/10 p-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                setImageZoom((z) => Math.max(0.5, z * 0.8))
              }
              className="rounded-full p-2 text-[#ffffff] transition hover:bg-white/20"
              aria-label="Riduci zoom"
            >
              <ZoomOut size={16} />
            </button>
            <span className="min-w-[52px] text-center text-xs font-black text-[#ffffff]/80">
              {Math.round(imageZoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setImageZoom((z) => Math.min(5, z * 1.25))}
              className="rounded-full p-2 text-[#ffffff] transition hover:bg-white/20"
              aria-label="Aumenta zoom"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setImageZoom(1);
                setImagePan({ x: 0, y: 0 });
              }}
              className="rounded-full px-2.5 py-1.5 text-[10px] font-black uppercase text-[#ffffff]/80 transition hover:bg-white/20"
            >
              Reset
            </button>
          </div>

          <img
            src={imagePreview.src}
            alt={imagePreview.titolo || "Immagine elemento"}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              if (imageZoom <= 1) return;
              e.preventDefault();
              imageDragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                panX: imagePan.x,
                panY: imagePan.y,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const drag = imageDragRef.current;
              if (!drag) return;
              setImagePan({
                x: drag.panX + (e.clientX - drag.startX),
                y: drag.panY + (e.clientY - drag.startY),
              });
            }}
            onPointerUp={() => {
              imageDragRef.current = null;
            }}
            draggable={false}
            style={{
              transform: `translate(${imagePan.x}px, ${imagePan.y}px) scale(${imageZoom})`,
              transition: imageDragRef.current
                ? "none"
                : "transform 0.15s ease-out",
              cursor: imageZoom > 1 ? "grab" : "zoom-in",
            }}
            className="max-h-[85vh] max-w-[92vw] select-none rounded-2xl object-contain shadow-2xl"
          />

          {imagePreview.titolo && (
            <p className="mt-4 max-w-[80vw] truncate text-sm font-bold text-[#ffffff]/80">
              {imagePreview.titolo}
            </p>
          )}
        </div>
      )}

      {/* Anteprima DOC nella sidebar destra */}
      {docPreview && selectedFlusso && (
        <aside className="animate-app-slide-in-right sticky top-4 flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_4px_rgba(15,23,42,0.06),0_16px_32px_-12px_rgba(15,23,42,0.14)]">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-[#eaf2fb] via-white to-white px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0150a0] to-[#013b76] text-[#ffffff] shadow-lg shadow-[#0150a0]/20">
                <FileDown size={16} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">
                  Anteprima DOC
                </h2>
                <p className="max-w-[240px] truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {selectedFlusso.nome}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDocPreview(null)}
              className="rounded-full p-2 text-slate-400 transition-all hover:rotate-90 hover:bg-white hover:text-slate-700 hover:shadow-sm"
              aria-label="Chiudi anteprima"
            >
              <X size={16} />
            </button>
          </div>

          <iframe
            title="Anteprima DOC"
            sandbox=""
            srcDoc={docPreview}
            className="min-h-[300px] w-full flex-1 bg-white"
          />

          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <AppButton
              type="button"
              variant="secondary"
              onClick={() => setDocPreview(null)}
            >
              Chiudi
            </AppButton>
            <AppButton type="button" onClick={downloadDoc} className="gap-1.5">
              <FileDown size={13} /> Scarica DOC
            </AppButton>
          </div>
        </aside>
      )}

      {/* Sidebar destra dettaglio elemento (richiudibile) */}
      {!docPreview &&
        elementModal &&
        (panelCollapsed ? (
          <div className="sticky top-4 flex h-fit flex-col items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
            <button
              type="button"
              onClick={() => setPanelCollapsed(false)}
              title="Riapri dettaglio"
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${TIPO_CONFIG[elementModal.tipo].iconBox}`}
            >
              <PanelRightOpen size={16} />
            </button>
            <button
              type="button"
              onClick={() => setElementModal(null)}
              title="Chiudi"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <ElementDetailPanel
            element={elementModal}
            saving={savingElement}
            allElements={allElementsFlat}
            onChange={setElementModal}
            onSave={() => void saveElement(elementModal)}
            onDelete={() => void deleteElement(elementModal)}
            onCollapse={() => setPanelCollapsed(true)}
            onClose={() => setElementModal(null)}
          />
        ))}
    </div>
  );
}

// =====================================================================
// NODO DEL FLUSSO (ricorsivo: le decisioni si dividono in rami)
// =====================================================================

/** Connettore con freccia: indica il verso di avanzamento del flusso */
function FlowConnector({
  tinted = false,
  horizontal = false,
}: {
  tinted?: boolean;
  horizontal?: boolean;
}) {
  if (horizontal) {
    return (
      <div className="flex shrink-0 items-center">
        <div
          className={`h-0.5 w-4 rounded ${
            tinted ? "bg-amber-300" : "bg-slate-300"
          }`}
        />
        <div
          className={`h-0 w-0 border-y-[5px] border-l-[6px] border-y-transparent ${
            tinted ? "border-l-amber-400" : "border-l-slate-400"
          }`}
        />
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-center">
      <div
        className={`h-4 w-0.5 rounded ${
          tinted ? "bg-amber-300" : "bg-slate-300"
        }`}
      />
      <div
        className={`h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent ${
          tinted ? "border-t-amber-400" : "border-t-slate-400"
        }`}
      />
    </div>
  );
}

function ElementNode({
  element,
  index,
  total,
  compact,
  horizontal = false,
  suppressNextNode = false,
  branchFilter,
  titlesById,
  onOpen,
  onMove,
  onAddInRamo,
}: {
  element: FlowElement;
  index: number;
  total: number;
  compact: boolean;
  horizontal?: boolean;
  /** Non renderizzare il nodo "Vai a": la tratteggiata parte dal fianco della card */
  suppressNextNode?: boolean;
  branchFilter: Record<string, string>;
  titlesById: Record<string, string>;
  onOpen: (el: FlowElement) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onAddInRamo: (ramoId: string, tipo: ElementoTipo) => void;
}) {
  const scrollToElement = (id: string) => {
    const target = document.getElementById(`flow-el-${id}`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });

    // Evidenzia brevemente la card di destinazione
    target.classList.add("ring-4", "ring-amber-400/50");
    setTimeout(() => {
      target.classList.remove("ring-4", "ring-amber-400/50");
    }, 1600);
  };
  const cfg = TIPO_CONFIG[element.tipo];
  const Icon = cfg.icon;
  const isDecision = element.tipo === "decisione";

  // Filtro percorso: se per questa decisione è stata scelta una strada,
  // il flusso prosegue solo lungo quella
  const activeRamo =
    isDecision && branchFilter[element.id]
      ? element.rami.find((r) => r.id === branchFilter[element.id]) || null
      : null;

  return (
    <div
      className={
        horizontal
          ? "flex shrink-0 items-center"
          : "flex w-full flex-col items-center"
      }
    >
      <div
        id={`flow-el-${element.id}`}
        role="button"
        tabIndex={0}
        onClick={() => onOpen(element)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onOpen(element);
        }}
        className={`group relative cursor-pointer scroll-mt-24 rounded-2xl border border-slate-200/80 border-l-4 ${cfg.accent} ${
          isDecision
            ? "bg-gradient-to-r from-amber-50/60 via-white to-white"
            : "bg-white"
        } shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${
          horizontal
            ? compact
              ? "w-64 shrink-0 p-3"
              : "w-80 shrink-0 p-4"
            : compact
              ? "w-full max-w-xl p-3"
              : "w-full max-w-xl p-4"
        }`}
      >
        {/* Ancora invisibile: da qui parte la tratteggiata quando il nodo
            "Vai a" è soppresso. Card orizzontale (vista verticale): sul
            fianco destro; card verticale (vista orizzontale): sul fondo. */}
        {suppressNextNode && element.next_to && (
          <span
            id={`flow-jump-${element.id}`}
            aria-hidden="true"
            className={
              horizontal
                ? "absolute right-0 top-1/2 h-px w-px -translate-y-1/2"
                : "absolute bottom-0 left-1/2 h-px w-px -translate-x-1/2"
            }
          />
        )}

        <div className="flex items-start gap-3">
          {/* Icona del tipo */}
          <div
            className={`flex shrink-0 items-center justify-center shadow-sm ${
              compact ? "h-8 w-8 rounded-lg" : "h-9 w-9 rounded-xl"
            } ${cfg.iconBox} ${isDecision ? "rotate-45" : ""}`}
          >
            <Icon
              size={compact ? 14 : 16}
              className={isDecision ? "-rotate-45" : ""}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${cfg.chip}`}
              >
                {cfg.label}
              </span>
              <h3
                className={`font-black text-slate-900 ${
                  compact ? "text-[13px]" : "text-sm"
                }`}
              >
                {element.titolo || "Senza titolo"}
              </h3>
            </div>

            {element.descrizione && (
              <p className="mt-1 text-xs text-slate-500">
                {element.descrizione}
              </p>
            )}

            {element.immagine && (
              <img
                src={element.immagine}
                alt={element.titolo}
                title="Clicca per ingrandire"
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(
                    new CustomEvent("flussi:image", {
                      detail: {
                        src: element.immagine,
                        titolo: element.titolo,
                      },
                    })
                  );
                }}
                className={`mt-2 w-auto cursor-zoom-in rounded-lg border border-slate-100 object-cover transition hover:ring-2 hover:ring-[#0150a0]/40 ${
                  compact ? "max-h-20" : "max-h-28"
                }`}
              />
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {element.links
                .filter((l) => l.url)
                .map((l) => (
                  <a
                    key={l.id}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-bold text-[#0150a0] transition hover:bg-[#e6eef8]"
                  >
                    <Link2 size={10} />
                    {l.label || l.url}
                  </a>
                ))}

              {element.campi.length > 0 && (
                <span
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold ${
                    element.campi.every((c) => c.valore.trim())
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-50 text-slate-500"
                  }`}
                >
                  <ListChecks size={10} />
                  {element.campi.filter((c) => c.valore.trim()).length}/
                  {element.campi.length} campi
                </span>
              )}

              {isDecision && element.rami.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                  <GitBranch size={10} />
                  {element.rami.length} strade
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(element.id, -1);
              }}
              disabled={index === 0}
              className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
              aria-label="Sposta su"
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(element.id, 1);
              }}
              disabled={index === total - 1}
              className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
              aria-label="Sposta giù"
            >
              <ArrowDown size={13} />
            </button>
            <ChevronRight
              size={16}
              className="text-slate-300 transition group-hover:text-[#0150a0]"
            />
          </div>
        </div>
      </div>

      {/* Percorso filtrato: il flusso prosegue solo lungo la strada scelta */}
      {isDecision && activeRamo && (
        <div
          className={
            horizontal
              ? "flex shrink-0 items-center"
              : "flex w-full flex-col items-center"
          }
        >
          <FlowConnector tinted horizontal={horizontal} />
          <span
            className={`rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-amber-700 ${
              horizontal ? "mx-1 shrink-0" : ""
            }`}
          >
            Percorso: {activeRamo.label || "Strada"}
          </span>

          {activeRamo.loop_to ? (
            <button
              id={`flow-jump-ramo-${activeRamo.id}`}
              type="button"
              onClick={() => scrollToElement(activeRamo.loop_to!)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-2 text-[10px] font-black uppercase text-amber-700 shadow-sm transition hover:bg-amber-50"
            >
              <Undo2 size={12} />
              Vai a: {titlesById[activeRamo.loop_to] || "elemento"}
            </button>
          ) : activeRamo.elementi.length === 0 ? (
            <p className="mt-2 text-[11px] text-amber-700/60">
              Strada senza elementi
            </p>
          ) : (
            activeRamo.elementi.map((child, childIndex) => (
              <Fragment key={child.id}>
                <FlowConnector tinted horizontal={horizontal} />
                <ElementNode
                  element={child}
                  index={childIndex}
                  total={activeRamo.elementi.length}
                  compact={compact}
                  horizontal={horizontal}
                  branchFilter={branchFilter}
                  titlesById={titlesById}
                  onOpen={onOpen}
                  onMove={onMove}
                  onAddInRamo={onAddInRamo}
                />
              </Fragment>
            ))
          )}
        </div>
      )}

      {/* Rami (vista orizzontale): strade impilate a destra della decisione.
          I salti "Vai a" sono nodi appesi alla barra verticale, sotto le
          strade reali, con etichetta hover — speculare alla vista verticale */}
      {isDecision && element.rami.length > 0 && !activeRamo && horizontal && (
        <div className="flex shrink-0 items-center">
          <FlowConnector tinted horizontal />
          {(() => {
            const isInlineH = (r: Ramo) =>
              !r.loop_to &&
              r.elementi.length === 1 &&
              Boolean(r.elementi[0].next_to) &&
              r.elementi[0].rami.length === 0;

            const jumpsH = element.rami.filter((r) => Boolean(r.loop_to));
            const inlinesH = element.rami.filter((r) => isInlineH(r));
            const contsH = element.rami.filter(
              (r) => !r.loop_to && !isInlineH(r)
            );
            const multiH = contsH.length > 1;

            return (
              <div className="relative flex flex-col justify-center gap-10 py-3">
                {/* Con una sola strada, il calo verso i salti parte
                    direttamente dalla linea del flusso */}
                {!multiH && jumpsH.length > 0 && (
                  <div className="absolute bottom-0 left-0 top-1/2 w-0.5 -translate-x-1/2 rounded bg-amber-300" />
                )}
                {/* Salti: chip appena sotto il bordo del flusso principale */}
                {jumpsH.map((ramo, j) => {
                  const offset = 64 + j * 40;
                  const chipTop = multiH
                    ? `calc(100% + ${30 + j * 40}px)`
                    : `calc(50% + ${offset}px)`;

                  return (
                    <Fragment key={ramo.id}>
                      {/* Calo dalla linea (o dalla barra) fino al chip */}
                      {multiH ? (
                        <div
                          className="absolute left-0 top-full w-0.5 -translate-x-1/2 rounded bg-amber-300"
                          style={{ height: 30 + j * 40 }}
                        />
                      ) : (
                        <div
                          className="absolute left-0 top-1/2 w-0.5 -translate-x-1/2 rounded bg-amber-300"
                          style={{ height: offset }}
                        />
                      )}
                      <div
                        className="group/vai absolute left-0 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center"
                        style={{ top: chipTop }}
                      >
                        <span
                          id={`flow-jump-ramo-${ramo.id}`}
                          className="inline-flex max-w-[140px] items-center truncate rounded-full bg-amber-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 ring-2 ring-white"
                        >
                          {ramo.label || "Strada"}
                        </span>

                        {/* Etichetta "Vai a": compare solo all'hover */}
                        <button
                          type="button"
                          onClick={() => scrollToElement(ramo.loop_to!)}
                          title={`Vai a: ${
                            titlesById[ramo.loop_to!] || "elemento"
                          }`}
                          className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 inline-flex w-max max-w-[260px] -translate-y-1/2 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-2 text-[10px] font-black uppercase text-amber-700 opacity-0 shadow-lg transition-opacity duration-200 focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/vai:pointer-events-auto group-hover/vai:opacity-100"
                        >
                          <Undo2 size={12} className="shrink-0" />
                          <span className="truncate">
                            Vai a: {titlesById[ramo.loop_to!] || "elemento"}
                          </span>
                        </button>
                      </div>
                    </Fragment>
                  );
                })}

                {/* Strade "inline": un solo step che poi salta — impilate
                    in VERTICALE sotto (o sopra) la linea del flusso:
                    calo → chip → freccia → card */}
                {inlinesH.map((ramo, j) => {
                  const el = ramo.elementi[0];
                  const below = j % 2 === 0;
                  const drop = 20 + Math.floor(j / 2) * 280;

                  return (
                    <div
                      key={ramo.id}
                      className={`absolute left-0 z-10 flex w-80 -translate-x-1/2 items-center ${
                        below
                          ? "top-1/2 flex-col"
                          : "bottom-1/2 flex-col-reverse"
                      }`}
                    >
                      {/* Calo (o risalita) dal giunto sulla linea */}
                      <div
                        className="w-0.5 rounded bg-amber-300"
                        style={{ height: drop + 14 }}
                      />
                      <span className="my-0.5 inline-flex max-w-[140px] items-center truncate rounded-full bg-amber-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 ring-2 ring-white">
                        {ramo.label || "Strada"}
                      </span>
                      <div className={below ? "" : "rotate-180"}>
                        <FlowConnector tinted />
                      </div>

                      <ElementNode
                        element={el}
                        index={0}
                        total={1}
                        compact
                        horizontal={false}
                        suppressNextNode
                        branchFilter={branchFilter}
                        titlesById={titlesById}
                        onOpen={onOpen}
                        onMove={onMove}
                        onAddInRamo={onAddInRamo}
                      />
                    </div>
                  );
                })}

                {contsH.map((ramo, ci) => (
              <div key={ramo.id} className="relative flex items-center">
                {/* Bracci della barra: solo tra il primo e l'ultimo attacco */}
                {multiH && ci > 0 && (
                  <div className="absolute -top-10 bottom-1/2 left-0 w-0.5 rounded bg-amber-300" />
                )}
                {multiH && ci < contsH.length - 1 && (
                  <div className="absolute -bottom-10 left-0 top-1/2 w-0.5 rounded bg-amber-300" />
                )}
                {/* Ponte verso i chip di salto sotto la colonna */}
                {multiH &&
                  ci === contsH.length - 1 &&
                  jumpsH.length > 0 && (
                    <div className="absolute -bottom-3 left-0 top-1/2 w-0.5 rounded bg-amber-300" />
                  )}
                <div className="h-0.5 w-3 shrink-0 rounded bg-amber-300" />
                <span
                  className="mx-1 inline-flex shrink-0 items-center justify-center truncate rounded-full bg-amber-100 px-2.5 py-0.5 text-center text-[9px] font-black uppercase tracking-widest text-amber-700"
                  style={{ width: contsH.length > 1 ? 170 : undefined }}
                  title={ramo.label || "Strada"}
                >
                  {ramo.label || "Strada"}
                </span>
                <FlowConnector tinted horizontal />

                {(
                  <>
                    {ramo.elementi.map((child, childIndex) => (
                      <Fragment key={child.id}>
                        {childIndex > 0 && (
                          <FlowConnector tinted horizontal />
                        )}
                        <ElementNode
                          element={child}
                          index={childIndex}
                          total={ramo.elementi.length}
                          compact
                          horizontal
                          branchFilter={branchFilter}
                          titlesById={titlesById}
                          onOpen={onOpen}
                          onMove={onMove}
                          onAddInRamo={onAddInRamo}
                        />
                      </Fragment>
                    ))}

                    <div className="ml-2 flex shrink-0 items-center gap-1 opacity-50 transition-opacity hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => onAddInRamo(ramo.id, "step")}
                        title="Aggiungi step"
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-[#0150a0] shadow-sm transition hover:bg-[#e6eef8]"
                      >
                        <Milestone size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onAddInRamo(ramo.id, "azione")}
                        title="Aggiungi azione"
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-emerald-600 shadow-sm transition hover:bg-emerald-50"
                      >
                        <Zap size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onAddInRamo(ramo.id, "decisione")}
                        title="Aggiungi decisione"
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-amber-500 shadow-sm transition hover:bg-amber-50"
                      >
                        <GitBranch size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Rami della decisione: il flusso si divarica e poi riconverge */}
      {isDecision && element.rami.length > 0 && !activeRamo && !horizontal && (
        <div className="w-full">
          {/* Connettore verticale dalla decisione */}
          <div className="flex justify-center">
            <FlowConnector tinted />
          </div>

          {/*
            Divaricazione e riconvergenza disegnate con bracci "per-colonna":
            ogni strada porta con sé metà barra a sinistra e metà a destra,
            così le barre restano SEMPRE agganciate al centro dello stub anche
            quando le colonne hanno larghezze diverse (le colonne "Vai a" si
            adattano al contenuto e non rubano più spazio alle strade reali).
          */}
          {(() => {
            const rami = element.rami;
            // Classificazione: salti puri ("Vai a"), strade "inline"
            // (un solo elemento che poi salta altrove: resa orizzontale)
            // e strade che proseguono nel flusso
            const isInline = (r: Ramo) =>
              !r.loop_to &&
              r.elementi.length === 1 &&
              Boolean(r.elementi[0].next_to) &&
              r.elementi[0].rami.length === 0;

            const jumps = rami.filter((r) => Boolean(r.loop_to));
            const inlines = rami.filter((r) => isInline(r));
            const conts = rami.filter((r) => !r.loop_to && !isInline(r));
            const multi = conts.length > 1;
            const lastIndex = conts.length - 1;
            const rejoin = conts.length > 1;

            return (
              <>
              <div className="relative flex w-full items-stretch">
                {/* Salti: nodi agganciati alla barra, vicino al giunto centrale */}
                {jumps.map((ramo, j) => {
                  const offset = 90 + j * 150;
                  return (
                    <Fragment key={ramo.id}>
                      {/* Segmento di barra dal giunto centrale al nodo */}
                      <div
                        className="absolute left-1/2 top-0 h-0.5 rounded bg-amber-300"
                        style={{ width: offset }}
                      />
                      <div
                        className="group/vai absolute top-0 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                        style={{ left: `calc(50% + ${offset}px)` }}
                      >
                        {/* Chip centrato sulla linea orizzontale della barra */}
                        <span
                          id={`flow-jump-ramo-${ramo.id}`}
                          className="inline-flex max-w-[140px] items-center gap-1 truncate rounded-full bg-amber-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 ring-2 ring-white"
                        >
                          {ramo.label || "Strada"}
                        </span>

                        {/* Etichetta "Vai a": compare solo all'hover */}
                        <button
                          type="button"
                          onClick={() => scrollToElement(ramo.loop_to!)}
                          title={`Vai a: ${
                            titlesById[ramo.loop_to!] || "elemento"
                          }`}
                          className="pointer-events-none absolute left-1/2 top-8 z-20 inline-flex w-max max-w-[260px] -translate-x-1/2 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-2 text-[10px] font-black uppercase text-amber-700 opacity-0 shadow-lg transition-opacity duration-200 focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/vai:pointer-events-auto group-hover/vai:opacity-100"
                        >
                          <Undo2 size={12} className="shrink-0" />
                          <span className="truncate">
                            Vai a: {titlesById[ramo.loop_to!] || "elemento"}
                          </span>
                        </button>
                      </div>
                    </Fragment>
                  );
                })}

                {/* Se tutte le strade sono salti, lascia spazio ai nodi */}
                {conts.length === 0 && inlines.length === 0 && (
                  <div className="h-14 w-64" />
                )}

                {conts.map((ramo, i) => (
                  <div
                    key={ramo.id}
                    className="relative flex min-w-[280px] flex-1 flex-col items-center"
                  >
                    {/* Barra di divaricazione: bracci agganciati allo stub */}
                    {multi && (
                      <div className="flex h-0.5 w-full">
                        <div
                          className={`flex-1 rounded-l ${
                            i === 0 ? "" : "bg-amber-300"
                          }`}
                        />
                        <div
                          className={`flex-1 rounded-r ${
                            i === lastIndex ? "" : "bg-amber-300"
                          }`}
                        />
                      </div>
                    )}

                    {/* Stub verticale + etichetta della strada */}
                    <div className="h-3 w-0.5 rounded bg-amber-300" />
                    <span className="my-1 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-amber-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700">
                      {ramo.label || "Strada"}
                    </span>
                    <FlowConnector tinted />

                    {(
                      <div className="flex w-full flex-col items-center px-2">
                        {ramo.elementi.length > 0 && (
                          <div className="flex w-full flex-col items-center">
                            {ramo.elementi.map((child, childIndex) => (
                              <Fragment key={child.id}>
                                {childIndex > 0 && <FlowConnector tinted />}
                                <ElementNode
                                  element={child}
                                  index={childIndex}
                                  total={ramo.elementi.length}
                                  compact
                                  branchFilter={branchFilter}
                                  titlesById={titlesById}
                                  onOpen={onOpen}
                                  onMove={onMove}
                                  onAddInRamo={onAddInRamo}
                                />
                              </Fragment>
                            ))}
                          </div>
                        )}

                        {/* Aggiungi elementi alla strada */}
                        <div
                          className={`flex items-center gap-1 opacity-50 transition-opacity hover:opacity-100 ${
                            ramo.elementi.length > 0 ? "mt-2" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onAddInRamo(ramo.id, "step")}
                            title="Aggiungi step"
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-[#0150a0] shadow-sm transition hover:bg-[#e6eef8]"
                          >
                            <Milestone size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onAddInRamo(ramo.id, "azione")}
                            title="Aggiungi azione"
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-emerald-600 shadow-sm transition hover:bg-emerald-50"
                          >
                            <Zap size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onAddInRamo(ramo.id, "decisione")}
                            title="Aggiungi decisione"
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-amber-500 shadow-sm transition hover:bg-amber-50"
                          >
                            <GitBranch size={12} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Spaziatore + risalita verso la riconvergenza */}
                    <div className="min-h-2 flex-1" />
                    {rejoin && (
                      <div className="h-4 w-0.5 rounded bg-amber-300" />
                    )}

                    {/* Barra di riconvergenza tra le strade che proseguono */}
                    {rejoin && (
                      <div className="flex h-0.5 w-full">
                        <div
                          className={`flex-1 rounded-l ${
                            i === 0 ? "" : "bg-amber-300"
                          }`}
                        />
                        <div
                          className={`flex-1 rounded-r ${
                            i === lastIndex ? "" : "bg-amber-300"
                          }`}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {/* Strade "inline": fuori dal bordo delle entità, agganciate
                    al giunto. Il flusso principale resta centrato sull'asse. */}
                {inlines.length > 0 && (
                  <>
                    <div
                      className="absolute left-1/2 top-0 z-10 flex flex-col gap-3"
                      style={{ width: "44rem" }}
                    >
                      {inlines.map((ramo) => {
                        const el = ramo.elementi[0];
                        return (
                          <div
                            key={ramo.id}
                            className="relative flex items-center self-start pl-80"
                          >
                            {/* Raccordo: braccio oltre il bordo delle card,
                                poi discesa al livello dell'entità */}
                            <div className="absolute left-0 top-0 h-0.5 w-80 rounded bg-amber-300" />
                            <div className="absolute bottom-1/2 left-80 top-0 w-0.5 -translate-x-1/2 rounded bg-amber-300" />

                            <span className="inline-flex max-w-[140px] items-center truncate rounded-full bg-amber-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700">
                              {ramo.label || "Strada"}
                            </span>
                            <FlowConnector tinted horizontal />
                            <ElementNode
                              element={el}
                              index={0}
                              total={1}
                              compact={false}
                              horizontal
                              suppressNextNode
                              branchFilter={branchFilter}
                              titlesById={titlesById}
                              onOpen={onOpen}
                              onMove={onMove}
                              onAddInRamo={onAddInRamo}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Riserva di larghezza: rende raggiungibili con lo scroll
                  le strisce assolute che sporgono oltre le entità */}
              {inlines.length > 0 && (
                <div aria-hidden="true" className="h-0 w-[88rem]" />
              )}
              </>
            );
          })()}
        </div>
      )}

      {/* Freccia in uscita reindirizzata: punta a un altro elemento */}
      {element.next_to && !suppressNextNode && (
        <div
          className={
            horizontal ? "flex items-center" : "flex flex-col items-center"
          }
        >
          <FlowConnector tinted horizontal={horizontal} />
          <button
            id={`flow-jump-${element.id}`}
            type="button"
            onClick={() => scrollToElement(element.next_to!)}
            title="Vai all'elemento a cui punta la freccia"
            className="inline-flex max-w-full items-center gap-1.5 truncate rounded-xl border border-amber-300 bg-white px-3 py-2 text-[10px] font-black uppercase text-amber-700 shadow-sm transition hover:bg-amber-50"
          >
            <Undo2 size={12} />
            Vai a: {titlesById[element.next_to] || "elemento"}
          </button>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// MODALE DETTAGLIO ELEMENTO
// =====================================================================

function ElementDetailPanel({
  element,
  saving,
  allElements,
  onChange,
  onSave,
  onDelete,
  onCollapse,
  onClose,
}: {
  element: FlowElement;
  saving: boolean;
  allElements: { id: string; titolo: string; tipo: ElementoTipo }[];
  onChange: (el: FlowElement) => void;
  onSave: () => void;
  onDelete: () => void;
  onCollapse: () => void;
  onClose: () => void;
}) {
  const cfg = TIPO_CONFIG[element.tipo];
  const Icon = cfg.icon;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [copiedCampoId, setCopiedCampoId] = useState<string | null>(null);

  const copyCampoValore = async (campo: CampoItem) => {
    try {
      await navigator.clipboard.writeText(campo.valore || "");
      setCopiedCampoId(campo.id);
      setTimeout(() => setCopiedCampoId(null), 1500);
    } catch {
      alert("Copia non riuscita");
    }
  };

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      onChange({ ...element, immagine: dataUrl });
    } catch (err) {
      alert("Immagine non valida o troppo grande");
      console.error(err);
    }
  };

  return (
    <aside className="animate-app-slide-in-right sticky top-4 flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_4px_rgba(15,23,42,0.06),0_16px_32px_-12px_rgba(15,23,42,0.14)]">
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b border-slate-100 bg-gradient-to-r px-6 py-5 ${cfg.headerGrad}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ${cfg.iconBox} ${
                element.tipo === "decisione" ? "rotate-45" : ""
              }`}
            >
              <Icon
                size={18}
                className={element.tipo === "decisione" ? "-rotate-45" : ""}
              />
            </div>
            <div>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${cfg.chip}`}
              >
                {cfg.label}
              </span>
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                {element.titolo || "Nuovo elemento"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCollapse}
              className="rounded-full p-2 text-slate-400 transition-all hover:bg-white hover:text-slate-700 hover:shadow-sm"
              aria-label="Comprimi pannello"
              title="Comprimi"
            >
              <PanelRightClose size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition-all hover:rotate-90 hover:bg-white hover:text-slate-700 hover:shadow-sm"
              aria-label="Chiudi"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Corpo scrollabile */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Tipo */}
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
              Tipo elemento
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1">
              {(Object.keys(TIPO_CONFIG) as ElementoTipo[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...element,
                      tipo: t,
                      rami:
                        t === "decisione" && element.rami.length === 0
                          ? defaultRami()
                          : element.rami,
                    })
                  }
                  className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-black uppercase transition-all ${
                    element.tipo === t
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {TIPO_CONFIG[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Freccia in uscita: dove punta dopo questo elemento */}
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
              Freccia in uscita
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
              <Undo2 size={12} className="shrink-0 text-amber-500" />
              <select
                value={element.next_to || ""}
                onChange={(e) =>
                  onChange({ ...element, next_to: e.target.value || null })
                }
                className="flex-1 bg-transparent text-xs font-bold outline-none"
              >
                <option value="">Prosegue al passo successivo</option>
                {allElements
                  .filter((x) => x.id !== element.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      → Vai a: {x.titolo || "Senza titolo"} (
                      {TIPO_CONFIG[x.tipo].label})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Rami della decisione */}
          {element.tipo === "decisione" && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <label className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700">
                  <GitBranch size={12} /> Strade della decisione
                </label>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...element,
                      rami: [
                        ...element.rami,
                        {
                          id: newId(),
                          label: `Strada ${element.rami.length + 1}`,
                          elementi: [],
                          loop_to: null,
                        },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1.5 text-[10px] font-black uppercase text-amber-700 transition hover:bg-amber-200"
                >
                  <Plus size={11} /> Aggiungi strada
                </button>
              </div>

              <p className="mb-3 text-[11px] text-amber-700/70">
                La decisione divide il flusso in più strade. Gli elementi di
                ogni strada si aggiungono dal canvas del flusso.
              </p>

              <div className="space-y-2">
                {element.rami.map((ramo) => (
                  <div
                    key={ramo.id}
                    className="rounded-xl border border-amber-200/60 bg-white/70 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        value={ramo.label}
                        onChange={(e) =>
                          onChange({
                            ...element,
                            rami: element.rami.map((r) =>
                              r.id === ramo.id
                                ? { ...r, label: e.target.value }
                                : r
                            ),
                          })
                        }
                        placeholder="Nome strada (es. Sì / No)"
                        className="flex-1 rounded-xl border border-transparent bg-white px-3 py-2 text-xs font-black uppercase tracking-wide outline-none transition-all focus:border-amber-300"
                      />
                      <span className="shrink-0 text-[10px] font-bold text-amber-700/60">
                        {ramo.loop_to ? "loop" : `${ramo.elementi.length} elem.`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            ramo.elementi.length > 0 &&
                            !confirm(
                              `La strada "${ramo.label}" contiene ${ramo.elementi.length} elementi che verranno eliminati. Continuare?`
                            )
                          ) {
                            return;
                          }
                          onChange({
                            ...element,
                            rami: element.rami.filter((r) => r.id !== ramo.id),
                          });
                        }}
                        className="rounded-lg p-1.5 text-amber-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label="Rimuovi strada"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Loop: questa strada torna a un elemento precedente */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <Undo2 size={11} className="shrink-0 text-amber-500" />
                      <select
                        value={ramo.loop_to || ""}
                        onChange={(e) =>
                          onChange({
                            ...element,
                            rami: element.rami.map((r) =>
                              r.id === ramo.id
                                ? { ...r, loop_to: e.target.value || null }
                                : r
                            ),
                          })
                        }
                        className="flex-1 rounded-lg bg-amber-50/70 px-2 py-1.5 text-[10px] font-bold outline-none"
                      >
                        <option value="">
                          Prosegue con i propri elementi
                        </option>
                        {allElements
                          .filter((x) => x.id !== element.id)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              → Vai a: {x.titolo || "Senza titolo"} (
                              {TIPO_CONFIG[x.tipo].label})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Titolo + descrizione breve */}
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
              Titolo *
            </label>
            <input
              value={element.titolo}
              onChange={(e) => onChange({ ...element, titolo: e.target.value })}
              className="w-full rounded-xl border border-transparent bg-slate-50 px-4 py-2.5 text-sm font-semibold outline-none transition-all focus:border-slate-300 focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
              Descrizione breve
            </label>
            <input
              value={element.descrizione}
              onChange={(e) =>
                onChange({ ...element, descrizione: e.target.value })
              }
              placeholder="Mostrata sulla card del flusso"
              className="w-full rounded-xl border border-transparent bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:border-slate-300 focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
              Descrizione completa
            </label>
            <textarea
              value={element.descrizione_completa}
              onChange={(e) =>
                onChange({ ...element, descrizione_completa: e.target.value })
              }
              rows={5}
              placeholder="Descrizione dettagliata di cosa fare in questo punto del flusso"
              className="w-full resize-none rounded-xl border border-transparent bg-slate-50 px-4 py-2.5 text-sm leading-relaxed outline-none transition-all focus:border-slate-300 focus:bg-white"
            />
          </div>

          {/* Immagine */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <label className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <ImageIcon size={12} className="text-[#0150a0]" /> Immagine
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#e6eef8] px-2.5 py-1.5 text-[10px] font-black uppercase text-[#0150a0] transition hover:bg-[#d3e2f4]"
                >
                  <Upload size={11} /> Carica
                </button>

                {element.immagine && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...element, immagine: "" })}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[10px] font-black uppercase text-red-600 transition hover:bg-red-100"
                  >
                    <Trash2 size={11} /> Rimuovi
                  </button>
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handleImageFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            {element.immagine ? (
              <img
                src={element.immagine}
                alt="Immagine elemento"
                title="Clicca per ingrandire"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("flussi:image", {
                      detail: {
                        src: element.immagine,
                        titolo: element.titolo,
                      },
                    })
                  )
                }
                className="max-h-48 w-auto cursor-zoom-in rounded-xl border border-slate-200 object-contain transition hover:ring-2 hover:ring-[#0150a0]/40"
              />
            ) : (
              <p className="text-xs text-slate-400">
                Nessuna immagine. Carica un file (viene ridimensionato
                automaticamente) o incolla un URL qui sotto.
              </p>
            )}

            <input
              value={element.immagine.startsWith("data:") ? "" : element.immagine}
              onChange={(e) =>
                onChange({ ...element, immagine: e.target.value })
              }
              placeholder="Oppure URL immagine: https://..."
              className="mt-2 w-full rounded-xl border border-transparent bg-white px-3 py-2 text-xs outline-none transition-all focus:border-slate-300"
            />
          </div>

          {/* Link */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <label className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <Link2 size={12} className="text-[#0150a0]" /> Link utili
              </label>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...element,
                    links: [
                      ...element.links,
                      { id: newId(), label: "", url: "" },
                    ],
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg bg-[#e6eef8] px-2.5 py-1.5 text-[10px] font-black uppercase text-[#0150a0] transition hover:bg-[#d3e2f4]"
              >
                <Plus size={11} /> Aggiungi link
              </button>
            </div>

            {element.links.length === 0 && (
              <p className="text-xs text-slate-400">Nessun link.</p>
            )}

            <div className="space-y-2">
              {element.links.map((link) => (
                <div key={link.id} className="flex items-center gap-2">
                  <input
                    value={link.label}
                    onChange={(e) =>
                      onChange({
                        ...element,
                        links: element.links.map((l) =>
                          l.id === link.id
                            ? { ...l, label: e.target.value }
                            : l
                        ),
                      })
                    }
                    placeholder="Etichetta"
                    className="w-36 rounded-xl border border-transparent bg-white px-3 py-2 text-xs font-semibold outline-none transition-all focus:border-slate-300"
                  />
                  <input
                    value={link.url}
                    onChange={(e) =>
                      onChange({
                        ...element,
                        links: element.links.map((l) =>
                          l.id === link.id ? { ...l, url: e.target.value } : l
                        ),
                      })
                    }
                    placeholder="https://..."
                    className="flex-1 rounded-xl border border-transparent bg-white px-3 py-2 text-xs outline-none transition-all focus:border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...element,
                        links: element.links.filter((l) => l.id !== link.id),
                      })
                    }
                    className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                    aria-label="Rimuovi link"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Campi da valorizzare */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <label className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <ListChecks size={12} className="text-[#0150a0]" /> Campi da
                valorizzare
              </label>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...element,
                    campi: [
                      ...element.campi,
                      {
                        id: newId(),
                        label: "",
                        descrizione: "",
                        valore: "",
                        tipo_valore: "variabile" as const,
                      },
                    ],
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg bg-[#e6eef8] px-2.5 py-1.5 text-[10px] font-black uppercase text-[#0150a0] transition hover:bg-[#d3e2f4]"
              >
                <Plus size={11} /> Aggiungi campo
              </button>
            </div>

            {element.campi.length === 0 && (
              <p className="text-xs text-slate-400">
                Nessun campo. Aggiungi i campi che vanno compilati in questo
                punto del flusso.
              </p>
            )}

            <div className="space-y-2">
              {element.campi.map((campo) => {
                const isFisso = campo.tipo_valore === "fisso";

                const updateCampo = (patch: Partial<CampoItem>) =>
                  onChange({
                    ...element,
                    campi: element.campi.map((c) =>
                      c.id === campo.id ? { ...c, ...patch } : c
                    ),
                  });

                return (
                  <div
                    key={campo.id}
                    className={`rounded-xl border p-3 ${
                      isFisso
                        ? "border-[#0150a0]/20 bg-[#f4f8fd]"
                        : "border-slate-100 bg-white"
                    }`}
                  >
                    {/* Riga 1: nome campo + fisso/variabile + elimina */}
                    <div className="flex items-center gap-2">
                      <input
                        value={campo.label}
                        onChange={(e) => updateCampo({ label: e.target.value })}
                        placeholder="Nome campo (es. Codice CHG)"
                        className="flex-1 rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wide outline-none transition-all focus:border-slate-300"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          updateCampo({
                            tipo_valore: isFisso ? "variabile" : "fisso",
                          })
                        }
                        title={
                          isFisso
                            ? "Valore fisso: sempre questo (clicca per renderlo variabile)"
                            : "Clicca se il valore è sempre lo stesso"
                        }
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                          isFisso
                            ? "bg-[#0150a0] text-[#ffffff] shadow-sm"
                            : "border border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
                        }`}
                      >
                        Fisso
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...element,
                            campi: element.campi.filter(
                              (c) => c.id !== campo.id
                            ),
                          })
                        }
                        className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                        aria-label="Rimuovi campo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Riga 2: descrizione del campo (testo multiriga) */}
                    <textarea
                      value={campo.descrizione}
                      onChange={(e) =>
                        updateCampo({ descrizione: e.target.value })
                      }
                      rows={3}
                      placeholder="Descrizione: a cosa serve il campo e come va valorizzato"
                      className="mt-2 w-full resize-none rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-xs leading-relaxed outline-none transition-all focus:border-slate-300"
                    />

                    {/* Riga 3: valore con indicazione chiara */}
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={campo.valore}
                        onChange={(e) =>
                          updateCampo({ valore: e.target.value })
                        }
                        placeholder={
                          isFisso
                            ? "Valore fisso (sempre questo)"
                            : "Valore attuale / esempio (può variare)"
                        }
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold outline-none transition-all ${
                          isFisso
                            ? "border-[#0150a0]/20 bg-white text-[#0150a0] focus:border-[#0150a0]/40"
                            : "border-transparent bg-slate-50 focus:border-slate-300"
                        }`}
                      />
                      {isFisso && (
                        <button
                          type="button"
                          onClick={() => void copyCampoValore(campo)}
                          title="Copia il valore fisso"
                          className={`shrink-0 rounded-lg p-2 transition-all ${
                            copiedCampoId === campo.id
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-[#e6eef8] text-[#0150a0] hover:bg-[#d3e2f4]"
                          }`}
                        >
                          {copiedCampoId === campo.id ? (
                            <Check size={13} />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <AppButton
            type="button"
            variant="danger"
            onClick={onDelete}
            className="gap-1.5 text-[10px] font-black uppercase"
          >
            <Trash2 size={12} /> Elimina
          </AppButton>

          <div className="flex gap-2">
            <AppButton type="button" variant="secondary" onClick={onClose}>
              Annulla
            </AppButton>
            <AppButton
              type="button"
              onClick={onSave}
              disabled={saving || !element.titolo.trim()}
              className="gap-2"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Salva elemento
            </AppButton>
          </div>
        </div>
    </aside>
  );
}

// =====================================================================
// FONTI GOOGLE (documento + diagramma draw.io, sempre aggiornati)
// =====================================================================

type ClienteFlussoGoogle = { key: string; label: string };

type FlussoSource = {
  id: string;
  title: string | null;
  modifiedAt: string | null;
  url: string;
  error: string | null;
};

type FlussoGoogleData = {
  cliente: string;
  doc: (FlussoSource & { html: string | null }) | null;
  diagram: (FlussoSource & { xml: string | null }) | null;
  fetchedAt: string;
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FontiGoogleView() {
  const [clienti, setClienti] = useState<ClienteFlussoGoogle[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [data, setData] = useState<FlussoGoogleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const diagramContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/flussi-operativi");
        const json = await res.json();
        const list: ClienteFlussoGoogle[] = json.clienti || [];
        setClienti(list);
        if (list.length > 0) setSelected(list[0].key);
      } catch {
        setError("Errore caricamento elenco fonti");
      }
    })();
  }, []);

  const loadFlusso = useCallback(async (clienteKey: string) => {
    if (!clienteKey) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/flussi-operativi?cliente=${encodeURIComponent(clienteKey)}`,
        { cache: "no-store" }
      );
      const json = await res.json();

      if (!res.ok) {
        setData(null);
        setError(json.error || "Errore caricamento fonte");
        return;
      }

      setData(json as FlussoGoogleData);
    } catch {
      setData(null);
      setError("Errore di rete durante il caricamento");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) void loadFlusso(selected);
  }, [selected, loadFlusso]);

  // Rendering del diagramma draw.io con il viewer ufficiale diagrams.net
  useEffect(() => {
    const container = diagramContainerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const xml = data?.diagram?.xml;
    if (!xml) return;

    const div = document.createElement("div");
    div.className = "mxgraph";
    div.style.maxWidth = "100%";
    div.setAttribute(
      "data-mxgraph",
      JSON.stringify({
        highlight: "#0150a0",
        nav: true,
        resize: true,
        toolbar: "zoom layers",
        "toolbar-position": "top",
        xml,
      })
    );
    container.appendChild(div);

    const render = () => {
      try {
        (window as any).GraphViewer?.processElements?.();
      } catch (err) {
        console.error("Errore rendering diagramma:", err);
      }
    };

    if ((window as any).GraphViewer) {
      render();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-drawio-viewer="true"]'
    );

    if (existing) {
      existing.addEventListener("load", render, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://viewer.diagrams.net/js/viewer-static.min.js";
    script.async = true;
    script.dataset.drawioViewer = "true";
    script.addEventListener("load", render, { once: true });
    document.body.appendChild(script);
  }, [data?.diagram?.xml]);

  return (
    <div>
      <AppCard className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Cliente
            </span>

            {clienti.length === 0 && (
              <span className="text-sm text-slate-400">
                Nessuna fonte configurata
              </span>
            )}

            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
              {clienti.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setSelected(c.key)}
                  className={`rounded-lg px-5 py-2.5 text-[10px] font-black uppercase transition-all ${
                    selected === c.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <AppButton
            type="button"
            variant="secondary"
            onClick={() => void loadFlusso(selected)}
            disabled={loading || !selected}
            className="gap-2 text-[10px] font-black uppercase"
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Aggiorna
          </AppButton>
        </div>
      </AppCard>

      {error && (
        <AppCard className="mb-6 border-red-200 bg-red-50">
          <p className="text-sm font-bold text-red-700">{error}</p>
          <p className="mt-1 text-xs text-red-500">
            Verifica che i file siano condivisi in lettura con il service
            account Google configurato nel gestionale.
          </p>
        </AppCard>
      )}

      {loading && !data && (
        <AppCard className="flex min-h-[300px] items-center justify-center">
          <span className="animate-pulse text-sm font-black uppercase tracking-widest text-slate-300">
            Caricamento fonte...
          </span>
        </AppCard>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
          {data.diagram && (
            <AppCard padded={false} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6eef8] text-[#0150a0]">
                    <Workflow size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">
                      {data.diagram.title || "Diagramma di flusso"}
                    </h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Ultima modifica:{" "}
                      {formatDateTime(data.diagram.modifiedAt)}
                    </p>
                  </div>
                </div>

                <a
                  href={data.diagram.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 transition hover:bg-slate-50"
                >
                  <ExternalLink size={11} /> Apri in draw.io
                </a>
              </div>

              {data.diagram.error ? (
                <p className="p-5 text-sm font-bold text-red-600">
                  {data.diagram.error}
                </p>
              ) : (
                <div
                  ref={diagramContainerRef}
                  className="min-h-[480px] overflow-auto bg-white p-4"
                />
              )}
            </AppCard>
          )}

          {data.doc && (
            <AppCard padded={false} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6eef8] text-[#0150a0]">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">
                      {data.doc.title || "Documento flussi"}
                    </h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Ultima modifica: {formatDateTime(data.doc.modifiedAt)}
                    </p>
                  </div>
                </div>

                <a
                  href={data.doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 transition hover:bg-slate-50"
                >
                  <ExternalLink size={11} /> Apri in Google Docs
                </a>
              </div>

              {data.doc.error ? (
                <p className="p-5 text-sm font-bold text-red-600">
                  {data.doc.error}
                </p>
              ) : (
                <iframe
                  title="Documento flussi operativi"
                  sandbox=""
                  srcDoc={data.doc.html || ""}
                  className="h-[70vh] w-full bg-white"
                />
              )}
            </AppCard>
          )}
        </div>
      )}
    </div>
  );
}
