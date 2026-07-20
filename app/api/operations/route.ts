/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-session";
import { createServerDatabase } from "@/lib/supabase-server";

function database() {
  return createServerDatabase();
}

export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req, ["full", "warehouse"]);
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
        "id,sku,product_model,product_type,brand,opening_stock,current_stock,reserved_stock,minimum_stock,linked_stock_product_id",
      )
      .is("deleted_at", null)
      .order("product_model"),
    db
      .from("stock_movements")
      .select(
        "id,product_id,source_product_id,stock_product_id,source_sku,stock_sku,movement_type,quantity,quantity_before,quantity_after,balance_after,reference_type,reference_number,remarks,active,created_at,source_product:products!stock_movements_source_product_id_fkey(sku,product_model),stock_product:products!stock_movements_stock_product_id_fkey(sku,product_model),processed_by:users(full_name)",
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
  const productRows = products || [];
  const productById = new Map(productRows.map((product: any) => [product.id, product]));
  const inventoryProducts = productRows.map((product: any) => {
    const owner = product.linked_stock_product_id
      ? productById.get(product.linked_stock_product_id)
      : product;
    return {
      ...product,
      stock_owner_id: owner?.id || product.id,
      stock_owner_sku: owner?.sku || product.sku,
      stock_owner_model: owner?.product_model || product.product_model,
      effective_opening_stock: Number(owner?.opening_stock ?? product.opening_stock),
      effective_current_stock: Number(owner?.current_stock ?? product.current_stock),
      effective_reserved_stock: Number(owner?.reserved_stock ?? product.reserved_stock),
      effective_minimum_stock: Number(owner?.minimum_stock ?? product.minimum_stock),
    };
  });
  return NextResponse.json({
    products: inventoryProducts,
    movements,
    invoices: sales,
    start,
    end,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req, ["full", "warehouse"]);
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
