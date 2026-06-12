import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getUser(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) return null;

  return data.user;
}

export async function GET(req: Request) {
  const user = await getUser(req);

  if (!user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("ai_conversations")
    .select(`
      id,
      title,
      created_at,
      updated_at,
      ai_messages (
        id,
        role,
        content,
        created_at
      )
    `)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const conversations = (data ?? []).map((conv: any) => {
    const messages = conv.ai_messages ?? [];

    return {
      id: conv.id,
      title: conv.title || "Nuova chat",
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      message_count: messages.length,
      last_message:
        messages.length > 0
          ? messages.sort(
              (a: any, b: any) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            )[0]?.content
          : null,
    };
  });

  return NextResponse.json({ conversations });
}

export async function POST(req: Request) {
  const user = await getUser(req);

  if (!user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { title } = await req.json();

  const { data, error } = await supabaseAdmin
    .from("ai_conversations")
    .insert({
      user_id: user.id,
      title: title || "Nuova chat",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversation: data });
}