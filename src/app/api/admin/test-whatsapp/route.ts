import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/auth";
import { sendManualTestWhatsAppMessage } from "@/lib/test-send";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = authorizeAdminRequest(request);

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  try {
    const result = await sendManualTestWhatsAppMessage();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown WhatsApp test-send failure.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
