import { NextResponse } from "next/server";
import { calculateInvoiceItem } from "@/lib/costing";
import type { InvoiceItemInput } from "@/types/business";

export async function POST(request: Request) {
  const input = (await request.json()) as InvoiceItemInput;
  return NextResponse.json(calculateInvoiceItem(input));
}
