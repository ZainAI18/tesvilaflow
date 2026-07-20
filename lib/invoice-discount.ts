const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function isValidDiscountPercent(value: unknown) {
  const percent = Number(value);
  return Number.isFinite(percent) &&
    percent >= 0 &&
    percent <= 100 &&
    Math.abs(percent - roundTo(percent, 2)) < 1e-9;
}

export function discountAmountFromPercent(
  quantity: number,
  unitPrice: number,
  discountPercent: number,
) {
  const lineSubtotal = Number(quantity) * Number(unitPrice);
  if (!Number.isFinite(lineSubtotal) || !isValidDiscountPercent(discountPercent)) return 0;
  return roundTo(lineSubtotal * Number(discountPercent) / 100, 2);
}

export function invoiceLineAmount(
  quantity: number,
  unitPrice: number,
  discountPercent = 0,
) {
  const lineSubtotal = Number(quantity) * Number(unitPrice);
  if (!Number.isFinite(lineSubtotal)) return 0;
  return roundTo(
    lineSubtotal - discountAmountFromPercent(quantity, unitPrice, discountPercent),
    2,
  );
}

type InvoiceDiscountItem = {
  quantity: number;
  unitPrice: number;
  discount?: number;
  discountAmount?: number;
  discountBasisQuantity?: number;
  discountBasisUnitPrice?: number;
};

function canUseSavedDiscountAmount(item: InvoiceDiscountItem) {
  return Number.isFinite(item.discountAmount) &&
    Number(item.quantity) === Number(item.discountBasisQuantity) &&
    Number(item.unitPrice) === Number(item.discountBasisUnitPrice) &&
    Number(item.discount || 0) === discountPercentFromAmount(
      Number(item.discountBasisQuantity),
      Number(item.discountBasisUnitPrice),
      Number(item.discountAmount),
    );
}

export function invoiceItemLineAmount(item: InvoiceDiscountItem) {
  if (canUseSavedDiscountAmount(item)) {
    return roundTo(
      Number(item.quantity) * Number(item.unitPrice) - Number(item.discountAmount),
      2,
    );
  }
  return invoiceLineAmount(item.quantity, item.unitPrice, item.discount || 0);
}

export function discountPercentFromAmount(
  quantity: number,
  unitPrice: number,
  discountAmount: number,
) {
  const lineSubtotal = Number(quantity) * Number(unitPrice);
  const amount = Number(discountAmount);
  if (!Number.isFinite(lineSubtotal) || lineSubtotal <= 0 || !Number.isFinite(amount)) return 0;
  return Math.min(100, Math.max(0, roundTo(amount / lineSubtotal * 100, 2)));
}

export function formatDiscountPercent(value: number) {
  return `${roundTo(Number(value) || 0, 2).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}%`;
}

type DiscountItem = {
  quantity?: unknown;
  unitPrice?: unknown;
  discount?: unknown;
  discountAmount?: unknown;
  discountBasisQuantity?: unknown;
  discountBasisUnitPrice?: unknown;
  [key: string]: unknown;
};

/** Converts the client percentage to the existing discount_amount RPC convention. */
export function withDiscountAmounts<T extends { items?: unknown }>(payload: T): T {
  if (!Array.isArray(payload.items)) return payload;
  return {
    ...payload,
    items: payload.items.map((rawItem, index) => {
      const item = rawItem as DiscountItem;
      if (!isValidDiscountPercent(item.discount ?? 0)) {
        throw new Error(`Item ${index + 1}: Discount must be between 0% and 100%.`);
      }
      const savedItem = {
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        discount: Number(item.discount || 0),
        discountAmount: Number(item.discountAmount),
        discountBasisQuantity: Number(item.discountBasisQuantity),
        discountBasisUnitPrice: Number(item.discountBasisUnitPrice),
      };
      return {
        ...item,
        discount: canUseSavedDiscountAmount(savedItem)
          ? Number(item.discountAmount)
          : discountAmountFromPercent(
              Number(item.quantity || 0),
              Number(item.unitPrice || 0),
              Number(item.discount || 0),
            ),
      };
    }),
  } as T;
}
