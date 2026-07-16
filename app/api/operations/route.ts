/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-session";
import { createServerDatabase } from "@/lib/supabase-server";

function database() {
  return createServerDatabase();
}

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.response) return auth.response;
  const db = database();
  if (!db)
    return NextResponse.json(
      { error: "Database is not connected." },
      { status: 503 },
    );
  const start =
    req.nextUrl.searchParams.get("start") ||
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  const end =
    req.nextUrl.searchParams.get("end") ||
    new Date().toISOString().slice(0, 10);

  const [
    { data: products, error: productError },
    { data: movements, error: movementError },
    { data: invoices, error: invoiceError },
  ] = await Promise.all([
    db
      .from("products")
      .select(
        "id,sku,product_model,product_type,brand,opening_stock,current_stock,reserved_stock,minimum_stock",
      )
      .is("deleted_at", null)
      .order("product_model"),
    db
      .from("stock_movements")
      .select(
        "id,product_id,movement_type,quantity,quantity_before,quantity_after,balance_after,reference_type,reference_number,remarks,active,created_at,product:products(sku,product_model),processed_by:users(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    db
      .from("invoices")
      .select(
        "id,invoice_number,invoice_date,customer_company_name,subtotal,gst_amount,grand_total,status,customer:customers(company_name),items:invoice_items(quantity,unit_price,unit_cost,discount_amount,product:products(id,sku,product_model,product_type))",
      )
      .is("deleted_at", null)
      .gte("invoice_date", start)
      .lte("invoice_date", end)
      .neq("status", "void")
      .order("invoice_date"),
  ]);
  const error = productError || movementError || invoiceError;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

  const sales = (invoices || []).map((invoice: any) => {
    const rows = invoice.items || [];
    const netSales = rows.reduce(
      (sum: number, row: any) =>
        sum +
        Number(row.quantity) * Number(row.unit_price) -
        Number(row.discount_amount || 0),
      0,
    );
    const cost = rows.reduce(
      (sum: number, row: any) =>
        sum + Number(row.quantity) * Number(row.unit_cost || 0),
      0,
    );
    return {
      ...invoice,
      customer: { company_name: invoice.customer_company_name || invoice.customer?.company_name || "" },
      net_sales: netSales,
      cost,
      gross_profit: netSales - cost,
    };
  });
  return NextResponse.json({
    products,
    movements,
    invoices: sales,
    start,
    end,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.response) return auth.response;
  const db = database();
  if (!db)
    return NextResponse.json(
      { error: "Database is not connected." },
      { status: 503 },
    );
  const body = await req.json();
  const { data, error } = await db.rpc("record_stock_movement", {
    p_product_id: body.productId,
    p_movement_type: body.movementType,
    p_quantity: Number(body.quantity),
    p_reference_number: body.referenceNumber || null,
    p_remarks: body.remarks || null,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
