import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "Outlook callback disabilitata" },
    { status: 410 }
  );
}