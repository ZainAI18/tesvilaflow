import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-session";
import { loadSalesReport } from "@/lib/sales-report";
import { buildSalesReportWorkbook } from "@/lib/sales-report-workbook";
import { createServerDatabase } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req, ["full"]);
  if (auth.response) return auth.response;
  const db = createServerDatabase();
  if (!db)
    return NextResponse.json(
      { error: "Database is not connected." },
      { status: 503 },
    );
  try {
    const report = await loadSalesReport(db, {
      start: req.nextUrl.searchParams.get("start") || undefined,
      end: req.nextUrl.searchParams.get("end") || undefined,
      productId: req.nextUrl.searchParams.get("productId") || "all",
      customerKey: req.nextUrl.searchParams.get("customerKey") || "all",
    });
    const { buffer, filename } = await buildSalesReportWorkbook(report);
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
      { error: error instanceof Error ? error.message : "Excel export failed." },
      { status: 400 },
    );
  }
}
