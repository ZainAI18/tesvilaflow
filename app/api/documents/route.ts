/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-session";
import { createServerDatabase } from "@/lib/supabase-server";
import {
  discountPercentFromAmount,
  withDiscountAmounts,
} from "@/lib/invoice-discount";
import { inferGstMode, isGstMode } from "@/lib/invoice-totals";

function database() {
  return createServerDatabase();
}

const parentSkuMessage =
  "This Invoice contains a Parent SKU. Parent SKUs can only be saved using ‘Save Invoice Only’. Create the Delivery Order later from the Delivery Order Only page and select the related Child SKU.";

async function parentProductsInPayload(
  db: NonNullable<ReturnType<typeof database>>,
  payload: Record<string, unknown>,
) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const productIds = Array.from(
    new Set(
      items
        .map((item) =>
          item && typeof item === "object" && "productId" in item
            ? String(item.productId || "")
            : "",
        )
        .filter(Boolean),
    ),
  );
  if (!productIds.length) return [];
  const { data, error } = await db
    .from("products")
    .select("parent_product_id")
    .in("parent_product_id", productIds)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  const parentIds = new Set((data || []).map((product) => product.parent_product_id));
  return items.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      "productId" in item &&
      parentIds.has(String(item.productId || "")),
  );
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
        "id,invoice_number,invoice_date,invoice_title,customer_id,customer_company_name,customer_contact_person,customer_contact_number,billing_address,delivery_address,issued_by_user_id,issued_by_display_name,po_number,gst_mode,gst_rate,subtotal,gst_amount,grand_total,deposit,balance,item_collect_method,payment_method,remarks,status,created_at,customer:customers(company_name,billing_address,delivery_address,contact_person,contact_number),items:invoice_items(id,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,unit_cost,discount_amount,remarks),related_delivery_orders:delivery_orders(id,do_number,delivery_date,status,deleted_at,items:delivery_order_items(invoice_item_id,quantity))",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    db
      .from("delivery_orders")
      .select(
        "id,do_number,delivery_date,customer_id,invoice_id,invoice_number,customer_company_name,customer_contact_person,customer_contact_number,billing_address,delivery_address,delivery_contact_person,delivery_contact_number,issued_by_user_id,issued_by_display_name,item_collect_method,contact_person,contact_number,remarks,status,created_at,invoice:invoices(id,invoice_number),customer:customers(company_name,billing_address,delivery_address,contact_person,contact_number),items:delivery_order_items(id,invoice_item_id,item_source,product_id,product_model,sku,product_type,description,brand,quantity,unit_price,remarks)",
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
  const items = (
    rows: any[] = [],
    deliveryItems = false,
    invoiceDiscounts = false,
  ) =>
    rows.map((x) => ({
      id: x.id,
      invoiceItemId: x.invoice_item_id || undefined,
      itemSource: deliveryItems
        ? x.item_source || (x.invoice_item_id ? "invoice" : "extra")
        : undefined,
      productId: x.product_id || "",
      model: x.product_model,
      sku: x.sku,
      type: x.product_type,
      description: x.description,
      brand: x.brand,
      quantity: Number(x.quantity),
      unitPrice: Number(x.unit_price),
      unitCost: Number(x.unit_cost || 0),
      discount: invoiceDiscounts
        ? discountPercentFromAmount(
            Number(x.quantity),
            Number(x.unit_price),
            Number(x.discount_amount || 0),
          )
        : 0,
      discountAmount: invoiceDiscounts ? Number(x.discount_amount || 0) : undefined,
      discountBasisQuantity: invoiceDiscounts ? Number(x.quantity) : undefined,
      discountBasisUnitPrice: invoiceDiscounts ? Number(x.unit_price) : undefined,
      remarks: x.remarks || "",
    }));
  const invoices = (invoiceRows || []).map((x: any) => {
    const related = (x.related_delivery_orders || []).filter(
      (order: any) => !order.deleted_at && order.status !== "cancelled",
    );
    const deliveredByInvoiceItem = new Map<string, number>();
    const deliveryOrdersByInvoiceItem = new Map<string, Set<string>>();
    related.forEach((order: any) =>
      (order.items || []).forEach((item: any) => {
        if (!item.invoice_item_id) return;
        deliveredByInvoiceItem.set(
          item.invoice_item_id,
          (deliveredByInvoiceItem.get(item.invoice_item_id) || 0) + Number(item.quantity),
        );
        const numbers = deliveryOrdersByInvoiceItem.get(item.invoice_item_id) || new Set<string>();
        numbers.add(order.do_number);
        deliveryOrdersByInvoiceItem.set(item.invoice_item_id, numbers);
      }),
    );
    const invoiceItems = items(x.items, false, true).map((item: any) => ({
      ...item,
      invoiceQuantity: item.quantity,
      previouslyDeliveredQuantity: deliveredByInvoiceItem.get(item.id) || 0,
      remainingQuantity: Math.max(
        0,
        item.quantity - (deliveredByInvoiceItem.get(item.id) || 0),
      ),
      relatedDeliveryOrderNumbers: Array.from(deliveryOrdersByInvoiceItem.get(item.id) || []),
    }));
    const deliveredQuantity = invoiceItems.reduce(
      (sum: number, item: any) => sum + item.previouslyDeliveredQuantity,
      0,
    );
    const deliveryStatus = deliveredQuantity === 0
      ? "Not Delivered"
      : invoiceItems.every((item: any) => item.remainingQuantity <= 0)
        ? "Fully Delivered"
        : "Partially Delivered";
    const relatedDeliveryOrders = related.map((order: any) => ({
      id: order.id,
      doNumber: order.do_number,
      deliveryDate: order.delivery_date,
      deliveredQuantity: (order.items || []).reduce(
        (sum: number, item: any) => sum + Number(item.quantity),
        0,
      ),
      status: String(order.status)
        .replaceAll("_", " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    }));
    return {
    id: x.id,
    invoiceNumber: x.invoice_number,
    invoiceDate: x.invoice_date,
    customer: customer(x),
    doNumber: relatedDeliveryOrders.map((order: any) => order.doNumber).join(", ") || "—",
    doId: relatedDeliveryOrders[0]?.id || "",
    relatedDeliveryOrders,
    deliveryStatus,
    poNumber: x.po_number || "",
    items: invoiceItems,
    gstMode: inferGstMode(x.gst_mode, {
      gstRate: x.gst_rate,
      subtotal: x.subtotal,
      gstAmount: x.gst_amount,
      grandTotal: x.grand_total,
    }),
    gstRate: Number(x.gst_rate),
    subtotal: x.subtotal == null ? undefined : Number(x.subtotal),
    gstAmount: x.gst_amount == null ? undefined : Number(x.gst_amount),
    grandTotal: x.grand_total == null ? undefined : Number(x.grand_total),
    deposit: Number(x.deposit),
    balance: x.balance == null ? undefined : Number(x.balance),
    paymentStatus: String(x.status)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    paymentMethod: ["paynow", "cash", "terms"].includes(x.payment_method) ? x.payment_method : "",
    itemCollectMethod: x.item_collect_method || "",
    collectionMethod: "Delivery by Tesvila",
    installationOption: "Supply only",
    remarks: x.remarks || "",
    titleOfInvoice: x.invoice_title || "Supply Sanitary Ware",
    createdBy: x.issued_by_display_name || "Tesvila User",
    issuedByUserId: x.issued_by_user_id || undefined,
    createdAt: x.created_at,
  };
  });
  const deliveryOrders = (doRows || []).map((x: any) => ({
    id: x.id,
    doNumber: x.do_number,
    deliveryDate: x.delivery_date,
    customer: customer(x),
    invoiceNumber: x.invoice_number || x.invoice?.invoice_number || "—",
    invoiceId: x.invoice_id || x.invoice?.id || undefined,
    deliveryAddress: x.delivery_address,
    deliveryContact: x.delivery_contact_person || "",
    deliveryPhone: x.delivery_contact_number || "",
    itemCollectMethod: x.item_collect_method || "",
    items: items(x.items, true),
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
  if (!["invoice_with_do", "invoice_only", "delivery_order"].includes(body.type))
    return NextResponse.json(
      { error: "Unknown document type" },
      { status: 400 },
    );
  try {
    const parents = await parentProductsInPayload(db, body);
    if (body.type === "invoice_with_do" && parents.length) {
      return NextResponse.json({ error: parentSkuMessage }, { status: 400 });
    }
    if (body.type === "delivery_order" && parents.length) {
      return NextResponse.json(
        { error: "Parent SKUs cannot be used in a Delivery Order. Select a valid Child SKU or normal Product SKU." },
        { status: 400 },
      );
    }
  } catch (validationError) {
    return NextResponse.json(
      { error: validationError instanceof Error ? validationError.message : "Unable to validate Parent SKU items." },
      { status: 400 },
    );
  }
  const fn =
    body.type === "invoice_with_do"
      ? "create_invoice_with_do_v11"
      : body.type === "invoice_only"
        ? "create_invoice_only_v9"
        : "create_delivery_order_only_v10";
  const clientPayload = {
    ...body,
    issuedByUserId: auth.session.userId,
    issuedByDisplayName: auth.session.displayName,
  };
  let payload = clientPayload;
  if (body.type === "invoice_with_do" || body.type === "invoice_only") {
    try {
      const discountedPayload = withDiscountAmounts(clientPayload);
      if (discountedPayload.gstMode !== undefined && !isGstMode(discountedPayload.gstMode))
        throw new Error("Please select a valid GST option.");
      const gstMode = inferGstMode(discountedPayload.gstMode, discountedPayload);
      payload = {
        ...discountedPayload,
        gstMode,
        gstRate: gstMode === "gst_9" ? 9 : 0,
      };
    } catch (discountError) {
      return NextResponse.json(
        { error: discountError instanceof Error ? discountError.message : "Invalid Invoice discount." },
        { status: 400 },
      );
    }
  }
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
  if (body.type === "delivery_order") {
    try {
      const parents = await parentProductsInPayload(db, body.record || {});
      if (parents.length) {
        return NextResponse.json(
          { error: "Parent SKUs cannot be used in a Delivery Order. Select a valid Child SKU or normal Product SKU." },
          { status: 400 },
        );
      }
    } catch (validationError) {
      return NextResponse.json(
        { error: validationError instanceof Error ? validationError.message : "Unable to validate Parent SKU items." },
        { status: 400 },
      );
    }
  }
  const fn =
    body.type === "invoice"
      ? "update_invoice_document_v9"
      : body.type === "delivery_order"
        ? "update_delivery_order_document_v10"
        : null;
  if (!fn)
    return NextResponse.json(
      { error: "Unknown document type" },
      { status: 400 },
    );
  let record = body.record;
  if (body.type === "invoice") {
    try {
      const discountedRecord = withDiscountAmounts(body.record);
      if (discountedRecord.gstMode !== undefined && !isGstMode(discountedRecord.gstMode))
        throw new Error("Please select a valid GST option.");
      const gstMode = inferGstMode(discountedRecord.gstMode, discountedRecord);
      record = {
        ...discountedRecord,
        gstMode,
        gstRate: gstMode === "gst_9" ? 9 : 0,
      };
    } catch (discountError) {
      return NextResponse.json(
        { error: discountError instanceof Error ? discountError.message : "Invalid Invoice discount." },
        { status: 400 },
      );
    }
  }
  const { error } = await db.rpc(fn, {
    p_id: body.record.id,
    p_payload: {
      ...record,
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
  if (body.type === "invoice") {
    const { data, error } = await db.rpc("delete_invoice_with_dependencies", {
      p_invoice_id: body.id,
      p_deleted_by: auth.session.userId,
    });
    if (error)
      return NextResponse.json(
        {
          error:
            "Unable to delete the Invoice and its related records. No changes were completed.",
        },
        { status: 400 },
      );
    return NextResponse.json(data || { ok: true });
  }

  const { error } = await db.rpc("soft_delete_document", {
    p_type: body.type,
    p_id: body.id,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
