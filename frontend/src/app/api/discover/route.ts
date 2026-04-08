import { NextRequest, NextResponse } from "next/server";
import { runDiscover } from "@/lib/musashi-cli";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const chain = Number(sp.get("chain") || "1");
  const limit = Number(sp.get("limit") || "20");

  try {
    const result = await runDiscover(chain, limit);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
