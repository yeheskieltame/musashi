import { NextRequest, NextResponse } from "next/server";
import { runStatus } from "@/lib/musashi-cli";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const perAgent = sp.get("perAgent") === "true";
  const agentId = Number(sp.get("agentId") || "0");

  try {
    const result = await runStatus(perAgent, agentId);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
