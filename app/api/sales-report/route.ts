import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-session";
import { loadSalesReport } from "@/lib/sales-report";
import { createServerDatabase } from "@/lib/supabase-server";

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
    const data = await loadSalesReport(db, {
      start: req.nextUrl.searchParams.get("start") || undefined,
      end: req.nextUrl.searchParams.get("end") || undefined,
      productId: req.nextUrl.searchParams.get("productId") || "all",
      customerKey: req.nextUrl.searchParams.get("customerKey") || "all",
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load sales report." },
      { status: 400 },
    );
  }
}
