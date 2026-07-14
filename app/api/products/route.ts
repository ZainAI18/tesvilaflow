import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function database() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET() {
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
