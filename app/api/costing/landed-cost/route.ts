import { NextResponse } from "next/server";
import { calculateLandedCost } from "@/lib/costing";
import type { LandedCostInput } from "@/types/business";

export async function POST(request: Request) {
  const input = (await request.json()) as LandedCostInput;
  return NextResponse.json(calculateLandedCost(input));
}
