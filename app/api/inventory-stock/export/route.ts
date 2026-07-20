import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-session";
import { loadStockListReport } from "@/lib/stock-list-report";
import { buildStockListWorkbook } from "@/lib/stock-list-workbook";
import { createServerDatabase } from "@/lib/supabase-server";

export const runtime = "nodejs";

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
    const { buffer, filename } = await buildStockListWorkbook(report);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Stock List export failed.",
      },
      { status: 400 },
    );
  }
}
