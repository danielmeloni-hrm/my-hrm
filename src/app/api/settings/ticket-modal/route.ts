import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  CONFIG_PREDEFINITA,
  normalizeTicketModalConfig,
} from "@/lib/ticket-modal-fields";

async function getSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
}

export async function GET() {
  const supabase = await getSupabase();

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("ticket_modal_preferences")
    .select("sezioni, campi")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) {
    // Tabella assente o non leggibile: si torna alla vista predefinita.
    console.error("Errore lettura preferenze popup ticket:", error);
    return NextResponse.json({ ok: true, config: CONFIG_PREDEFINITA });
  }

  return NextResponse.json({
    ok: true,
    config: data ? normalizeTicketModalConfig(data) : CONFIG_PREDEFINITA,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabase();

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const config = normalizeTicketModalConfig(body);

  const { error } = await supabase.from("ticket_modal_preferences").upsert(
    {
      user_id: userData.user.id,
      sezioni: config.sezioni,
      campi: config.campi,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, config });
}
