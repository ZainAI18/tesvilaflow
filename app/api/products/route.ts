import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth-session";
import { createServerDatabase } from "@/lib/supabase-server";
import { sortProductsByCodeAfterFirstT } from "@/lib/record-sorting";

function database() {
  return createServerDatabase();
}

type ProductRow = {
  id: string;
  sku: string;
  product_model: string;
  description: string;
  brand: string;
  current_stock: number;
  opening_stock: number;
  reserved_stock: number;
  minimum_stock: number;
  linked_stock_product_id: string | null;
  [key: string]: unknown;
};

function withStockOwners(rows: ProductRow[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return rows.map((row) => {
    const owner = row.linked_stock_product_id
      ? byId.get(row.linked_stock_product_id)
      : row;
    return {
      ...row,
      stock_owner: owner
        ? {
            id: owner.id,
            sku: owner.sku,
            product_model: owner.product_model,
            description: owner.description,
            brand: owner.brand,
          }
        : null,
      effective_opening_stock: Number(owner?.opening_stock ?? row.opening_stock),
      effective_current_stock: Number(owner?.current_stock ?? row.current_stock),
      effective_reserved_stock: Number(owner?.reserved_stock ?? row.reserved_stock),
      effective_minimum_stock: Number(owner?.minimum_stock ?? row.minimum_stock),
    };
  });
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
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({
    products: sortProductsByCodeAfterFirstT(
      withStockOwners((data || []) as ProductRow[]),
    ),
  });
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
  const linkedStockProductId = body.linkedStockProductId || null;

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

  if (linkedStockProductId) {
    const { data: stockProduct, error: stockProductError } = await db
      .from("products")
      .select("id,linked_stock_product_id")
      .eq("id", linkedStockProductId)
      .is("deleted_at", null)
      .maybeSingle();

    if (stockProductError || !stockProduct) {
      return NextResponse.json(
        { error: "Linked Stock Product was not found or is inactive." },
        { status: 400 },
      );
    }
    if (stockProduct.linked_stock_product_id) {
      return NextResponse.json(
        { error: "Please select a main stock product that is not linked to another product." },
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
      linked_stock_product_id: linkedStockProductId,
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
  const updates: Record<string, string | null> = {};
  const changingParent = Object.prototype.hasOwnProperty.call(body, "parentProductId");
  const changingStockLink = Object.prototype.hasOwnProperty.call(body, "linkedStockProductId");
  const parentProductId = body.parentProductId || null;
  const linkedStockProductId = body.linkedStockProductId || null;

  if (!productId) {
    return NextResponse.json(
      { error: "Product is required." },
      { status: 400 },
    );
  }

  if (!changingParent && !changingStockLink) {
    return NextResponse.json({ error: "No product change was supplied." }, { status: 400 });
  }

  if (changingParent && parentProductId === productId) {
    return NextResponse.json(
      { error: "A Product cannot use itself as its Parent SKU." },
      { status: 400 },
    );
  }

  if (changingParent && parentProductId) {
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

  if (changingParent) updates.parent_product_id = parentProductId;

  if (changingStockLink && linkedStockProductId === productId) {
    return NextResponse.json(
      { error: "A product cannot be linked to itself." },
      { status: 400 },
    );
  }

  if (changingStockLink && linkedStockProductId) {
    const [{ data: stockProduct, error: stockProductError }, { count: childCount, error: childError }] =
      await Promise.all([
        db
          .from("products")
          .select("id,linked_stock_product_id")
          .eq("id", linkedStockProductId)
          .is("deleted_at", null)
          .maybeSingle(),
        db
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("linked_stock_product_id", productId)
          .is("deleted_at", null),
      ]);

    if (stockProductError || !stockProduct) {
      return NextResponse.json(
        { error: "Linked Stock Product was not found or is inactive." },
        { status: 400 },
      );
    }
    if (stockProduct.linked_stock_product_id) {
      return NextResponse.json(
        { error: "Please select a main stock product that is not linked to another product." },
        { status: 400 },
      );
    }
    if (childError) {
      return NextResponse.json({ error: childError.message }, { status: 400 });
    }
    if ((childCount || 0) > 0) {
      return NextResponse.json(
        { error: "A main stock product used by linked products cannot itself be linked." },
        { status: 400 },
      );
    }
  }
  if (changingStockLink) updates.linked_stock_product_id = linkedStockProductId;

  const { data, error } = await db
    .from("products")
    .update(updates)
    .eq("id", productId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ product: data });
}
