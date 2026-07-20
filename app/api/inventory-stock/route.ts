import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-session";
import { loadStockListReport } from "@/lib/stock-list-report";
import { createServerDatabase } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req, ["full", "warehouse"]);
  if (auth.response) return auth.response;
  const db = createServerDatabase();
  if (!db) {
    return NextResponse.json({ error: "Database is not connected." }, { status: 503 });
  }
  try {
    const report = await loadStockListReport(
      db,
      req.nextUrl.searchParams.get("period") || undefined,
    );
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Inventory Stock.",
      },
      { status: 400 },
    );
  }
}
