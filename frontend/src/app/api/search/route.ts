import { NextRequest, NextResponse } from "next/server";
import { runSearch } from "@/lib/musashi-cli";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q");
  const limit = Number(sp.get("limit") || "5");

  if (!q) {
    return NextResponse.json({ error: "q parameter required" }, { status: 400 });
  }

  try {
    const result = await runSearch(q, limit);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
