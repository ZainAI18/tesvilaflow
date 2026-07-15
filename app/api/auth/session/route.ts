import { NextRequest, NextResponse } from "next/server";
import { readRequestSession } from "@/lib/auth-session";

export async function GET(request: NextRequest) {
  const session = await readRequestSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ username: session.username, access: session.access });
}

