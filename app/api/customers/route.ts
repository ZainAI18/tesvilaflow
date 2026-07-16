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
    .from("customers")
    .select(
      `
      id,
      customer_code,
      company_name,
      contact_person,
      contact_number,
      email,
      billing_address,
      delivery_address,
      credit_terms,
      created_at,
      updated_at
      `,
    )
    .is("deleted_at", null)
    .order("company_name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 },
    );
  }

  const databaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";

const databaseProject =
  databaseUrl.match(
    /https:\/\/([^.]+)\.supabase\.co/,
  )?.[1] || "unknown";

return NextResponse.json({
  databaseProject,
  customers: data ?? [],
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

  if (!body.companyName?.trim()) {
    return NextResponse.json(
      { error: "Company name is required." },
      { status: 400 },
    );
  }

  const customerCode =
    body.customerCode?.trim() ||
    `CUS-${Date.now().toString().slice(-8)}`;

  const { data, error } = await db
    .from("customers")
    .insert({
      customer_code: customerCode,
      company_name: body.companyName.trim(),
      contact_person: body.contactPerson?.trim() || null,
      contact_number: body.contactNumber?.trim() || null,
      email: body.email?.trim() || null,
      billing_address: body.billingAddress?.trim() || null,
      delivery_address: body.deliveryAddress?.trim() || null,
      credit_terms: body.creditTerms?.trim() || null,
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
    { customer: data },
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

  if (!body.id) {
    return NextResponse.json(
      { error: "Customer ID is required." },
      { status: 400 },
    );
  }

  if (!body.companyName?.trim()) {
    return NextResponse.json(
      { error: "Company name is required." },
      { status: 400 },
    );
  }

  const { data, error } = await db
    .from("customers")
    .update({
      customer_code: body.customerCode?.trim(),
      company_name: body.companyName.trim(),
      contact_person: body.contactPerson?.trim() || null,
      contact_number: body.contactNumber?.trim() || null,
      email: body.email?.trim() || null,
      billing_address: body.billingAddress?.trim() || null,
      delivery_address: body.deliveryAddress?.trim() || null,
      credit_terms: body.creditTerms?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({
    customer: data,
  });
}

export async function DELETE(request: NextRequest) {
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

  if (!body.id) {
    return NextResponse.json(
      { error: "Customer ID is required." },
      { status: 400 },
    );
  }

  const { error } = await db
    .from("customers")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
