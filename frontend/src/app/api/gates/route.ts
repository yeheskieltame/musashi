import { NextRequest, NextResponse } from "next/server";
import { runGates } from "@/lib/musashi-cli";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const token = sp.get("token");
  const chain = Number(sp.get("chain") || "1");

  if (!token) {
    return NextResponse.json({ error: "token parameter required" }, { status: 400 });
  }

  try {
    const result = await runGates(token, chain);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
