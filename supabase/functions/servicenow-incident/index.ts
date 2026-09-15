import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function getSecretKey() {
  const currentKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (currentKeys) {
    const parsed = JSON.parse(currentKeys);
    if (parsed.default) return parsed.default;
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function mapPriority(rawPriority: unknown) {
  const value = String(rawPriority || "").trim().toLowerCase();
  if (/^1\b/.test(value) || value.includes("critical") || value.includes("urgente")) return "Urgente";
  if (/^2\b/.test(value) || value.includes("high") || value.includes("alta")) return "Alta";
  if (/^[45]\b/.test(value) || value.includes("low") || value.includes("bassa")) return "Bassa";
  return "Media";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "Metodo non consentito." }, 405);

  try {
    const payload = await request.json();
    const bridgeSecret = Deno.env.get("SERVICENOW_BRIDGE_SECRET") || "";
    const defaultUserId = Deno.env.get("DEFAULT_UTENTE_ID") || "";
    const defaultAssigneeId = Deno.env.get("DEFAULT_ASSIGNEE_ID") || defaultUserId;
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const secretKey = getSecretKey();

    if (!bridgeSecret || payload.secret !== bridgeSecret) {
      return jsonResponse({ ok: false, error: "Chiave condivisa non valida." }, 401);
    }
    if (!supabaseUrl || !secretKey) throw new Error("Configurazione Supabase server incompleta.");
    if (!defaultUserId) throw new Error("Configura il secret DEFAULT_UTENTE_ID.");

    const ticket = String(payload.ticket || "").trim().toUpperCase();
    if (!/^INC\d+$/.test(ticket)) {
      return jsonResponse({ ok: false, error: "Numero Incident non valido." }, 400);
    }

    const supabase = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: client, error: clientError } = await supabase
      .from("clienti")
      .select("id")
      .ilike("nome", "Esselunga")
      .limit(1)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client?.id) throw new Error("Cliente Esselunga non trovato in public.clienti.");

    const { data: existing, error: existingError } = await supabase
      .from("incident")
      .select("id")
      .eq("n_tag", ticket)
      .maybeSingle();

    if (existingError) throw existingError;

    const eventDate = new Date(payload.eventAt || Date.now());
    if (Number.isNaN(eventDate.getTime())) throw new Error("Data evento non valida.");
    const date = eventDate.toISOString().slice(0, 10);
    const closed = String(payload.status || "").toLowerCase() === "chiuso";
    const title = String(payload.shortDescription || payload.description || ticket).trim().slice(0, 250);

    const record = {
      utente_id: defaultUserId,
      assignee: defaultAssigneeId || null,
      cliente_id: client.id,
      n_tag: ticket,
      titolo: title,
      descrizione: String(payload.description || payload.shortDescription || "").trim(),
      applicativo: payload.application ? [String(payload.application)] : [],
      priorita: mapPriority(payload.priority),
      tipologia_ticket: "Incident",
      tipo_di_attivita: "Incident Resolution",
      tool: "GA4",
      stato: closed ? "Completato" : "In stand-by",
      percentuale_avanzamento: closed ? 100 : 5,
      stato_collaudo: "Da iniziare",
      in_lavorazione_ora: false,
      data_segnalazione: date,
      data_chiusura_attivita: closed ? date : null,
      note: String(payload.noteText || "").trim() || null
    };

    const { data: incident, error: upsertError } = await supabase
      .from("incident")
      .upsert(record, { onConflict: "n_tag" })
      .select("id, n_tag, stato")
      .single();

    if (upsertError) throw upsertError;
    return jsonResponse({
      ok: true,
      action: existing ? "updated" : "inserted",
      incident
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Errore inatteso."
    }, 500);
  }
});
