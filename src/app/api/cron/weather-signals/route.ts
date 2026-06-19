import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/auth";
import { runWeatherSignalCheck } from "@/lib/notifier";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = authorizeCronRequest(request);

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const result = await runWeatherSignalCheck("cron");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
