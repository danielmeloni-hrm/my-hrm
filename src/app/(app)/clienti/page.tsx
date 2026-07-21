"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import AppPage from "@/components/ui/AppPage";
import AppCard from "@/components/ui/AppCard";
import {
  Building2,
  Search,
  MoreVertical,
  Workflow,
  UserPlus,
  X,
  Save,
} from "lucide-react";
import AbilitazioneUtentiModal from "@/components/clienti/AbilitazioneUtentiModal";
import ModalPortal from "@/components/ui/ModalPortal";

const supabase = createClient();

type Cliente = {
  id: string;
  nome: string;
  creato_at: string;
};

type ProjectStep = {
  key: string;
  label: string;
};

const PROJECT_STEPS: ProjectStep[] = [
  { key: "step_documento_operativo", label: "Documento Operativo" },
  { key: "step_gtm_ga4_coll", label: "GTM / GA4 Collaudo" },
  { key: "step_sviluppo_testing_coll", label: "Sviluppo / Testing Coll" },
  { key: "step_gtm_ga4_prod", label: "GTM / GA4 Produzione" },
  { key: "step_sviluppo_testing_prod", label: "Sviluppo / Testing Prod" },
  { key: "step_ga4_realtime_rilascio", label: "GA4 Realtime / Rilascio" },
  { key: "step_report_manutenzione", label: "Report Manutenzione" },
  { key: "step_modello_dati", label: "Modello Dati" },
  { key: "step_modello_dati_bq", label: "Modello Dati BQ" },
  { key: "step_doc_confronto_applicativi", label: "Doc Confronto Applicativi" },
  { key: "step_report_business", label: "Report Business" },
  { key: "step_powerbi", label: "Power BI" },
];

export default function ClientiPage() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [filteredClienti, setFilteredClienti] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [openMenuClienteId, setOpenMenuClienteId] = useState<string | null>(
    null
  );

  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clienteAbilitazione, setClienteAbilitazione] = useState<Cliente | null>(
    null
  );
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [savingSteps, setSavingSteps] = useState(false);

  useEffect(() => {
    loadClienti();
  }, []);

  useRealtimeTable({
    supabase,
    table: "clienti",
    onChange: () => {
      void loadClienti();
    },
  });

  useEffect(() => {
    setFilteredClienti(
      clienti.filter((c) =>
        c.nome.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, clienti]);

  async function loadClienti() {
    const { data, error } = await supabase
      .from("clienti")
      .select("*")
      .order("nome");

    console.log("CLIENTI", data);
    console.log("ERROR", error);

    if (!error) {
      setClienti(data || []);
      setFilteredClienti(data || []);
    }

    setLoading(false);
  }

  async function openFlussoProgetto(cliente: Cliente) {
    setSelectedCliente(cliente);
    setOpenMenuClienteId(null);

    const { data, error } = await supabase
      .from("clienti_flusso_progetto")
      .select("steps")
      .eq("cliente_id", cliente.id)
      .maybeSingle();

    console.log("FLUSSO", data);
    console.log("FLUSSO ERROR", error);

    if (data?.steps?.length) {
      setSelectedSteps(data.steps);
    } else {
      setSelectedSteps(PROJECT_STEPS.map((step) => step.key));
    }
  }

  function toggleStep(stepKey: string) {
    setSelectedSteps((prev) =>
      prev.includes(stepKey)
        ? prev.filter((key) => key !== stepKey)
        : [...prev, stepKey]
    );
  }

  async function saveFlussoProgetto() {
  if (!selectedCliente) return;

  setSavingSteps(true);

  const { data, error } = await supabase
    .from("clienti_flusso_progetto")
    .upsert(
      {
        cliente_id: selectedCliente.id,
        steps: selectedSteps,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "cliente_id",
      }
    )
    .select();

  console.log("SAVE FLUSSO DATA", data);
  console.log("SAVE FLUSSO ERROR", error);

  setSavingSteps(false);

  if (error) {
    alert(`Errore salvataggio flusso: ${error.message}`);
    return;
  }

  setSelectedCliente(null);
}

  return (
    <AppPage
      title="Clienti"
      subtitle="Elenco dei clienti presenti nel sistema"
      icon={<Building2 size={22} />}
      maxWidth="full"
    >
      <div className="space-y-6 pb-16">
        <AppCard padded={false} className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />

            <input
              type="text"
              placeholder="Cerca cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-transparent bg-slate-50 pl-10 pr-4 py-2.5 text-sm outline-none transition-all focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-[#0150a0]/20"
            />
          </div>
        </AppCard>

        <AppCard padded={false} className="overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">
              {filteredClienti.length} clienti
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Caricamento...</div>
          ) : filteredClienti.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nessun cliente trovato
            </div>
          ) : (
            <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredClienti.map((cliente) => (
                <div
                  key={cliente.id}
                  className="relative rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-md transition"
                >
                  <div className="absolute right-4 top-4">
                    <button
                      onClick={() =>
                        setOpenMenuClienteId(
                          openMenuClienteId === cliente.id ? null : cliente.id
                        )
                      }
                      className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {openMenuClienteId === cliente.id && (
                      <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                        <button
                          onClick={() => openFlussoProgetto(cliente)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                        >
                          <Workflow className="h-4 w-4 text-[#0150a0]" />
                          Flusso Progetto
                        </button>

                        <button
                          onClick={() => {
                            setClienteAbilitazione(cliente);
                            setOpenMenuClienteId(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                        >
                          <UserPlus className="h-4 w-4 text-[#0150a0]" />
                          Abilitazione Utenti
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pr-10">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                      <Building2 className="h-5 w-5 text-[#0150a0]" />
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {cliente.nome}
                      </h3>

                      <p className="text-xs text-gray-500">Cliente</p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-500">Creato il</p>

                    <p className="text-sm font-medium text-gray-700">
                      {new Date(cliente.creato_at).toLocaleDateString("it-IT")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AppCard>
      </div>

      {selectedCliente && (
        <ModalPortal>
          <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/40 p-4">
          <div className="mx-auto my-4 flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Flusso Progetto
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedCliente.nome}
                </p>
              </div>

              <button
                onClick={() => setSelectedCliente(null)}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-6">
              {PROJECT_STEPS.map((step) => {
                const active = selectedSteps.includes(step.key);

                return (
                  <button
                    key={step.key}
                    onClick={() => toggleStep(step.key)}
                    className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                      active
                        ? "border-[#0150a0] bg-blue-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {step.label}
                      </p>
                      <p className="text-xs text-gray-500">{step.key}</p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        active
                          ? "bg-[#0150a0] text-[#ffffff]"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {active ? "Attivo" : "Disattivo"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setSelectedCliente(null)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Annulla
              </button>

              <button
                onClick={saveFlussoProgetto}
                disabled={savingSteps}
                className="flex items-center gap-2 rounded-xl bg-[#0150a0] px-4 py-2 text-sm font-semibold text-[#ffffff] hover:bg-[#014080] disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingSteps ? "Salvataggio..." : "Salva flusso"}
              </button>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {clienteAbilitazione && (
        <AbilitazioneUtentiModal
          clienteId={clienteAbilitazione.id}
          clienteNome={clienteAbilitazione.nome}
          onClose={() => setClienteAbilitazione(null)}
        />
      )}
    </AppPage>
  );
}