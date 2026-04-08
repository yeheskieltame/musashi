import { NextRequest, NextResponse } from "next/server";
import { runAgentInfo } from "@/lib/musashi-cli";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const tokenId = Number(sp.get("tokenId") || "0");

  try {
    const result = await runAgentInfo(tokenId);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
