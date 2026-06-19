import { NextResponse } from "next/server";
import { getWeatherStatus } from "@/lib/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const status = await getWeatherStatus();
  return NextResponse.json(status);
}
