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
  const [
    { data: invoiceRows, error: invoiceError },
    { data: doRows, error: doError },
  ] = await Promise.all([
    db
      .from("invoices")
      .select(
        "id,invoice_number,invoice_date,customer_id,customer_company_name,customer_contact_person,customer_contact_number,billing_address,delivery_address,issued_by_user_id,issued_by_display_name,po_number,gst_rate,deposit,payment_method,remarks,status,created_at,customer:customers(company_name,billing_address,delivery_address,contact_person,contact_number),items:invoice_items(id,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,unit_cost,discount_amount,remarks),delivery_order:delivery_orders(id,do_number)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    db
      .from("delivery_orders")
      .select(
        "id,do_number,delivery_date,customer_id,customer_company_name,customer_contact_person,customer_contact_number,billing_address,delivery_address,issued_by_user_id,issued_by_display_name,contact_person,contact_number,remarks,status,created_at,invoice:invoices(id,invoice_number),customer:customers(company_name,billing_address,delivery_address,contact_person,contact_number),items:delivery_order_items(id,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,remarks)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (invoiceError || doError)
    return NextResponse.json(
      { error: invoiceError?.message || doError?.message },
      { status: 400 },
    );
  const customer = (row: any) => ({
    customerId: row.customer_id || undefined,
    name: row.customer_company_name || row.customer?.company_name || "",
    billingAddress: row.billing_address || row.customer?.billing_address || "",
    deliveryAddress: row.delivery_address || row.customer?.delivery_address || "",
    attention: row.customer_contact_person || row.customer?.contact_person || "",
    phone: row.customer_contact_number || row.customer?.contact_number || "",
  });
  const items = (rows: any[] = []) =>
    rows.map((x) => ({
      id: x.id,
      productId: x.product_id || "",
      model: x.product_model,
      sku: x.sku,
      type: x.product_type,
      description: x.description,
      brand: x.brand,
      quantity: Number(x.quantity),
      unitPrice: Number(x.unit_price),
      unitCost: Number(x.unit_cost || 0),
      discount: Number(x.discount_amount || 0),
      remarks: x.remarks || "",
    }));
  const invoices = (invoiceRows || []).map((x: any) => ({
    id: x.id,
    invoiceNumber: x.invoice_number,
    invoiceDate: x.invoice_date,
    customer: customer(x),
    doNumber: x.delivery_order?.[0]?.do_number || "—",
    doId: x.delivery_order?.[0]?.id || "",
    poNumber: x.po_number || "",
    items: items(x.items),
    gstRate: Number(x.gst_rate),
    deposit: Number(x.deposit),
    paymentStatus: String(x.status)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    paymentMethod: x.payment_method || "",
    collectionMethod: "Delivery by Tesvila",
    installationOption: "Supply only",
    remarks: x.remarks || "",
    createdBy: x.issued_by_display_name || "Tesvila User",
    issuedByUserId: x.issued_by_user_id || undefined,
    createdAt: x.created_at,
  }));
  const deliveryOrders = (doRows || []).map((x: any) => ({
    id: x.id,
    doNumber: x.do_number,
    deliveryDate: x.delivery_date,
    customer: customer(x),
    invoiceNumber: x.invoice?.invoice_number || "—",
    invoiceId: x.invoice?.id,
    deliveryAddress: x.delivery_address,
    deliveryContact: x.contact_person || "",
    deliveryPhone: x.contact_number || "",
    items: items(x.items),
    status: String(x.status)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    remarks: x.remarks || "",
    createdBy: x.issued_by_display_name || "Tesvila User",
    issuedByUserId: x.issued_by_user_id || undefined,
    createdAt: x.created_at,
  }));
  return NextResponse.json({ invoices, deliveryOrders });
}
export async function POST(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.response) return auth.response;
  const db = database();
  if (!db)
    return NextResponse.json(
      {
        error:
          "Database is not connected. Add the Supabase URL and service key before saving documents.",
      },
      { status: 503 },
    );
  const body = await req.json();
  if (!["invoice_with_do", "delivery_order"].includes(body.type))
    return NextResponse.json(
      { error: "Unknown document type" },
      { status: 400 },
    );
  const fn =
    body.type === "invoice_with_do"
      ? "create_invoice_with_do"
      : "create_delivery_order_only";
  const payload = {
    ...body,
    issuedByUserId: auth.session.userId,
    issuedByDisplayName: auth.session.displayName,
  };
  const { data, error } = await db.rpc(fn, { p_payload: payload });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
export async function PATCH(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.response) return auth.response;
  const db = database();
  if (!db)
    return NextResponse.json(
      { error: "Database is not connected." },
      { status: 503 },
    );
  const body = await req.json();
  const fn =
    body.type === "invoice"
      ? "update_invoice_document"
      : body.type === "delivery_order"
        ? "update_delivery_order_document"
        : null;
  if (!fn)
    return NextResponse.json(
      { error: "Unknown document type" },
      { status: 400 },
    );
  const { error } = await db.rpc(fn, {
    p_id: body.record.id,
    p_payload: {
      ...body.record,
      updatedByUserId: auth.session.userId,
      updatedByDisplayName: auth.session.displayName,
    },
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
export async function DELETE(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.response) return auth.response;
  const db = database();
  if (!db)
    return NextResponse.json(
      { error: "Database is not connected." },
      { status: 503 },
    );
  const body = await req.json();
  if (!["invoice", "delivery_order"].includes(body.type))
    return NextResponse.json(
      { error: "Unknown document type" },
      { status: 400 },
    );
  const { error } = await db.rpc("soft_delete_document", {
    p_type: body.type,
    p_id: body.id,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
