import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-session";
import { createServerDatabase } from "@/lib/supabase-server";

function database() {
  return createServerDatabase();
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (auth.response) return auth.response;
  const db = database();

  if (!db) {
    return NextResponse.json(
      { error: "Database is not connected." },
      { status: 503 },
    );
  }

  const { data, error } = await db
    .from("products")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ products: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (auth.response) return auth.response;
  const db = database();

  if (!db) {
    return NextResponse.json(
      { error: "Database is not connected." },
      { status: 503 },
    );
  }

  const body = await request.json();

  if (
    !body.sku ||
    !body.productModel ||
    !body.productType ||
    !body.description ||
    !body.brand
  ) {
    return NextResponse.json(
      { error: "Please complete all required product fields." },
      { status: 400 },
    );
  }

  const openingStock = Number(body.openingStock || 0);
  const parentProductId = body.parentProductId || null;

  if (parentProductId) {
    const { data: parent, error: parentError } = await db
      .from("products")
      .select("id,parent_product_id")
      .eq("id", parentProductId)
      .is("deleted_at", null)
      .maybeSingle();

    if (parentError || !parent || parent.parent_product_id) {
      return NextResponse.json(
        { error: "Please select a valid Parent SKU." },
        { status: 400 },
      );
    }
  }

  const { data, error } = await db
    .from("products")
    .insert({
      sku: body.sku.trim(),
      product_model: body.productModel.trim(),
      product_type: body.productType.trim(),
      description: body.description.trim(),
      brand: body.brand.trim(),
      cost_price: Number(body.costPrice || 0),
      selling_price: Number(body.sellingPrice || 0),
      opening_stock: openingStock,
      current_stock: openingStock,
      reserved_stock: 0,
      minimum_stock: Number(body.minimumStock || 0),
      parent_product_id: parentProductId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { product: data },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (auth.response) return auth.response;
  const db = database();

  if (!db) {
    return NextResponse.json(
      { error: "Database is not connected." },
      { status: 503 },
    );
  }

  const body = await request.json();
  const productId = body.productId;
  const parentProductId = body.parentProductId || null;

  if (!productId) {
    return NextResponse.json(
      { error: "Product is required." },
      { status: 400 },
    );
  }

  if (parentProductId === productId) {
    return NextResponse.json(
      { error: "A Product cannot use itself as its Parent SKU." },
      { status: 400 },
    );
  }

  if (parentProductId) {
    const { data: parent, error: parentError } = await db
      .from("products")
      .select("id,parent_product_id")
      .eq("id", parentProductId)
      .is("deleted_at", null)
      .maybeSingle();

    if (parentError || !parent || parent.parent_product_id) {
      return NextResponse.json(
        { error: "Please select a valid Parent SKU." },
        { status: 400 },
      );
    }
  }

  const { data, error } = await db
    .from("products")
    .update({ parent_product_id: parentProductId })
    .eq("id", productId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ product: data });
}
