import { NextRequest, NextResponse } from "next/server";
import { runScan } from "@/lib/musashi-cli";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const chain = Number(sp.get("chain") || "0");
  const limit = Number(sp.get("limit") || "10");
  const gates = sp.get("gates") === "true";

  try {
    const result = await runScan(chain, limit, gates);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
