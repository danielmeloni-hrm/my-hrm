"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Workflow,
} from "lucide-react";
import AppPage from "@/components/ui/AppPage";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

type ClienteFlusso = { key: string; label: string };

type FlussoSource = {
  id: string;
  title: string | null;
  modifiedAt: string | null;
  url: string;
  error: string | null;
};

type FlussoData = {
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

/**
 * Flussi Operativi per cliente.
 *
 * Le fonti restano su Google Drive (documento + diagramma draw.io) e
 * vengono lette in tempo reale dall'API /api/flussi-operativi: quando i
 * file vengono aggiornati, il flusso mostrato qui resta aggiornato.
 */
export default function FlussiOperativiPage() {
  const [clienti, setClienti] = useState<ClienteFlusso[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [data, setData] = useState<FlussoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const diagramContainerRef = useRef<HTMLDivElement | null>(null);

  // Elenco clienti con flussi configurati
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/flussi-operativi");
        const json = await res.json();
        const list: ClienteFlusso[] = json.clienti || [];
        setClienti(list);
        if (list.length > 0) setSelected(list[0].key);
      } catch {
        setError("Errore caricamento elenco flussi");
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
        setError(json.error || "Errore caricamento flusso");
        return;
      }

      setData(json as FlussoData);
    } catch {
      setData(null);
      setError("Errore di rete durante il caricamento del flusso");
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
    <AppPage
      title="Flussi Operativi"
      subtitle="Flussi per attività dei clienti — fonti Google sempre aggiornate"
      icon={<Workflow size={22} />}
      maxWidth="full"
      actions={
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
      }
    >
      {/* Selettore cliente */}
      <AppCard className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Cliente
          </span>

          {clienti.length === 0 && (
            <span className="text-sm text-slate-400">
              Nessun flusso configurato
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
            Caricamento flusso...
          </span>
        </AppCard>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
          {/* Diagramma draw.io */}
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
                      Ultima modifica: {formatDateTime(data.diagram.modifiedAt)}
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

          {/* Documento Google */}
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
    </AppPage>
  );
}
