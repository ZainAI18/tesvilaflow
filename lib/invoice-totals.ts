import { invoiceItemLineAmount } from "./invoice-discount";

export const GST_MODES = ["gst_9", "included"] as const;
export type GstMode = (typeof GST_MODES)[number];

type InvoiceTotalItem = Parameters<typeof invoiceItemLineAmount>[0];

const roundCurrency = (value: number) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function isGstMode(value: unknown): value is GstMode {
  return GST_MODES.includes(value as GstMode);
}

export function inferGstMode(
  value: unknown,
  saved?: {
    gstRate?: unknown;
    subtotal?: unknown;
    gstAmount?: unknown;
    grandTotal?: unknown;
  },
): GstMode {
  if (isGstMode(value)) return value;
  const gstRate = Number(saved?.gstRate);
  const subtotal = Number(saved?.subtotal);
  const gstAmount = Number(saved?.gstAmount);
  const grandTotal = Number(saved?.grandTotal);
  if (
    gstRate === 0 ||
    (Number.isFinite(subtotal) &&
      Number.isFinite(gstAmount) &&
      Number.isFinite(grandTotal) &&
      gstAmount === 0 &&
      Math.abs(grandTotal - subtotal) < 0.005)
  ) {
    return "included";
  }
  return "gst_9";
}

export function gstModeLabel(mode: GstMode) {
  return mode === "included" ? "GST Included" : "GST 9%";
}

export function calculateInvoiceTotals(
  items: InvoiceTotalItem[],
  gstMode: GstMode,
) {
  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + invoiceItemLineAmount(item), 0),
  );
  const gstAmount = gstMode === "gst_9" ? roundCurrency(subtotal * 0.09) : 0;
  return {
    subtotal,
    gstRate: gstMode === "gst_9" ? 9 : 0,
    gstAmount,
    grandTotal: roundCurrency(subtotal + gstAmount),
  };
}
