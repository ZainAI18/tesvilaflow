/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-session";
import { createServerDatabase, REQUIRED_SUPABASE_PROJECT } from "@/lib/supabase-server";

function monthBounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) return null;
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  return { start, end, days: new Date(Date.UTC(year, monthNumber, 0)).getUTCDate() };
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, true);
  if (auth.response) return auth.response;
  try {
    const db = createServerDatabase();
    if (!db) return NextResponse.json({ error: "Database is not connected." }, { status: 503 });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const requestedMonth = request.nextUrl.searchParams.get("month") || currentMonth;
    const bounds = monthBounds(requestedMonth);
    if (!bounds) return NextResponse.json({ error: "Invalid month." }, { status: 400 });

    const [monthSource, invoiceSource, productSource] = await Promise.all([
      db.from("invoices").select("invoice_date").is("deleted_at", null).neq("status", "void").order("invoice_date", { ascending: false }),
      db
        .from("invoices")
        .select("id,invoice_date,subtotal,grand_total,balance,status,items:invoice_items(quantity,unit_price,unit_cost,discount_amount)")
        .is("deleted_at", null)
        .neq("status", "void")
        .gte("invoice_date", bounds.start)
        .lte("invoice_date", bounds.end)
        .order("invoice_date"),
      db.from("products").select("id,current_stock,minimum_stock").is("deleted_at", null),
    ]);

    const error = monthSource.error || invoiceSource.error || productSource.error;
    if (error) return NextResponse.json({ error: "Unable to load dashboard data." }, { status: 400 });

    const availableMonths = Array.from(
      new Set((monthSource.data || []).map((row) => String(row.invoice_date).slice(0, 7))),
    );
    if (!availableMonths.length) availableMonths.push(currentMonth);
    if (!availableMonths.includes(requestedMonth)) availableMonths.push(requestedMonth);
    availableMonths.sort().reverse();

    const daily = Array.from({ length: bounds.days }, (_, index) => ({
      day: index + 1,
      label: `${index + 1}`,
      sales: 0,
      costing: 0,
      profit: 0,
    }));

    let sales = 0;
    let costing = 0;
    let outstanding = 0;
    for (const invoice of invoiceSource.data || []) {
      const rows = (invoice.items || []) as any[];
      const invoiceSales = rows.length
        ? rows.reduce((sum, row) => sum + Number(row.quantity) * Number(row.unit_price) - Number(row.discount_amount || 0), 0)
        : Number(invoice.subtotal || 0);
      const invoiceCost = rows.reduce((sum, row) => sum + Number(row.quantity) * Number(row.unit_cost || 0), 0);
      const day = Number(String(invoice.invoice_date).slice(8, 10));
      sales += invoiceSales;
      costing += invoiceCost;
      if (invoice.status !== "paid") outstanding += Math.max(0, Number(invoice.balance || 0));
      if (daily[day - 1]) {
        daily[day - 1].sales += invoiceSales;
        daily[day - 1].costing += invoiceCost;
        daily[day - 1].profit += invoiceSales - invoiceCost;
      }
    }

    const grossProfit = sales - costing;
    const grossProfitPercentage = sales === 0 ? 0 : (grossProfit / sales) * 100;
    const lowStock = (productSource.data || []).filter(
      (product) => Number(product.current_stock) <= Number(product.minimum_stock),
    ).length;

    return NextResponse.json({
      databaseProject: REQUIRED_SUPABASE_PROJECT,
      selectedMonth: requestedMonth,
      availableMonths,
      summary: { sales, outstanding, costing, grossProfit, grossProfitPercentage, lowStock },
      daily,
    });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Supabase project")
      ? error.message
      : "Unable to load dashboard data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

