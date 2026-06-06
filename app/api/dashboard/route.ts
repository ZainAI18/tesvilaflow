import { NextResponse } from "next/server";
import { invoicePreviewSummary, products, stockMovements } from "@/lib/demo-data";

export async function GET() {
  const inventoryValue = products.reduce((sum, product) => sum + product.stock * product.wac, 0);

  return NextResponse.json({
    inventoryValue,
    todaySales: invoicePreviewSummary.totalAmount,
    monthlyCost: invoicePreviewItemsCost(),
    grossProfit: invoicePreviewSummary.grossProfit,
    lowStock: products.filter((product) => product.stock <= 12),
    recentMovements: stockMovements
  });
}

function invoicePreviewItemsCost() {
  return invoicePreviewSummary.subtotal - invoicePreviewSummary.grossProfit;
}
